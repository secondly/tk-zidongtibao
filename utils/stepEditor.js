/**
 * 步骤编辑模块
 * 负责步骤的创建、编辑、删除等功能
 */

/**
 * 添加步骤
 */
function addStep(stepType) {
    if (!currentWorkflow) {
        newWorkflow();
        if (!currentWorkflow) return;
    }

    try {
        const step = createStepByType(stepType);
        const addedStep = workflowManager.addStep(currentWorkflow.id, step);
        renderSteps();
        updateWorkflowInfo();
        // 保存当前工作流状态
        saveCurrentWorkflowState();
        showStatus(`已添加${getStepTypeName(stepType)}步骤`, 'success');

        // 自动打开编辑模态框
        editStep(addedStep.id);
    } catch (error) {
        showStatus(`添加步骤失败: ${error.message}`, 'error');
        console.error('添加步骤详细错误:', error);
    }
}

/**
 * 根据类型创建步骤
 */
function createStepByType(type) {
    const baseStep = {
        type: type,
        name: getStepTypeName(type),
        errorHandling: 'continue'
    };

    switch (type) {
        case 'click':
            return {
                ...baseStep,
                locator: { strategy: 'css', value: '' }
            };
        case 'input':
            return {
                ...baseStep,
                locator: { strategy: 'css', value: '' },
                inputText: ''
            };
        case 'wait':
            return {
                ...baseStep,
                waitTime: 3
            };
        case 'smartWait':
            return {
                ...baseStep,
                locator: { strategy: 'css', value: '' },
                timeout: 30000
            };
        case 'loop':
            return {
                ...baseStep,
                loopType: 'container',
                locator: { strategy: 'css', value: '' },
                subOperations: [],
                startIndex: 0,
                endIndex: -1,
                actionType: 'click',
                actionDelay: 200,
                loopDelay: 500,
                errorHandling: 'continue'
            };
        case 'condition':
            return {
                ...baseStep,
                locator: { strategy: 'css', value: '' },
                conditionType: 'exists',
                trueActions: [],
                falseActions: []
            };
        case 'checkState':
            return {
                ...baseStep,
                locator: { strategy: 'css', value: '' },
                stateType: 'enabled',
                expectedValue: true
            };
        case 'drag':
            return {
                ...baseStep,
                locator: { strategy: 'css', value: '' },
                horizontalDistance: 0,
                verticalDistance: 0,
                timeout: 10000,
                dragSpeed: 100,
                waitAfterDrag: 1000
            };
        default:
            return baseStep;
    }
}

/**
 * 获取步骤类型名称
 */
function getStepTypeName(type) {
    const typeNames = {
        click: '点击操作',
        input: '输入文本',
        wait: '等待时间',
        smartWait: '智能等待',
        loop: '循环操作',
        condition: '条件判断',
        checkState: '状态检测',
        drag: '拖拽操作'
    };
    return typeNames[type] || '未知操作';
}

/**
 * 编辑步骤
 */
function editStep(stepId) {
    const step = currentWorkflow.steps.find(s => s.id === stepId);
    if (!step) {
        showStatus('找不到指定的步骤', 'error');
        return;
    }

    console.log('✏️ 编辑步骤:', step.name);
    showStepModal(step);
}

/**
 * 删除步骤
 */
function deleteStep(stepId) {
    if (!confirm('确定要删除这个步骤吗？')) {
        return;
    }

    try {
        workflowManager.removeStep(currentWorkflow.id, stepId);
        renderSteps();
        updateWorkflowInfo();
        // 保存当前工作流状态
        saveCurrentWorkflowState();
        showStatus('步骤已删除', 'success');
    } catch (error) {
        showStatus(`删除步骤失败: ${error.message}`, 'error');
    }
}

/**
 * 测试步骤
 */
async function testStep(stepId) {
    const step = currentWorkflow.steps.find(s => s.id === stepId);
    if (!step) {
        showStatus('找不到指定的步骤', 'error');
        return;
    }

    try {
        showStatus(`🧪 开始测试步骤: ${step.name}`, 'info');

        // 使用页面选择器选择目标页面，确保与设计器测试环境一致
        let tab;
        try {
            // 初始化页面选择器
            if (!window.tabSelector) {
                window.tabSelector = new TabSelector();
            }

            // 显示页面选择器
            tab = await window.tabSelector.showTabSelector();
            if (!tab) {
                showStatus('已取消测试', 'info');
                return;
            }
            console.log('✅ 用户选择的测试页面:', tab.title, tab.url);
        } catch (error) {
            console.warn('⚠️ 页面选择器失败，使用当前页面:', error);
            // 降级到当前页面
            const [currentTab] = await chrome.tabs.query({active: true, currentWindow: true});
            if (!currentTab) {
                throw new Error('无法获取目标页面');
            }
            tab = currentTab;
            console.log('📍 使用当前页面:', tab.title, tab.url);
        }

        // 确保content script已加载
        showStatus('🔄 正在加载自动化引擎...', 'info');

        // 先尝试重置引擎，避免重复定义错误
        try {
            await sendMessageToTab(tab.id, { action: 'resetEngine' }, 2000);
            console.log('✅ 引擎已重置');
        } catch (error) {
            console.log('⚠️ 重置引擎失败，继续执行:', error.message);
        }

        await ensureContentScriptLoaded(tab.id);

        // 创建测试工作流（只包含当前步骤）
        const testWorkflow = {
            id: 'test-' + Date.now(),
            name: `测试: ${step.name}`,
            steps: [step]
        };

        console.log('🧪 发送测试请求:', testWorkflow);

        // 发送测试请求
        chrome.tabs.sendMessage(tab.id, {
            action: 'executeWorkflow',
            workflow: testWorkflow
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('测试失败:', chrome.runtime.lastError);
                showStatus(`测试失败: ${chrome.runtime.lastError.message}`, 'error');
            } else if (response && response.success) {
                showStatus(`✅ 步骤测试成功: ${step.name}`, 'success');
            } else {
                showStatus(`测试失败: ${response?.error || '未知错误'}`, 'error');
            }
        });

    } catch (error) {
        console.error('测试步骤失败:', error);
        showStatus(`测试步骤失败: ${error.message}`, 'error');
    }
}

