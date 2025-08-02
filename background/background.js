// 添加停止执行功能
let isExecutionStopped = false;
let isExecutionPaused = false;
let currentExecutionTabId = null;

// 窗口管理相关变量
let windowManager = null;
let mainWindowId = null;
let windowStack = [];
let windowCreationPromises = new Map();

// 监听来自弹出界面的消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // 处理浮层控制面板的转发请求
  if (request.action === "forwardToContentScript") {
    console.log(`📡 Background收到转发请求: ${request.targetAction}`, request.targetData);

    // 获取当前活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // 转发消息到 content script
        chrome.tabs.sendMessage(tabs[0].id, {
          action: request.targetAction,
          data: request.targetData
        }).then(response => {
          console.log(`✅ 消息已转发到content script:`, response);
          sendResponse({ success: true, response: response });
        }).catch(error => {
          console.error(`❌ 转发到content script失败:`, error);
          sendResponse({ success: false, error: error.message });
        });
      } else {
        sendResponse({ success: false, error: '没有找到活动标签页' });
      }
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
      message: "Background开始执行多窗口流程"
    });

    // 异步处理执行步骤，并正确处理响应
    handleStepsExecution(request.steps)
      .then((result) => {
        console.log("🪟 Background执行完成:", result);
        sendResponse({ success: true, result: result });
      })
      .catch((error) => {
        console.error("🪟 Background执行失败:", error);
        sendResponse({ success: false, error: error.message });
      });

    // 返回true表示我们将异步发送响应
    return true;
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
    const newWindowPromise = waitForNewWindowAndReady(currentTabId, mockStep)
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
    isExecutionStopped = true;
    isExecutionPaused = false;
    currentExecutionTabId = null;

    // 通知所有标签页执行已停止
    notifyExecutionStatusChange({
      isRunning: false,
      isPaused: false,
      message: "执行已停止"
    });

    sendResponse({ stopped: true });
    return true;
  }

  // 处理更新当前执行窗口的请求
  if (request.action === "updateCurrentExecutionTab" && request.tabId) {
    currentExecutionTabId = request.tabId;
    console.log(`🔄 更新当前执行窗口ID为: ${currentExecutionTabId}`);
    sendResponse({ success: true });
    return true;
  }

  // 处理切换到最新窗口的请求
  if (request.action === "switchToLatestWindow") {
    console.log("🔄 收到切换到最新窗口请求");

    (async () => {
      try {
        // 获取最新的窗口（窗口栈中的最后一个）
        let targetWindowId = null;
        if (windowStack && windowStack.length > 0) {
          targetWindowId = windowStack[windowStack.length - 1];
          console.log(`🎯 目标窗口ID: ${targetWindowId}`);
        }

        if (targetWindowId) {
          // 激活目标窗口
          await chrome.tabs.update(targetWindowId, { active: true });
          console.log(`✅ 成功切换到窗口: ${targetWindowId}`);
          
          // 更新当前执行窗口ID，确保后续操作在新窗口中执行
          currentExecutionTabId = targetWindowId;
          console.log(`🔄 更新当前执行窗口ID为: ${currentExecutionTabId}`);
          
          sendResponse({ 
            success: true, 
            windowId: targetWindowId,
            message: `已切换到窗口 ${targetWindowId}`
          });
        } else {
          console.warn("⚠️ 没有找到可切换的窗口");
          sendResponse({ 
            success: false, 
            error: "没有找到可切换的窗口"
          });
        }
      } catch (error) {
        console.error("❌ 切换窗口失败:", error);
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      }
    })();

    return true; // 保持消息通道开放
  }

  if (request.action === "pauseExecution") {
    isExecutionPaused = true;

    // 通知所有标签页执行已暂停
    notifyExecutionStatusChange({
      isRunning: true,
      isPaused: true,
      message: "执行已暂停"
    });

    sendResponse({ paused: true });
    return true;
  }

  if (request.action === "resumeExecution") {
    isExecutionPaused = false;

    // 通知所有标签页执行已恢复
    notifyExecutionStatusChange({
      isRunning: true,
      isPaused: false,
      message: "执行已恢复"
    });

    sendResponse({ resumed: true });
    return true;
  }

  // 新增：获取执行状态
  if (request.action === "getExecutionStatus") {
    sendResponse({
      isExecuting: !isExecutionStopped, // 如果停止标志为false，则表示正在执行
      isPaused: isExecutionPaused,
      timestamp: Date.now(),
    });
    return true;
  }
});

