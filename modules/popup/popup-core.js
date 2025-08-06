/**
 * 弹窗核心模块
 * 负责初始化、布局管理和基础事件监听
 */

import { debugLog, getElement } from '../../shared/popup/popup-utils.js';
import { UI_CONSTANTS } from '../../shared/popup/popup-constants.js';
import { performanceMonitor, memoryManager } from '../../shared/popup/popup-performance.js';
import { errorHandler, handleError, ERROR_TYPES } from '../../shared/popup/popup-error-handler.js';

// 全局变量
export let workflowManager = null;
export let currentWorkflow = null;
export let editingStep = null;
export let isEditingSubOperation = false;
export let selectedNode = null;

// 三栏布局相关变量
export let configManager = null;
export let flowPreview = null;
export let executionStatus = null;

/**
 * 初始化弹窗应用
 */
export function initializePopup() {
    try {
        performanceMonitor.startMeasure('popup-initialization');
        debugLog('通用自动化插件已加载 - 三栏布局版本');

        // 初始化工作流管理器
        initializeWorkflowManager();

        // 初始化三栏布局
        initializeLayout();

        // 初始化事件监听器
        initializeEventListeners();

        // 初始化性能监控
        initializePerformanceMonitoring();

        performanceMonitor.endMeasure('popup-initialization');
        debugLog('弹窗初始化完成');
    } catch (error) {
        handleError(error, { context: 'popup-initialization' });
    }
}

/**
 * 初始化工作流管理器
 */
function initializeWorkflowManager() {
    if (typeof WorkflowManager !== 'undefined') {
        workflowManager = new WorkflowManager();
        debugLog('WorkflowManager 已初始化');
    } else {
        console.error('❌ WorkflowManager 类未找到');
    }
}



/**
 * 初始化三栏布局
 */
export function initializeLayout() {
    debugLog('初始化三栏布局');

    // 初始化配置管理器
    initializeConfigManager();

    // 初始化流程图预览
    initializeFlowPreview();

    // 初始化执行状态
    initializeExecutionStatus();

    // 初始化分割线拖拽
    initializeDividerResize();
}

/**
 * 初始化配置管理器
 */
function initializeConfigManager() {
    debugLog('初始化配置管理器');

    // 初始化配置选择下拉框
    const configSelect = getElement('#configSelect');
    if (configSelect) {
        configSelect.innerHTML = '<option value="">请选择一个配置...</option>';
    }

    // 隐藏当前配置信息
    hideCurrentConfigDisplay();
}

/**
 * 初始化流程图预览
 */
function initializeFlowPreview() {
    debugLog('初始化流程图预览');

    const flowGraphContainer = getElement('#flowGraphContainer');
    const flowOverlay = getElement('#flowOverlay');

    if (flowGraphContainer && flowOverlay) {
        // 设置初始状态
        flowOverlay.style.display = 'flex';
        flowOverlay.innerHTML = `
            <div class="overlay-content">
                <div class="overlay-icon">
                    <img src="icons/icon128.png" alt="秘灵" style="display: block; width: 88px; height: 88px; margin: 0 auto 10px;" />
                </div>
                <div class="overlay-text" >选择配置后显示流程图预览</div>
            </div>
        `;

        debugLog('流程图预览区域已初始化');
    } else {
        console.warn('流程图预览容器未找到');
    }
}

/**
 * 初始化执行状态
 */
function initializeExecutionStatus() {
    debugLog('初始化执行状态');

    const statusIcon = document.querySelector('.status-icon');
    const statusText = document.querySelector('.status-text');

    if (statusIcon && statusText) {
        statusIcon.innerHTML = '⏳';
        statusText.textContent = '等待执行...';
        debugLog('执行状态显示已初始化');
    }
}

/**
 * 初始化分割线拖拽功能
 */
