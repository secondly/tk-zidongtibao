/**
 * 弹窗执行模块
 * 负责工作流的执行控制，包括执行、暂停、继续、停止功能
 */

import {
  debugLog,
  updateExecutionStatus,
  showStatus,
} from "../../shared/popup/popup-utils.js";
import { EXECUTION_STATUS } from "../../shared/popup/popup-constants.js";
import { getCurrentWorkflow } from "./popup-core.js";

// 执行状态管理
let executionState = {
  isRunning: false,
  isPaused: false,
  currentStep: 0,
  startTime: null,
  totalSteps: 0,
  completedSteps: 0,
  errors: [],
};

/**
 * 获取当前执行状态
 * @returns {Object} 执行状态对象
 */
export function getExecutionState() {
  return { ...executionState };
}

/**
 * 执行工作流
 */
export async function executeWorkflow() {
  debugLog("开始执行工作流");

  const currentWorkflow = getCurrentWorkflow();

  if (
    !currentWorkflow ||
    !currentWorkflow.steps ||
    currentWorkflow.steps.length === 0
  ) {
    showStatus("请先选择一个配置并确保包含步骤", "warning");
    return;
  }

  try {
    // 检查是否已在执行中
    if (executionState.isRunning) {
      showStatus("工作流正在执行中", "warning");
      return;
    }

    // 重置执行状态
    resetExecutionState();

    // 更新执行状态
    executionState.isRunning = true;
    executionState.isPaused = false;
    executionState.currentStep = 0;
    executionState.startTime = Date.now();
    executionState.totalSteps = currentWorkflow.steps.length;
    executionState.completedSteps = 0;
    executionState.errors = [];

    // 更新UI
    updateExecutionUI();
    updateExecutionStatus(EXECUTION_STATUS.RUNNING, "正在执行工作流...");

    // 立即保存执行状态（包含selectedConfigIndex）
    if (typeof window.saveExecutionStateToCache === 'function') {
      window.saveExecutionStateToCache();
    }

    // 显示标签页选择器让用户选择目标页面
    const tab = await selectTargetTab();
    if (!tab) {
      resetExecutionState();
      updateExecutionStatus(EXECUTION_STATUS.IDLE, "已取消执行");
      return;
    }

    debugLog("选择的目标标签页:", tab.url);

    // 检查content script是否已就绪，多次尝试
    let isContentScriptReady = false;
    let attempts = 0;
    const maxAttempts = 3; // 减少尝试次数，但增加每次尝试的可靠性

    while (!isContentScriptReady && attempts < maxAttempts) {
      attempts++;
      debugLog(`第 ${attempts} 次检查 content script 状态...`);

      try {
        isContentScriptReady = await checkContentScript(tab.id);

        if (isContentScriptReady) {
          debugLog("Content script 检查成功，已就绪");
          break;
        }
      } catch (error) {
        debugLog(`第 ${attempts} 次检查失败:`, error.message);
      }

      if (!isContentScriptReady && attempts < maxAttempts) {
        const waitTime = Math.min(attempts * 1000, 3000); // 最多等待3秒
        debugLog(`Content script 未就绪，等待 ${waitTime}ms 后重试...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    if (!isContentScriptReady) {
      // 提供更友好的错误信息和解决方案
      const errorMessage = `Content script 未能正确加载，已尝试 ${maxAttempts} 次。

可能的解决方案：
1. 刷新目标页面后重试
2. 确保目标页面是普通网页（http/https）
3. 检查页面是否完全加载完成
4. 尝试关闭并重新打开目标页面

如果问题持续存在，请检查浏览器控制台是否有错误信息。`;

      throw new Error(errorMessage);
    }

    debugLog("Content script 已就绪，开始执行工作流");

    // 执行工作流
    const result = await executeWorkflowWithTimeout(tab.id, currentWorkflow);

    // 执行完成
    resetExecutionState();
    updateExecutionStatus(EXECUTION_STATUS.COMPLETED, "工作流执行完成");
    showStatus("工作流执行完成", "success");

    debugLog("工作流执行完成:", result);
  } catch (error) {
    console.error("执行工作流失败:", error);
    resetExecutionState();

    // 根据错误类型提供不同的处理
    let errorMessage = error.message;
    let statusType = "error";

    if (error.message.includes("Content script")) {
      statusType = "warning";
      errorMessage = "页面脚本加载失败，请刷新目标页面后重试";
    } else if (error.message.includes("TabSelector")) {
      statusType = "warning";
      errorMessage = "页面选择器加载失败，已使用默认页面";
    } else if (error.message.includes("无法选择目标标签页")) {
      statusType = "warning";
      errorMessage = "请确保至少有一个网页打开";
    }

    updateExecutionStatus(EXECUTION_STATUS.ERROR, `执行失败: ${errorMessage}`);
    showStatus(`执行失败: ${errorMessage}`, statusType);

    // 如果是content script问题，提供额外的帮助信息
    if (error.message.includes("Content script")) {
      setTimeout(() => {
        showStatus("提示：如果问题持续存在，请尝试重新加载扩展程序", "info");
      }, 3000);
    }
  }
}

/**
 * 暂停/继续执行
 */
export async function togglePauseResume() {
  debugLog("togglePauseResume 被调用，当前状态:", {
    isRunning: executionState.isRunning,
    isPaused: executionState.isPaused,
  });

  if (!executionState.isRunning) {
    debugLog("工作流未运行，忽略暂停/继续操作");
    return;
  }

  try {
    // 获取当前活动标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error("无法获取当前标签页");
    }

    const tab = tabs[0];

    if (executionState.isPaused) {
      // 继续执行
      debugLog("发送继续执行消息");
      executionState.isPaused = false;
      updateExecutionUI();
      updateExecutionStatus(EXECUTION_STATUS.RUNNING, "继续执行中...");

      await chrome.tabs.sendMessage(tab.id, {
        action: "resumeExecution",
      });
    } else {
      // 暂停执行
      debugLog("发送暂停执行消息");
      executionState.isPaused = true;
      updateExecutionUI();
      updateExecutionStatus(EXECUTION_STATUS.PAUSED, "执行已暂停");

      await chrome.tabs.sendMessage(tab.id, {
        action: "pauseExecution",
      });
    }
  } catch (error) {
    console.error("暂停/继续执行失败:", error);
    showStatus(`操作失败: ${error.message}`, "error");
  }
}

/**
 * 停止执行
 */
export async function stopExecution() {
  debugLog("stopExecution 被调用");

  if (!executionState.isRunning) {
    debugLog("工作流未运行，忽略停止操作");
    return;
  }

  try {
    // 获取当前活动标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error("无法获取当前标签页");
    }

    const tab = tabs[0];

    debugLog("发送停止执行消息");
    await chrome.tabs.sendMessage(tab.id, {
      action: "stopExecution",
    });

    // 重置执行状态
    resetExecutionState();
    updateExecutionStatus(EXECUTION_STATUS.IDLE, "执行已停止");
    showStatus("执行已停止", "info");
  } catch (error) {
    console.error("停止执行失败:", error);
    resetExecutionState();
    showStatus(`停止失败: ${error.message}`, "error");
  }
}

/**
 * 重置执行状态
 */
export function resetExecutionState() {
  debugLog("重置执行状态");

  executionState.isRunning = false;
  executionState.isPaused = false;
  executionState.currentStep = 0;
  executionState.startTime = null;
  executionState.totalSteps = 0;
  executionState.completedSteps = 0;
  executionState.errors = [];

  // 更新UI
  updateExecutionUI();

  // 触发状态重置事件
  const event = new CustomEvent("executionStateReset");
  window.dispatchEvent(event);
}

/**
 * 更新执行UI
 */
function updateExecutionUI() {
  debugLog("更新执行UI");

  // 更新执行按钮状态
  const executeBtn = document.getElementById("executeBtn");
  const pauseResumeBtn = document.getElementById("pauseResumeBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (executeBtn) {
    executeBtn.disabled = executionState.isRunning;
    executeBtn.textContent = executionState.isRunning ? "执行中..." : "执行工作流";
    // 控制执行按钮的显示/隐藏
    if (executionState.isRunning) {
      executeBtn.style.display = "none";
    } else {
      executeBtn.style.display = "block";
    }
  }

  if (pauseResumeBtn) {
    pauseResumeBtn.disabled = !executionState.isRunning;
    pauseResumeBtn.textContent = executionState.isPaused ? "继续" : "暂停";
  }

  if (stopBtn) {
    stopBtn.disabled = !executionState.isRunning;
  }

  // 控制执行控制按钮的显示/隐藏
  const executionControls = document.getElementById("executionControls");
  if (executionControls) {
    if (executionState.isRunning) {
      executionControls.style.display = "flex";
    } else {
      executionControls.style.display = "none";
    }
  }

  // 简化日志输出
  debugLog(`UI更新: 运行=${executionState.isRunning}, 暂停=${executionState.isPaused}`);

  // 更新进度显示
  updateProgressDisplay();

  // 触发UI更新事件
  const event = new CustomEvent("executionUIUpdated", {
    detail: { executionState: getExecutionState() },
  });
  window.dispatchEvent(event);
}

/**
 * 更新进度显示
 */
function updateProgressDisplay() {
  const progressContainer = document.getElementById("executionProgress");
  if (!progressContainer) return;

  if (executionState.isRunning && executionState.totalSteps > 0) {
    const percentage = Math.round(
      (executionState.completedSteps / executionState.totalSteps) * 100
    );

    progressContainer.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="progress-text">
                ${executionState.completedSteps} / ${executionState.totalSteps} 步骤 (${percentage}%)
            </div>
        `;
    progressContainer.style.display = "block";
  } else {
    progressContainer.style.display = "none";
  }
}

/**
 * 选择目标标签页
 * @returns {Promise<Object|null>} 选中的标签页对象或null
 */
async function selectTargetTab() {
  try {
    // 确保TabSelector已加载，如果未加载则尝试动态加载
    if (typeof TabSelector === "undefined") {
      debugLog("TabSelector 未加载，尝试动态加载...");
      try {
        // 尝试从全局作用域获取
        if (window.TabSelector) {
          window.TabSelector = window.TabSelector;
        } else {
          // 如果仍然没有，则降级到简单的标签页选择
          debugLog("TabSelector 不可用，使用简单标签页选择");
          return await selectTargetTabFallback();
        }
      } catch (loadError) {
        debugLog("动态加载TabSelector失败:", loadError);
        return await selectTargetTabFallback();
      }
    }

    // 创建TabSelector实例
    const tabSelector = new TabSelector();

    // 显示标签页选择器
    const selectedTab = await tabSelector.showTabSelector();

    if (!selectedTab) {
      debugLog("用户取消了标签页选择");
      return null;
    }

    // 检查选中的标签页URL是否可以注入content script
    if (!isInjectableUrl(selectedTab.url)) {
      throw new Error(
        `无法在此页面执行工作流: ${selectedTab.url}\n请选择普通网页（http://、https:// 或 file://）`
      );
    }

    return selectedTab;
  } catch (error) {
    console.error("选择目标标签页失败:", error);
    // 如果TabSelector失败，尝试降级方案
    debugLog("TabSelector失败，尝试降级方案...");
    return await selectTargetTabFallback();
  }
}

/**
 * 降级的标签页选择方案
 * @returns {Promise<Object|null>} 选中的标签页对象或null
 */
async function selectTargetTabFallback() {
  try {
    // 获取所有标签页
    const tabs = await chrome.tabs.query({});

    // 过滤有效的标签页
    const validTabs = tabs.filter(
      (tab) =>
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://") &&
        (tab.url.startsWith("http") || tab.url.startsWith("file://"))
    );

    if (validTabs.length === 0) {
      throw new Error(
        "没有找到可执行工作流的页面。请打开一些网页或本地HTML文件。"
      );
    }

    // 如果只有一个有效标签页，直接使用
    if (validTabs.length === 1) {
      debugLog("只有一个有效标签页，直接使用:", validTabs[0].title);
      return validTabs[0];
    }

    // 优先使用当前活动标签页（如果它是有效的）
    const activeTabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTabs.length > 0) {
      const activeTab = activeTabs[0];
      if (isInjectableUrl(activeTab.url)) {
        debugLog("使用当前活动标签页:", activeTab.title);
        return activeTab;
      }
    }

    // 使用第一个有效标签页
    debugLog("使用第一个有效标签页:", validTabs[0].title);
    return validTabs[0];
  } catch (error) {
    console.error("降级标签页选择失败:", error);
    throw new Error("无法选择目标标签页，请确保至少有一个可访问的网页打开");
  }
}

/**
 * 检查URL是否可以注入content script
 * @param {string} url - 页面URL
 * @returns {boolean} 是否可以注入
 */
function isInjectableUrl(url) {
  if (!url) return false;

  // 不允许的协议
  const blockedProtocols = [
    "chrome://",
    "chrome-extension://",
    "moz-extension://",
    "edge://",
    "about:",
    "data:",
    "javascript:",
  ];

  // 检查是否是被阻止的协议
  for (const protocol of blockedProtocols) {
    if (url.startsWith(protocol)) {
      return false;
    }
  }

  // 允许 http://、https:// 和 file://
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("file://")
  );
}

/**
 * 检查content script是否已注入
 * @param {number} tabId - 标签页ID
 * @returns {Promise<boolean>} 是否已注入
 */
async function checkContentScript(tabId) {
  try {
    debugLog(`向标签页 ${tabId} 发送ping消息...`);

    // 使用Promise.race来设置超时
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { action: "ping" }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("ping超时")), 2000)
      ),
    ]);

    debugLog("收到ping响应:", response);

    const isReady = response && response.status === "ready";
    debugLog(`Content script 状态: ${isReady ? "就绪" : "未就绪"}`);

    return isReady;
  } catch (error) {
    debugLog("Content script检查失败:", error.message);

    // 如果是通信错误，尝试注入content script
    if (
      error.message.includes("Could not establish connection") ||
      error.message.includes("ping超时") ||
      error.message.includes("Receiving end does not exist")
    ) {
      debugLog("检测到通信错误，尝试注入content script...");
      try {
        await injectContentScript(tabId);
        // 注入后等待一下再检查
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 再次尝试ping
        const retryResponse = await Promise.race([
          chrome.tabs.sendMessage(tabId, { action: "ping" }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("重试ping超时")), 2000)
          ),
        ]);

        return retryResponse && retryResponse.status === "ready";
      } catch (injectError) {
        debugLog("注入content script失败:", injectError.message);
        return false;
      }
    }

    return false;
  }
}

