/**
 * 弹窗存储管理模块
 * 负责localStorage管理、数据持久化和存储监听
 */

import { debugLog, safeJsonParse, safeJsonStringify } from '../../shared/popup/popup-utils.js';
import { STORAGE_KEY } from '../../shared/popup/popup-constants.js';

/**
 * 从localStorage获取工作流列表
 * @returns {Array} 工作流列表
 */
export function getWorkflowsFromStorage() {
    try {
        debugLog('正在读取localStorage，键名:', STORAGE_KEY);

        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) {
            debugLog('localStorage中没有找到工作流数据');
            return [];
        }

        const workflows = safeJsonParse(data, []);
        debugLog(`从localStorage读取到 ${workflows.length} 个工作流`);

        return Array.isArray(workflows) ? workflows : [];
    } catch (error) {
        console.error('读取工作流数据失败:', error);
        return [];
    }
}

/**
 * 保存工作流列表到localStorage
 * @param {Array} workflows - 工作流列表
 * @returns {boolean} 保存是否成功
 */
export function saveWorkflowsToStorage(workflows) {
    try {
        if (!Array.isArray(workflows)) {
            console.error('工作流数据必须是数组');
            return false;
        }

        const jsonData = safeJsonStringify(workflows);
        localStorage.setItem(STORAGE_KEY, jsonData);

        debugLog(`已保存 ${workflows.length} 个工作流到localStorage`);
        return true;
    } catch (error) {
        console.error('保存工作流数据失败:', error);
        return false;
    }
}

/**
 * 初始化localStorage监听器
 * 监听跨窗口的存储变化
 */
export function initializeStorageListener() {
    debugLog('初始化localStorage监听器');

    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
            debugLog('检测到工作流数据变化，准备刷新列表');

            // 触发自定义事件，通知其他模块数据已更新
            const event = new CustomEvent('workflowsUpdated', {
                detail: {
                    oldValue: e.oldValue,
                    newValue: e.newValue
                }
            });
            window.dispatchEvent(event);
        }
    });
}

/**
 * 调试localStorage内容
 * 用于开发和调试
 */
export function debugLocalStorage() {
    if (!debugLog.enabled) return;

    debugLog('调试localStorage内容:');
    debugLog('localStorage长度:', localStorage.length);

    // 显示所有键
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
    }
    debugLog('所有键名:', keys);

    // 显示工作流数据
    const workflowData = localStorage.getItem(STORAGE_KEY);
    if (workflowData) {
        try {
            const workflows = JSON.parse(workflowData);
            debugLog(`工作流数据 (${STORAGE_KEY}):`, workflows);
            debugLog('工作流数量:', workflows.length);

            workflows.forEach((workflow, index) => {
                debugLog(`工作流 ${index}:`, {
                    name: workflow.name,
                    steps: workflow.steps?.length || 0,
                    createdAt: workflow.createdAt,
                    updatedAt: workflow.updatedAt
                });
            });
        } catch (error) {
            console.error('解析工作流数据失败:', error);
        }
    } else {
        debugLog('没有找到工作流数据');
    }

    // 显示存储使用情况
    let totalSize = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            totalSize += localStorage[key].length;
        }
    }
    debugLog(`localStorage总大小: ${(totalSize / 1024).toFixed(2)} KB`);
}

/**
 * 清理过期的缓存数据
 * @param {number} maxAge - 最大保存时间(毫秒)，默认7天
 */
export function cleanupExpiredCache(maxAge = 7 * 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        // 检查缓存键
        if (key && key.includes('_cache')) {
            try {
                const data = safeJsonParse(localStorage.getItem(key));
                if (data && data.timestamp && (now - data.timestamp > maxAge)) {
                    keysToRemove.push(key);
                }
            } catch (error) {
                // 如果解析失败，也标记为删除
                keysToRemove.push(key);
            }
        }
    }

    // 删除过期的缓存
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        debugLog(`已删除过期缓存: ${key}`);
    });

    if (keysToRemove.length > 0) {
        debugLog(`清理了 ${keysToRemove.length} 个过期缓存项`);
    }
}

/**
 * 获取存储使用情况统计
 * @returns {Object} 存储统计信息
 */
export function getStorageStats() {
    let totalSize = 0;
    let workflowSize = 0;
    let cacheSize = 0;
    let otherSize = 0;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        const size = value ? value.length : 0;

        totalSize += size;

        if (key === STORAGE_KEY) {
            workflowSize += size;
        } else if (key && key.includes('_cache')) {
            cacheSize += size;
        } else {
            otherSize += size;
        }
    }

    return {
        total: {
            size: totalSize,
            sizeKB: (totalSize / 1024).toFixed(2),
            count: localStorage.length
        },
        workflows: {
            size: workflowSize,
            sizeKB: (workflowSize / 1024).toFixed(2)
        },
        cache: {
            size: cacheSize,
            sizeKB: (cacheSize / 1024).toFixed(2)
        },
        other: {
            size: otherSize,
            sizeKB: (otherSize / 1024).toFixed(2)
        }
    };
}

/**
 * 备份工作流数据
 * @returns {string} 备份的JSON字符串
 */
export function backupWorkflows() {
    const workflows = getWorkflowsFromStorage();
    const backup = {
        version: '1.0',
        timestamp: Date.now(),
        workflows: workflows
    };

    debugLog(`已备份 ${workflows.length} 个工作流`);
    return safeJsonStringify(backup);
}

/**
 * 从备份恢复工作流数据
 * @param {string} backupData - 备份的JSON字符串
 * @returns {boolean} 恢复是否成功
 */
export function restoreWorkflows(backupData) {
    try {
        const backup = safeJsonParse(backupData);

        if (!backup || !backup.workflows || !Array.isArray(backup.workflows)) {
            console.error('备份数据格式无效');
            return false;
        }

        const success = saveWorkflowsToStorage(backup.workflows);
        if (success) {
            debugLog(`已从备份恢复 ${backup.workflows.length} 个工作流`);

            // 触发更新事件
            const event = new CustomEvent('workflowsRestored', {
                detail: { workflows: backup.workflows }
            });
            window.dispatchEvent(event);
        }

        return success;
    } catch (error) {
        console.error('恢复工作流数据失败:', error);
        return false;
    }
}

/**
 * 检查存储配额
 * @returns {Object} 配额信息
 */
export function checkStorageQuota() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        return navigator.storage.estimate().then(estimate => {
            return {
                quota: estimate.quota,
                usage: estimate.usage,
                available: estimate.quota - estimate.usage,
                usagePercentage: ((estimate.usage / estimate.quota) * 100).toFixed(2)
            };
        });
    } else {
        // 降级方案：尝试写入测试数据来估算剩余空间
        return Promise.resolve({
            quota: null,
            usage: null,
            available: null,
            usagePercentage: null,
            note: '浏览器不支持存储配额API'
        });
    }
}