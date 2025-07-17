/**
 * 事件处理模块
 * 负责初始化和管理所有事件监听器
 */

/**
 * 初始化所有事件监听器
 */
function initializeEventListeners() {
    // 工作流管理按钮
    document.getElementById('executeBtn').addEventListener('click', executeWorkflow);
    document.getElementById('pauseResumeBtn').addEventListener('click', togglePauseResume);
    document.getElementById('resetEngineBtn').addEventListener('click', resetEngine);

    // 右键菜单事件监听器
    initializeContextMenu();

    // 调试：添加手动测试暂停按钮的功能
    console.log('🔧 [DEBUG] 添加调试功能：双击执行按钮可以手动显示暂停按钮');
    document.getElementById('executeBtn').addEventListener('dblclick', function() {
        console.log('🔧 [DEBUG] 双击执行按钮，手动显示暂停按钮');
        const pauseBtn = document.getElementById('pauseResumeBtn');
        if (pauseBtn) {
            pauseBtn.style.display = 'inline-block';
            pauseBtn.disabled = false;
            pauseBtn.textContent = '⏸️ 暂停';
            pauseBtn.className = 'btn btn-warning';
            executionState.isRunning = true;
            executionState.isPaused = false;
            console.log('🔧 [DEBUG] 暂停按钮已手动显示，可以测试点击功能');
        }
    });

    // 导入导出按钮
    document.getElementById('exportWorkflowBtn').addEventListener('click', exportWorkflow);
    document.getElementById('importWorkflowBtn').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', importWorkflow);

    // 流程图设计器按钮
    document.getElementById('openDesignerBtn').addEventListener('click', openWorkflowDesigner);

    // 工具按钮
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const stepType = this.dataset.stepType;
            if (stepType) {
                addStep(stepType);
            }
        });
    });
    
    // 模态框关闭
    document.getElementById('closeModalBtn').addEventListener('click', closeStepModal);
    document.getElementById('saveStepBtn').addEventListener('click', saveStepChanges);
    document.getElementById('cancelStepBtn').addEventListener('click', closeStepModal);
}

/**
 * 设置子操作处理器
 */
function setupSubOperationHandlers() {
    // 添加子操作按钮
    const addBtn = document.getElementById('addSubOperationBtn');
    if (addBtn) {
        addBtn.addEventListener('click', addSubOperation);
    }

    // 子操作编辑和删除按钮（使用事件委托）
    const container = document.getElementById('subOperationsList');
    if (container) {
        container.addEventListener('click', function(e) {
            if (e.target.classList.contains('edit-sub-op')) {
                const index = parseInt(e.target.dataset.index);
                editSubOperation(index);
            } else if (e.target.classList.contains('remove-sub-op')) {
                const index = parseInt(e.target.dataset.index);
                removeSubOperation(index);
            }
        });
    }
}

/**
 * 设置循环类型处理器
 */
function setupLoopTypeHandlers() {
    const loopTypeSelect = document.getElementById('editLoopType');
    if (loopTypeSelect) {
        loopTypeSelect.addEventListener('change', function() {
            const selectedType = this.value;
            console.log('🔄 循环类型改变为:', selectedType);
            
            // 根据循环类型显示/隐藏相关配置
            toggleLoopTypeConfig(selectedType);
        });
        
        // 初始化时也要设置一次
        toggleLoopTypeConfig(loopTypeSelect.value);
    }
}

/**
 * 设置定位器测试监听器
 */
function setupLocatorTestListeners() {
    // 主操作定位器测试按钮监听
    const mainTestBtn = document.getElementById('testMainLocatorBtn');
    if (mainTestBtn) {
        mainTestBtn.addEventListener('click', testMainLocator);
    }

    // 子操作定位器测试按钮监听
    const subOpTestBtn = document.getElementById('testSubOpLocatorBtn');
    if (subOpTestBtn) {
        subOpTestBtn.addEventListener('click', testSubOpLocator);
    }

    // 主操作定位器输入框监听
    const mainLocatorValue = document.getElementById('editLocatorValue');
    const mainLocatorStrategy = document.getElementById('editLocatorStrategy');
    
    if (mainLocatorValue && mainLocatorStrategy) {
        // 当定位器值或策略改变时，清除之前的测试高亮
        [mainLocatorValue, mainLocatorStrategy].forEach(element => {
            element.addEventListener('input', clearTestHighlights);
            element.addEventListener('change', clearTestHighlights);
        });
    }

    // 子操作定位器输入框监听
    const subOpLocatorValue = document.getElementById('subOpLocatorValue');
    const subOpLocatorStrategy = document.getElementById('subOpLocatorStrategy');
    
    if (subOpLocatorValue && subOpLocatorStrategy) {
        // 当定位器值或策略改变时，清除之前的测试高亮
        [subOpLocatorValue, subOpLocatorStrategy].forEach(element => {
            element.addEventListener('input', clearTestHighlights);
            element.addEventListener('change', clearTestHighlights);
        });
    }
}

/**
 * 切换循环类型配置显示
 */
function toggleLoopTypeConfig(loopType) {
    const containerConfig = document.getElementById('containerLoopConfig');
    const selfConfig = document.getElementById('selfLoopConfig');
    
    if (containerConfig && selfConfig) {
        if (loopType === 'container') {
            containerConfig.style.display = 'block';
            selfConfig.style.display = 'none';
            console.log('🔧 显示容器循环配置');
        } else if (loopType === 'self') {
            containerConfig.style.display = 'none';
            selfConfig.style.display = 'block';
            console.log('🔧 显示自循环配置');
        } else {
            containerConfig.style.display = 'none';
            selfConfig.style.display = 'none';
            console.log('🔧 隐藏所有循环配置');
        }
    }
}

// 导出函数供主文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeEventListeners,
        setupSubOperationHandlers,
        setupLoopTypeHandlers,
        setupLocatorTestListeners,
        toggleLoopTypeConfig
    };
}

// 在浏览器环境中，将函数添加到全局作用域
if (typeof window !== 'undefined') {
    window.initializeEventListeners = initializeEventListeners;
    window.setupSubOperationHandlers = setupSubOperationHandlers;
    window.setupLoopTypeHandlers = setupLoopTypeHandlers;
    window.setupLocatorTestListeners = setupLocatorTestListeners;
    window.toggleLoopTypeConfig = toggleLoopTypeConfig;
}