/**
 * 处理步骤执行（支持多窗口）
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
        console.log(`通信尝试 ${attempt} 失败:`, error.message);

        if (attempt < 3) {
          // 尝试注入content script
          try {
            console.log("尝试注入内容脚本...");
            await injectContentScript(tab.id);
            // 等待脚本加载 - 减少等待时间
            await sleep(300); // 从500ms减少到300ms
          } catch (injectError) {
            console.error("注入内容脚本失败:", injectError.message);
          }
        }
      }
    }

    if (!contentScriptReady) {
      throw new Error(
        "无法与页面脚本建立通信。请尝试以下解决方案：\n1. 刷新目标页面后重试\n2. 确保目标页面是普通网页（http/https）\n3. 重新加载浏览器扩展"
      );
    }

    // 2. 依次执行每个步骤
    for (let i = 0; i < steps.length; i++) {
      // 检查是否已停止执行
      if (isExecutionStopped) {
        throw new Error("操作已被用户手动停止");
      }

      // 检查是否暂停，如果暂停则等待恢复
      while (isExecutionPaused && !isExecutionStopped) {
        console.log("执行已暂停，等待恢复...");
        await sleep(500); // 每500ms检查一次
      }

      // 再次检查是否已停止（可能在暂停期间被停止）
      if (isExecutionStopped) {
        throw new Error("操作已被用户手动停止");
      }

      const step = steps[i];
      console.log(`执行步骤 ${i + 1}/${steps.length}:`, step);

      // 通知UI当前执行的步骤
      chrome.runtime
        .sendMessage({
          action: "executionProgress",
          currentStep: i,
          message: `正在执行步骤 ${i + 1}...`,
          completed: false,
        })
        .catch((err) => console.error("发送进度时出错:", err));

      if (step.action === "loop") {
        // 处理循环操作
        await handleLoopOperation(currentExecutionTabId, step, i);
      } else if (step.action === "newWindow" || step.opensNewWindow) {
        // 处理新窗口操作
        const newTabId = await handleNewWindowStep(currentExecutionTabId, step);
        console.log(`🪟 新窗口已创建并准备就绪: ${newTabId}`);
        // 重要：更新当前执行窗口ID，后续步骤将在新窗口中执行
        currentExecutionTabId = newTabId;
        console.log(`🔄 执行上下文已切换到新窗口: ${newTabId}`);
      } else if (step.action === "closeWindow") {
        // 处理关闭窗口操作
        const returnedTabId = await handleCloseWindowStep(step);
        console.log(`🗑️ 窗口已关闭，当前窗口: ${returnedTabId}`);
      } else {
        // 处理普通操作
        await executeStepWithRetry(currentExecutionTabId, step, i);
      }

      // 操作完成后等待页面稳定 - 根据操作类型调整等待时间
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

    // 所有步骤执行完成
    console.log("所有步骤已成功执行");

    // 重置执行状态
    isExecutionStopped = false;
    isExecutionPaused = false;
    currentExecutionTabId = null;

    // 通知执行完成
    notifyExecutionStatusChange({
      isRunning: false,
      isPaused: false,
      message: "执行完成"
    });

    chrome.runtime
      .sendMessage({
        action: "executionResult",
        result: { success: true, completed: true },
      })
      .catch((err) => console.error("发送成功结果时出错:", err));
  } catch (error) {
    console.error("执行步骤时出错:", error.message, error.stack);

    // 如果是用户手动停止
    if (error.message.includes("操作已被用户手动停止")) {
      chrome.runtime
        .sendMessage({
          action: "executionStopped",
        })
        .catch((err) => console.error("发送停止消息时出错:", err));
    } else {
      // 其他错误
      chrome.runtime
        .sendMessage({
          action: "executionResult",
          result: { success: false, error: error.message, completed: true },
        })
        .catch((err) => console.error("发送错误结果时出错:", err));
    }
  }
}

/**
 * 处理循环操作
 * @param {number} tabId - 标签页ID
 * @param {object} loopStep - 循环步骤配置
 * @param {number} stepIndex - 当前步骤索引
 */