/**
 * 显示步骤编辑模态框
 */
function showStepModal(step) {
    const modal = document.getElementById('stepModal');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');

    console.log('🔍 显示步骤编辑模态框:', step.name);

    // 设置当前编辑的步骤
    editingStep = step;
    console.log('🔧 设置editingStep:', editingStep.name);

    // 确保父级按钮可见并恢复正确的文本和功能
    const saveStepBtn = document.getElementById('saveStepBtn');
    const cancelStepBtn = document.getElementById('cancelStepBtn');
    const buttonContainer = saveStepBtn ? saveStepBtn.parentElement : null;

    if (buttonContainer) {
        buttonContainer.style.display = 'flex';
        console.log('🔧 确保父级按钮容器可见');
    }

    // 恢复按钮文本和功能
    if (saveStepBtn) {
        saveStepBtn.textContent = '保存';
        saveStepBtn.onclick = saveStepChanges;
        console.log('🔧 恢复保存按钮');
    }

    if (cancelStepBtn) {
        cancelStepBtn.textContent = '取消';
        cancelStepBtn.onclick = closeStepModal;
        console.log('🔧 恢复取消按钮');
    }

    // 清除子操作编辑状态
    isEditingSubOperation = false;

    // 验证步骤数据完整性
    validateStepData(step);

    if (step.type === 'loop') {
        console.log('🔍 循环步骤完整数据:', {
            name: step.name,
            type: step.type,
            loopType: step.loopType,
            locator: step.locator,
            subOperations: step.subOperations,
            subOperationsCount: step.subOperations?.length || 0,
            startIndex: step.startIndex,
            endIndex: step.endIndex
        });
    }

    title.textContent = `编辑 ${step.name}`;
    content.innerHTML = generateStepEditHTML(step);

    // 为循环类型添加事件监听器
    if (step.type === 'loop') {
        setupLoopTypeHandlers();
        setupSubOperationHandlers();
    }

    // 设置定位器测试监听器
    setupLocatorTestListeners();

    modal.style.display = 'block';
}

/**
 * 关闭步骤编辑模态框
 */
function closeStepModal() {
    const modal = document.getElementById('stepModal');
    modal.style.display = 'none';
    editingStep = null;
    isEditingSubOperation = false;
    console.log('🔧 步骤编辑模态框已关闭');
}

/**
 * 保存步骤更改
 */
function saveStepChanges() {
    if (!editingStep) {
        showStatus('没有正在编辑的步骤', 'error');
        return;
    }

    try {
        // 从表单收集数据
        const formData = collectStepFormData(editingStep.type);
        
        // 更新步骤数据
        Object.assign(editingStep, formData);
        
        // 更新工作流
        workflowManager.updateStep(currentWorkflow.id, editingStep.id, editingStep);
        
        // 重新渲染
        renderSteps();
        updateWorkflowInfo();
        
        // 保存状态
        saveCurrentWorkflowState();
        
        // 关闭模态框
        closeStepModal();
        
        showStatus('步骤已保存', 'success');
    } catch (error) {
        showStatus(`保存失败: ${error.message}`, 'error');
        console.error('保存步骤失败:', error);
    }
}

/**
 * 验证步骤数据完整性
 */
function validateStepData(step) {
    if (!step.subOperations) {
        step.subOperations = [];
        console.log('🔧 初始化subOperations数组');
    }
    
    if (step.type === 'loop' && !step.loopType) {
        step.loopType = 'container';
        console.log('🔧 设置默认循环类型为container');
    }
    
    if (!step.locator && ['click', 'input', 'smartWait', 'loop', 'condition', 'checkState', 'drag'].includes(step.type)) {
        step.locator = { strategy: 'css', value: '' };
        console.log('🔧 初始化locator对象');
    }
}

// 导出函数供主文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        addStep,
        createStepByType,
        getStepTypeName,
        editStep,
        deleteStep,
        testStep,
        showStepModal,
        closeStepModal,
        saveStepChanges,
        validateStepData
    };
}

// 在浏览器环境中，将函数添加到全局作用域
if (typeof window !== 'undefined') {
    window.addStep = addStep;
    window.createStepByType = createStepByType;
    window.getStepTypeName = getStepTypeName;
    window.editStep = editStep;
    window.deleteStep = deleteStep;
    window.testStep = testStep;
    window.testStepNode = testStep; // 别名
    window.showStepModal = showStepModal;
    window.closeStepModal = closeStepModal;
    window.saveStepChanges = saveStepChanges;
    window.validateStepData = validateStepData;
}
