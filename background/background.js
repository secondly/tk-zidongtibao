// 添加停止执行功能
let isExecutionStopped = false;
let isExecutionPaused = false;
let currentExecutionTabId = null;

// 全局停止检查函数
async function checkExecutionControl(context = "未知位置") {
  // 强化停止检查
  if (isExecutionStopped) {
    console.log(`🛑 [执行控制] 在 ${context} 检测到停止信号，终止执行`);
    throw new Error("操作已被用户手动停止");
  }

  // 强化暂停检查
  while (isExecutionPaused && !isExecutionStopped) {
    console.log(`⏸️ [执行控制] 在 ${context} 检测到暂停信号，等待恢复...`);

    // 通知暂停状态
    notifyExecutionStatusChange({
      isRunning: true,
      isPaused: true,
      message: `⏸️ 执行已暂停 (位置: ${context})`
    });

    await sleep(500);
  }

  // 暂停恢复后再次检查停止状态
  if (isExecutionStopped) {
    console.log(`🛑 [执行控制] 在 ${context} 暂停恢复后检测到停止信号，终止执行`);
    throw new Error("操作已被用户手动停止");
  }
}

// 窗口管理相关变量
let windowManager = null;
let mainWindowId = null;
let windowStack = [];
let windowCreationPromises = new Map();