/**
 * 注入content script
 * @param {number} tabId - 标签页ID
 */
async function injectContentScript(tabId) {
  try {
    debugLog(`开始向标签页 ${tabId} 注入content script...`);

    // 首先检查标签页是否存在且可访问
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      throw new Error("标签页不存在");
    }

    if (!isInjectableUrl(tab.url)) {
      throw new Error(`页面URL不支持脚本注入: ${tab.url}`);
    }

    // 注入content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content/content.js"],
    });

    debugLog("Content script注入成功");

    // 等待脚本初始化
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (error) {
    console.error("注入content script失败:", error);

    // 提供更详细的错误信息
    if (error.message.includes("Cannot access")) {
      throw new Error("无法访问目标页面，可能是权限限制或页面已关闭");
    } else if (error.message.includes("No tab with id")) {
      throw new Error("目标标签页已关闭或不存在");
    } else {
      throw new Error(`无法注入执行脚本: ${error.message}`);
    }
  }
}

/**
 * 带超时的工作流执行
 * @param {number} tabId - 标签页ID
 * @param {Object} workflow - 工作流数据
 * @param {number} timeout - 超时时间(ms)，默认30秒
 * @returns {Promise} 执行结果
 */
function executeWorkflowWithTimeout(tabId, workflow, timeout = 30000) {
  return new Promise((resolve, reject) => {
    // 设置超时
    const timeoutId = setTimeout(() => {
      reject(new Error("执行超时"));
    }, timeout);

    // 发送消息到content script执行
    chrome.tabs.sendMessage(
      tabId,
      {
        action: "executeWorkflow",
        data: workflow,
      },
      (response) => {
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || "执行失败"));
        }
      }
    );
  });
}

