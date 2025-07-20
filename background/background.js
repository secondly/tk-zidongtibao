// 添加停止执行功能
let isExecutionStopped = false;

// 监听来自弹出界面的消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "executeSteps") {
    // 重置停止标志
    isExecutionStopped = false;

    // 立即返回初始响应，确保通信通道保持开放
    sendResponse({ received: true, initializing: true });

    // 通知UI操作已开始
    chrome.runtime
      .sendMessage({
        action: "executionStarted",
      })
      .catch((err) => console.error("发送开始消息时出错:", err));

    // 然后异步处理执行步骤
    handleStepsExecution(request.steps);

    // 返回true表示我们将异步发送响应
    return true;
  }

  if (request.action === "stopExecution") {
    isExecutionStopped = true;
    sendResponse({ stopped: true });
    return true;
  }

  // 新增：获取执行状态
  if (request.action === "getExecutionStatus") {
    sendResponse({
      isExecuting: !isExecutionStopped, // 如果停止标志为false，则表示正在执行
      timestamp: Date.now(),
    });
    return true;
  }
});

/**
 * 处理步骤执行
 * @param {Array} steps - 要执行的步骤配置
 */
async function handleStepsExecution(steps) {
  try {
    // 调试信息
    console.log("开始执行步骤:", steps);

    // 1. 获取当前激活的标签页
    const tab = await getCurrentTab();
    console.log("已获取当前标签页:", tab.id);

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
        await handleLoopOperation(tab.id, step, i);
      } else {
        // 处理普通操作
        await executeStepWithRetry(tab.id, step, i);
      }

      // 操作完成后等待页面稳定 - 根据操作类型调整等待时间
      if (step.action === "wait" || step.action === "input") {
        // 简单操作等待时间较短
        await sleep(800); // 从1500ms减少到800ms
      } else {
        // 复杂操作等待时间稍长
        await sleep(1200); // 从1500ms减少到1200ms
      }
    }

    // 所有步骤执行完成
    console.log("所有步骤已成功执行");
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
      message: `循环操作 ${
        stepIndex + 1
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

    // 检查是否需要跳过当前索引
    if (skipIndices.includes(elementIndex)) {
      console.log(`跳过索引 ${elementIndex}`);
      chrome.runtime
        .sendMessage({
          action: "executionProgress",
          currentStep: stepIndex,
          message: `循环操作 ${stepIndex + 1}: 跳过第 ${
            elementIndex + 1
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
        message: `循环操作 ${stepIndex + 1}: 处理第 ${
          elementIndex + 1
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
        `点击第 ${elementIndex + 1} 个循环元素失败: ${
          clickResponse.error || "未知错误"
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
          message: `循环操作 ${stepIndex + 1}: 元素 ${
            elementIndex + 1
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
        files: ["/content/content.js"],
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