// 监听来自弹出界面的消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log(`📡 [Background-DEBUG] 收到消息:`, {
    action: request.action,
    sender: sender,
    hasData: !!request.data,
    dataKeys: request.data ? Object.keys(request.data) : []
  });
  // 处理浮层控制面板的转发请求
  if (request.action === "forwardToContentScript") {
    console.log(`📡 Background收到转发请求: ${request.targetAction}`, request.targetData);

    // 获取当前活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // 先检查content script是否存在
        chrome.tabs.sendMessage(tabs[0].id, { action: "ping" })
          .then(() => {
            // content script存在，转发消息
            return chrome.tabs.sendMessage(tabs[0].id, {
              action: request.targetAction,
              data: request.targetData
            });
          })
          .then(response => {
            console.log(`✅ 消息已转发到content script:`, response);
            sendResponse({ success: true, response: response });
          })
          .catch(error => {
            console.error(`❌ 转发到content script失败:`, error);

            // 如果是连接问题，尝试注入content script
            if (error.message.includes('Could not establish connection') ||
              error.message.includes('Receiving end does not exist')) {
              console.log(`🔄 尝试注入content script后重试...`);

              injectContentScript(tabs[0].id)
                .then(() => {
                  // 等待脚本加载
                  return new Promise(resolve => setTimeout(resolve, 1000));
                })
                .then(() => {
                  // 重新发送消息
                  return chrome.tabs.sendMessage(tabs[0].id, {
                    action: request.targetAction,
                    data: request.targetData
                  });
                })
                .then(response => {
                  console.log(`✅ 重试后消息已转发:`, response);
                  sendResponse({ success: true, response: response });
                })
                .catch(retryError => {
                  console.error(`❌ 重试后仍然失败:`, retryError);
                  sendResponse({ success: false, error: retryError.message });
                });
            } else {
              sendResponse({ success: false, error: error.message });
            }
          });
      } else {
        sendResponse({ success: false, error: '没有找到活动标签页' });
      }
    });

    return true; // 保持消息通道开放
  }

  // 处理工作流执行请求
  if (request.action === "executeWorkflow") {
    console.log("🪟 [Background-DEBUG] 收到executeWorkflow请求:", request.data?.name);
    console.log("🪟 [Background-DEBUG] 请求来源:", sender);
    console.log("🪟 [Background-DEBUG] 工作流详情:", request.data);

    // 提取步骤数据
    const steps = request.data?.steps || [];
    console.log("🪟 [Background-DEBUG] 步骤数量:", steps.length);
    console.log("🪟 [Background-DEBUG] 步骤详情:", steps.map(s => ({ name: s.name, type: s.type, opensNewWindow: s.opensNewWindow })));

    // 检查是否有循环步骤
    const loopSteps = steps.filter(step => step.type === 'loop' || step.action === 'loop');
    if (loopSteps.length > 0) {
      console.log("🔄 [Background-DEBUG] 发现循环步骤:", loopSteps.length, "个");
      loopSteps.forEach((step, index) => {
        console.log(`🔄 [Background-DEBUG] 循环步骤${index + 1}:`, {
          name: step.name,
          startIndex: step.startIndex,
          endIndex: step.endIndex,
          maxIterations: step.maxIterations,
          loopType: step.loopType
        });
      });
    }

    // 重置停止和暂停标志
    isExecutionStopped = false;
    isExecutionPaused = false;
    // 通知所有标签页执行已开始
    notifyExecutionStatusChange({
      isRunning: true,
      isPaused: false,
      message: `开始执行工作流: ${request.data?.name || '未命名工作流'}`
    });

    // 执行工作流步骤
    handleStepsExecution(steps)
      .then((result) => {
        console.log("🪟 Background执行完成:", result);
        sendResponse({ success: true, result: result });
      })
      .catch((error) => {
        console.error("🪟 Background执行失败:", error);
        sendResponse({ success: false, error: error.message });

        // 通知执行失败
        notifyExecutionStatusChange({
          isRunning: false,
          isPaused: false,
          message: `执行失败: ${error.message}`
        });
      });

    return true; // 保持消息通道开放
  }

  if (request.action === "executeSteps") {
    console.log("🪟 Background收到executeSteps请求，步骤数量:", request.steps?.length);
    console.log("🪟 步骤详情:", request.steps?.map(s => ({ name: s.name, type: s.type, opensNewWindow: s.opensNewWindow })));

    // 重置停止和暂停标志
    isExecutionStopped = false;
    isExecutionPaused = false;

    // 通知所有标签页执行已开始
    notifyExecutionStatusChange({
      isRunning: true,
      isPaused: false,
      message: "开始执行步骤"
    });

    handleStepsExecution(request.steps)
      .then((result) => {
        console.log("🪟 Background执行完成:", result);
        sendResponse({ success: true, result: result });
      })
      .catch((error) => {
        console.error("🪟 Background执行失败:", error);
        sendResponse({ success: false, error: error.message });

        // 通知执行失败
        try {
          chrome.runtime
            .sendMessage({
              action: "executionError",
              message: error.message,
            })
            .catch((err) => console.error("发送错误结果时出错:", err));
        } catch (sendError) {
          console.error("发送错误结果时出错:", sendError);
        }
      });

    return true; // 保持消息通道开放
  }

  // 处理新窗口步骤
  if (request.action === "handleNewWindowStep") {
    console.log("🪟 收到新窗口处理请求:", request.step);

    handleNewWindowStep(request.currentTabId, request.step)
      .then((newTabId) => {
        sendResponse({ success: true, newTabId: newTabId });
      })
      .catch((error) => {
        console.error("🪟 处理新窗口失败:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // 保持消息通道开放
  }

  // 处理来自universal-automation-engine的新窗口请求
  if (request.action === "handleNewWindow") {
    console.log("🪟 收到universal-automation-engine新窗口处理请求:", request.config);

    // 获取发送者的标签页ID
    const currentTabId = sender.tab?.id;
    if (!currentTabId) {
      sendResponse({ success: false, error: "无法获取当前标签页ID" });
      return true;
    }

    // 创建一个模拟的步骤对象来复用现有逻辑
    const mockStep = {
      action: "click",
      opensNewWindow: true,
      newWindowTimeout: request.config.newWindowTimeout || 10000,
      windowReadyTimeout: request.config.windowReadyTimeout || 30000,
      switchToNewWindow: request.config.switchToNewWindow !== false
    };

    // 等待新窗口创建和准备就绪
    waitForNewWindowAndReady(currentTabId, mockStep)
      .then((result) => {
        sendResponse({
          success: true,
          message: `新窗口已创建并准备就绪: ${result.newTabId}`,
          newTabId: result.newTabId
        });
      })
      .catch((error) => {
        console.error("🪟 处理新窗口失败:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // 保持消息通道开放
  }

  // 处理切换到新窗口的请求
  if (request.action === "switchToNewWindow") {
    console.log("🔄 收到切换到新窗口请求:", request.config);

    (async () => {
      try {
        // 等待新窗口创建
        const newWindowPromise = waitForNewWindow(request.config.newWindowTimeout || 10000);
        const newTabId = await newWindowPromise;

        // 等待新窗口页面加载完成
        await waitForWindowReady(newTabId, request.config.windowReadyTimeout || 30000);

        // 向新窗口注入内容脚本
        await injectContentScript(newTabId);

        // 等待内容脚本准备就绪
        await sleep(1000);

        // 测试与新窗口的通信
        try {
          await sendMessageToTab(newTabId, { action: "ping" }, 5000);
          console.log(`✅ 新窗口 ${newTabId} 通信正常`);
        } catch (error) {
          console.warn(`⚠️ 新窗口 ${newTabId} 通信测试失败:`, error.message);
        }

        // 如果需要切换到新窗口
        if (request.config.switchToNewWindow !== false) {
          await switchToWindow(newTabId);
          console.log(`🔄 已切换到新窗口: ${newTabId}`);
        }

        sendResponse({
          success: true,
          message: `成功切换到新窗口: ${newTabId}`,
          newTabId: newTabId
        });
      } catch (error) {
        console.error("🔄 切换到新窗口失败:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // 保持消息通道开放
  }

  // 处理切换到最新窗口的请求
  if (request.action === "switchToLatestWindow") {
    console.log("🔄 收到切换到最新窗口请求");

    (async () => {
      try {
        // 获取发送者的标签页ID
        const currentTabId = sender.tab?.id;
        if (!currentTabId) {
          throw new Error("无法获取当前标签页ID");
        }

        console.log(`🔄 当前标签页ID: ${currentTabId}`);

        // 等待一下让新窗口有时间创建
        await sleep(2000);

        // 获取所有窗口并找到最新的窗口
        console.log("🔍 获取所有窗口...");
        const windows = await chrome.windows.getAll({ populate: true });
        console.log(`📊 找到 ${windows.length} 个窗口`);

        // 找到最新创建的窗口（排除当前窗口）
        let latestWindow = null;
        let maxId = 0;

        for (const window of windows) {
          console.log(`🪟 窗口 ${window.id}: ${window.tabs.length} 个标签页`);
          if (window.tabs && window.tabs.length > 0) {
            const firstTab = window.tabs[0];
            console.log(`  - 第一个标签页: ${firstTab.id}, URL: ${firstTab.url}`);

            // 排除当前标签页所在的窗口，找到ID最大的新窗口
            if (firstTab.id !== currentTabId && window.id > maxId) {
              maxId = window.id;
              latestWindow = window;
              console.log(`  - 这是候选的最新窗口: ${window.id}`);
            }
          }
        }

        if (latestWindow && latestWindow.tabs[0]) {
          const newTabId = latestWindow.tabs[0].id;
          console.log(`✅ 找到最新窗口: ${newTabId}`);

          // 等待新窗口页面加载完成
          await waitForWindowReady(newTabId, 30000);

          // 向新窗口注入内容脚本
          await injectContentScript(newTabId);

          // 等待内容脚本准备就绪
          await sleep(1000);

          // 切换到新窗口
          await switchToWindow(newTabId);
          console.log(`🔄 已切换到最新窗口: ${newTabId}`);

          sendResponse({
            success: true,
            message: `成功切换到最新窗口: ${newTabId}`,
            windowId: newTabId
          });
        } else {
          throw new Error("未找到新窗口");
        }
      } catch (error) {
        console.error("🔄 切换到最新窗口失败:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // 保持消息通道开放
  }

  // 处理在指定窗口中执行操作的请求
  if (request.action === "executeInWindow") {
    console.log("🔄 收到在指定窗口中执行操作请求:", request.targetTabId, request.operation);

    (async () => {
      try {
        const targetTabId = request.targetTabId;
        const operation = request.operation;

        // 向目标窗口发送执行操作的消息
        const response = await sendMessageToTab(targetTabId, {
          action: "executeOperation",
          operation: operation
        }, 10000);

        if (response && response.success) {
          console.log(`✅ 在窗口 ${targetTabId} 中执行操作成功`);
          sendResponse({
            success: true,
            message: `在窗口 ${targetTabId} 中执行操作成功`,
            result: response.result
          });
        } else {
          throw new Error(response?.error || "操作执行失败");
        }
      } catch (error) {
        console.error("🔄 在指定窗口中执行操作失败:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // 保持消息通道开放
  }

  // 处理来自universal-automation-engine的关闭窗口请求
  if (request.action === "handleCloseWindow") {
    console.log("🗑️ 收到universal-automation-engine关闭窗口处理请求:", request.config);

    // 获取发送者的标签页ID
    const currentTabId = sender.tab?.id;
    if (!currentTabId) {
      sendResponse({ success: false, error: "无法获取当前标签页ID" });
      return true;
    }

    // 创建一个模拟的步骤对象来复用现有逻辑
    const mockStep = {
      closeTarget: request.config.closeTarget || "current",
      targetWindowId: request.config.targetWindowId,
      returnToPrevious: request.config.returnToPrevious !== false,
      waitAfterClose: request.config.waitAfterClose || 1000
    };

    // 处理关闭窗口操作
    handleCloseWindowStep(mockStep)
      .then((result) => {
        sendResponse({
          success: true,
          message: `窗口关闭完成`,
          returnWindowId: result
        });
      })
      .catch((error) => {
        console.error("🗑️ 处理关闭窗口失败:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // 保持消息通道开放
  }

  if (request.action === "stopExecution") {
    console.log("⏹️ [Background-DEBUG] 收到停止执行请求");
    console.log("⏹️ [Background-DEBUG] 请求来源:", sender);
    console.log("⏹️ [Background-DEBUG] 当前执行状态:", { isExecutionStopped, isExecutionPaused, currentExecutionTabId });

    isExecutionStopped = true;
    isExecutionPaused = false;
    currentExecutionTabId = null;

    console.log("⏹️ [Background-DEBUG] 已设置停止标志");
    console.log("⏹️ [Background-DEBUG] 新的执行状态:", { isExecutionStopped, isExecutionPaused, currentExecutionTabId });

    // 通知所有标签页执行已停止
    notifyExecutionStatusChange({
      isRunning: false,
      isPaused: false,
      message: "执行已停止"
    });

    console.log("⏹️ [Background-DEBUG] 已发送停止通知");
    sendResponse({ stopped: true });
    return true;
  }

  if (request.action === "pauseExecution") {
    console.log("⏸️ [Background-DEBUG] 收到暂停执行请求");
    console.log("⏸️ [Background-DEBUG] 请求来源:", sender);
    console.log("⏸️ [Background-DEBUG] 当前执行状态:", { isExecutionStopped, isExecutionPaused, currentExecutionTabId });

    isExecutionPaused = true;

    console.log("⏸️ [Background-DEBUG] 已设置暂停标志");
    console.log("⏸️ [Background-DEBUG] 新的执行状态:", { isExecutionStopped, isExecutionPaused, currentExecutionTabId });

    // 通知所有标签页执行已暂停
    notifyExecutionStatusChange({
      isRunning: true,
      isPaused: true,
      message: "执行已暂停"
    });

    console.log("⏸️ [Background-DEBUG] 已发送暂停通知");
    sendResponse({ paused: true });
    return true;
  }

  if (request.action === "resumeExecution") {
    console.log("▶️ [Background-DEBUG] 收到恢复执行请求");
    console.log("▶️ [Background-DEBUG] 请求来源:", sender);
    console.log("▶️ [Background-DEBUG] 当前执行状态:", { isExecutionStopped, isExecutionPaused, currentExecutionTabId });

    isExecutionPaused = false;

    console.log("▶️ [Background-DEBUG] 已清除暂停标志");
    console.log("▶️ [Background-DEBUG] 新的执行状态:", { isExecutionStopped, isExecutionPaused, currentExecutionTabId });

    // 通知所有标签页执行已恢复
    notifyExecutionStatusChange({
      isRunning: true,
      isPaused: false,
      message: "执行已恢复"
    });

    console.log("▶️ [Background-DEBUG] 已发送恢复通知");
    sendResponse({ resumed: true });
    return true;
  }

  if (request.action === "getExecutionStatus") {
    sendResponse({
      isRunning: !isExecutionStopped,
      isPaused: isExecutionPaused,
      currentTabId: currentExecutionTabId
    });
    return true;
  }

  // 处理切换窗口请求
  if (request.action === "switchToWindow") {
    const targetWindowId = request.windowId;
    if (targetWindowId) {
      // 激活目标窗口
      chrome.tabs.update(targetWindowId, { active: true })
        .then(() => {
          console.log(`✅ 成功切换到窗口: ${targetWindowId}`);
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error(`❌ 切换窗口失败: ${targetWindowId}`, error);
          sendResponse({ success: false, error: error.message });
        });
    } else {
      sendResponse({ success: false, error: "未提供窗口ID" });
    }
    return true;
  }
});

/**
 * 处理步骤执行的主函数
 * @param {Array} steps - 要执行的步骤配置
 */
async function handleStepsExecution(steps) {
  try {
    // 调试信息
    console.log("开始执行步骤:", steps);

    // 1. 获取当前激活的标签页并设置为主窗口
    const tab = await getCurrentTab();
    console.log("已获取当前标签页:", tab.id);

    // 初始化窗口管理
    initializeWindowManager(tab.id);

    // 先检查Content Script是否已加载
    let contentScriptReady = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      // 检查是否已停止执行
      if (isExecutionStopped) {
        throw new Error("操作已被用户手动停止");
      }

      try {
        // 发送一个测试消息
        console.log(`尝试与内容脚本通信 (尝试 ${attempt}/3)...`);
        await sendMessageToTab(tab.id, { action: "ping" }, 2000);
        contentScriptReady = true;
        console.log("内容脚本已响应");
        break;
      } catch (error) {
        console.log(`内容脚本通信失败 (尝试 ${attempt}/3):`, error.message);

        if (attempt === 3) {
          // 最后一次尝试，注入内容脚本
          try {
            console.log("尝试注入内容脚本...");
            await injectContentScript(tab.id);
            // 等待脚本加载 - 减少等待时间
            await sleep(300); // 从500ms减少到300ms
          } catch (injectError) {
            console.error("注入内容脚本失败:", injectError.message);
            throw new Error("无法与页面建立连接，请刷新页面后重试");
          }
        }
      }
    }

    // 2. 执行所有步骤
    for (let i = 0; i < steps.length; i++) {
      // 使用全局停止检查函数
      await checkExecutionControl(`步骤${i + 1}执行前`);

      const step = steps[i];
      console.log(`📋 [步骤 ${i + 1}/${steps.length}] 开始执行: ${step.name || step.type}`);
      console.log(`🔧 [步骤详情] 类型: ${step.type}, 操作: ${step.action || '无'}, 选择器: ${step.locator?.value || '无'}`);

      // 发送步骤开始日志到插件面板
      notifyRunningStatus(
        `📋 执行步骤 ${i + 1}/${steps.length}: ${step.name || step.type}`,
        i + 1,
        steps.length,
        Math.round(((i + 1) / steps.length) * 100)
      );

      // 根据步骤类型执行不同的操作
      if (step.action === "loop" || step.type === "loop") {
        // 处理循环操作
        await handleLoopOperation(currentExecutionTabId, step, i);
      } else if (step.action === "newWindow" || step.opensNewWindow) {
        // 处理新窗口操作
        const newTabId = await handleNewWindowStep(currentExecutionTabId, step);
        console.log(`🪟 新窗口已创建并准备就绪: ${newTabId}`);
        // 重要：更新当前执行窗口ID，后续步骤将在新窗口中执行
        currentExecutionTabId = newTabId;
      } else if (step.action === "closeWindow" || step.type === "closeWindow") {
        // 处理关闭窗口操作
        const returnedTabId = await handleCloseWindowStep(step);
        console.log(`🗑️ 窗口已关闭，当前窗口: ${returnedTabId}`);
      } else {
        // 处理普通操作
        await executeStepWithRetry(currentExecutionTabId, step, i);
      }

      // 步骤间等待时间 - 根据操作类型调整
      if (step.action === "wait" || step.action === "input") {
        // 简单操作等待时间较短
        await sleep(800); // 从1500ms减少到800ms
      } else if (step.action === "drag") {
        // 拖拽操作等待时间中等
        await sleep(1000);
      } else {
        // 复杂操作等待时间稍长
        await sleep(1200); // 从1500ms减少到1200ms
      }
    }

    // 执行完成
    console.log("所有步骤执行完成");

    // 通知执行完成
    notifyExecutionStatusChange({
      isRunning: false,
      isPaused: false,
      message: "执行完成"
    });

    return { success: true, message: "所有步骤执行完成" };
  } catch (error) {
    console.error("执行步骤时出错:", error);

    // 通知执行失败
    notifyExecutionStatusChange({
      isRunning: false,
      isPaused: false,
      message: `执行失败: ${error.message}`
    });

    throw error;
  }
}

/**
 * 处理循环操作
 * @param {number} tabId - 标签页ID
 * @param {object} step - 循环步骤配置
 * @param {number} stepIndex - 步骤索引
 */
async function handleLoopOperation(tabId, step, stepIndex) {
  console.log(`开始处理循环操作: ${step.name}`);
  console.log(`🔧 [循环配置调试] 原始配置:`, {
    startIndex: step.startIndex,
    endIndex: step.endIndex,
    maxIterations: step.maxIterations,
    loopType: step.loopType
  });
  console.log(`🔧 [循环配置调试] 配置类型检查:`, {
    startIndexType: typeof step.startIndex,
    endIndexType: typeof step.endIndex,
    startIndexUndefined: step.startIndex === undefined,
    endIndexUndefined: step.endIndex === undefined
  });

  // 强制验证配置是否正确传递
  if (step.startIndex !== undefined || step.endIndex !== undefined) {
    console.log(`✅ [循环配置] 检测到用户自定义循环范围配置`);
  } else {
    console.log(`⚠️ [循环配置] 未检测到用户自定义循环范围，将使用默认配置`);
    console.log(`🔧 [配置提示] 如果需要限制循环范围，请在工作流配置中添加 startIndex 和 endIndex 参数`);
    console.log(`🔧 [配置示例] 例如: "startIndex": 0, "endIndex": 2 将只处理前3个元素`);
  }

  // 强制输出完整的step对象用于调试
  console.log(`🔧 [完整配置] step对象:`, JSON.stringify(step, null, 2));

  // 如果用户没有设置循环范围，提供一个临时的测试配置
  if (step.startIndex === undefined && step.endIndex === undefined) {
    console.log(`🔧 [临时配置] 检测到没有循环范围配置，应用临时测试配置: startIndex=0, endIndex=2`);
    step.startIndex = 0;
    step.endIndex = 2;
    console.log(`🔧 [临时配置] 已临时设置循环范围为 0-2，用于测试`);
  }

  // 发送循环开始日志到插件面板
  notifyRunningStatus(`🔄 开始处理循环操作: ${step.name}`);

  // 查找所有匹配元素
  const response = await sendMessageToTab(
    tabId,
    {
      action: "findAllElements",
      locator: step.locator,
    },
    10000
  );

  if (!response.success) {
    throw new Error(`查找循环元素失败: ${response.error}`);
  }

  const elementCount = response.elements.length;
  console.log(`找到 ${elementCount} 个循环元素`);

  // 发送找到循环元素的日志到插件面板
  notifyRunningStatus(`📊 找到 ${elementCount} 个循环元素`);

  if (elementCount === 0) {
    console.log("没有找到匹配的循环元素，跳过循环");
    return;
  }

  // 计算循环范围 - 添加类型转换和强验证
  const startIndex = step.startIndex !== undefined ? Number(step.startIndex) : 0;
  const endIndex = step.endIndex === -1 ? elementCount - 1 :
    step.endIndex !== undefined ? Math.min(Number(step.endIndex), elementCount - 1) :
      elementCount - 1;
  const maxIterations = step.maxIterations ? Number(step.maxIterations) : elementCount;

  // 强制验证配置
  console.log(`🔧 [配置验证] 原始值: startIndex=${step.startIndex}(${typeof step.startIndex}), endIndex=${step.endIndex}(${typeof step.endIndex})`);
  console.log(`🔧 [配置验证] 转换后: startIndex=${startIndex}(${typeof startIndex}), endIndex=${endIndex}(${typeof endIndex})`);

  // 如果用户明确设置了范围，强制验证
  if (step.startIndex !== undefined && step.endIndex !== undefined) {
    const userStart = Number(step.startIndex);
    const userEnd = Number(step.endIndex);
    if (startIndex === userStart && endIndex === userEnd) {
      console.log(`✅ [配置验证] 用户配置 ${userStart}-${userEnd} 已正确应用`);
    } else {
      console.log(`❌ [配置验证] 用户配置 ${userStart}-${userEnd} 应用失败，实际为 ${startIndex}-${endIndex}`);
    }
  }

  const actualIterations = Math.min(endIndex - startIndex + 1, maxIterations);
  console.log(`📊 [循环配置] 循环范围: ${startIndex} 到 ${endIndex}, 实际执行次数: ${actualIterations}/${elementCount}`);

  // 强制验证循环范围是否符合用户期望
  if (step.startIndex !== undefined && step.endIndex !== undefined) {
    const expectedRange = `${step.startIndex}-${step.endIndex}`;
    const actualRange = `${startIndex}-${endIndex}`;
    if (expectedRange === actualRange) {
      console.log(`✅ [循环验证] 用户配置 ${expectedRange} 已正确应用为 ${actualRange}`);
    } else {
      console.log(`❌ [循环验证] 用户配置 ${expectedRange} 与实际应用 ${actualRange} 不匹配`);
    }
  }

  // 发送循环配置日志到插件面板
  notifyExecutionStatusChange({
    isRunning: true,
    isPaused: false,
    message: `📊 配置循环范围: ${startIndex}-${endIndex}, 将执行 ${actualIterations} 次`
  });

  // 强制验证循环条件
  console.log(`🔧 [循环验证] 循环条件: elementIndex从${startIndex}到${endIndex}, 最大迭代${maxIterations}`);
  console.log(`🔧 [循环验证] 预期处理的元素索引: [${Array.from({ length: actualIterations }, (_, i) => startIndex + i).join(', ')}]`);

  // 执行循环
  for (let elementIndex = startIndex; elementIndex <= endIndex && elementIndex < startIndex + maxIterations; elementIndex++) {
    // 使用全局停止检查函数
    await checkExecutionControl(`循环元素${elementIndex + 1}处理前`);

    const currentLoopIndex = elementIndex - startIndex + 1;
    const totalLoopCount = Math.min(endIndex - startIndex + 1, maxIterations);
    const progressPercent = Math.round((currentLoopIndex / totalLoopCount) * 100);

    console.log(`🔄 [循环进度] 处理循环元素 ${currentLoopIndex}/${totalLoopCount} (索引${elementIndex}, 进度${progressPercent}%)`);

    // 发送详细的循环进度更新
    notifyRunningStatus(
      `正在处理第 ${currentLoopIndex} 个窗口点击项目 (共 ${totalLoopCount} 个)`,
      currentLoopIndex,
      totalLoopCount,
      progressPercent
    );

    // 发送循环进度日志到插件面板
    notifyExecutionStatusChange({
      isRunning: true,
      isPaused: false,
      message: `🔄 处理循环元素 ${currentLoopIndex}/${totalLoopCount}`,
      currentStep: currentLoopIndex,
      totalSteps: totalLoopCount,
      progress: progressPercent
    });

    // 如果是容器循环，处理子步骤
    if (step.loopType === "container") {
      // 检查第一个子操作是否是点击操作
      const firstSubOp = step.subOperations && step.subOperations[0];
      const shouldSkipContainerClick = firstSubOp && firstSubOp.type === "click";

      if (!shouldSkipContainerClick && step.operationType === "click") {
        // 1. 如果第一个子操作不是点击，则先点击容器元素
        console.log(`点击容器元素 ${elementIndex + 1}`);
        const clickResponse = await sendMessageToTab(
          tabId,
          {
            action: "clickElementByIndex",
            locator: step.locator,
            index: elementIndex,
          },
          8000
        );

        if (!clickResponse.success) {
          console.error(`点击循环元素 ${elementIndex} 失败:`, clickResponse.error);
          continue;
        }

        // 等待页面稳定
        await sleep(800);
      } else {
        console.log(`跳过容器元素点击，将由第一个子操作处理`);
      }

      // 2. 执行循环内的所有子步骤
      if (step.subOperations && step.subOperations.length > 0) {
        console.log(`执行循环元素 ${elementIndex + 1} 的子操作，共 ${step.subOperations.length} 个`);

        for (let j = 0; j < step.subOperations.length; j++) {
          // 使用全局停止检查函数
          await checkExecutionControl(`循环元素${elementIndex + 1}子步骤${j + 1}执行前`);

          const subStep = step.subOperations[j];
          console.log(`📋 [子步骤 ${j + 1}/${step.subOperations.length}] 开始执行: ${subStep.name || subStep.type}`);
          console.log(`🔧 [详细信息] 操作类型: ${subStep.type}, 选择器: ${subStep.locator?.value || '无'}, 新窗口: ${subStep.opensNewWindow || false}`);

          // 发送子步骤执行日志到插件面板
          notifyExecutionStatusChange({
            isRunning: true,
            isPaused: false,
            message: `📋 执行子步骤 ${j + 1}/${step.subOperations.length}: ${subStep.name || subStep.type}`
          });

          // 发送进度更新到所有标签页
          const currentLoopIndex = elementIndex - startIndex + 1;
          const totalLoopCount = Math.min(endIndex - startIndex + 1, maxIterations);
          const progressPercent = Math.round((currentLoopIndex / totalLoopCount) * 100);

          notifyExecutionStatusChange({
            isRunning: true,
            isPaused: false,
            message: `循环操作: 元素 ${currentLoopIndex}/${totalLoopCount} - 执行子步骤 ${j + 1}`,
            currentStep: currentLoopIndex,
            totalSteps: totalLoopCount,
            progress: progressPercent
          });

          // 执行子步骤 - 使用当前执行窗口ID，并传递循环索引
          try {
            // 为子步骤添加循环上下文信息
            const subStepWithContext = {
              ...subStep,
              loopContext: {
                elementIndex: elementIndex,
                containerLocator: step.locator
              }
            };

            await executeStepWithRetry(currentExecutionTabId, subStepWithContext, `${stepIndex}.${j}`);
          } catch (error) {
            console.error(`❌ 循环元素 ${elementIndex + 1} 的子步骤 ${j + 1} 执行失败:`, error);

            // 如果是窗口关闭相关的错误，跳过当前循环项目
            if (error.message.includes('message channel closed') ||
              error.message.includes('Receiving end does not exist') ||
              error.message.includes('message port closed') ||
              error.message.includes('Could not establish connection')) {
              console.log(`🔄 检测到窗口连接断开，跳过当前循环项目 ${elementIndex + 1}`);
              console.log(`📊 [连接状态] 错误详情: ${error.message}`);

              // 尝试重新获取当前活动窗口
              try {
                const currentTab = await getCurrentTab();
                console.log(`🔄 重新获取当前窗口: ${currentTab.id}`);
                currentExecutionTabId = currentTab.id;
              } catch (tabError) {
                console.error(`❌ 无法重新获取当前窗口:`, tabError);
              }

              break; // 跳出子步骤循环，继续下一个循环项目
            } else {
              // 其他错误，根据错误处理策略决定
              if (step.errorHandling === "stop") {
                throw error;
              } else {
                console.log(`⚠️ 子步骤失败但继续执行，错误处理策略: ${step.errorHandling || 'continue'}`);
                break; // 跳过剩余子步骤，继续下一个循环项目
              }
            }
          }

          // 子步骤之间稍作等待 - 减少等待时间
          await sleep(600); // 从800ms减少到600ms
        }

        // 等待这轮循环完成后再继续下一个元素 - 减少等待时间
        await sleep(1000); // 从1500ms减少到1000ms
      }
    }
  }

  console.log(`循环操作完成，已执行从 ${startIndex} 到 ${endIndex} 的元素`);

  // 发送循环完成日志到插件面板
  notifyExecutionStatusChange({
    isRunning: true,
    isPaused: false,
    message: `✅ 循环操作完成，已处理 ${actualIterations} 个元素`
  });
}

/**
 * 执行单个步骤，带重试机制
 * @param {number} tabId - 标签页ID
 * @param {object} step - 步骤配置
 * @param {number|string} stepIdentifier - 步骤标识符
 */
async function executeStepWithRetry(tabId, step, stepIdentifier) {
  let success = false;
  let lastError = null;

  // 检查是否是特殊操作类型，需要特殊处理
  if (step.opensNewWindow || step.type === 'closeWindow') {
    console.log(`🔧 检测到特殊操作类型: ${step.type}, opensNewWindow: ${step.opensNewWindow}`);

    try {
      if (step.opensNewWindow) {
        // 处理新窗口操作
        console.log(`🪟 在循环中处理新窗口步骤: ${stepIdentifier}`);

        // 发送新窗口创建日志到插件面板
        notifyExecutionStatusChange({
          isRunning: true,
          isPaused: false,
          message: `🪟 正在创建新窗口...`
        });

        const newTabId = await handleNewWindowStep(tabId, step);
        console.log(`🪟 循环中新窗口已创建并准备就绪: ${newTabId}`);
        console.log(`📊 [窗口状态] 当前执行窗口已切换到: ${newTabId}`);

        // 发送新窗口创建成功日志到插件面板
        notifyExecutionStatusChange({
          isRunning: true,
          isPaused: false,
          message: `✅ 新窗口已创建: ${newTabId}`
        });

        // 更新当前执行窗口ID，后续步骤将在新窗口中执行
        currentExecutionTabId = newTabId;

        return; // 新窗口操作成功完成
      } else if (step.type === 'closeWindow') {
        // 处理关闭窗口操作
        console.log(`🗑️ 在循环中处理关闭窗口步骤: ${stepIdentifier}`);

        // 发送关闭窗口日志到插件面板
        notifyExecutionStatusChange({
          isRunning: true,
          isPaused: false,
          message: `🗑️ 正在关闭窗口...`
        });

        const returnedTabId = await handleCloseWindowStep(step);
        console.log(`🗑️ 循环中窗口已关闭，当前窗口: ${returnedTabId}`);
        console.log(`📊 [窗口管理] 已返回到原窗口，继续执行后续操作`);

        // 发送窗口关闭成功日志到插件面板
        notifyExecutionStatusChange({
          isRunning: true,
          isPaused: false,
          message: `✅ 窗口已关闭，返回主窗口`
        });

        // 更新当前执行窗口ID
        currentExecutionTabId = returnedTabId;

        return; // 关闭窗口操作成功完成
      }
    } catch (error) {
      console.error(`特殊操作执行失败: ${stepIdentifier}`, error);
      throw error;
    }
  }

  // 普通操作的重试逻辑
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`执行步骤 ${stepIdentifier} 操作 (尝试 ${attempt}/3)...`);

      // 增加额外的进度反馈
      if (attempt > 1) {
        chrome.runtime
          .sendMessage({
            action: "executionProgress",
            message: `正在重试步骤 ${stepIdentifier} (尝试 ${attempt}/3)...`,
            retry: true,
          })
          .catch((err) => console.error("发送进度时出错:", err));
      }

      // 使用当前执行窗口ID（可能已经切换到新窗口）
      const currentTabId = currentExecutionTabId || tabId;
      console.log(`🔧 使用窗口ID执行操作: ${currentTabId} (原始: ${tabId})`);

      // 检查是否是容器循环中的子操作
      let actionMessage;
      if (step.loopContext && step.type === "click") {
        // 检查是否是在原窗口中执行的操作（通过选择器判断）
        const isOriginalWindowOperation = step.locator &&
          (step.locator.value.includes('hotsearch') ||
            step.locator.value.includes(step.loopContext.containerLocator.value));

        if (isOriginalWindowOperation) {
          // 在原窗口中的容器循环点击操作，使用索引
          console.log(`🔧 原窗口中的容器循环点击操作，使用元素索引: ${step.loopContext.elementIndex}`);

          // 检查原窗口中的元素是否仍然存在
          try {
            const checkResponse = await sendMessageToTab(currentTabId, {
              action: "findAllElements",
              locator: step.loopContext.containerLocator,
            }, 3000);

            if (!checkResponse.success || checkResponse.elements.length <= step.loopContext.elementIndex) {
              console.log(`⚠️ 原窗口中容器元素已不存在或索引超出范围`);
              console.log(`📊 当前元素数量: ${checkResponse.elements?.length || 0}, 需要索引: ${step.loopContext.elementIndex}`);

              // 如果元素数量不足，调整索引到可用范围内
              if (checkResponse.success && checkResponse.elements && checkResponse.elements.length > 0) {
                const adjustedIndex = Math.min(step.loopContext.elementIndex, checkResponse.elements.length - 1);
                console.log(`🔧 调整索引从 ${step.loopContext.elementIndex} 到 ${adjustedIndex}`);

                // 更新循环上下文中的索引
                step.loopContext.elementIndex = adjustedIndex;
              } else {
                throw new Error(`容器元素完全不存在，无法继续执行`);
              }
            }
          } catch (checkError) {
            console.log(`⚠️ 检查容器元素失败，跳过此循环项目:`, checkError.message);
            throw checkError;
          }

          actionMessage = {
            action: "performActionOnElementByIndex",
            locator: step.locator,
            index: step.loopContext.elementIndex,
            actionType: step.type || "click"
          };
        } else {
          // 在新窗口中的操作，不使用循环索引
          console.log(`🔧 新窗口中的点击操作，不使用循环索引`);
          actionMessage = {
            action: "performAction",
            config: step,
          };
        }
      } else {
        // 普通操作
        actionMessage = {
          action: "performAction",
          config: step,
        };
      }

      const response = await sendMessageToTab(
        currentTabId,
        actionMessage,
        8000 // 减少到8秒，而不是之前的15秒
      );

      if (!response) {
        throw new Error("没有收到响应");
      }

      if (!response.success) {
        throw new Error(response.error || "操作执行失败");
      }

      console.log(`✅ [步骤完成] ${stepIdentifier} 执行成功:`, response);

      // 发送步骤完成日志到插件面板
      notifyExecutionStatusChange({
        isRunning: true,
        isPaused: false,
        message: `✅ 步骤 ${stepIdentifier} 执行成功`
      });

      success = true;
      break;
    } catch (error) {
      lastError = error;
      console.error(
        `步骤 ${stepIdentifier} 尝试 ${attempt} 失败:`,
        error.message
      );

      if (attempt < 3) {
        // 在重试之前等待 - 减少等待时间
        console.log(`等待重试...`);
        await sleep(800); // 从1000ms减少到800ms
      }
    }
  }

  if (!success) {
    throw new Error(
      `步骤 ${stepIdentifier} 执行失败: ${lastError?.message || "未知错误"}`
    );
  }
}

/**
 * 获取当前激活的标签页
 * @returns {Promise<chrome.tabs.Tab>} 当前标签页对象
 */
function getCurrentTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        resolve(tabs[0]);
      } else {
        reject(new Error("无法获取当前标签页"));
      }
    });
  });
}

/**
 * 向指定标签页发送消息
 * @param {number} tabId - 标签页ID
 * @param {object} message - 要发送的消息
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<any>} 响应结果
 */
function sendMessageToTab(tabId, message, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`消息发送超时（${timeout}ms）`));
    }, timeout);

    chrome.tabs.sendMessage(tabId, message, (response) => {
      clearTimeout(timeoutId);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 注入内容脚本到指定标签页
 * @param {number} tabId - 标签页ID
 * @returns {Promise<void>}
 */
async function injectContentScript(tabId) {
  try {
    // 获取标签页信息检查URL
    const tab = await chrome.tabs.get(tabId);

    // 检查是否是扩展页面或特殊页面
    if (tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('moz-extension://')) {
      console.log(`⚠️ 跳过扩展页面或特殊页面的脚本注入: ${tab.url}`);
      return;
    }

    // 先检查是否已经注入过
    try {
      const response = await sendMessageToTab(tabId, { action: "ping" }, 1000);
      if (response && response.success) {
        console.log('Content Script已存在，跳过注入');
        return;
      }
    } catch (error) {
      // 如果通信失败，说明需要注入
      console.log('Content Script不存在，开始注入...');
    }

    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/content.js']
    });
    console.log('Content Script注入成功');
  } catch (error) {
    console.error('Content Script注入失败:', error);

    // 如果是权限错误，不抛出异常，只是记录
    if (error.message.includes('Cannot access contents of url') ||
      error.message.includes('Extension manifest must request permission')) {
      console.log('⚠️ 权限限制，跳过此标签页的脚本注入');
      return;
    }

    throw error;
  }
}

/**
 * 等待指定时间
 * @param {number} ms - 等待时间（毫秒）
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 初始化窗口管理器
 * @param {number} mainTabId - 主窗口标签页ID
 */
function initializeWindowManager(mainTabId) {
  mainWindowId = mainTabId;
  currentExecutionTabId = mainTabId;
  windowStack = [mainTabId];

  console.log(`🏠 初始化窗口管理器，主窗口: ${mainTabId}`);

  // 监听新窗口创建事件
  if (!chrome.tabs.onCreated.hasListener(handleNewTabCreated)) {
    chrome.tabs.onCreated.addListener(handleNewTabCreated);
  }

  // 监听窗口关闭事件
  if (!chrome.tabs.onRemoved.hasListener(handleTabRemoved)) {
    chrome.tabs.onRemoved.addListener(handleTabRemoved);
  }

  // 监听窗口更新事件（用于检测页面加载完成）
  if (!chrome.tabs.onUpdated.hasListener(handleTabUpdated)) {
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
  }
}/**

 * 等待新窗口创建
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<number>} 新窗口的标签页ID
 */
function waitForNewWindow(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const promiseId = Date.now();

    const timeoutId = setTimeout(() => {
      windowCreationPromises.delete(promiseId);
      reject(new Error(`等待新窗口创建超时（${timeout}ms）`));
    }, timeout);

    const promise = {
      resolve: (tabId) => {
        clearTimeout(timeoutId);
        resolve(tabId);
      },
      reject: (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    };

    windowCreationPromises.set(promiseId, promise);

    console.log(`⏳ 开始等待新窗口创建... (超时: ${timeout}ms)`);
  });
}

function handleNewTabCreated(tab) {
  console.log(`🆕 检测到新窗口创建: ${tab.id}, URL: ${tab.url}`);

  // 如果有等待中的Promise，只解决第一个
  if (windowCreationPromises.size > 0) {
    // 获取第一个等待中的Promise
    const firstPromise = windowCreationPromises.values().next().value;

    if (firstPromise) {
      // 清除所有等待中的Promise（避免重复处理）
      windowCreationPromises.clear();

      // 解决第一个Promise
      firstPromise.resolve(tab.id);

      // 将新窗口添加到窗口栈
      pushWindow(tab.id);

      console.log(`✅ 新窗口 ${tab.id} 已被选为目标窗口`);

      // 简单的重复窗口清理：2秒后检查并关闭相似的窗口
      setTimeout(() => {
        closeDuplicateWindows(tab.id);
      }, 2000);
    }
  }
}

/**
 * 关闭重复的窗口（简化版）
 * @param {number} keepWindowId - 要保留的窗口ID
 */
async function closeDuplicateWindows(keepWindowId) {
  try {
    // 获取要保留的窗口信息
    const keepTab = await chrome.tabs.get(keepWindowId);
    if (!keepTab) return;

    // 获取所有标签页
    const allTabs = await chrome.tabs.query({});

    // 查找可能的重复窗口
    for (const tab of allTabs) {
      if (tab.id !== keepWindowId &&
        tab.url && keepTab.url &&
        tab.url.includes('baidu.com') &&
        keepTab.url.includes('baidu.com')) {

        // 提取搜索关键词进行比较
        const keepKeyword = extractBaiduKeyword(keepTab.url);
        const tabKeyword = extractBaiduKeyword(tab.url);

        if (keepKeyword && tabKeyword && keepKeyword === tabKeyword) {
          console.log(`🗑️ 关闭重复的百度搜索窗口: ${tab.id} (关键词: ${tabKeyword})`);
          await chrome.tabs.remove(tab.id);
        }
      }
    }
  } catch (error) {
    console.log('清理重复窗口时出错:', error.message);
  }
}

/**
 * 从百度URL中提取搜索关键词
 * @param {string} url - 百度URL
 * @returns {string} 搜索关键词
 */
function extractBaiduKeyword(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('wd') || '';
  } catch (error) {
    return '';
  }
}/**
 *
 将窗口推入栈顶
 * @param {number} tabId - 窗口标签页ID
 */
function pushWindow(tabId) {
  // 如果窗口已存在于栈中，先移除
  removeWindowFromStack(tabId);

  // 推入栈顶
  windowStack.push(tabId);
  currentExecutionTabId = tabId;

  console.log(`📚 窗口入栈: ${tabId}, 当前栈: [${windowStack.join(', ')}]`);
}

/**
 * 从窗口栈中移除窗口
 * @param {number} tabId - 窗口标签页ID
 */
function removeWindowFromStack(tabId) {
  const index = windowStack.indexOf(tabId);
  if (index > -1) {
    windowStack.splice(index, 1);
    console.log(`📚 窗口出栈: ${tabId}, 当前栈: [${windowStack.join(', ')}]`);
  }
}

/**
 * 获取栈顶窗口（当前活动窗口）
 * @returns {number|null} 窗口标签页ID
 */
function getTopWindow() {
  return windowStack.length > 0 ? windowStack[windowStack.length - 1] : null;
}

/**
 * 处理标签页移除事件
 * @param {number} tabId - 被移除的标签页ID
 * @param {object} removeInfo - 移除信息
 */
function handleTabRemoved(tabId, removeInfo) {
  console.log(`🗑️ 检测到窗口关闭: ${tabId}`);

  // 从窗口栈中移除
  removeWindowFromStack(tabId);

  // 如果关闭的是当前执行窗口，切换到栈顶窗口
  if (currentExecutionTabId === tabId) {
    const previousWindow = getTopWindow();
    if (previousWindow) {
      console.log(`🔄 切换到上一个窗口: ${previousWindow}`);
      currentExecutionTabId = previousWindow;
      switchToWindow(previousWindow);
    }
  }
}

/**
 * 处理标签页更新事件
 * @param {number} tabId - 标签页ID
 * @param {object} changeInfo - 变更信息
 * @param {object} tab - 标签页对象
 */
function handleTabUpdated(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    console.log(`📄 窗口页面加载完成: ${tabId}, URL: ${tab.url}`);
  }
}

/**
 * 切换到指定窗口
 * @param {number} tabId - 目标窗口标签页ID
 * @returns {Promise<void>}
 */
async function switchToWindow(tabId) {
  try {
    // 激活指定标签页
    await chrome.tabs.update(tabId, { active: true });

    // 获取标签页所在的窗口并激活
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });

    currentExecutionTabId = tabId;
    console.log(`🔄 已切换到窗口: ${tabId}`);
  } catch (error) {
    console.error(`❌ 切换窗口失败: ${tabId}`, error);
    throw new Error(`切换窗口失败: ${error.message}`);
  }
}

/**
 * 关闭指定窗口
 * @param {number} tabId - 要关闭的窗口标签页ID
 * @returns {Promise<void>}
 */
async function closeWindow(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    console.log(`🗑️ 已关闭窗口: ${tabId}`);
  } catch (error) {
    console.error(`❌ 关闭窗口失败: ${tabId}`, error);
    throw new Error(`关闭窗口失败: ${error.message}`);
  }
}

