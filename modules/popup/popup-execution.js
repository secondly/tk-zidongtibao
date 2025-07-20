/**
 * 弹窗执行模块
 * 负责工作流的执行控制，包括执行、暂停、继续、停止功能
 */

import { debugLog, updateExecutionStatus, showStatus } from '../../shared/popup/popup-utils.js';
import { EXECUTION_STATUS } from '../../shared/popup/popup-constants.js';
import { getCurrentWorkflow } from './popup-core.js';

// 执行状态管理
let executionState = {
    isRunning: false,
    isPaused: false,
    currentStep: 0,
    startTime: null,
    totalSteps: 0,
    completedSteps: 0,
    errors: []
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
    debugLog('开始执行工作流');

    const currentWorkflow = getCurrentWorkflow();

    if (!currentWorkflow || !currentWorkflow.steps || currentWorkflow.steps.length === 0) {
        showStatus('请先选择一个配置并确保包含步骤', 'warning');
        return;
    }

    try {
        // 检查是否已在执行中
        if (executionState.isRunning) {
            showStatus('工作流正在执行中', 'warning');
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
        updateExecutionStatus(EXECUTION_STATUS.RUNNING, '正在执行工作流...');

        // 获取当前活动标签页
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
            throw new Error('无法获取当前标签页');
        }

        const tab = tabs[0];
        debugLog('目标标签页:', tab.url);

        // 检查content script是否已注入
        const isContentScriptReady = await checkContentScript(tab.id);

        if (!isContentScriptReady) {
            debugLog('Content script未就绪，尝试注入');
            await injectContentScript(tab.id);

            // 等待一段时间让content script初始化
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 执行工作流
        const result = await executeWorkflowWithTimeout(tab.id, currentWorkflow);

        // 执行完成
        resetExecutionState();
        updateExecutionStatus(EXECUTION_STATUS.COMPLETED, '工作流执行完成');
        showStatus('工作流执行完成', 'success');

        debugLog('工作流执行完成:', result);

    } catch (error) {
        console.error('执行工作流失败:', error);
        resetExecutionState();
        updateExecutionStatus(EXECUTION_STATUS.ERROR, `执行失败: ${error.message}`);
        showStatus(`执行失败: ${error.message}`, 'error');
    }
}

/**
 * 暂停/继续执行
 */
export async function togglePauseResume() {
    debugLog('togglePauseResume 被调用，当前状态:', {
        isRunning: executionState.isRunning,
        isPaused: executionState.isPaused
    });

    if (!executionState.isRunning) {
        debugLog('工作流未运行，忽略暂停/继续操作');
        return;
    }

    try {
        // 获取当前活动标签页
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
            throw new Error('无法获取当前标签页');
        }

        const tab = tabs[0];

        if (executionState.isPaused) {
            // 继续执行
            debugLog('发送继续执行消息');
            executionState.isPaused = false;
            updateExecutionUI();
            updateExecutionStatus(EXECUTION_STATUS.RUNNING, '继续执行中...');

            await chrome.tabs.sendMessage(tab.id, {
                action: 'resumeExecution'
            });

        } else {
            // 暂停执行
            debugLog('发送暂停执行消息');
            executionState.isPaused = true;
            updateExecutionUI();
            updateExecutionStatus(EXECUTION_STATUS.PAUSED, '执行已暂停');

            await chrome.tabs.sendMessage(tab.id, {
                action: 'pauseExecution'
            });
        }

    } catch (error) {
        console.error('暂停/继续执行失败:', error);
        showStatus(`操作失败: ${error.message}`, 'error');
    }
}

/**
 * 停止执行
 */
export async function stopExecution() {
    debugLog('stopExecution 被调用');

    if (!executionState.isRunning) {
        debugLog('工作流未运行，忽略停止操作');
        return;
    }

    try {
        // 获取当前活动标签页
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
            throw new Error('无法获取当前标签页');
        }

        const tab = tabs[0];

        debugLog('发送停止执行消息');
        await chrome.tabs.sendMessage(tab.id, {
            action: 'stopExecution'
        });

        // 重置执行状态
        resetExecutionState();
        updateExecutionStatus(EXECUTION_STATUS.IDLE, '执行已停止');
        showStatus('执行已停止', 'info');

    } catch (error) {
        console.error('停止执行失败:', error);
        resetExecutionState();
        showStatus(`停止失败: ${error.message}`, 'error');
    }
}