async function handleLoopOperation(tabId, loopStep, stepIndex) {
  // 验证循环步骤配置
  if (!loopStep.loopSteps || loopStep.loopSteps.length === 0) {
    throw new Error(`步骤 ${stepIndex + 1} 的循环操作中没有子步骤`);
  }

  // 获取执行范围参数
  let startIndex = loopStep.startIndex !== undefined ? loopStep.startIndex : 0;
  let endIndex = loopStep.endIndex !== undefined ? loopStep.endIndex : -1;
  let skipIndices =
    loopStep.skipIndices && Array.isArray(loopStep.skipIndices)
      ? loopStep.skipIndices
      : [];

  // 确保startIndex是一个有效的非负整数
  startIndex = Math.max(0, Math.floor(startIndex));

  console.log(`开始循环操作，查找所有匹配元素:`, loopStep.locator);
  console.log(
    `执行范围: 起始=${startIndex}, 结束=${endIndex}, 跳过=[${skipIndices.join(
      ","
    )}]`
  );

  // 查找所有匹配元素
  const response = await sendMessageToTab(
    tabId,
    {
      action: "findAllElements",
      locator: loopStep.locator,
    },
    10000 // 减少到10秒，而不是之前的30秒
  );

  if (!response.success) {
    throw new Error(`查找循环元素失败: ${response.error || "未知错误"}`);
  }

  const elementCount = response.count || 0;
  console.log(`找到 ${elementCount} 个匹配元素`);

  if (elementCount === 0) {
    throw new Error(`没有找到匹配的循环元素`);
  }

  // 计算实际的结束索引
  if (endIndex < 0 || endIndex >= elementCount) {
    endIndex = elementCount - 1;
  }

  // 验证起始索引不超过结束索引和元素总数
  if (startIndex > endIndex) {
    throw new Error(`起始索引(${startIndex})大于结束索引(${endIndex})`);
  }

  if (startIndex >= elementCount) {
    throw new Error(`起始索引(${startIndex})超出了元素总数(${elementCount})`);
  }

  // 记录执行信息
  chrome.runtime
    .sendMessage({
      action: "executionProgress",
      currentStep: stepIndex,
      message: `循环操作 ${stepIndex + 1
        }: 执行范围 ${startIndex} 到 ${endIndex}，共${elementCount}个元素`,
      completed: false,
    })
    .catch((err) => console.error("发送进度时出错:", err));

  // 对指定范围内的元素依次执行循环内的操作
  for (
    let elementIndex = startIndex;
    elementIndex <= endIndex;
    elementIndex++
  ) {
    // 检查是否已停止执行
    if (isExecutionStopped) {
      throw new Error("操作已被用户手动停止");
    }

    // 检查是否暂停，如果暂停则等待恢复
    while (isExecutionPaused && !isExecutionStopped) {
      console.log("循环执行已暂停，等待恢复...");
      await sleep(500);
    }

    // 再次检查是否已停止
    if (isExecutionStopped) {
      throw new Error("操作已被用户手动停止");
    }

    // 检查是否需要跳过当前索引
    if (skipIndices.includes(elementIndex)) {
      console.log(`跳过索引 ${elementIndex}`);
      chrome.runtime
        .sendMessage({
          action: "executionProgress",
          currentStep: stepIndex,
          message: `循环操作 ${stepIndex + 1}: 跳过第 ${elementIndex + 1
            }/${elementCount} 个元素`,
          completed: false,
        })
        .catch((err) => console.error("发送进度时出错:", err));
      continue;
    }

    console.log(`处理第 ${elementIndex + 1}/${elementCount} 个元素`);

    // 通知UI当前循环进度
    chrome.runtime
      .sendMessage({
        action: "executionProgress",
        currentStep: stepIndex,
        message: `循环操作 ${stepIndex + 1}: 处理第 ${elementIndex + 1
          }/${elementCount} 个元素`,
        completed: false,
      })
      .catch((err) => console.error("发送进度时出错:", err));

    // 1. 首先点击当前循环元素
    const clickResponse = await sendMessageToTab(
      tabId,
      {
        action: "performActionOnElementByIndex",
        locator: loopStep.locator,
        index: elementIndex,
        actionType: "click",
      },
      8000 // 减少到8秒，而不是之前的15秒
    );

    if (!clickResponse.success) {
      throw new Error(
        `点击第 ${elementIndex + 1} 个循环元素失败: ${clickResponse.error || "未知错误"
        }`
      );
    }

    // 等待页面稳定 - 略微减少等待时间
    await sleep(800); // 从1000ms减少到800ms

    // 2. 执行循环内的所有子步骤
    for (let j = 0; j < loopStep.loopSteps.length; j++) {
      // 检查是否已停止执行
      if (isExecutionStopped) {
        throw new Error("操作已被用户手动停止");
      }

      const subStep = loopStep.loopSteps[j];
      console.log(`执行循环内步骤 ${j + 1}/${loopStep.loopSteps.length}`);

      // 通知UI当前子步骤
      chrome.runtime
        .sendMessage({
          action: "executionProgress",
          currentStep: stepIndex,
          message: `循环操作 ${stepIndex + 1}: 元素 ${elementIndex + 1
            }/${elementCount} - 执行子步骤 ${j + 1}`,
          completed: false,
        })
        .catch((err) => console.error("发送进度时出错:", err));

      // 执行子步骤
      await executeStepWithRetry(tabId, subStep, `${stepIndex}.${j}`);

      // 子步骤之间稍作等待 - 减少等待时间
      await sleep(600); // 从800ms减少到600ms
    }

    // 等待这轮循环完成后再继续下一个元素 - 减少等待时间
    await sleep(1000); // 从1500ms减少到1000ms
  }

  console.log(`循环操作完成，已执行从 ${startIndex} 到 ${endIndex} 的元素`);
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

      const response = await sendMessageToTab(
        tabId,
        {
          action: "performAction",
          config: step,
        },
        8000 // 减少到8秒，而不是之前的15秒
      );

      if (!response) {
        throw new Error("没有收到响应");
      }

      if (!response.success) {
        throw new Error(response.error || "操作执行失败");
      }

      console.log(`步骤 ${stepIdentifier} 执行成功:`, response);
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
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (tabs.length === 0) {
        reject(new Error("没有找到活动标签页"));
      } else {
        resolve(tabs[0]);
      }
    });
  });
}

