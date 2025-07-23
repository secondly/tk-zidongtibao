/**
 * 弹窗持久化模块
 * 负责状态持久化、缓存管理和数据恢复
 */

import { debugLog, safeJsonParse, safeJsonStringify } from '../../shared/popup/popup-utils.js';
import { STATE_CACHE_KEY, WORKFLOW_CACHE_KEY } from '../../shared/popup/popup-constants.js';
import { setCurrentWorkflow } from './popup-core.js';
import { getExecutionState } from './popup-execution.js';

/**
 * 初始化状态持久化
 */
export function initializeStatePersistence() {
    debugLog('初始化状态持久化功能...');

    // 监听窗口关闭事件
    window.addEventListener('beforeunload', saveStateBeforeClose);

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 监听页面隐藏事件（移动端兼容）
    window.addEventListener('pagehide', saveStateBeforeClose);

    debugLog('状态持久化监听器已设置');
}

/**
 * 窗口关闭前保存状态
 * @param {Event} event - 事件对象
 */
function saveStateBeforeClose(event) {
    debugLog('窗口即将关闭，保存当前状态...');

    try {
        // 保存执行状态
        saveExecutionStateToCache();

        // 保存工作流缓存
        saveWorkflowCache();

        debugLog('状态保存完成');
    } catch (error) {
        console.error('保存状态失败:', error);
    }
}

/**
 * 处理页面可见性变化
 */
function handleVisibilityChange() {
    if (document.hidden) {
        // 页面被隐藏时保存状态
        debugLog('页面被隐藏，保存状态');
        saveStateBeforeClose();
    } else {
        // 页面变为可见时可以选择恢复状态
        debugLog('页面变为可见');
    }
}

/**
 * 保存执行状态到缓存
 */
function saveExecutionStateToCache() {
    try {
        const executionState = getExecutionState();

        const stateCache = {
            timestamp: Date.now(),
            executionState: executionState,
            url: window.location.href,
            userAgent: navigator.userAgent,
            selectedConfigIndex: getSelectedConfigIndex()
        };

        const cacheData = safeJsonStringify(stateCache);
        localStorage.setItem(STATE_CACHE_KEY, cacheData);

        debugLog('执行状态已保存到缓存');
    } catch (error) {
        console.error('保存执行状态失败:', error);
    }
}

/**
 * 保存工作流缓存
 */
export function saveWorkflowCache() {
    try {
        const currentWorkflow = getCurrentWorkflow();

        if (!currentWorkflow) {
            debugLog('没有当前工作流，跳过缓存保存');
            return;
        }

        const workflowCache = {
            timestamp: Date.now(),
            workflow: currentWorkflow,
            url: window.location.href
        };

        const cacheData = safeJsonStringify(workflowCache);
        localStorage.setItem(WORKFLOW_CACHE_KEY, cacheData);

        debugLog('工作流缓存已保存:', currentWorkflow.name);
    } catch (error) {
        console.error('保存工作流缓存失败:', error);
    }
}

/**
 * 恢复执行状态
 */
export function restoreExecutionState() {
    debugLog('开始恢复执行状态...');

    try {
        // 先尝试恢复工作流缓存
        restoreWorkflowCache();

        // 然后恢复执行状态缓存
        restoreExecutionStateCache();

        debugLog('状态恢复完成');
    } catch (error) {
        console.error('恢复执行状态失败:', error);
    }
}

/**
 * 恢复工作流缓存
 */
function restoreWorkflowCache() {
    try {
        const cacheData = localStorage.getItem(WORKFLOW_CACHE_KEY);
        if (!cacheData) {
            debugLog('没有找到工作流缓存');
            return;
        }

        const cache = safeJsonParse(cacheData);
        if (!cache || !cache.workflow) {
            debugLog('工作流缓存数据无效');
            return;
        }

        // 检查缓存是否过期（24小时）
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - cache.timestamp > maxAge) {
            debugLog('工作流缓存已过期，清除缓存');
            localStorage.removeItem(WORKFLOW_CACHE_KEY);
            return;
        }

        // 恢复工作流
        setCurrentWorkflow(cache.workflow);

        // 触发工作流恢复事件
        const event = new CustomEvent('workflowRestored', {
            detail: { workflow: cache.workflow }
        });
        window.dispatchEvent(event);

        debugLog('工作流缓存已恢复:', cache.workflow.name);

        // 显示恢复提示
        showRestorationNotice('工作流已从上次会话恢复');

    } catch (error) {
        console.error('恢复工作流缓存失败:', error);
    }
}