/**
 * 重置执行状态
 */
export function resetExecutionState() {
    debugLog('重置执行状态');

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
    const event = new CustomEvent('executionStateReset');
    window.dispatchEvent(event);
}

/**
 * 更新执行UI
 */
function updateExecutionUI() {
    debugLog('更新执行UI');

    // 更新执行按钮状态
    const executeBtn = document.getElementById('executeBtn');
    const pauseResumeBtn = document.getElementById('pauseResumeBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (executeBtn) {
        executeBtn.disabled = executionState.isRunning;
        executeBtn.textContent = executionState.isRunning ? '执行中...' : '执行';
    }

    if (pauseResumeBtn) {
        pauseResumeBtn.disabled = !executionState.isRunning;
        pauseResumeBtn.textContent = executionState.isPaused ? '继续' : '暂停';
    }

    if (stopBtn) {
        stopBtn.disabled = !executionState.isRunning;
    }

    // 更新进度显示
    updateProgressDisplay();

    // 触发UI更新事件
    const event = new CustomEvent('executionUIUpdated', {
        detail: { executionState: getExecutionState() }
    });
    window.dispatchEvent(event);
}

/**
 * 更新进度显示
 */
function updateProgressDisplay() {
    const progressContainer = document.getElementById('executionProgress');
    if (!progressContainer) return;

    if (executionState.isRunning && executionState.totalSteps > 0) {
        const percentage = Math.round((executionState.completedSteps / executionState.totalSteps) * 100);

        progressContainer.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="progress-text">
                ${executionState.completedSteps} / ${executionState.totalSteps} 步骤 (${percentage}%)
            </div>
        `;
        progressContainer.style.display = 'block';
    } else {
        progressContainer.style.display = 'none';
    }
}

/**
 * 检查content script是否已注入
 * @param {number} tabId - 标签页ID
 * @returns {Promise<boolean>} 是否已注入
 */
async function checkContentScript(tabId) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        return response && response.status === 'ready';
    } catch (error) {
        debugLog('Content script检查失败:', error.message);
        return false;
    }
}

/**
 * 注入content script
 * @param {number} tabId - 标签页ID
 */
async function injectContentScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content/content.js']
        });
        debugLog('Content script注入成功');
    } catch (error) {
        console.error('注入content script失败:', error);
        throw new Error('无法注入执行脚本');
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
            reject(new Error('执行超时'));
        }, timeout);

        // 发送消息到content script执行
        chrome.tabs.sendMessage(tabId, {
            action: 'executeWorkflow',
            data: workflow
        }, (response) => {
            clearTimeout(timeoutId);

            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            if (response && response.success) {
                resolve(response);
            } else {
                reject(new Error(response?.error || '执行失败'));
            }
        });
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

    if (progressData.error) {
        executionState.errors.push(progressData.error);
    }

    // 更新UI
    updateProgressDisplay();

    // 更新状态消息
    if (progressData.message) {
        updateExecutionStatus(EXECUTION_STATUS.RUNNING, progressData.message);
    }

    debugLog('执行进度更新:', progressData);
}

/**
 * 初始化执行模块事件监听器
 */
export function initializeExecutionListeners() {
    debugLog('初始化执行模块事件监听器');

    // 执行按钮
    const executeBtn = document.getElementById('executeBtn');
    if (executeBtn) {
        executeBtn.addEventListener('click', executeWorkflow);
    }

    // 暂停/继续按钮
    const pauseResumeBtn = document.getElementById('pauseResumeBtn');
    if (pauseResumeBtn) {
        pauseResumeBtn.addEventListener('click', togglePauseResume);
    }

    // 停止按钮
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) {
        stopBtn.addEventListener('click', stopExecution);
    }

    // 监听来自content script的消息
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'executionProgress') {
                handleExecutionProgress(message.data);
                sendResponse({ received: true });
            }
        });
    }

    debugLog('执行模块事件监听器已设置');
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
            percentage: executionState.totalSteps > 0 ?
                Math.round((executionState.completedSteps / executionState.totalSteps) * 100) : 0
        },
        timing: {
            startTime: executionState.startTime,
            elapsed: executionState.startTime ? Date.now() - executionState.startTime : 0
        },
        errors: [...executionState.errors]
    };

    return stats;
}