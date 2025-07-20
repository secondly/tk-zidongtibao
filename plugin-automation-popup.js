/**
 * 通用自动化插件弹窗脚本 - 模块化版本
 * 
 * 这是重构后的主入口文件，整合了所有拆分的模块
 * 
 * 模块结构：
 * - popup-core.js - 核心初始化和布局管理
 * - popup-config.js - 配置管理功能
 * - popup-execution.js - 执行控制功能
 * - popup-persistence.js - 状态持久化功能
 * - popup-preview.js - 流程图预览功能
 * - popup-storage.js - 存储管理功能
 * - popup-utils.js - 工具函数
 * - popup-constants.js - 常量定义
 */

// 导入所有模块
import {
    initializePopup,
    getCurrentWorkflow,
    getPerformanceStats,
    cleanup
} from './modules/popup/popup-core.js';
import {
    loadSavedWorkflows,
    initializeConfigActionListeners,
    refreshConfigList
} from './modules/popup/popup-config.js';
import {
    initializeExecutionListeners
} from './modules/popup/popup-execution.js';
import {
    initializeStatePersistence,
    restoreExecutionState,
    initializePersistenceListeners
} from './modules/popup/popup-persistence.js';
import {
    initializePreviewListeners
} from './modules/popup/popup-preview.js';
import {
    initializeStorageListener,
    debugLocalStorage
} from './modules/popup/popup-storage.js';
import { debugLog } from './shared/popup/popup-utils.js';
import { performanceMonitor, memoryManager } from './shared/popup/popup-performance.js';
import { errorHandler, handleError, ERROR_TYPES } from './shared/popup/popup-error-handler.js';
import { performancePanel } from './utils/performancePanel.js';

/**
 * 应用程序主入口
 */