function initializeDividerResize() {
    debugLog('初始化分割线拖拽功能');

    const divider = getElement('#divider');
    const leftPanel = getElement('#leftPanel');
    const rightPanel = getElement('#rightPanel');

    if (!divider || !leftPanel || !rightPanel) {
        console.warn('分割线或面板元素未找到');
        return;
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    divider.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = leftPanel.offsetWidth;

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        debugLog('开始拖拽分割线');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const newWidth = Math.max(UI_CONSTANTS.MIN_PANEL_WIDTH, startWidth + deltaX);
        const maxWidth = window.innerWidth - UI_CONSTANTS.MIN_PANEL_WIDTH - 10; // 10px for divider

        if (newWidth <= maxWidth) {
            leftPanel.style.width = newWidth + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            debugLog('结束拖拽分割线');
        }
    });
}

/**
 * 初始化基础事件监听器
 */
export function initializeEventListeners() {
    debugLog('初始化基础事件监听器');

    // 窗口大小变化监听
    window.addEventListener('resize', handleWindowResize);

    // 键盘快捷键监听
    document.addEventListener('keydown', handleKeyboardShortcuts);

    debugLog('基础事件监听器已设置');
}

/**
 * 处理窗口大小变化
 */
function handleWindowResize() {
    // 可以在这里添加响应式布局调整逻辑
    debugLog('窗口大小已变化');
}

/**
 * 处理键盘快捷键
 * @param {KeyboardEvent} event - 键盘事件
 */
function handleKeyboardShortcuts(event) {
    // Ctrl+S 保存
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        debugLog('快捷键: 保存');
        // 触发保存操作
    }

    // Ctrl+N 新建
    if (event.ctrlKey && event.key === 'n') {
        event.preventDefault();
        debugLog('快捷键: 新建');
        // 触发新建操作
    }

    // F5 刷新配置列表
    if (event.key === 'F5') {
        event.preventDefault();
        debugLog('快捷键: 刷新配置列表');
        // 触发刷新操作
    }
}

/**
 * 隐藏当前配置显示
 */
function hideCurrentConfigDisplay() {
    const currentConfig = getElement('#currentConfig');
    if (currentConfig) {
        currentConfig.style.display = 'none';
    }
}

/**
 * 获取当前工作流
 * @returns {Object|null} 当前工作流对象
 */
export function getCurrentWorkflow() {
    return currentWorkflow;
}

/**
 * 设置当前工作流
 * @param {Object} workflow - 工作流对象
 */
export function setCurrentWorkflow(workflow) {
    currentWorkflow = workflow;
    debugLog('当前工作流已更新', workflow?.name);
}

/**
 * 获取工作流管理器
 * @returns {Object|null} 工作流管理器实例
 */
export function getWorkflowManager() {
    return workflowManager;
}



/**
 * 初始化性能监控
 */
function initializePerformanceMonitoring() {
    debugLog('初始化性能监控');

    // 添加性能监控观察者
    performanceMonitor.addObserver((name, metric) => {
        if (metric.duration > 500) { // 超过500ms的操作记录警告
            console.warn(`性能警告: ${name} 耗时 ${metric.duration.toFixed(2)}ms`);
        }
    });

    // 启动内存管理
    memoryManager.start();

    // 添加内存清理任务
    memoryManager.addCleanupTask('dom-cleanup', () => {
        // 清理可能的DOM引用
        const unusedElements = document.querySelectorAll('.temp-element');
        unusedElements.forEach(el => el.remove());
    });

    // 定期生成性能报告
    setInterval(() => {
        const report = performanceMonitor.getReport();
        if (report.recommendations.length > 0) {
            debugLog('性能建议:', report.recommendations);
        }
    }, 60000); // 每分钟检查一次

    debugLog('性能监控已启动');
}

/**
 * 获取性能统计信息
 */
export function getPerformanceStats() {
    return {
        monitor: performanceMonitor.getReport(),
        memory: performanceMonitor.getMemoryUsage(),
        errors: errorHandler.getErrorStats()
    };
}

/**
 * 清理资源
 */
export function cleanup() {
    debugLog('开始清理资源');

    try {
        // 停止性能监控
        memoryManager.stop();

        // 清理事件监听器
        window.removeEventListener('resize', handleWindowResize);
        document.removeEventListener('keydown', handleKeyboardShortcuts);

        // 清理全局变量
        currentWorkflow = null;
        editingStep = null;
        selectedNode = null;

        debugLog('资源清理完成');
    } catch (error) {
        handleError(error, { context: 'cleanup' });
    }
}