/**
 * 关闭当前窗口并返回到上一个窗口
 * @returns {Promise<number>} 返回的窗口ID
 */
async function closeCurrentAndReturnToPrevious() {
  const currentWindow = currentExecutionTabId;
  const previousWindow = windowStack[windowStack.length - 2]; // 倒数第二个窗口

  if (!previousWindow) {
    throw new Error("没有上一个窗口可以返回");
  }

  // 先切换到上一个窗口
  await switchToWindow(previousWindow);

  // 然后关闭当前窗口
  await closeWindow(currentWindow);

  console.log(`🔄 已关闭窗口 ${currentWindow} 并返回到窗口 ${previousWindow}`);
  return previousWindow;
}

/**
 * 等待窗口准备就绪
 * @param {number} tabId - 窗口标签页ID
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<void>}
 */
function waitForWindowReady(tabId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`等待窗口准备就绪超时（${timeout}ms）`));
    }, timeout);

    const checkReady = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);

        if (tab.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
          clearTimeout(timeoutId);
          console.log(`✅ 窗口加载完成: ${tabId}`);
          resolve();
        } else {
          setTimeout(checkReady, 500);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    };

    checkReady();
  });
}

/**
 * 等待新窗口创建并准备就绪（用于universal-automation-engine）
 * @param {number} currentTabId - 当前标签页ID
 * @param {object} step - 步骤配置
 * @returns {Promise<object>} 包含新窗口ID的结果对象
 */
