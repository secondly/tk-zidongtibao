/**
 * 统一错误处理和日志系统
 * 提供错误捕获、分类、报告和恢复机制
 */

import { debugLog } from './popup-utils.js';

// 错误级别
const ERROR_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    FATAL: 'fatal'
};

// 错误类型
const ERROR_TYPES = {
    VALIDATION: 'validation',
    NETWORK: 'network',
    STORAGE: 'storage',
    UI: 'ui',
    EXECUTION: 'execution',
    SYSTEM: 'system',
    USER: 'user'
};

// 自定义错误类
class AutomationError extends Error {
    constructor(message, type = ERROR_TYPES.SYSTEM, level = ERROR_LEVELS.ERROR, context = {}) {
        super(message);
        this.name = 'AutomationError';
        this.type = type;
        this.level = level;
        this.context = context;
        this.timestamp = Date.now();
        this.stack = this.stack || (new Error()).stack;
    }

    // 转换为JSON
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            level: this.level,
            context: this.context,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }

    // 获取用户友好的消息
    getUserMessage() {
        const userMessages = {
            [ERROR_TYPES.VALIDATION]: '数据验证失败，请检查输入内容',
            [ERROR_TYPES.NETWORK]: '网络连接异常，请检查网络设置',
            [ERROR_TYPES.STORAGE]: '数据存储失败，请检查浏览器设置',
            [ERROR_TYPES.UI]: '界面操作异常，请刷新页面重试',
            [ERROR_TYPES.EXECUTION]: '执行过程中出现错误，请检查配置',
            [ERROR_TYPES.SYSTEM]: '系统错误，请联系技术支持',
            [ERROR_TYPES.USER]: '操作错误，请按照提示重新操作'
        };

        return userMessages[this.type] || this.message;
    }
}

