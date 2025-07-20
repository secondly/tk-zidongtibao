/**
 * 弹窗模块工具函数
 * 包含各模块共享的工具函数
 */

import { DEBUG, EXECUTION_STATUS, STATUS_MESSAGES } from './popup-constants.js';

/**
 * 调试日志输出
 * @param {string} message - 日志消息
 * @param {any} data - 可选的数据对象
 */
export function debugLog(message, data = null) {
    if (DEBUG.ENABLED) {
        if (data) {
            console.log(`${DEBUG.LOG_PREFIX} ${message}`, data);
        } else {
            console.log(`${DEBUG.LOG_PREFIX} ${message}`);
        }
    }
}

/**
 * 显示状态消息
 * @param {string} message - 状态消息
 * @param {string} type - 消息类型 (success, error, warning, info)
 */
export function showStatus(message, type = 'info') {
    debugLog(`状态: ${type} - ${message}`);

    // 这里可以扩展为显示在UI上的通知
    const statusElement = document.querySelector('.status-text');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status-text status-${type}`;
    }
}

/**
 * 更新执行状态显示
 * @param {string} status - 执行状态
 * @param {string} message - 状态消息
 */
export function updateExecutionStatus(status, message) {
    debugLog(`更新执行状态: ${status} - ${message}`);

    const statusIcon = document.querySelector('.status-icon');
    const statusText = document.querySelector('.status-text');

    if (statusIcon && statusText) {
        // 更新图标
        statusIcon.className = `status-icon status-${status}`;

        // 更新文本
        statusText.textContent = message || STATUS_MESSAGES[status] || message;
        statusText.className = `status-text status-${status}`;

        // 根据状态设置不同的样式
        switch (status) {
            case EXECUTION_STATUS.RUNNING:
                statusIcon.innerHTML = '⚡';
                break;
            case EXECUTION_STATUS.PAUSED:
                statusIcon.innerHTML = '⏸️';
                break;
            case EXECUTION_STATUS.COMPLETED:
                statusIcon.innerHTML = '✅';
                break;
            case EXECUTION_STATUS.ERROR:
                statusIcon.innerHTML = '❌';
                break;
            case EXECUTION_STATUS.WARNING:
                statusIcon.innerHTML = '⚠️';
                break;
            default:
                statusIcon.innerHTML = '⏳';
        }
    }
}

/**
 * 安全的JSON解析
 * @param {string} jsonString - JSON字符串
 * @param {any} defaultValue - 解析失败时的默认值
 * @returns {any} 解析结果或默认值
 */
export function safeJsonParse(jsonString, defaultValue = null) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        debugLog(`JSON解析失败: ${error.message}`);
        return defaultValue;
    }
}

/**
 * 安全的JSON字符串化
 * @param {any} data - 要序列化的数据
 * @param {string} defaultValue - 序列化失败时的默认值
 * @returns {string} JSON字符串或默认值
 */
export function safeJsonStringify(data, defaultValue = '{}') {
    try {
        return JSON.stringify(data);
    } catch (error) {
        debugLog(`JSON序列化失败: ${error.message}`);
        return defaultValue;
    }
}

/**
 * 深拷贝对象
 * @param {any} obj - 要拷贝的对象
 * @returns {any} 拷贝后的对象
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }

    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }

    if (typeof obj === 'object') {
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }

    return obj;
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} delay - 延迟时间(ms)
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} delay - 延迟时间(ms)
 * @returns {Function} 节流后的函数
 */
export function throttle(func, delay) {
    let lastCall = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            return func.apply(this, args);
        }
    };
}

/**
 * 获取DOM元素，带错误处理
 * @param {string} selector - CSS选择器
 * @param {Element} parent - 父元素，默认为document
 * @returns {Element|null} DOM元素或null
 */
export function getElement(selector, parent = document) {
    try {
        return parent.querySelector(selector);
    } catch (error) {
        debugLog(`获取元素失败: ${selector} - ${error.message}`);
        return null;
    }
}

/**
 * 获取多个DOM元素，带错误处理
 * @param {string} selector - CSS选择器
 * @param {Element} parent - 父元素，默认为document
 * @returns {NodeList} DOM元素列表
 */
export function getElements(selector, parent = document) {
    try {
        return parent.querySelectorAll(selector);
    } catch (error) {
        debugLog(`获取元素列表失败: ${selector} - ${error.message}`);
        return [];
    }
}

/**
 * 验证工作流数据结构
 * @param {any} workflow - 工作流数据
 * @returns {boolean} 是否有效
 */
export function validateWorkflow(workflow) {
    if (!workflow || typeof workflow !== 'object') {
        return false;
    }

    // 检查必需的属性
    const requiredProps = ['name', 'steps'];
    for (const prop of requiredProps) {
        if (!(prop in workflow)) {
            debugLog(`工作流缺少必需属性: ${prop}`);
            return false;
        }
    }

    // 检查步骤数组
    if (!Array.isArray(workflow.steps)) {
        debugLog('工作流步骤不是数组');
        return false;
    }

    return true;
}

/**
 * 格式化时间戳
 * @param {number} timestamp - 时间戳
 * @returns {string} 格式化的时间字符串
 */
export function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}