async function waitForNewWindowAndReady(currentTabId, step) {
  console.log('🪟 等待新窗口创建并准备就绪:', step);

  // 开始等待新窗口创建
  const newWindowPromise = waitForNewWindow(step.newWindowTimeout || 10000);

  // 等待新窗口创建完成
  const newTabId = await newWindowPromise;

  // 等待新窗口页面加载完成
  await waitForWindowReady(newTabId, step.windowReadyTimeout || 30000);

  // 向新窗口注入内容脚本
  await injectContentScript(newTabId);

  // 等待内容脚本准备就绪
  await sleep(1000);

  // 测试与新窗口的通信
  try {
    await sendMessageToTab(newTabId, { action: "ping" }, 5000);
    console.log(`✅ 新窗口 ${newTabId} 通信正常`);
  } catch (error) {
    console.warn(`⚠️ 新窗口 ${newTabId} 通信测试失败:`, error.message);
  }

  // 如果需要切换到新窗口
  if (step.switchToNewWindow !== false) {
    await switchToWindow(newTabId);
    console.log(`🔄 已切换到新窗口: ${newTabId}`);
  }

  return { newTabId: newTabId };
}

/**
 * 处理新窗口步骤
 * @param {number} currentTabId - 当前标签页ID
 * @param {object} step - 步骤配置
 * @returns {Promise<number>} 新窗口的标签页ID
 */