// 错误处理器
class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
        this.listeners = [];
        this.isEnabled = true;
        this.setupGlobalHandlers();
    }

    // 设置全局错误处理器
    setupGlobalHandlers() {
        // 捕获未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(new AutomationError(
                `未处理的Promise拒绝: ${event.reason}`,
                ERROR_TYPES.SYSTEM,
                ERROR_LEVELS.ERROR,
                { reason: event.reason }
            ));
        });

        // 捕获全局错误
        window.addEventListener('error', (event) => {
            this.handleError(new AutomationError(
                `全局错误: ${event.message}`,
                ERROR_TYPES.SYSTEM,
                ERROR_LEVELS.ERROR,
                {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    error: event.error
                }
            ));
        });
    }

    // 处理错误
    handleError(error, context = {}) {
        if (!this.isEnabled) return;

        // 确保是AutomationError实例
        if (!(error instanceof AutomationError)) {
            error = new AutomationError(
                error.message || String(error),
                ERROR_TYPES.SYSTEM,
                ERROR_LEVELS.ERROR,
                { originalError: error, ...context }
            );
        }

        // 添加额外上下文
        error.context = { ...error.context, ...context };

        // 记录错误
        this.recordError(error);

        // 通知监听器
        this.notifyListeners(error);

        // 根据错误级别进行处理
        this.processError(error);

        return error;
    }

    // 记录错误
    recordError(error) {
        this.errors.push(error);

        // 限制错误数量
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(-this.maxErrors);
        }

        // 记录到控制台
        this.logToConsole(error);

        // 记录到存储（可选）
        this.logToStorage(error);
    }

    // 记录到控制台
    logToConsole(error) {
        const logMethod = {
            [ERROR_LEVELS.DEBUG]: 'debug',
            [ERROR_LEVELS.INFO]: 'info',
            [ERROR_LEVELS.WARN]: 'warn',
            [ERROR_LEVELS.ERROR]: 'error',
            [ERROR_LEVELS.FATAL]: 'error'
        }[error.level] || 'error';

        console[logMethod](`[${error.type.toUpperCase()}] ${error.message}`, {
            context: error.context,
            stack: error.stack
        });
    }

    // 记录到存储
    logToStorage(error) {
        try {
            const errorLogs = JSON.parse(localStorage.getItem('automation_error_logs') || '[]');
            errorLogs.push(error.toJSON());

            // 只保留最近的50个错误
            if (errorLogs.length > 50) {
                errorLogs.splice(0, errorLogs.length - 50);
            }

            localStorage.setItem('automation_error_logs', JSON.stringify(errorLogs));
        } catch (storageError) {
            console.warn('无法保存错误日志到存储:', storageError);
        }
    }

    // 处理错误
    processError(error) {
        switch (error.level) {
            case ERROR_LEVELS.FATAL:
                this.handleFatalError(error);
                break;
            case ERROR_LEVELS.ERROR:
                this.handleRegularError(error);
                break;
            case ERROR_LEVELS.WARN:
                this.handleWarning(error);
                break;
            default:
                // DEBUG和INFO级别不需要特殊处理
                break;
        }
    }

    // 处理致命错误
    handleFatalError(error) {
        // 显示错误对话框
        this.showErrorDialog(error, true);

        // 尝试恢复
        this.attemptRecovery(error);
    }

    // 处理常规错误
    handleRegularError(error) {
        // 显示错误提示
        this.showErrorNotification(error);
    }

    // 处理警告
    handleWarning(error) {
        // 显示警告提示
        this.showWarningNotification(error);
    }

    // 显示错误对话框
    showErrorDialog(error, isBlocking = false) {
        const message = `${error.getUserMessage()}\n\n技术详情: ${error.message}`;

        if (isBlocking) {
            alert(message);
        } else {
            // 这里可以实现自定义的错误对话框
            console.error(message);
        }
    }

    // 显示错误通知
    showErrorNotification(error) {
        // 尝试使用浏览器通知API
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('自动化插件错误', {
                body: error.getUserMessage(),
                icon: '/icons/icon48.png'
            });
        }

        // 在页面中显示错误提示
        this.showInPageNotification(error, 'error');
    }

    // 显示警告通知
    showWarningNotification(error) {
        this.showInPageNotification(error, 'warning');
    }

    // 在页面中显示通知
    showInPageNotification(error, type = 'error') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `error-notification ${type}`;
        notification.innerHTML = `
            <div class="error-content">
                <strong>${type === 'error' ? '错误' : '警告'}</strong>
                <p>${error.getUserMessage()}</p>
                <button class="close-btn">&times;</button>
            </div>
        `;

        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#f8d7da' : '#fff3cd'};
            color: ${type === 'error' ? '#721c24' : '#856404'};
            border: 1px solid ${type === 'error' ? '#f5c6cb' : '#ffeaa7'};
            border-radius: 4px;
            padding: 15px;
            max-width: 400px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;

        // 添加关闭功能
        const closeBtn = notification.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        // 添加到页面
        document.body.appendChild(notification);

        // 自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // 尝试恢复
    attemptRecovery(error) {
        switch (error.type) {
            case ERROR_TYPES.STORAGE:
                this.recoverFromStorageError();
                break;
            case ERROR_TYPES.UI:
                this.recoverFromUIError();
                break;
            default:
                // 通用恢复策略
                this.performGeneralRecovery();
                break;
        }
    }

    // 从存储错误中恢复
    recoverFromStorageError() {
        try {
            // 清理可能损坏的存储数据
            localStorage.removeItem('automation_state_cache');
            localStorage.removeItem('automation_workflow_cache');
            debugLog('已清理存储缓存，尝试恢复');
        } catch (error) {
            console.warn('存储恢复失败:', error);
        }
    }

    // 从UI错误中恢复
    recoverFromUIError() {
        try {
            // 重新初始化UI组件
            const event = new CustomEvent('ui-recovery-needed');
            window.dispatchEvent(event);
            debugLog('已触发UI恢复事件');
        } catch (error) {
            console.warn('UI恢复失败:', error);
        }
    }

    // 执行通用恢复
    performGeneralRecovery() {
        try {
            // 重新加载页面作为最后的恢复手段
            if (confirm('系统遇到严重错误，是否重新加载页面？')) {
                window.location.reload();
            }
        } catch (error) {
            console.warn('通用恢复失败:', error);
        }
    }

    // 添加错误监听器
    addListener(callback) {
        this.listeners.push(callback);
    }

    // 移除错误监听器
    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    // 通知监听器
    notifyListeners(error) {
        this.listeners.forEach(callback => {
            try {
                callback(error);
            } catch (listenerError) {
                console.warn('错误监听器回调失败:', listenerError);
            }
        });
    }

    // 获取错误统计
    getErrorStats() {
        const stats = {
            total: this.errors.length,
            byType: {},
            byLevel: {},
            recent: this.errors.slice(-10)
        };

        this.errors.forEach(error => {
            stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
            stats.byLevel[error.level] = (stats.byLevel[error.level] || 0) + 1;
        });

        return stats;
    }

    // 清理错误记录
    clearErrors() {
        this.errors = [];
        localStorage.removeItem('automation_error_logs');
    }

    // 导出错误日志
    exportErrorLogs() {
        const logs = {
            timestamp: Date.now(),
            errors: this.errors.map(error => error.toJSON()),
            stats: this.getErrorStats()
        };

        const blob = new Blob([JSON.stringify(logs, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `automation-error-logs-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// 创建全局错误处理器实例
const errorHandler = new ErrorHandler();

// 便捷函数
function handleError(error, context = {}) {
    return errorHandler.handleError(error, context);
}

function createError(message, type = ERROR_TYPES.SYSTEM, level = ERROR_LEVELS.ERROR, context = {}) {
    return new AutomationError(message, type, level, context);
}

function logError(message, type = ERROR_TYPES.SYSTEM, context = {}) {
    const error = createError(message, type, ERROR_LEVELS.ERROR, context);
    return handleError(error);
}

function logWarning(message, type = ERROR_TYPES.SYSTEM, context = {}) {
    const error = createError(message, type, ERROR_LEVELS.WARN, context);
    return handleError(error);
}

function logInfo(message, context = {}) {
    const error = createError(message, ERROR_TYPES.SYSTEM, ERROR_LEVELS.INFO, context);
    return handleError(error);
}

// 导出
export {
    AutomationError,
    ErrorHandler,
    ERROR_LEVELS,
    ERROR_TYPES,
    errorHandler,
    handleError,
    createError,
    logError,
    logWarning,
    logInfo
};