/**
 * 恢复执行状态缓存
 */
function restoreExecutionStateCache() {
    try {
        const cacheData = localStorage.getItem(STATE_CACHE_KEY);
        if (!cacheData) {
            debugLog('没有找到执行状态缓存');
            return;
        }

        const cache = safeJsonParse(cacheData);
        if (!cache || !cache.executionState) {
            debugLog('执行状态缓存数据无效');
            return;
        }

        // 检查缓存是否过期（1小时）
        const maxAge = 60 * 60 * 1000;
        if (Date.now() - cache.timestamp > maxAge) {
            debugLog('执行状态缓存已过期，清除缓存');
            localStorage.removeItem(STATE_CACHE_KEY);
            return;
        }

        const cachedState = cache.executionState;

        if (cachedState.isRunning) {
            debugLog('检测到上次正在执行的状态，尝试恢复执行界面');

            // 检查content script是否还在执行，传递完整的缓存对象
            checkAndRestoreExecutionState(cachedState, cache);
        }

        debugLog('执行状态缓存处理完成');

    } catch (error) {
        console.error('恢复执行状态缓存失败:', error);
    }
}

/**
 * 检查并恢复执行状态
 * @param {Object} cachedState - 缓存的执行状态
 * @param {Object} fullCache - 完整的缓存对象
 */
async function checkAndRestoreExecutionState(cachedState, fullCache) {
    try {
        debugLog('开始检查content script执行状态...');

        // 获取当前活动标签页
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
            debugLog('无法获取当前标签页，无法恢复执行状态');
            showRestorationNotice('检测到上次正在执行，但无法连接到页面');
            return;
        }

        const tab = tabs[0];

        try {
            // 尝试获取content script的执行状态
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'getExecutionStatus'
            });

            if (response && response.isRunning) {
                debugLog('Content script仍在执行，恢复执行状态UI');

                // 恢复执行状态到popup，传递完整缓存
                await restoreExecutionUI(cachedState, response, fullCache);

                if (response.isPaused) {
                    showRestorationNotice('上次执行已暂停，状态已恢复，可以继续执行');
                } else {
                    showRestorationNotice('检测到正在执行的工作流，状态已恢复');
                }
            } else {
                debugLog('Content script未在执行，显示中断提示');
                showRestorationNotice('检测到上次正在执行，但已中断');
            }
        } catch (error) {
            debugLog('无法连接到content script:', error.message);
            showRestorationNotice('检测到上次正在执行，但页面已刷新或关闭');
        }

    } catch (error) {
        console.error('检查执行状态失败:', error);
        showRestorationNotice('恢复执行状态时出错');
    }
}

/**
 * 恢复执行状态UI
 * @param {Object} cachedState - 缓存的执行状态
 * @param {Object} currentState - 当前content script状态
 * @param {Object} fullCache - 完整的缓存对象
 */
async function restoreExecutionUI(cachedState, currentState, fullCache) {
    try {
        // 导入执行模块
        const { restoreExecutionStateFromCache } = await import('./popup-execution.js');

        // 合并状态信息
        const mergedState = {
            ...cachedState,
            ...currentState,
            isRunning: true, // 确保标记为运行中
            selectedConfigIndex: fullCache.selectedConfigIndex // 添加配置索引
        };

        debugLog('恢复执行状态UI:', mergedState);

        // 恢复执行状态
        restoreExecutionStateFromCache(mergedState);

    } catch (error) {
        console.error('恢复执行UI失败:', error);
    }
}

/**
 * 获取当前选中的配置索引
 * @returns {number|null} 配置索引或null
 */
function getSelectedConfigIndex() {
    const configSelect = document.getElementById('configSelect');
    if (configSelect && configSelect.value !== '') {
        return parseInt(configSelect.value);
    }
    return null;
}

/**
 * 清除状态缓存
 */
export function clearStateCache() {
    try {
        localStorage.removeItem(STATE_CACHE_KEY);
        localStorage.removeItem(WORKFLOW_CACHE_KEY);

        debugLog('状态缓存已清除');

        // 触发缓存清除事件
        const event = new CustomEvent('stateCacheCleared');
        window.dispatchEvent(event);

        return true;
    } catch (error) {
        console.error('清除状态缓存失败:', error);
        return false;
    }
}