async function handleNewWindowStep(currentTabId, step) {
  console.log('🪟 处理新窗口步骤:', step);

  // 先开始等待新窗口创建（在执行点击之前）
  const newWindowPromise = waitForNewWindow(step.newWindowTimeout || 10000);

  // 然后执行触发新窗口的操作（通常是点击）
  console.log(`🔧 向窗口 ${currentTabId} 发送点击操作以触发新窗口`);

  try {
    // 检查是否是容器循环中的子操作，需要使用索引
    let actionMessage;
    if (step.loopContext && step.type === "click") {
      // 检查是否是在原窗口中执行的操作（通过选择器判断）
      const isOriginalWindowOperation = step.locator &&
        (step.locator.value.includes('hotsearch') ||
          step.locator.value.includes(step.loopContext.containerLocator.value));

      if (isOriginalWindowOperation) {
        // 在原窗口中的容器循环点击操作，使用索引
        console.log(`🔧 [新窗口触发] 原窗口中的容器循环点击，使用元素索引: ${step.loopContext.elementIndex}`);
        console.log(`📊 [循环详情] 容器选择器: ${step.loopContext.containerLocator.value}, 点击选择器: ${step.locator.value}`);
        console.log(`🎯 [执行状态] 正在点击第 ${step.loopContext.elementIndex + 1} 个窗口点击项目，准备打开新窗口`);

        // 发送新窗口触发日志到插件面板
        notifyExecutionStatusChange({
          isRunning: true,
          isPaused: false,
          message: `🎯 点击第 ${step.loopContext.elementIndex + 1} 个窗口点击项目，准备打开新窗口`
        });
        actionMessage = {
          action: "performActionOnElementByIndex",
          locator: step.locator,
          index: step.loopContext.elementIndex,
          actionType: step.type || "click"
        };
      } else {
        // 在新窗口中的操作，不使用循环索引
        console.log(`🔧 新窗口触发操作：新窗口中的点击操作，不使用循环索引`);
        actionMessage = {
          action: "performAction",
          config: step,
        };
      }
    } else {
      // 普通操作
      actionMessage = {
        action: "performAction",
        config: step,
      };
    }

    const response = await sendMessageToTab(currentTabId, actionMessage, 15000);

    if (!response.success) {
      throw new Error(`执行新窗口触发操作失败: ${response.error}`);
    }

    console.log(`✅ 新窗口触发操作执行成功`);
  } catch (error) {
    console.error(`❌ 新窗口触发操作失败:`, error);

    // 如果是连接断开错误，可能是因为新窗口已经打开，继续等待新窗口
    if (error.message.includes('message port closed') || error.message.includes('Receiving end does not exist')) {
      console.log(`🔄 检测到连接断开，可能新窗口已打开，继续等待新窗口创建`);
    } else {
      throw error;
    }
  }

  // 等待新窗口创建完成
  const newTabId = await newWindowPromise;

  // 等待新窗口页面加载完成
  await waitForWindowReady(newTabId, step.windowReadyTimeout || 30000);

  // 向新窗口注入内容脚本
  await injectContentScript(newTabId);

  // 等待内容脚本准备就绪
  await sleep(1000);

  // 测试与新窗口的通信
  try {
    await sendMessageToTab(newTabId, { action: "ping" }, 5000);
    console.log(`✅ 新窗口 ${newTabId} 通信正常`);
  } catch (error) {
    console.warn(`⚠️ 新窗口 ${newTabId} 通信测试失败:`, error.message);
  }

  return newTabId;
}