/**
 * 向标签页发送消息
 * @param {number} tabId - 标签页ID
 * @param {object} message - 要发送的消息
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<any>} 响应结果
 */
function sendMessageToTab(tabId, message, timeout = 30000) {
  // 根据操作类型优化超时时间
  let adjustedTimeout = timeout;
  if (message.action === "findAllElements") {
    adjustedTimeout = Math.min(timeout, 30000); // 最多30秒
  } else if (message.action === "performAction") {
    adjustedTimeout = Math.min(timeout, 30000); // 最多30秒
  } else if (message.action === "performActionOnElementByIndex") {
    adjustedTimeout = Math.min(timeout, 30000); // 最多30秒
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.warn(`向标签页 ${tabId} 发送消息超时: ${message.action}`);
      reject(new Error(`消息发送超时（${adjustedTimeout}ms）`));
    }, adjustedTimeout);

    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError) {
          console.error(`发送消息失败:`, chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!response) {
          console.error(`未收到响应:`, message);
          reject(new Error("没有收到响应"));
        } else {
          // 成功响应
          resolve(response);
        }
      });
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`发送消息异常:`, error);
      reject(error);
    }
  });
}

/**
 * 注入Content Script到页面
 * @param {number} tabId - 标签页ID
 * @returns {Promise<void>}
 */
function injectContentScript(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabId },
        files: ["/content/content-modular.js"],
      },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              `无法注入Content Script: ${chrome.runtime.lastError.message}`
            )
          );
        } else {
          console.log("Content Script注入成功");
          resolve();
        }
      }
    );
  });
}

/**
 * 睡眠指定的毫秒数
 * @param {number} ms - 睡眠时间（毫秒）
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'sendToWebpageStorage') {
    console.log('📡 Background收到数据同步请求:', message.data);

    // 获取所有标签页并转发消息，不仅仅是当前活动标签页
    chrome.tabs.query({}, (tabs) => {
      let successCount = 0;
      let errorCount = 0;

      tabs.forEach(tab => {
        // 跳过chrome://等特殊页面
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'sendToLocalStorage',
            data: message.data
          }).then(() => {
            successCount++;
            console.log(`✅ 数据已同步到标签页: ${tab.url}`);
          }).catch(error => {
            errorCount++;
            console.log(`⚠️ 同步到标签页失败: ${tab.url}`, error.message);
          });
        }
      });

      console.log(`📊 数据同步请求已发送到 ${tabs.length} 个标签页`);
    });

    sendResponse({ success: true });
  }
});

/**
 * 初始化窗口管理器
 * @param {number} tabId - 主窗口标签页ID
 */