/**
 * 处理执行进度更新
 * @param {Object} progressData - 进度数据
 */
export function handleExecutionProgress(progressData) {
  if (progressData.currentStep !== undefined) {
    executionState.currentStep = progressData.currentStep;
  }

  if (progressData.completedSteps !== undefined) {
    executionState.completedSteps = progressData.completedSteps;
  }

  if (progressData.totalSteps !== undefined) {
    executionState.totalSteps = progressData.totalSteps;
  }

  if (progressData.error) {
    executionState.errors.push(progressData.error);
  }

  // 更新UI
  updateProgressDisplay();

  // 更新状态消息 - 支持详细信息
  if (progressData.currentOperation || progressData.message) {
    const message = progressData.currentOperation || progressData.message;
    const detailInfo = progressData.loopInfo || null;

    updateExecutionStatus(EXECUTION_STATUS.RUNNING, message, detailInfo);
  }

  // 简化日志输出，只在重要变化时输出
  if (progressData.stepName || progressData.currentStep) {
    debugLog(`进度: 步骤${progressData.currentStep}/${progressData.totalSteps} - ${progressData.stepName || progressData.stepType}`);
  }
}

/**
 * 从缓存恢复执行状态
 * @param {Object} cachedState - 缓存的执行状态
 */
export function restoreExecutionStateFromCache(cachedState) {
  debugLog("从缓存恢复执行状态:", cachedState);

  // 恢复执行状态
  executionState.isRunning = cachedState.isRunning || false;
  executionState.isPaused = cachedState.isPaused || false;
  executionState.currentStep = cachedState.currentStep || 0;
  executionState.startTime = cachedState.startTime || null;
  executionState.totalSteps = cachedState.totalSteps || 0;
  executionState.completedSteps = cachedState.completedSteps || 0;
  executionState.errors = cachedState.errors || [];

  // 恢复配置选择（延迟执行确保DOM已加载）
  if (cachedState.selectedConfigIndex !== undefined) {
    setTimeout(() => {
      const configSelect = document.getElementById('configSelect');
      if (configSelect) {
        configSelect.value = cachedState.selectedConfigIndex;
        debugLog("恢复配置选择:", cachedState.selectedConfigIndex);

        // 触发配置变更事件以更新预览
        const event = new Event('change', { bubbles: true });
        configSelect.dispatchEvent(event);

        // 如果有预览更新函数，也调用一下
        if (typeof window.updateWorkflowPreview === 'function') {
          window.updateWorkflowPreview();
        }
      } else {
        debugLog("配置选择元素未找到，稍后重试");
        // 再次尝试
        setTimeout(() => {
          const configSelect2 = document.getElementById('configSelect');
          if (configSelect2) {
            configSelect2.value = cachedState.selectedConfigIndex;
            const event2 = new Event('change', { bubbles: true });
            configSelect2.dispatchEvent(event2);
          }
        }, 500);
      }
    }, 100);
  }

  // 更新UI
  updateExecutionUI();

  // 更新状态显示
  if (executionState.isRunning) {
    let statusMessage = "";
    if (cachedState.currentOperation) {
      statusMessage = cachedState.currentOperation;
    } else if (executionState.isPaused) {
      statusMessage = "执行已暂停 - 可以继续执行";
    } else {
      statusMessage = "正在执行工作流...";
    }

    if (executionState.isPaused) {
      updateExecutionStatus(EXECUTION_STATUS.PAUSED, statusMessage);
    } else {
      updateExecutionStatus(EXECUTION_STATUS.RUNNING, statusMessage);
    }
  }

  // 显示执行控制按钮
  const executionControls = document.getElementById("executionControls");
  if (executionControls && executionState.isRunning) {
    executionControls.style.display = "flex";
  }

  debugLog("执行状态恢复完成");
}