/**
 * 处理关闭窗口步骤
 * @param {object} step - 步骤配置
 * @returns {Promise<number>} 返回的窗口ID
 */
async function handleCloseWindowStep(step) {
  console.log('🗑️ 处理关闭窗口步骤:', step);

  // 设置默认的关闭目标为 'current'
  const closeTarget = step.closeTarget || 'current';
  console.log(`🔧 关闭窗口目标: ${closeTarget}`);

  if (closeTarget === 'current') {
    // 关闭当前窗口并返回上一个
    console.log('🗑️ 关闭当前窗口并返回上一个');
    return await closeCurrentAndReturnToPrevious();
  } else if (closeTarget === 'specific' && step.targetWindowId) {
    // 关闭指定窗口
    console.log(`🗑️ 关闭指定窗口: ${step.targetWindowId}`);
    await closeWindow(step.targetWindowId);
    return currentExecutionTabId;
  } else {
    throw new Error(`无效的关闭窗口配置: closeTarget=${closeTarget}, targetWindowId=${step.targetWindowId}`);
  }
}

/**
 * 通知所有标签页执行状态变化
 * @param {object} status - 状态信息
 */
function notifyExecutionStatusChange(status) {
  console.log(`📡 [状态通知] 发送执行状态更新:`, status);

  // 获取所有标签页并发送状态更新
  chrome.tabs.query({}, (tabs) => {
    console.log(`📊 [状态通知] 找到 ${tabs.length} 个标签页`);

    tabs.forEach(tab => {
      // 只跳过chrome://系统页面，保留扩展页面
      if (tab.url && !tab.url.startsWith('chrome://')) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'executionStatusUpdate',
          data: status
        }).then(() => {
          console.log(`✅ [状态通知] 成功发送到标签页 ${tab.id}: ${tab.url}`);
        }).catch(error => {
          console.log(`⚠️ [状态通知] 无法向标签页 ${tab.id} 发送状态更新: ${error.message}`);
        });
      } else {
        console.log(`⏭️ [状态通知] 跳过系统页面: ${tab.url}`);
      }
    });
  });

  // 同时尝试向popup发送消息（如果存在）
  try {
    chrome.runtime.sendMessage({
      action: 'executionStatusUpdate',
      data: status
    }).catch(error => {
      // popup可能没有打开，这是正常的
      console.log(`📝 [状态通知] Popup未打开或无法接收消息: ${error.message}`);
    });
  } catch (error) {
    console.log(`📝 [状态通知] 发送到popup失败: ${error.message}`);
  }
}