function initializeApp() {
    performanceMonitor.startMeasure('app-initialization');
    debugLog('开始初始化优化版模块化弹窗应用');

    try {
        // 1. 初始化核心模块
        initializePopup();

        // 2. 初始化各功能模块的事件监听器
        initializeConfigActionListeners();
        initializeExecutionListeners();
        initializePersistenceListeners();
        initializePreviewListeners();

        // 3. 初始化状态持久化
        initializeStatePersistence();

        // 4. 初始化存储监听
        initializeStorageListener();

        // 5. 初始化性能监控和错误处理
        initializeOptimizations();

        // 6. 调试localStorage内容
        debugLocalStorage();

        // 7. 加载保存的工作流
        loadSavedWorkflows();

        // 8. 恢复上次的执行状态和流程缓存
        restoreExecutionState();

        const initMetric = performanceMonitor.endMeasure('app-initialization');
        debugLog(`优化版模块化弹窗应用初始化完成，耗时: ${initMetric.duration.toFixed(2)}ms`);

    } catch (error) {
        handleError(error, { context: 'app-initialization', type: ERROR_TYPES.SYSTEM });

        // 显示错误信息给用户
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f44336;
            color: white;
            padding: 20px;
            border-radius: 5px;
            text-align: center;
            z-index: 10000;
        `;
        errorMessage.innerHTML = `
            <h3>应用初始化失败</h3>
            <p>${error.message}</p>
            <button onclick="window.location.reload()" style="
                background: white;
                color: #f44336;
                border: none;
                padding: 8px 16px;
                border-radius: 3px;
                cursor: pointer;
                margin-top: 10px;
            ">重新加载</button>
        `;
        document.body.appendChild(errorMessage);
    }
}

/**
 * DOM内容加载完成后初始化应用
 */
document.addEventListener('DOMContentLoaded', initializeApp);

/**
 * 导出主要功能供外部调用（如果需要）
 */
window.PopupApp = {
    // 核心功能
    getCurrentWorkflow,

    // 配置管理
    refreshConfigList,

    // 调试功能
    debugLocalStorage,

    // 版本信息
    version: '2.0.0-modular',
    modules: [
        'popup-core',
        'popup-config',
        'popup-execution',
        'popup-persistence',
        'popup-preview',
        'popup-storage',
        'popup-utils',
        'popup-constants'
    ]
};

/**
 * 初始化优化功能
 */
function initializeOptimizations() {
    debugLog('初始化性能优化功能');

    try {
        // 启动内存管理
        memoryManager.start();

        // 添加性能监控观察者
        performanceMonitor.addObserver((name, metric) => {
            if (metric.duration > 1000) { // 超过1秒的操作记录警告
                console.warn(`⚠️ 性能警告: ${name} 耗时 ${metric.duration.toFixed(2)}ms`);
            }
        });

        // 添加错误处理监听器
        errorHandler.addListener((error) => {
            debugLog(`错误处理: ${error.type} - ${error.message}`);
        });

        // 添加键盘快捷键支持
        document.addEventListener('keydown', handleKeyboardShortcuts);

        // 添加窗口关闭时的清理
        window.addEventListener('beforeunload', () => {
            cleanup();
        });

        debugLog('性能优化功能初始化完成');
    } catch (error) {
        console.warn('优化功能初始化失败:', error);
    }
}

/**
 * 处理键盘快捷键
 */
function handleKeyboardShortcuts(event) {
    // Ctrl+Shift+P: 打开性能监控面板
    if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        event.preventDefault();
        performancePanel.toggle();
        return;
    }

    // Ctrl+Shift+D: 打开调试信息
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        showDebugInfo();
        return;
    }

    // Ctrl+Shift+R: 重置应用状态
    if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        if (confirm('确定要重置应用状态吗？这将清除所有缓存数据。')) {
            resetAppState();
        }
        return;
    }

    // Ctrl+Shift+E: 导出性能报告
    if (event.ctrlKey && event.shiftKey && event.key === 'E') {
        event.preventDefault();
        exportPerformanceReport();
        return;
    }
}

/**
 * 显示调试信息
 */
function showDebugInfo() {
    const stats = getPerformanceStats();
    const debugInfo = {
        version: window.PopupApp.version,
        modules: window.PopupApp.modules,
        performance: stats.monitor,
        memory: stats.memory,
        errors: stats.errors,
        timestamp: new Date().toISOString()
    };

    console.group('🔍 应用调试信息');
    console.log('版本信息:', debugInfo.version);
    console.log('加载模块:', debugInfo.modules);
    console.log('性能统计:', debugInfo.performance);
    console.log('内存使用:', debugInfo.memory);
    console.log('错误统计:', debugInfo.errors);
    console.groupEnd();

    // 显示在界面上
    const debugPanel = document.createElement('div');
    debugPanel.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        width: 400px;
        max-height: 500px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: monospace;
        font-size: 12px;
        overflow-y: auto;
    `;

    debugPanel.innerHTML = `
        <div style="padding: 16px; border-bottom: 1px solid #eee; background: #f8f9fa;">
            <h3 style="margin: 0; color: #495057;">🔍 调试信息</h3>
            <button onclick="this.parentElement.parentElement.remove()" style="
                position: absolute;
                top: 12px;
                right: 12px;
                background: none;
                border: none;
                font-size: 16px;
                cursor: pointer;
            ">✖️</button>
        </div>
        <div style="padding: 16px;">
            <pre style="margin: 0; white-space: pre-wrap; word-break: break-word;">
${JSON.stringify(debugInfo, null, 2)}
            </pre>
        </div>
    `;

    document.body.appendChild(debugPanel);

    // 5秒后自动关闭
    setTimeout(() => {
        if (debugPanel.parentNode) {
            debugPanel.remove();
        }
    }, 10000);
}

/**
 * 重置应用状态
 */
function resetAppState() {
    try {
        // 清除所有存储数据
        localStorage.removeItem('automation_workflows');
        localStorage.removeItem('automation_state_cache');
        localStorage.removeItem('automation_workflow_cache');
        localStorage.removeItem('automation_error_logs');

        // 清除性能数据
        performanceMonitor.cleanup();
        errorHandler.clearErrors();

        // 重新加载页面
        window.location.reload();
    } catch (error) {
        handleError(error, { context: 'reset-app-state' });
    }
}

/**
 * 导出性能报告
 */
function exportPerformanceReport() {
    try {
        const stats = getPerformanceStats();
        const report = {
            timestamp: new Date().toISOString(),
            version: window.PopupApp.version,
            modules: window.PopupApp.modules,
            performance: stats.monitor,
            memory: stats.memory,
            errors: stats.errors,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `popup-performance-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        debugLog('性能报告已导出');
    } catch (error) {
        handleError(error, { context: 'export-performance-report' });
    }
}

debugLog('优化版模块化弹窗脚本已加载，版本:', window.PopupApp.version);