/**
 * 初始化执行模块事件监听器
 */
export function initializeExecutionListeners() {
  debugLog("初始化执行模块事件监听器");

  // 执行按钮
  const executeBtn = document.getElementById("executeBtn");
  if (executeBtn) {
    executeBtn.addEventListener("click", executeWorkflow);
  }

  // 暂停/继续按钮
  const pauseResumeBtn = document.getElementById("pauseResumeBtn");
  if (pauseResumeBtn) {
    pauseResumeBtn.addEventListener("click", togglePauseResume);
  }

  // 停止按钮
  const stopBtn = document.getElementById("stopBtn");
  if (stopBtn) {
    stopBtn.addEventListener("click", stopExecution);
  }

  // 监听来自content script的消息
  if (typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "executionProgress") {
        handleExecutionProgress(message.data);
        sendResponse({ received: true });
      } else if (message.action === "executionStopped") {
        debugLog("收到执行停止消息");
        resetExecutionState();
        updateExecutionStatus(EXECUTION_STATUS.IDLE, "执行已停止");
        updateExecutionUI();
        sendResponse({ received: true });
      } else if (message.action === "executionPaused") {
        debugLog("收到执行暂停消息");
        executionState.isPaused = true;
        updateExecutionStatus(EXECUTION_STATUS.PAUSED, "执行已暂停");
        updateExecutionUI();
        sendResponse({ received: true });
      } else if (message.action === "executionResumed") {
        debugLog("收到执行继续消息");
        executionState.isPaused = false;
        updateExecutionStatus(EXECUTION_STATUS.RUNNING, "正在执行工作流...");
        updateExecutionUI();
        sendResponse({ received: true });
      }
    });
  }

  debugLog("执行模块事件监听器已设置");
}

/**
 * 获取执行统计信息
 * @returns {Object} 统计信息
 */
export function getExecutionStats() {
  const stats = {
    isRunning: executionState.isRunning,
    isPaused: executionState.isPaused,
    progress: {
      current: executionState.completedSteps,
      total: executionState.totalSteps,
      percentage:
        executionState.totalSteps > 0
          ? Math.round(
              (executionState.completedSteps / executionState.totalSteps) * 100
            )
          : 0,
    },
    timing: {
      startTime: executionState.startTime,
      elapsed: executionState.startTime
        ? Date.now() - executionState.startTime
        : 0,
    },
    errors: [...executionState.errors],
  };

  return stats;
}