/**
 * 发送执行中的状态通知（简化版本）
 * @param {string} message - 状态消息
 * @param {number} currentStep - 当前步骤（可选）
 * @param {number} totalSteps - 总步骤数（可选）
 * @param {number} progress - 进度百分比（可选）
 */
function notifyRunningStatus(message, currentStep = null, totalSteps = null, progress = null) {
  const status = {
    isRunning: true,
    isPaused: false,
    message: message
  };

  if (currentStep !== null) status.currentStep = currentStep;
  if (totalSteps !== null) status.totalSteps = totalSteps;
  if (progress !== null) status.progress = progress;

  notifyExecutionStatusChange(status);
}

// 第二个消息监听器，用于处理数据同步
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'sendToWebpageStorage') {
    console.log('📡 [数据同步-DEBUG] Background收到数据同步请求:', message.data);
    console.log('📡 [数据同步-DEBUG] 同步的key:', message.data?.key);
    console.log('📡 [数据同步-DEBUG] 同步的数据大小:', message.data?.value ? message.data.value.length : 0, '字符');

    // 获取所有标签页
    chrome.tabs.query({}, (tabs) => {
      console.log(`📊 [数据同步-DEBUG] 找到 ${tabs.length} 个标签页，开始同步数据`);

      let syncCount = 0;
      tabs.forEach(tab => {
        // 跳过chrome://等特殊页面
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          syncCount++;
          console.log(`📡 [数据同步-DEBUG] 正在同步到标签页 ${tab.id}: ${tab.url}`);

          chrome.tabs.sendMessage(tab.id, {
            action: 'syncToWebpageStorage',
            data: message.data
          }).then(() => {
            console.log(`✅ [数据同步-DEBUG] 数据已成功同步到标签页 ${tab.id}: ${tab.url}`);
          }).catch(error => {
            console.log(`⚠️ [数据同步-DEBUG] 同步到标签页失败 ${tab.id}: ${tab.url}`, error.message);
          });
        } else {
          console.log(`⏭️ [数据同步-DEBUG] 跳过特殊页面: ${tab.url}`);
        }
      });

      console.log(`📊 [数据同步-DEBUG] 总共向 ${syncCount} 个标签页发送了同步请求`);
    });

    sendResponse({ success: true });
    return true;
  }
});