function initializeWindowManager(tabId) {
  mainWindowId = tabId;
  windowStack = [tabId];
  currentExecutionTabId = tabId;

  console.log(`🏠 初始化窗口管理器，主窗口: ${tabId}`);

  // 监听新窗口创建事件
  if (!chrome.tabs.onCreated.hasListener(handleNewTabCreated)) {
    chrome.tabs.onCreated.addListener(handleNewTabCreated);
  }

  // 监听窗口关闭事件
  if (!chrome.tabs.onRemoved.hasListener(handleTabRemoved)) {
    chrome.tabs.onRemoved.addListener(handleTabRemoved);
  }

  // 监听窗口更新事件
  if (!chrome.tabs.onUpdated.hasListener(handleTabUpdated)) {
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
  }
}

/**
 * 处理新标签页创建事件
 * @param {chrome.tabs.Tab} tab - 新创建的标签页
 */
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
      currentExecutionTabId = previousWindow;
      console.log(`🔄 切换到上一个窗口: ${previousWindow}`);
    }
  }
}

/**
 * 处理标签页更新事件
 * @param {number} tabId - 标签页ID
 * @param {object} changeInfo - 变更信息
 * @param {chrome.tabs.Tab} tab - 标签页对象
 */
function handleTabUpdated(tabId, changeInfo, tab) {
  // 当页面加载完成时，可以进行一些初始化操作
  if (changeInfo.status === 'complete' && tab.url) {
    console.log(`📄 窗口页面加载完成: ${tabId}, URL: ${tab.url}`);
  }
}

/**
 * 等待新窗口创建
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<number>} 新窗口的标签页ID
 */
function waitForNewWindow(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`等待新窗口超时（${timeout}ms）`));
    }, timeout);

    // 创建一个唯一的Promise标识
    const promiseId = Date.now() + Math.random();

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

/**
 * 将窗口推入栈顶
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
 * @returns {Promise<number|null>} 返回的窗口ID
 */
async function closeCurrentAndReturnToPrevious() {
  const currentWindow = currentExecutionTabId;
  if (!currentWindow) {
    throw new Error('没有当前活动窗口');
  }

  // 如果当前窗口是主窗口，不允许关闭
  if (currentWindow === mainWindowId) {
    throw new Error('不能关闭主窗口');
  }

  // 获取上一个窗口
  const currentIndex = windowStack.indexOf(currentWindow);

  if (currentIndex <= 0) {
    throw new Error('没有可返回的上一个窗口');
  }

  const previousWindow = windowStack[currentIndex - 1];

  // 先切换到上一个窗口
  await switchToWindow(previousWindow);

  // 然后关闭当前窗口
  await closeWindow(currentWindow);

  console.log(`🔄 已关闭窗口 ${currentWindow} 并返回到窗口 ${previousWindow}`);
  return previousWindow;
}

/**
 * 等待窗口页面加载完成
 * @param {number} tabId - 窗口标签页ID
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<void>}
 */
async function waitForWindowReady(tabId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`等待窗口加载超时: ${tabId}`));
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
  const response = await sendMessageToTab(currentTabId, {
    action: "performAction",
    config: step,
  });

  if (!response.success) {
    throw new Error(`执行新窗口触发操作失败: ${response.error}`);
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

  if (step.closeTarget === 'current') {
    // 关闭当前窗口并返回上一个
    return await closeCurrentAndReturnToPrevious();
  } else if (step.closeTarget === 'specific' && step.targetWindowId) {
    // 关闭指定窗口
    await closeWindow(step.targetWindowId);
    return currentExecutionTabId;
  } else {
    throw new Error('无效的关闭窗口配置');
  }
}

/**
 * 通知所有标签页执行状态变化
 * @param {Object} statusData - 状态数据
 */
function notifyExecutionStatusChange(statusData) {
  // 获取所有标签页
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      // 向每个标签页发送状态更新消息
      chrome.tabs.sendMessage(tab.id, {
        action: 'executionStatusUpdate',
        data: statusData
      }).catch(err => {
        // 忽略无法发送消息的标签页（可能没有content script）
        console.log(`无法向标签页 ${tab.id} 发送状态更新:`, err.message);
      });
    });
  });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(registration => {
      console.log('Service Worker registered:', registration);
    })
    .catch(error => {
      console.error('Service Worker registration failed:', error);
      // Handle specific error codes
      if (error.name === 'SecurityError') {
        console.error('Service Worker registration failed due to security restrictions');
      } else if (error.name === 'NetworkError') {
        console.error('Service Worker registration failed due to network issues');
      } else {
        console.error(`Service Worker registration failed with error: ${error.message}`);
      }
    });
} else {
  console.warn('Service Workers are not supported in this browser');
}
