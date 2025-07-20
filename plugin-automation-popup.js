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
    getCurrentWorkflow
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

/**
 * 应用程序主入口
 */
function initializeApp() {
    debugLog('开始初始化模块化弹窗应用');

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

        // 5. 调试localStorage内容
        debugLocalStorage();

        // 6. 加载保存的工作流
        loadSavedWorkflows();

        // 7. 恢复上次的执行状态和流程缓存
        restoreExecutionState();

        debugLog('模块化弹窗应用初始化完成');

    } catch (error) {
        console.error('初始化应用失败:', error);

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

debugLog('模块化弹窗脚本已加载，版本:', window.PopupApp.version);