/**
 * 处理清除缓存按钮点击
 */
export function handleClearCache() {
    debugLog('用户点击清除缓存按钮');

    const confirmMessage = '确定要清除所有缓存数据吗？这将清除保存的执行状态和工作流缓存。';
    if (!confirm(confirmMessage)) {
        return;
    }

    const success = clearStateCache();

    if (success) {
        // 重新加载页面以确保状态完全重置
        const reloadConfirm = '缓存已清除。是否重新加载页面以完全重置状态？';
        if (confirm(reloadConfirm)) {
            window.location.reload();
        }
    } else {
        alert('清除缓存失败，请检查浏览器控制台获取详细信息。');
    }
}

/**
 * 显示恢复通知
 * @param {string} message - 通知消息
 */
function showRestorationNotice(message) {
    // 创建通知元素
    const notice = document.createElement('div');
    notice.className = 'restoration-notice';
    notice.innerHTML = `
        <div class="notice-content">
            <span class="notice-icon">🔄</span>
            <span class="notice-text">${message}</span>
            <button class="notice-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    // 添加样式
    notice.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #4CAF50;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        font-size: 14px;
        max-width: 300px;
    `;

    notice.querySelector('.notice-content').style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    notice.querySelector('.notice-close').style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
    `;

    // 添加到页面
    document.body.appendChild(notice);

    // 3秒后自动移除
    setTimeout(() => {
        if (notice.parentElement) {
            notice.remove();
        }
    }, 3000);
}

/**
 * 获取缓存统计信息
 * @returns {Object} 缓存统计
 */
export function getCacheStats() {
    const stats = {
        stateCache: null,
        workflowCache: null,
        totalSize: 0
    };

    try {
        // 检查执行状态缓存
        const stateData = localStorage.getItem(STATE_CACHE_KEY);
        if (stateData) {
            const stateCache = safeJsonParse(stateData);
            stats.stateCache = {
                exists: true,
                timestamp: stateCache?.timestamp,
                age: stateCache?.timestamp ? Date.now() - stateCache.timestamp : null,
                size: stateData.length
            };
            stats.totalSize += stateData.length;
        } else {
            stats.stateCache = { exists: false };
        }

        // 检查工作流缓存
        const workflowData = localStorage.getItem(WORKFLOW_CACHE_KEY);
        if (workflowData) {
            const workflowCache = safeJsonParse(workflowData);
            stats.workflowCache = {
                exists: true,
                timestamp: workflowCache?.timestamp,
                age: workflowCache?.timestamp ? Date.now() - workflowCache.timestamp : null,
                workflowName: workflowCache?.workflow?.name,
                size: workflowData.length
            };
            stats.totalSize += workflowData.length;
        } else {
            stats.workflowCache = { exists: false };
        }

    } catch (error) {
        console.error('获取缓存统计失败:', error);
    }

    return stats;
}

/**
 * 手动保存状态（供调试使用）
 */
export function manualSaveState() {
    debugLog('手动保存状态...');
    saveStateBeforeClose();
}

/**
 * 手动恢复状态（供调试使用）
 */
export function manualRestoreState() {
    debugLog('手动恢复状态...');
    restoreExecutionState();
}

/**
 * 初始化持久化模块事件监听器
 */
export function initializePersistenceListeners() {
    debugLog('初始化持久化模块事件监听器');

    // 清除缓存按钮
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', handleClearCache);
    }

    // 监听工作流选择事件，自动保存缓存
    window.addEventListener('configSelected', () => {
        setTimeout(saveWorkflowCache, 100); // 延迟保存，确保状态已更新
    });

    // 监听执行状态变化，自动保存缓存
    window.addEventListener('executionUIUpdated', () => {
        setTimeout(saveExecutionStateToCache, 100);
    });

    debugLog('持久化模块事件监听器已设置');
}

/**
 * 导入当前工作流的引用（避免循环依赖）
 */
function getCurrentWorkflow() {
    // 这里需要从popup-core模块获取当前工作流
    // 为了避免循环依赖，使用全局变量
    if (typeof window !== 'undefined' && window.PopupApp && window.PopupApp.getCurrentWorkflow) {
        return window.PopupApp.getCurrentWorkflow();
    }
    return null;
}