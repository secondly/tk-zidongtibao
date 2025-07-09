/**
 * 通用自动化插件弹窗脚本
 */

// 全局变量
let workflowManager = new WorkflowManager();
let automationEngine = new UniversalAutomationEngine();
let currentWorkflow = null;
let editingStep = null;
let isEditingSubOperation = false; // 标记是否在编辑子操作

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🤖 通用自动化插件已加载');
    initializeEventListeners();
    loadSavedWorkflows();
    // 自动加载上次的工作流状态
    loadLastWorkflowState();
});

// 初始化事件监听器
function initializeEventListeners() {
    // 工作流管理按钮
    document.getElementById('newWorkflowBtn').addEventListener('click', newWorkflow);
    document.getElementById('loadWorkflowBtn').addEventListener('click', loadWorkflow);
    document.getElementById('saveWorkflowBtn').addEventListener('click', saveWorkflow);
    document.getElementById('clearWorkflowBtn').addEventListener('click', clearWorkflow);
    document.getElementById('executeBtn').addEventListener('click', executeWorkflow);
    document.getElementById('resetEngineBtn').addEventListener('click', resetEngine);

    // 导入导出按钮
    document.getElementById('exportWorkflowBtn').addEventListener('click', exportWorkflow);
    document.getElementById('importWorkflowBtn').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', importWorkflow);

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

// 新建工作流
function newWorkflow() {
    const name = prompt('请输入工作流名称:', '新建工作流');
    if (name && name.trim()) {
        try {
            currentWorkflow = workflowManager.createWorkflow(name.trim());
            updateWorkflowInfo();
            renderSteps();
            // 保存当前工作流状态
            saveCurrentWorkflowState();
            showStatus('工作流创建成功', 'success');
        } catch (error) {
            showStatus(`创建工作流失败: ${error.message}`, 'error');
        }
    }
}

// 加载工作流
function loadWorkflow() {
    const workflowList = workflowManager.getWorkflowList();
    if (workflowList.length === 0) {
        showStatus('没有保存的工作流', 'info');
        return;
    }

    let options = workflowList.map((wf, index) => 
        `${index + 1}. ${wf.name} (${wf.stepCount}个步骤)`
    ).join('\n');
    
    const choice = prompt(`选择要加载的工作流:\n${options}\n\n请输入序号:`);
    const index = parseInt(choice) - 1;
    
    if (index >= 0 && index < workflowList.length) {
        const workflowId = workflowList[index].id;
        try {
            currentWorkflow = workflowManager.loadFromStorage(workflowId);
            updateWorkflowInfo();
            renderSteps();
            // 保存当前工作流状态
            saveCurrentWorkflowState();
            showStatus('工作流加载成功', 'success');
        } catch (error) {
            showStatus(`加载工作流失败: ${error.message}`, 'error');
        }
    }
}

// 保存工作流
function saveWorkflow() {
    if (!currentWorkflow) {
        showStatus('没有工作流可保存', 'error');
        return;
    }

    try {
        workflowManager.saveToStorage(currentWorkflow.id);
        // 同时更新当前工作流状态
        saveCurrentWorkflowState();
        showStatus('工作流保存成功', 'success');
    } catch (error) {
        showStatus(`保存工作流失败: ${error.message}`, 'error');
    }
}

// 清除当前工作流
function clearWorkflow() {
    if (currentWorkflow && currentWorkflow.steps.length > 0) {
        if (confirm('确定要清除当前工作流吗？未保存的更改将丢失。')) {
            clearCurrentWorkflowState();
            showStatus('工作流已清除', 'info');
        }
    } else {
        clearCurrentWorkflowState();
        showStatus('工作流已清除', 'info');
    }
}

// 执行工作流
async function executeWorkflow() {
    if (!currentWorkflow || currentWorkflow.steps.length === 0) {
        showStatus('工作流为空，无法执行', 'error');
        return;
    }

    // 验证工作流
    const validation = workflowManager.validateWorkflow(currentWorkflow);
    if (!validation.isValid) {
        showStatus(`工作流验证失败: ${validation.errors[0]}`, 'error');
        return;
    }

    try {
        // 禁用执行按钮
        document.getElementById('executeBtn').disabled = true;
        showStatus('开始执行工作流...', 'info');

        // 首先检查当前标签页
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        if (!tab) {
            throw new Error('无法获取当前标签页');
        }

        // 确保content script已加载
        showStatus('🔄 正在准备自动化引擎...', 'info');

        // 先尝试重置引擎，避免重复定义错误
        try {
            await sendMessageToTab(tab.id, { action: 'resetEngine' }, 2000);
            console.log('✅ 引擎已重置');
        } catch (error) {
            console.log('⚠️ 重置引擎失败，继续执行:', error.message);
        }

        await ensureContentScriptLoaded(tab.id);

        // 调试：检查发送的工作流数据
        console.log('🚀 发送工作流执行请求:', {
            workflowName: currentWorkflow.name,
            stepsCount: currentWorkflow.steps.length,
            steps: currentWorkflow.steps.map(step => ({
                id: step.id,
                name: step.name,
                type: step.type,
                loopType: step.loopType,
                hasSubOperations: !!(step.subOperations && step.subOperations.length > 0),
                subOperationsCount: step.subOperations?.length || 0,
                subOperations: step.subOperations
            }))
        });

        // 发送消息到content script执行
        chrome.tabs.sendMessage(tab.id, {
            action: 'executeWorkflow',
            workflow: currentWorkflow
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('执行失败:', chrome.runtime.lastError);
                showStatus(`执行失败: ${chrome.runtime.lastError.message}`, 'error');
                document.getElementById('executeBtn').disabled = false;
            } else if (response && response.success) {
                showStatus('工作流执行完成', 'success');
                document.getElementById('executeBtn').disabled = false;
            } else {
                showStatus(`执行失败: ${response?.error || '未知错误'}`, 'error');
                document.getElementById('executeBtn').disabled = false;
            }
        });

    } catch (error) {
        console.error('执行工作流失败:', error);
        showStatus(`执行工作流失败: ${error.message}`, 'error');
        document.getElementById('executeBtn').disabled = false;
    }
}

// 添加步骤
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

// 根据类型创建步骤
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
                text: '',
                clearFirst: true
            };
        case 'wait':
            return {
                ...baseStep,
                duration: 1000
            };
        case 'smartWait':
            return {
                ...baseStep,
                locator: { strategy: 'css', value: '' },
                timeout: 10000,
                interval: 500,
                description: '等待元素出现'
            };
        case 'loop':
            return {
                ...baseStep,
                locator: { strategy: 'css', value: '' },
                loopType: 'parentLoop', // 默认为父级循环
                startIndex: 0,
                endIndex: -1,
                skipIndices: [],
                subOperations: [], // 父级循环的子操作
                waitAfterClick: 1000, // 点击后等待时间
                loopDelay: 500,
                errorHandling: 'continue', // 错误处理策略
                // 简单循环专用属性
                actionType: 'click', // click, input, check, uncheck
                inputText: '', // 当actionType为input时使用
                actionDelay: 200 // 简单循环操作间隔
            };
        case 'rangeSelect':
            return {
                ...baseStep,
                locator: { strategy: 'css', value: '' },
                startIndex: 1,
                endIndex: 5,
                selectDelay: 200
            };
        case 'nestedLoop':
            return {
                ...baseStep,
                // 主循环配置
                mainLocator: { strategy: 'css', value: '' },
                startIndex: 0,
                endIndex: -1,
                skipIndices: [],
                mainLoopDelay: 1000,

                // 第一个弹窗配置
                firstModalWait: {
                    locator: { strategy: 'css', value: '' },
                    timeout: 10000,
                    interval: 500
                },
                firstModalAction: {
                    type: 'click',
                    locator: { strategy: 'css', value: '' }
                },

                // 第二个弹窗配置
                secondModalWait: {
                    locator: { strategy: 'css', value: '' },
                    timeout: 10000,
                    interval: 500
                },
                rangeSelection: {
                    locator: { strategy: 'css', value: '' },
                    startIndex: 2,
                    endIndex: 6,
                    selectionDelay: 200
                },

                // 确认操作
                confirmAction: {
                    type: 'click',
                    locator: { strategy: 'css', value: '' }
                },

                // 返回等待时间
                returnWait: 1000
            };
        default:
            return baseStep;
    }
}

// 获取步骤类型名称
function getStepTypeName(type) {
    const names = {
        'click': '点击操作',
        'input': '输入文本',
        'wait': '等待时间',
        'smartWait': '智能等待',
        'loop': '循环操作',
        'rangeSelect': '区间选择'
    };
    return names[type] || type;
}

// 更新工作流信息
function updateWorkflowInfo() {
    const nameElement = document.getElementById('workflowName');
    const statsElement = document.getElementById('workflowStats');
    const executeBtn = document.getElementById('executeBtn');

    if (currentWorkflow) {
        nameElement.textContent = currentWorkflow.name;
        statsElement.textContent = `${currentWorkflow.steps.length} 个步骤`;
        executeBtn.disabled = currentWorkflow.steps.length === 0;
    } else {
        nameElement.textContent = '未选择工作流';
        statsElement.textContent = '点击"新建"创建工作流';
        executeBtn.disabled = true;
    }
}

// 渲染步骤列表
function renderSteps() {
    const container = document.getElementById('stepsContainer');
    
    if (!currentWorkflow || currentWorkflow.steps.length === 0) {
        container.innerHTML = `
            <div class="empty-steps">
                暂无操作步骤<br>
                点击上方工具添加操作
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    currentWorkflow.steps.forEach((step, index) => {
        const stepElement = createStepElement(step, index);
        container.appendChild(stepElement);
    });
}

// 创建步骤元素
function createStepElement(step, index) {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step-item';
    stepDiv.innerHTML = `
        <div class="step-info">
            <div class="step-name">${step.name}</div>
            <div class="step-details">${getStepDetails(step)}</div>
        </div>
        <div class="step-actions">
            <button class="step-action-btn" data-step-id="${step.id}" data-action="test" title="测试此步骤">🧪</button>
            <button class="step-action-btn" data-step-id="${step.id}" data-action="edit" title="编辑">✏️</button>
            <button class="step-action-btn" data-step-id="${step.id}" data-action="delete" title="删除">🗑️</button>
        </div>
    `;
    
    // 添加事件监听器
    stepDiv.querySelectorAll('.step-action-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const stepId = this.dataset.stepId;
            const action = this.dataset.action;
            
            if (action === 'test') {
                testStep(stepId);
            } else if (action === 'edit') {
                editStep(stepId);
            } else if (action === 'delete') {
                deleteStep(stepId);
            }
        });
    });
    
    return stepDiv;
}

// 获取步骤详情
function getStepDetails(step) {
    switch (step.type) {
        case 'click':
        case 'input':
        case 'smartWait':
        case 'rangeSelect':
            return step.locator ? `${step.locator.strategy}: ${step.locator.value || '未配置'}` : '未配置定位器';
        case 'loop':
            const loopTypeText = step.loopType === 'simpleLoop' ? '简单循环' : '父级循环';
            const locatorText = step.locator ? `${step.locator.strategy}: ${step.locator.value || '未配置'}` : '未配置定位器';
            const actionText = step.loopType === 'simpleLoop' ? ` (${step.actionType || 'click'})` : '';
            const subOpsText = step.loopType === 'parentLoop' && step.subOperations ? ` [${step.subOperations.length}个子操作]` : '';
            return `${loopTypeText} - ${locatorText}${actionText}${subOpsText}`;
        case 'wait':
            return `等待 ${step.duration}ms`;
        case 'nestedLoop':
            const mainLocatorText = step.mainLocator ? `${step.mainLocator.strategy}: ${step.mainLocator.value || '未配置'}` : '未配置主定位器';
            return `三层嵌套 - ${mainLocatorText}`;
        default:
            return step.type;
    }
}

// 编辑步骤
function editStep(stepId) {
    const step = workflowManager.findStepById(currentWorkflow, stepId);
    if (!step) {
        showStatus('步骤不存在', 'error');
        return;
    }

    editingStep = step;

    // 确保步骤有必要的数据结构
    if (!step.locator) {
        step.locator = { strategy: 'css', value: '' };
        console.log('🔧 为步骤初始化locator对象');
    }

    // 确保循环步骤有subOperations数组
    if (step.type === 'loop' && !step.subOperations) {
        step.subOperations = [];
        console.log('🔧 为循环步骤初始化subOperations数组');
    }

    showStepModal(step);
}

// 测试单个步骤
async function testStep(stepId) {
    const step = workflowManager.findStepById(currentWorkflow, stepId);
    if (!step) {
        showStatus('步骤不存在', 'error');
        return;
    }

    try {
        showStatus(`🧪 开始测试步骤: ${step.name}`, 'info');

        // 获取当前标签页
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        if (!tab) {
            throw new Error('无法获取当前标签页');
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

        showStatus('⚡ 正在执行测试...', 'info');

        // 发送测试消息到content script
        const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('测试超时（10秒）'));
            }, 10000);

            chrome.tabs.sendMessage(tab.id, {
                action: 'executeWorkflow',
                workflow: testWorkflow
            }, (response) => {
                clearTimeout(timeout);

                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        if (response && response.success) {
            showStatus(`✅ 步骤测试成功: ${step.name}`, 'success');
        } else {
            showStatus(`❌ 测试失败: ${response?.error || '未知错误'}`, 'error');
        }

    } catch (error) {
        console.error('测试步骤失败:', error);
        showStatus(`❌ 测试步骤失败: ${error.message}`, 'error');
    }
}

// 删除步骤
function deleteStep(stepId) {
    if (confirm('确定要删除这个步骤吗？')) {
        try {
            workflowManager.deleteStep(currentWorkflow.id, stepId);
            renderSteps();
            updateWorkflowInfo();
            // 保存当前工作流状态
            saveCurrentWorkflowState();
            showStatus('步骤删除成功', 'success');
        } catch (error) {
            showStatus(`删除步骤失败: ${error.message}`, 'error');
        }
    }
}

// 显示步骤编辑模态框
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

    // 只有在非子操作编辑模式下才恢复父级按钮功能
    if (!isEditingSubOperation) {
        // 恢复父级按钮的正确文本和功能（可能被子操作修改了）
        if (saveStepBtn) {
            if (saveStepBtn.textContent !== '保存') {
                saveStepBtn.textContent = '保存';
                console.log('🔧 恢复保存按钮文本');
            }
            // 重新绑定父级保存功能
            saveStepBtn.onclick = saveStepChanges;
            console.log('🔧 重新绑定父级保存功能');
        }
        if (cancelStepBtn) {
            if (cancelStepBtn.textContent !== '取消') {
                cancelStepBtn.textContent = '取消';
                console.log('🔧 恢复取消按钮文本');
            }
            // 重新绑定父级取消功能
            cancelStepBtn.onclick = closeStepModal;
            console.log('🔧 重新绑定父级取消功能');
        }
    } else {
        console.log('🔧 子操作编辑模式：跳过按钮重新绑定');
    }

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

// 设置循环类型处理器
function setupLoopTypeHandlers() {
    const loopTypeSelect = document.getElementById('editLoopType');
    const actionTypeSelect = document.getElementById('editActionType');

    if (loopTypeSelect) {
        loopTypeSelect.addEventListener('change', function() {
            const loopType = this.value;
            const simpleConfig = document.getElementById('simpleLoopConfig');
            const parentConfig = document.getElementById('parentLoopConfig');

            if (loopType === 'simpleLoop') {
                simpleConfig.style.display = 'block';
                parentConfig.style.display = 'none';
            } else {
                simpleConfig.style.display = 'none';
                parentConfig.style.display = 'block';
            }
        });
    }

    if (actionTypeSelect) {
        actionTypeSelect.addEventListener('change', function() {
            const actionType = this.value;
            const inputTextGroup = document.getElementById('inputTextGroup');

            if (actionType === 'input') {
                inputTextGroup.style.display = 'block';
            } else {
                inputTextGroup.style.display = 'none';
            }
        });
    }
}

// 设置子操作处理器
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

// 关闭步骤编辑模态框
function closeStepModal() {
    document.getElementById('stepModal').style.display = 'none';
    editingStep = null;
}

// 关闭模态框但保持editingStep数据（用于子操作编辑流程）
function hideStepModal() {
    document.getElementById('stepModal').style.display = 'none';
    // 不清空editingStep，保持数据状态
}

// 生成步骤编辑HTML
function generateStepEditHTML(step) {
    let html = `
        <div class="form-group">
            <label>步骤名称</label>
            <input type="text" id="editStepName" value="${step.name}" placeholder="输入步骤名称">
        </div>
    `;

    // 根据步骤类型添加特定配置
    switch (step.type) {
        case 'click':
        case 'input':
        case 'smartWait':
        case 'rangeSelect':
            html += `
                <div class="form-group">
                    <label>定位策略</label>
                    <select id="editLocatorStrategy">
                        <option value="css" ${step.locator?.strategy === 'css' ? 'selected' : ''}>CSS选择器</option>
                        <option value="xpath" ${step.locator?.strategy === 'xpath' ? 'selected' : ''}>XPath</option>
                        <option value="id" ${step.locator?.strategy === 'id' ? 'selected' : ''}>ID</option>
                        <option value="className" ${step.locator?.strategy === 'className' ? 'selected' : ''}>类名</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>定位值</label>
                    <div class="input-with-test">
                        <input type="text" id="editLocatorValue" value="${step.locator?.value || ''}" placeholder="输入定位值">
                        <button type="button" class="test-locator-btn" id="testMainLocatorBtn">🔍测试</button>
                    </div>
                    <div id="mainLocatorTestResult" class="test-result"></div>
                    <div class="help-text">用于定位页面元素的值</div>
                </div>
            `;
            break;
        case 'loop':
            html += `
                <div class="form-group">
                    <label>循环类型</label>
                    <select id="editLoopType">
                        <option value="parentLoop" ${step.loopType === 'parentLoop' ? 'selected' : ''}>父级循环（带子操作）</option>
                        <option value="simpleLoop" ${step.loopType === 'simpleLoop' ? 'selected' : ''}>简单循环（单一操作）</option>
                    </select>
                    <div class="help-text">选择循环类型：父级循环用于复杂的多步骤操作，简单循环用于对多个元素执行相同操作</div>
                </div>
                <div class="form-group">
                    <label>定位策略</label>
                    <select id="editLocatorStrategy">
                        <option value="css" ${(step.locator && step.locator.strategy === 'css') ? 'selected' : ''}>CSS选择器</option>
                        <option value="xpath" ${(step.locator && step.locator.strategy === 'xpath') ? 'selected' : ''}>XPath</option>
                        <option value="id" ${(step.locator && step.locator.strategy === 'id') ? 'selected' : ''}>ID</option>
                        <option value="className" ${(step.locator && step.locator.strategy === 'className') ? 'selected' : ''}>类名</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>定位值</label>
                    <div class="input-with-test">
                        <input type="text" id="editLocatorValue" value="${(step.locator && step.locator.value) ? step.locator.value : ''}" placeholder="输入定位值">
                        <button type="button" class="test-locator-btn" id="testMainLocatorBtn">🔍测试</button>
                    </div>
                    <div id="mainLocatorTestResult" class="test-result"></div>
                    <div class="help-text">用于定位页面元素的值</div>
                </div>
                <div class="form-group">
                    <label>起始索引</label>
                    <input type="number" id="editLoopStartIndex" value="${step.startIndex || 0}" min="0">
                </div>
                <div class="form-group">
                    <label>结束索引</label>
                    <input type="number" id="editLoopEndIndex" value="${step.endIndex || -1}" min="-1">
                    <div class="help-text">-1 表示处理所有元素</div>
                </div>
                <div id="simpleLoopConfig" style="display: ${step.loopType === 'simpleLoop' ? 'block' : 'none'};">
                    <div class="form-group">
                        <label>操作类型</label>
                        <select id="editActionType">
                            <option value="click" ${step.actionType === 'click' ? 'selected' : ''}>点击</option>
                            <option value="input" ${step.actionType === 'input' ? 'selected' : ''}>输入文本</option>
                            <option value="check" ${step.actionType === 'check' ? 'selected' : ''}>勾选复选框</option>
                            <option value="uncheck" ${step.actionType === 'uncheck' ? 'selected' : ''}>取消勾选</option>
                        </select>
                    </div>
                    <div class="form-group" id="inputTextGroup" style="display: ${step.actionType === 'input' ? 'block' : 'none'};">
                        <label>输入文本</label>
                        <input type="text" id="editInputText" value="${step.inputText || ''}" placeholder="要输入的文本">
                    </div>
                    <div class="form-group">
                        <label>操作间隔(毫秒)</label>
                        <input type="number" id="editActionDelay" value="${step.actionDelay || 200}" min="0">
                    </div>
                </div>
                <div id="parentLoopConfig" style="display: ${step.loopType === 'parentLoop' ? 'block' : 'none'};">
                    <div class="form-group">
                        <label>点击后等待时间(毫秒)</label>
                        <input type="number" id="editWaitAfterClick" value="${step.waitAfterClick || 1000}" min="0">
                        <div class="help-text">点击父级元素后等待页面加载的时间</div>
                    </div>
                    <div class="form-group">
                        <label>循环间隔(毫秒)</label>
                        <input type="number" id="editLoopDelay" value="${step.loopDelay || 500}" min="0">
                    </div>
                    <div class="form-group">
                        <label>子操作配置</label>
                        <div id="subOperationsList">
                            ${renderSubOperationsList(step.subOperations || [])}
                        </div>
                        <button type="button" class="btn-secondary" id="addSubOperationBtn">+ 添加子操作</button>
                        <div class="help-text">配置在每个父级元素上执行的操作序列</div>
                    </div>
                    <div class="form-group">
                        <label>错误处理</label>
                        <select id="editErrorHandling">
                            <option value="continue" ${step.errorHandling === 'continue' ? 'selected' : ''}>跳过错误继续</option>
                            <option value="stop" ${step.errorHandling === 'stop' ? 'selected' : ''}>遇到错误停止</option>
                        </select>
                    </div>
                </div>
            `;
            break;
        case 'nestedLoop':
            html += `
                <div class="form-group">
                    <label>主循环定位策略</label>
                    <select id="editMainLocatorStrategy">
                        <option value="css" ${step.mainLocator?.strategy === 'css' ? 'selected' : ''}>CSS选择器</option>
                        <option value="xpath" ${step.mainLocator?.strategy === 'xpath' ? 'selected' : ''}>XPath</option>
                        <option value="id" ${step.mainLocator?.strategy === 'id' ? 'selected' : ''}>ID</option>
                        <option value="className" ${step.mainLocator?.strategy === 'className' ? 'selected' : ''}>类名</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>主循环定位值</label>
                    <input type="text" id="editMainLocatorValue" value="${step.mainLocator?.value || ''}" placeholder="主列表元素定位值">
                    <div class="help-text">用于定位主页面列表中的每一行</div>
                </div>

                <h4>第一个弹窗配置</h4>
                <div class="form-group">
                    <label>第一个弹窗等待定位值</label>
                    <input type="text" id="editFirstModalWaitValue" value="${step.firstModalWait?.locator?.value || ''}" placeholder="第一个弹窗的定位值">
                    <div class="help-text">等待第一个弹窗出现的元素定位</div>
                </div>
                <div class="form-group">
                    <label>第一个弹窗操作定位值</label>
                    <input type="text" id="editFirstModalActionValue" value="${step.firstModalAction?.locator?.value || ''}" placeholder="第一个弹窗中要点击的按钮">
                    <div class="help-text">在第一个弹窗中要点击的元素（如"选择类目按钮"）</div>
                </div>

                <h4>第二个弹窗配置</h4>
                <div class="form-group">
                    <label>第二个弹窗等待定位值</label>
                    <input type="text" id="editSecondModalWaitValue" value="${step.secondModalWait?.locator?.value || ''}" placeholder="第二个弹窗的定位值">
                    <div class="help-text">等待第二个弹窗出现的元素定位</div>
                </div>
                <div class="form-group">
                    <label>区间选择定位值</label>
                    <input type="text" id="editRangeSelectionValue" value="${step.rangeSelection?.locator?.value || ''}" placeholder="多选列表中的选项定位">
                    <div class="help-text">第二个弹窗中多选列表的选项定位</div>
                </div>
                <div class="form-group">
                    <label>区间起始索引</label>
                    <input type="number" id="editRangeStartIndex" value="${step.rangeSelection?.startIndex || 2}" min="0">
                </div>
                <div class="form-group">
                    <label>区间结束索引</label>
                    <input type="number" id="editRangeEndIndex" value="${step.rangeSelection?.endIndex || 6}" min="0">
                </div>
                <div class="form-group">
                    <label>确认按钮定位值</label>
                    <input type="text" id="editConfirmActionValue" value="${step.confirmAction?.locator?.value || ''}" placeholder="确认按钮的定位值">
                    <div class="help-text">第二个弹窗中确认按钮的定位</div>
                </div>

                <h4>时间配置</h4>
                <div class="form-group">
                    <label>主循环间隔(毫秒)</label>
                    <input type="number" id="editMainLoopDelay" value="${step.mainLoopDelay || 1000}" min="0">
                </div>
                <div class="form-group">
                    <label>返回等待时间(毫秒)</label>
                    <input type="number" id="editReturnWait" value="${step.returnWait || 1000}" min="0">
                    <div class="help-text">完成操作后等待返回主页面的时间</div>
                </div>
            `;
            break;
    }

    // 添加类型特定配置
    switch (step.type) {
        case 'input':
            html += `
                <div class="form-group">
                    <label>输入文本</label>
                    <input type="text" id="editInputText" value="${step.text || ''}" placeholder="要输入的文本">
                </div>
            `;
            break;
        case 'wait':
            html += `
                <div class="form-group">
                    <label>等待时间(毫秒)</label>
                    <input type="number" id="editWaitDuration" value="${step.duration || 1000}" min="100" max="60000">
                </div>
            `;
            break;
        case 'smartWait':
            html += `
                <div class="form-group">
                    <label>超时时间(毫秒)</label>
                    <input type="number" id="editSmartWaitTimeout" value="${step.timeout || 10000}" min="1000" max="60000">
                </div>
                <div class="form-group">
                    <label>等待描述</label>
                    <input type="text" id="editSmartWaitDescription" value="${step.description || ''}" placeholder="等待的描述">
                </div>
            `;
            break;
        case 'rangeSelect':
            html += `
                <div class="form-group">
                    <label>起始位置</label>
                    <input type="number" id="editRangeStart" value="${step.startIndex || 1}" min="1">
                </div>
                <div class="form-group">
                    <label>结束位置</label>
                    <input type="number" id="editRangeEnd" value="${step.endIndex || 5}" min="1">
                </div>
            `;
            break;
    }

    return html;
}

// 保存步骤修改
function saveStepChanges() {
    if (!editingStep) return;

    try {
        const updates = {
            name: document.getElementById('editStepName')?.value || editingStep.name
        };

        // 更新定位器
        const strategyElement = document.getElementById('editLocatorStrategy');
        const valueElement = document.getElementById('editLocatorValue');
        if (strategyElement && valueElement) {
            updates.locator = {
                strategy: strategyElement.value,
                value: valueElement.value
            };
        }

        // 更新类型特定属性
        switch (editingStep.type) {
            case 'input':
                const textElement = document.getElementById('editInputText');
                if (textElement) updates.text = textElement.value;
                break;
            case 'wait':
                const durationElement = document.getElementById('editWaitDuration');
                if (durationElement) updates.duration = parseInt(durationElement.value);
                break;
            case 'smartWait':
                const timeoutElement = document.getElementById('editSmartWaitTimeout');
                const descElement = document.getElementById('editSmartWaitDescription');
                if (timeoutElement) updates.timeout = parseInt(timeoutElement.value);
                if (descElement) updates.description = descElement.value;
                break;
            case 'rangeSelect':
                const startElement = document.getElementById('editRangeStart');
                const endElement = document.getElementById('editRangeEnd');
                if (startElement) updates.startIndex = parseInt(startElement.value);
                if (endElement) updates.endIndex = parseInt(endElement.value);
                break;
            case 'loop':
                console.log('🔍 开始保存循环步骤配置...');

                // 循环类型
                const loopTypeElement = document.getElementById('editLoopType');
                if (loopTypeElement) {
                    updates.loopType = loopTypeElement.value;
                    console.log('🔍 循环类型:', updates.loopType);
                }

                // 定位器配置已在上面的通用部分处理，这里不需要重复
                console.log('🔍 定位器配置:', updates.locator);

                // 循环范围
                const loopStartElement = document.getElementById('editLoopStartIndex');
                const loopEndElement = document.getElementById('editLoopEndIndex');
                if (loopStartElement) updates.startIndex = parseInt(loopStartElement.value);
                if (loopEndElement) updates.endIndex = parseInt(loopEndElement.value);
                console.log('🔍 循环范围:', updates.startIndex, 'to', updates.endIndex);

                // 简单循环配置
                if (updates.loopType === 'simpleLoop') {
                    const actionTypeElement = document.getElementById('editActionType');
                    const actionDelayElement = document.getElementById('editActionDelay');
                    const inputTextElement = document.getElementById('editInputText');

                    if (actionTypeElement) updates.actionType = actionTypeElement.value;
                    if (actionDelayElement) updates.actionDelay = parseInt(actionDelayElement.value);
                    if (inputTextElement && updates.actionType === 'input') {
                        updates.inputText = inputTextElement.value;
                    }
                    console.log('🔍 简单循环配置:', {
                        actionType: updates.actionType,
                        actionDelay: updates.actionDelay,
                        inputText: updates.inputText
                    });
                }

                // 父级循环配置
                if (updates.loopType === 'parentLoop') {
                    const waitAfterClickElement = document.getElementById('editWaitAfterClick');
                    const loopDelayElement = document.getElementById('editLoopDelay');
                    const errorHandlingElement = document.getElementById('editErrorHandling');

                    if (waitAfterClickElement) updates.waitAfterClick = parseInt(waitAfterClickElement.value);
                    if (loopDelayElement) updates.loopDelay = parseInt(loopDelayElement.value);
                    if (errorHandlingElement) updates.errorHandling = errorHandlingElement.value;

                    // 保存子操作配置（确保总是保存，即使是空数组）
                    updates.subOperations = editingStep.subOperations || [];
                    console.log('🔍 子操作配置:', updates.subOperations);

                    console.log('🔍 父级循环配置:', {
                        waitAfterClick: updates.waitAfterClick,
                        loopDelay: updates.loopDelay,
                        errorHandling: updates.errorHandling,
                        subOperationsCount: updates.subOperations?.length || 0
                    });
                }

                console.log('🔍 完整的循环更新数据:', updates);
                break;
            case 'nestedLoop':
                // 主循环配置
                const mainStrategyElement = document.getElementById('editMainLocatorStrategy');
                const mainValueElement = document.getElementById('editMainLocatorValue');
                if (mainStrategyElement && mainValueElement) {
                    updates.mainLocator = {
                        strategy: mainStrategyElement.value,
                        value: mainValueElement.value
                    };
                }

                // 第一个弹窗配置
                const firstModalWaitElement = document.getElementById('editFirstModalWaitValue');
                const firstModalActionElement = document.getElementById('editFirstModalActionValue');
                if (firstModalWaitElement) {
                    updates.firstModalWait = {
                        locator: { strategy: 'css', value: firstModalWaitElement.value },
                        timeout: 10000,
                        interval: 500
                    };
                }
                if (firstModalActionElement) {
                    updates.firstModalAction = {
                        type: 'click',
                        locator: { strategy: 'css', value: firstModalActionElement.value }
                    };
                }

                // 第二个弹窗配置
                const secondModalWaitElement = document.getElementById('editSecondModalWaitValue');
                const rangeSelectionElement = document.getElementById('editRangeSelectionValue');
                const rangeStartElement = document.getElementById('editRangeStartIndex');
                const rangeEndElement = document.getElementById('editRangeEndIndex');
                const confirmActionElement = document.getElementById('editConfirmActionValue');

                if (secondModalWaitElement) {
                    updates.secondModalWait = {
                        locator: { strategy: 'css', value: secondModalWaitElement.value },
                        timeout: 10000,
                        interval: 500
                    };
                }
                if (rangeSelectionElement) {
                    updates.rangeSelection = {
                        locator: { strategy: 'css', value: rangeSelectionElement.value },
                        startIndex: rangeStartElement ? parseInt(rangeStartElement.value) : 2,
                        endIndex: rangeEndElement ? parseInt(rangeEndElement.value) : 6,
                        selectionDelay: 200
                    };
                }
                if (confirmActionElement) {
                    updates.confirmAction = {
                        type: 'click',
                        locator: { strategy: 'css', value: confirmActionElement.value }
                    };
                }

                // 时间配置
                const mainLoopDelayElement = document.getElementById('editMainLoopDelay');
                const returnWaitElement = document.getElementById('editReturnWait');
                if (mainLoopDelayElement) updates.mainLoopDelay = parseInt(mainLoopDelayElement.value);
                if (returnWaitElement) updates.returnWait = parseInt(returnWaitElement.value);
                break;
        }

        // 应用更新到editingStep
        Object.assign(editingStep, updates);

        // 调试信息
        if (editingStep.type === 'loop') {
            console.log('🔍 保存循环步骤完整数据:', {
                name: editingStep.name,
                type: editingStep.type,
                loopType: editingStep.loopType,
                locator: editingStep.locator,
                subOperations: editingStep.subOperations,
                subOperationsCount: editingStep.subOperations?.length || 0
            });
        }

        workflowManager.updateStep(currentWorkflow.id, editingStep.id, updates);

        // 立即保存到localStorage
        try {
            workflowManager.saveToStorage(currentWorkflow.id);
            console.log('✅ 工作流已保存到localStorage');

            // 验证保存是否成功
            const savedData = localStorage.getItem(`workflow_${currentWorkflow.id}`);
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                const savedStep = workflowManager.findStepById(parsedData, editingStep.id);
                if (savedStep) {
                    console.log('✅ 验证：步骤已正确保存到localStorage:', {
                        stepId: savedStep.id,
                        stepName: savedStep.name,
                        stepType: savedStep.type,
                        locator: savedStep.locator,
                        loopType: savedStep.loopType,
                        subOperations: savedStep.subOperations,
                        subOperationsCount: savedStep.subOperations?.length || 0
                    });
                } else {
                    console.error('❌ 验证失败：在保存的数据中找不到步骤');
                }
            } else {
                console.error('❌ 验证失败：localStorage中没有找到工作流数据');
            }
        } catch (error) {
            console.error('❌ 保存工作流到localStorage失败:', error);
        }

        renderSteps();

        // 检查是否在子操作编辑模式下
        const saveStepBtn = document.getElementById('saveStepBtn');
        const isSubOperationMode = saveStepBtn && saveStepBtn.textContent === '保存子操作';

        if (isSubOperationMode) {
            // 子操作编辑模式：不关闭模态框，不清空editingStep
            console.log('🔧 子操作编辑模式：保持模态框打开');
            hideStepModal(); // 只隐藏，不清空数据
        } else {
            // 正常模式：关闭模态框并清空editingStep
            closeStepModal();
        }

        // 保存当前工作流状态
        saveCurrentWorkflowState();
        showStatus('步骤更新成功', 'success');
    } catch (error) {
        showStatus(`更新步骤失败: ${error.message}`, 'error');
    }
}

// 显示状态消息
function showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = 'block';
    
    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 3000);
}

// 加载保存的工作流
function loadSavedWorkflows() {
    try {
        const workflowList = JSON.parse(localStorage.getItem('workflow_list') || '[]');
        console.log(`发现 ${workflowList.length} 个保存的工作流`);
    } catch (error) {
        console.error('加载保存的工作流失败:', error);
    }
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'executionProgress') {
        updateProgress(message.data);
    } else if (message.action === 'executionComplete') {
        onExecutionComplete(message.data);
    } else if (message.action === 'executionError') {
        onExecutionError(message.data);
    }
});

// 更新执行进度
function updateProgress(progress) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressFill && progressText) {
        progressFill.style.width = `${progress.progress || 0}%`;
        progressText.textContent = `执行进度: ${progress.completedSteps || 0}/${progress.totalSteps || 0}`;
    }
}

// 执行完成回调
function onExecutionComplete(stats) {
    document.getElementById('executeBtn').disabled = false;
    showStatus(`执行完成! 成功: ${stats.successCount}, 失败: ${stats.errorCount}`, 'success');
}

// 执行错误回调
function onExecutionError(error) {
    document.getElementById('executeBtn').disabled = false;
    showStatus(`执行失败: ${error.message}`, 'error');
}

// 保存当前工作流状态到本地存储
function saveCurrentWorkflowState() {
    try {
        if (currentWorkflow) {
            // 保存当前工作流ID和完整数据
            localStorage.setItem('current_workflow_id', currentWorkflow.id);
            localStorage.setItem('current_workflow_data', JSON.stringify(currentWorkflow));
            console.log('✅ 当前工作流状态已保存:', currentWorkflow.name);
        } else {
            // 清除当前工作流状态
            localStorage.removeItem('current_workflow_id');
            localStorage.removeItem('current_workflow_data');
            console.log('🗑️ 当前工作流状态已清除');
        }
    } catch (error) {
        console.error('❌ 保存工作流状态失败:', error);
    }
}

// 加载上次的工作流状态
function loadLastWorkflowState() {
    try {
        const savedWorkflowData = localStorage.getItem('current_workflow_data');
        const savedWorkflowId = localStorage.getItem('current_workflow_id');

        console.log('🔍 尝试加载上次工作流状态...');
        console.log('🔍 保存的工作流ID:', savedWorkflowId);

        if (savedWorkflowData && savedWorkflowId) {
            // 恢复工作流数据
            currentWorkflow = JSON.parse(savedWorkflowData);

            console.log('🔍 恢复的工作流数据:', currentWorkflow);
            console.log('🔍 工作流步骤数量:', currentWorkflow.steps?.length || 0);

            // 检查循环步骤的配置
            currentWorkflow.steps?.forEach((step, index) => {
                if (step.type === 'loop') {
                    console.log(`🔍 加载的循环步骤 ${index + 1}:`, {
                        id: step.id,
                        name: step.name,
                        loopType: step.loopType,
                        locator: step.locator,
                        subOperations: step.subOperations,
                        subOperationsCount: step.subOperations?.length || 0
                    });

                    // 检查定位器
                    if (!step.locator || !step.locator.value) {
                        console.warn(`⚠️ 循环步骤 ${step.name} 缺少定位器配置`);
                    }

                    // 检查子操作
                    if (step.loopType === 'parentLoop' && (!step.subOperations || step.subOperations.length === 0)) {
                        console.warn(`⚠️ 父级循环步骤 ${step.name} 没有子操作`);
                    }
                }
            });

            // 验证工作流数据完整性
            if (currentWorkflow && currentWorkflow.id === savedWorkflowId) {
                // 修复数据结构不一致问题
                fixWorkflowDataStructure(currentWorkflow);

                // 确保工作流管理器中也有这个工作流
                try {
                    workflowManager.loadFromStorage(savedWorkflowId);
                } catch (error) {
                    // 如果存储中没有，则添加当前工作流
                    workflowManager.workflows.set(currentWorkflow.id, currentWorkflow);
                }

                updateWorkflowInfo();
                renderSteps();
                console.log('✅ 已恢复上次的工作流:', currentWorkflow.name);
                showStatus(`已恢复工作流: ${currentWorkflow.name}`, 'info');
            } else {
                console.log('⚠️ 工作流数据不完整，跳过恢复');
                clearCurrentWorkflowState();
            }
        } else {
            console.log('ℹ️ 没有找到上次的工作流状态');
            updateWorkflowInfo(); // 确保UI正确显示空状态
        }
    } catch (error) {
        console.error('❌ 加载工作流状态失败:', error);
        clearCurrentWorkflowState();
        showStatus('加载上次工作流失败，已重置', 'warning');
    }
}

// 清除当前工作流状态
function clearCurrentWorkflowState() {
    currentWorkflow = null;
    localStorage.removeItem('current_workflow_id');
    localStorage.removeItem('current_workflow_data');
    updateWorkflowInfo();
    renderSteps();
}

// 验证步骤数据完整性
function validateStepData(step) {
    if (!step) {
        console.error('❌ 步骤数据为null或undefined');
        return false;
    }

    // 检查基本属性
    if (!step.id) {
        console.warn('⚠️ 步骤缺少ID');
    }
    if (!step.name) {
        console.warn('⚠️ 步骤缺少名称');
    }
    if (!step.type) {
        console.warn('⚠️ 步骤缺少类型');
    }

    // 检查定位器
    if (['click', 'input', 'loop', 'smartWait', 'rangeSelect'].includes(step.type)) {
        if (!step.locator) {
            console.warn('⚠️ 步骤缺少定位器对象');
        } else if (!step.locator.strategy || !step.locator.value) {
            console.warn('⚠️ 步骤定位器不完整:', step.locator);
        }
    }

    // 检查循环步骤特有属性
    if (step.type === 'loop') {
        if (!step.loopType) {
            console.warn('⚠️ 循环步骤缺少loopType');
        }
        if (step.loopType === 'parentLoop' && !step.subOperations) {
            console.warn('⚠️ 父级循环步骤缺少subOperations数组');
        }
    }

    return true;
}

// 修复工作流数据结构不一致问题
function fixWorkflowDataStructure(workflow) {
    if (!workflow || !workflow.steps) return;

    let hasChanges = false;

    workflow.steps.forEach(step => {
        if (step.type === 'loop') {
            // 修复旧的steps字段为subOperations
            if (step.steps && !step.subOperations) {
                step.subOperations = step.steps;
                delete step.steps;
                hasChanges = true;
                console.log('🔧 修复循环步骤：将steps字段重命名为subOperations');
            }

            // 确保subOperations存在
            if (!step.subOperations) {
                step.subOperations = [];
                hasChanges = true;
                console.log('🔧 修复循环步骤：添加缺失的subOperations数组');
            }

            // 确保errorHandling存在
            if (!step.errorHandling) {
                step.errorHandling = 'continue';
                hasChanges = true;
            }
        }
    });

    if (hasChanges) {
        console.log('✅ 工作流数据结构已修复');
        // 保存修复后的数据
        try {
            workflowManager.workflows.set(workflow.id, workflow);
            workflowManager.saveToStorage(workflow.id);
        } catch (error) {
            console.error('❌ 保存修复后的工作流失败:', error);
        }
    }
}

// 确保content script已加载
async function ensureContentScriptLoaded(tabId) {
    try {
        // 尝试ping content script
        const response = await sendMessageToTab(tabId, { action: 'ping' }, 2000);
        if (response && response.success) {
            console.log('Content script已就绪');
            return true;
        }
    } catch (error) {
        console.log('Content script未响应，尝试注入...');
    }

    // 如果ping失败，尝试注入content script
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content/content.js']
        });

        // 等待脚本加载
        await new Promise(resolve => setTimeout(resolve, 500));

        // 再次尝试ping
        const response = await sendMessageToTab(tabId, { action: 'ping' }, 2000);
        if (response && response.success) {
            console.log('Content script注入成功');
            return true;
        } else {
            throw new Error('Content script注入后仍无响应');
        }
    } catch (error) {
        console.error('注入content script失败:', error);
        throw new Error('无法加载content script，请刷新页面后重试');
    }
}

// 发送消息到标签页（带超时）
function sendMessageToTab(tabId, message, timeout = 3000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`消息发送超时（${timeout}ms）`));
        }, timeout);

        chrome.tabs.sendMessage(tabId, message, (response) => {
            clearTimeout(timeoutId);

            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}

// 重置自动化引擎
async function resetEngine() {
    try {
        showStatus('🔄 正在重置自动化引擎...', 'info');

        // 获取当前标签页
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        if (!tab) {
            throw new Error('无法获取当前标签页');
        }

        // 发送重置消息
        const response = await sendMessageToTab(tab.id, { action: 'resetEngine' }, 3000);

        if (response && response.success) {
            showStatus('✅ 自动化引擎已重置', 'success');
        } else {
            showStatus('⚠️ 重置引擎失败，请刷新页面', 'warning');
        }

    } catch (error) {
        console.error('重置引擎失败:', error);
        showStatus(`❌ 重置失败: ${error.message}`, 'error');
    }
}

// ==================== 子操作管理 ====================

// 渲染子操作列表
function renderSubOperationsList(subOperations) {
    if (!subOperations || subOperations.length === 0) {
        return '<div class="sub-operations-empty">暂无子操作，点击"添加子操作"开始配置</div>';
    }

    return subOperations.map((op, index) => `
        <div class="sub-operation-item" data-index="${index}">
            <div class="sub-operation-info">
                <span class="sub-operation-type">${getSubOperationTypeName(op.type)}</span>
                <span class="sub-operation-detail">${getSubOperationDetail(op)}</span>
            </div>
            <div class="sub-operation-actions">
                <button type="button" class="btn-small edit-sub-op" data-index="${index}">编辑</button>
                <button type="button" class="btn-small btn-danger remove-sub-op" data-index="${index}">删除</button>
            </div>
        </div>
    `).join('');
}

// 获取子操作类型名称
function getSubOperationTypeName(type) {
    const names = {
        'click': '点击',
        'input': '输入',
        'wait': '等待',
        'waitForElement': '等待元素',
        'check': '勾选',
        'select': '选择',
        'autoLoop': '自循环'
    };
    return names[type] || type;
}

// 获取子操作详情
function getSubOperationDetail(op) {
    if (!op) return '未配置';

    console.log('🔍 获取子操作详情:', op);

    switch (op.type) {
        case 'click':
        case 'check':
        case 'waitForElement':
            if (op.locator && op.locator.value) {
                return `${op.locator.strategy || 'css'}: ${op.locator.value}`;
            }
            return '未配置定位器';
        case 'input':
            const inputLocator = (op.locator && op.locator.value) ? op.locator.value : '未配置';
            const inputText = op.text || '';
            return `${inputLocator} = "${inputText}"`;
        case 'wait':
            return `等待 ${op.duration || 1000}ms`;
        case 'select':
            const selectLocator = (op.locator && op.locator.value) ? op.locator.value : '未配置';
            const selectValue = op.value || '';
            return `${selectLocator} = "${selectValue}"`;
        case 'autoLoop':
            const autoLoopLocator = (op.locator && op.locator.value) ? op.locator.value : '未配置';
            const autoLoopAction = op.actionType || 'click';
            const autoLoopRange = `[${op.startIndex || 0}-${op.endIndex === -1 ? '全部' : op.endIndex || 0}]`;
            return `${autoLoopLocator} (${autoLoopAction}) ${autoLoopRange}`;
        default:
            return `${op.type} 操作`;
    }
}

// 添加子操作
function addSubOperation() {
    const newOp = {
        type: 'click',
        name: '新子操作',
        locator: { strategy: 'css', value: '' }
    };

    if (!editingStep.subOperations) {
        editingStep.subOperations = [];
    }

    editingStep.subOperations.push(newOp);
    console.log('✅ 已添加子操作，当前子操作数量:', editingStep.subOperations.length);
    console.log('🔍 新添加的子操作:', newOp);
    updateSubOperationsList();
}

// 编辑子操作
function editSubOperation(index) {
    console.log('🔍 开始编辑子操作:', { index, editingStep: editingStep?.name });

    // 验证editingStep和子操作数据
    if (!editingStep) {
        console.error('❌ editingStep不存在');
        showStatus('编辑步骤数据丢失', 'error');
        return;
    }

    if (!editingStep.subOperations) {
        console.error('❌ subOperations数组不存在');
        showStatus('子操作数据丢失', 'error');
        return;
    }

    if (!editingStep.subOperations[index]) {
        console.error('❌ 指定索引的子操作不存在:', index);
        showStatus('子操作不存在', 'error');
        return;
    }

    const subOp = editingStep.subOperations[index];
    console.log('🔍 子操作数据:', subOp);

    // 确保子操作有必要的数据结构
    if (!subOp.locator) {
        subOp.locator = { strategy: 'css', value: '' };
        console.log('🔧 为子操作初始化locator对象');
    }

    showSubOperationModal(subOp, index);
}

// 删除子操作
function removeSubOperation(index) {
    if (confirm('确定要删除这个子操作吗？')) {
        editingStep.subOperations.splice(index, 1);
        updateSubOperationsList();
    }
}

// 更新子操作列表显示
function updateSubOperationsList() {
    const container = document.getElementById('subOperationsList');
    if (container) {
        container.innerHTML = renderSubOperationsList(editingStep.subOperations || []);
        // 重新绑定事件监听器
        setupSubOperationListHandlers();
    }
}

// 为子操作列表设置事件监听器
function setupSubOperationListHandlers() {
    const container = document.getElementById('subOperationsList');
    if (container) {
        // 移除旧的监听器
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);

        // 添加新的监听器
        newContainer.addEventListener('click', function(e) {
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

// 显示子操作编辑模态框
function showSubOperationModal(subOp, index) {
    const modal = document.getElementById('stepModal');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');

    title.textContent = `编辑子操作 ${index + 1}`;

    content.innerHTML = `
        <div class="form-group">
            <label>操作类型</label>
            <select id="subOpType">
                <option value="click" ${subOp.type === 'click' ? 'selected' : ''}>点击</option>
                <option value="input" ${subOp.type === 'input' ? 'selected' : ''}>输入文本</option>
                <option value="wait" ${subOp.type === 'wait' ? 'selected' : ''}>等待</option>
                <option value="waitForElement" ${subOp.type === 'waitForElement' ? 'selected' : ''}>等待元素</option>
                <option value="check" ${subOp.type === 'check' ? 'selected' : ''}>勾选复选框</option>
                <option value="select" ${subOp.type === 'select' ? 'selected' : ''}>选择选项</option>
                <option value="autoLoop" ${subOp.type === 'autoLoop' ? 'selected' : ''}>自循环</option>
            </select>
        </div>
        <div class="form-group" id="subOpLocatorGroup" style="display: ${['click', 'input', 'waitForElement', 'check', 'select', 'autoLoop'].includes(subOp.type) ? 'block' : 'none'};">
            <label>定位策略</label>
            <select id="subOpLocatorStrategy">
                <option value="css" ${(subOp.locator && subOp.locator.strategy === 'css') ? 'selected' : ''}>CSS选择器</option>
                <option value="xpath" ${(subOp.locator && subOp.locator.strategy === 'xpath') ? 'selected' : ''}>XPath</option>
                <option value="id" ${(subOp.locator && subOp.locator.strategy === 'id') ? 'selected' : ''}>ID</option>
                <option value="className" ${(subOp.locator && subOp.locator.strategy === 'className') ? 'selected' : ''}>类名</option>
            </select>
        </div>
        <div class="form-group" id="subOpLocatorValueGroup" style="display: ${['click', 'input', 'waitForElement', 'check', 'select', 'autoLoop'].includes(subOp.type) ? 'block' : 'none'};">
            <label>定位值</label>
            <div class="input-with-test">
                <input type="text" id="subOpLocatorValue" value="${(subOp.locator && subOp.locator.value) ? subOp.locator.value : ''}" placeholder="输入定位值">
                <button type="button" class="test-locator-btn" id="testSubOpLocatorBtn">🔍测试</button>
            </div>
            <div id="subOpLocatorTestResult" class="test-result"></div>
        </div>
        <div class="form-group" id="subOpTextGroup" style="display: ${subOp.type === 'input' ? 'block' : 'none'};">
            <label>输入文本</label>
            <input type="text" id="subOpText" value="${subOp.text || ''}" placeholder="要输入的文本">
        </div>
        <div class="form-group" id="subOpValueGroup" style="display: ${subOp.type === 'select' ? 'block' : 'none'};">
            <label>选择值</label>
            <input type="text" id="subOpValue" value="${subOp.value || ''}" placeholder="选择的值">
        </div>
        <div class="form-group" id="subOpDurationGroup" style="display: ${['wait', 'waitForElement'].includes(subOp.type) ? 'block' : 'none'};">
            <label>${subOp.type === 'wait' ? '等待时间(毫秒)' : '超时时间(毫秒)'}</label>
            <input type="number" id="subOpDuration" value="${subOp.duration || subOp.timeout || 1000}" min="0">
        </div>

        <!-- 自循环专用配置 -->
        <div id="autoLoopConfig" style="display: ${subOp.type === 'autoLoop' ? 'block' : 'none'};">
            <div class="form-group">
                <label>循环操作类型</label>
                <select id="subOpAutoLoopActionType">
                    <option value="click" ${(subOp.actionType || 'click') === 'click' ? 'selected' : ''}>点击</option>
                    <option value="input" ${subOp.actionType === 'input' ? 'selected' : ''}>输入文本</option>
                    <option value="check" ${subOp.actionType === 'check' ? 'selected' : ''}>勾选复选框</option>
                    <option value="uncheck" ${subOp.actionType === 'uncheck' ? 'selected' : ''}>取消勾选</option>
                    <option value="hover" ${subOp.actionType === 'hover' ? 'selected' : ''}>悬停</option>
                    <option value="focus" ${subOp.actionType === 'focus' ? 'selected' : ''}>聚焦</option>
                </select>
                <div class="help-text">对每个匹配元素执行的操作类型</div>
            </div>
            <div class="form-group" id="subOpAutoLoopInputTextGroup" style="display: ${subOp.actionType === 'input' ? 'block' : 'none'};">
                <label>输入文本</label>
                <input type="text" id="subOpAutoLoopInputText" value="${subOp.inputText || ''}" placeholder="要输入的文本">
                <div class="help-text">当操作类型为"输入文本"时使用</div>
            </div>
            <div class="form-group">
                <label>起始索引</label>
                <input type="number" id="subOpAutoLoopStartIndex" value="${subOp.startIndex || 0}" min="0">
                <div class="help-text">从第几个元素开始处理（从0开始计数）</div>
            </div>
            <div class="form-group">
                <label>结束索引</label>
                <input type="number" id="subOpAutoLoopEndIndex" value="${subOp.endIndex !== undefined ? subOp.endIndex : -1}" min="-1">
                <div class="help-text">处理到第几个元素结束，-1表示处理所有元素</div>
            </div>
            <div class="form-group">
                <label>操作间隔(毫秒)</label>
                <input type="number" id="subOpAutoLoopActionDelay" value="${subOp.actionDelay || 200}" min="0">
                <div class="help-text">每次操作之间的等待时间</div>
            </div>
            <div class="form-group">
                <label>错误处理</label>
                <select id="subOpAutoLoopErrorHandling">
                    <option value="continue" ${(subOp.errorHandling || 'continue') === 'continue' ? 'selected' : ''}>继续执行</option>
                    <option value="stop" ${subOp.errorHandling === 'stop' ? 'selected' : ''}>停止执行</option>
                </select>
                <div class="help-text">当某个元素操作失败时的处理策略</div>
            </div>
        </div>

        <div class="form-group">
            <label>延迟时间(毫秒)</label>
            <input type="number" id="subOpDelay" value="${subOp.delay || 0}" min="0">
            <div class="help-text">操作完成后的等待时间</div>
        </div>
    `;

    // 添加类型变化监听
    document.getElementById('subOpType').addEventListener('change', function() {
        const type = this.value;
        const needsLocator = ['click', 'input', 'waitForElement', 'check', 'select', 'autoLoop'].includes(type);

        document.getElementById('subOpLocatorGroup').style.display = needsLocator ? 'block' : 'none';
        document.getElementById('subOpLocatorValueGroup').style.display = needsLocator ? 'block' : 'none';
        document.getElementById('subOpTextGroup').style.display = type === 'input' ? 'block' : 'none';
        document.getElementById('subOpValueGroup').style.display = type === 'select' ? 'block' : 'none';
        document.getElementById('subOpDurationGroup').style.display = ['wait', 'waitForElement'].includes(type) ? 'block' : 'none';
        document.getElementById('autoLoopConfig').style.display = type === 'autoLoop' ? 'block' : 'none';

        // 清除测试结果
        const testResult = document.getElementById('subOpLocatorTestResult');
        if (testResult) {
            testResult.innerHTML = '';
        }

        const durationLabel = document.querySelector('#subOpDurationGroup label');
        if (durationLabel) {
            durationLabel.textContent = type === 'wait' ? '等待时间(毫秒)' : '超时时间(毫秒)';
        }
    });

    // 添加自循环操作类型变化监听
    const autoLoopActionTypeSelect = document.getElementById('subOpAutoLoopActionType');
    if (autoLoopActionTypeSelect) {
        autoLoopActionTypeSelect.addEventListener('change', function() {
            const actionType = this.value;
            const inputTextGroup = document.getElementById('subOpAutoLoopInputTextGroup');
            if (inputTextGroup) {
                inputTextGroup.style.display = actionType === 'input' ? 'block' : 'none';
            }
        });
    }

    // 直接替换父级按钮的功能和文本
    const saveStepBtn = document.getElementById('saveStepBtn');
    const cancelStepBtn = document.getElementById('cancelStepBtn');

    if (saveStepBtn && cancelStepBtn) {
        // 保存原始的按钮处理函数
        const originalSaveHandler = saveStepBtn.onclick;
        const originalCancelHandler = cancelStepBtn.onclick;
        const originalSaveText = saveStepBtn.textContent;
        const originalCancelText = cancelStepBtn.textContent;

        // 设置子操作编辑状态
        isEditingSubOperation = true;

        // 修改按钮文本和功能为子操作专用
        saveStepBtn.textContent = '保存子操作';
        cancelStepBtn.textContent = '返回父级配置';

        saveStepBtn.onclick = () => {
            console.log('🔧 子操作保存按钮被点击');
            console.log('🔍 按钮点击时的全局状态:', {
                editingStepExists: !!editingStep,
                editingStepName: editingStep?.name,
                editingStepType: editingStep?.type,
                hasSubOperations: !!editingStep?.subOperations,
                subOperationsLength: editingStep?.subOperations?.length,
                isEditingSubOperation: isEditingSubOperation,
                targetIndex: index
            });

            // 额外验证
            if (!editingStep) {
                console.error('❌ 致命错误：editingStep为null，无法保存子操作');
                showStatus('编辑数据丢失，请重新打开编辑界面', 'error');
                return;
            }

            saveSubOperation(index);
        };

        cancelStepBtn.onclick = () => {
            console.log('🔧 子操作取消按钮被点击');

            // 清除子操作编辑状态
            isEditingSubOperation = false;

            // 恢复原始按钮文本和功能
            saveStepBtn.textContent = originalSaveText;
            cancelStepBtn.textContent = originalCancelText;
            saveStepBtn.onclick = originalSaveHandler;
            cancelStepBtn.onclick = originalCancelHandler;

            // 返回父级循环配置
            returnToParentConfig();
        };

        console.log('🔧 已替换按钮功能为子操作专用');
    }

    // 设置定位器测试监听器
    setupLocatorTestListeners();

    modal.style.display = 'block';
}

// 返回父级配置（恢复父级按钮功能）
function returnToParentConfig() {
    console.log('🔄 返回父级配置');

    if (!editingStep) {
        console.error('❌ editingStep不存在，无法返回父级配置');
        return;
    }

    // 清除子操作编辑状态
    isEditingSubOperation = false;

    // 恢复父级按钮功能
    const saveStepBtn = document.getElementById('saveStepBtn');
    const cancelStepBtn = document.getElementById('cancelStepBtn');

    if (saveStepBtn) {
        saveStepBtn.textContent = '保存';
        saveStepBtn.onclick = saveStepChanges;
        console.log('🔧 恢复父级保存按钮功能');
    }

    if (cancelStepBtn) {
        cancelStepBtn.textContent = '取消';
        cancelStepBtn.onclick = closeStepModal;
        console.log('🔧 恢复父级取消按钮功能');
    }

    // 更新模态框内容
    const content = document.getElementById('modalContent');
    const title = document.getElementById('modalTitle');

    if (title) {
        title.textContent = `编辑 ${editingStep.name}`;
    }

    if (content) {
        content.innerHTML = generateStepEditHTML(editingStep);

        // 重新设置循环类型处理器和子操作处理器
        if (editingStep.type === 'loop') {
            setupLoopTypeHandlers();
            setupSubOperationHandlers();
        }
    }

    console.log('✅ 父级配置已恢复');
}

// 保存子操作
function saveSubOperation(index) {
    try {
        console.log('🔧 开始保存子操作:', {
            index,
            editingStep: editingStep?.name,
            editingStepExists: !!editingStep,
            subOperationsExists: !!editingStep?.subOperations,
            subOperationsLength: editingStep?.subOperations?.length,
            targetSubOpExists: !!editingStep?.subOperations?.[index]
        });

        // 验证必要的数据
        if (!editingStep) {
            throw new Error('编辑步骤数据不存在');
        }

        if (!editingStep.subOperations) {
            throw new Error('子操作数组不存在');
        }

        if (!editingStep.subOperations[index]) {
            throw new Error(`索引${index}的子操作不存在，当前子操作数量：${editingStep.subOperations.length}`);
        }

        const typeElement = document.getElementById('subOpType');
        if (!typeElement) {
            throw new Error('找不到子操作类型选择器');
        }

        const type = typeElement.value;
        const updates = { type };

        console.log('🔍 收集子操作数据:', { type });

        // 根据类型收集数据
        if (['click', 'input', 'waitForElement', 'check', 'select', 'autoLoop'].includes(type)) {
            const strategyElement = document.getElementById('subOpLocatorStrategy');
            const valueElement = document.getElementById('subOpLocatorValue');

            if (!strategyElement || !valueElement) {
                throw new Error('找不到定位器配置元素');
            }

            const strategy = strategyElement.value;
            const value = valueElement.value;
            updates.locator = { strategy, value };

            console.log('🔍 定位器数据:', { strategy, value });
        }

        if (type === 'input') {
            const textElement = document.getElementById('subOpText');
            if (textElement) {
                updates.text = textElement.value;
            }
        }

        if (type === 'select') {
            const selectValueElement = document.getElementById('subOpValue');
            if (selectValueElement) {
                updates.value = selectValueElement.value;
            }
        }

        if (['wait', 'waitForElement'].includes(type)) {
            const durationElement = document.getElementById('subOpDuration');
            if (durationElement) {
                const duration = parseInt(durationElement.value);
                if (type === 'wait') {
                    updates.duration = duration;
                } else {
                    updates.timeout = duration;
                }
            }
        }

        // 自循环特定配置
        if (type === 'autoLoop') {
            const actionTypeElement = document.getElementById('subOpAutoLoopActionType');
            const inputTextElement = document.getElementById('subOpAutoLoopInputText');
            const startIndexElement = document.getElementById('subOpAutoLoopStartIndex');
            const endIndexElement = document.getElementById('subOpAutoLoopEndIndex');
            const actionDelayElement = document.getElementById('subOpAutoLoopActionDelay');
            const errorHandlingElement = document.getElementById('subOpAutoLoopErrorHandling');

            if (actionTypeElement) {
                updates.actionType = actionTypeElement.value;
            }
            if (inputTextElement) {
                updates.inputText = inputTextElement.value;
            }
            if (startIndexElement) {
                updates.startIndex = parseInt(startIndexElement.value);
            }
            if (endIndexElement) {
                updates.endIndex = parseInt(endIndexElement.value);
            }
            if (actionDelayElement) {
                updates.actionDelay = parseInt(actionDelayElement.value);
            }
            if (errorHandlingElement) {
                updates.errorHandling = errorHandlingElement.value;
            }

            console.log('🔍 自循环配置数据:', {
                actionType: updates.actionType,
                inputText: updates.inputText,
                startIndex: updates.startIndex,
                endIndex: updates.endIndex,
                actionDelay: updates.actionDelay,
                errorHandling: updates.errorHandling
            });
        }

        const delayElement = document.getElementById('subOpDelay');
        if (delayElement) {
            const delay = parseInt(delayElement.value);
            if (delay > 0) {
                updates.delay = delay;
            }
        }

        // 更新子操作
        Object.assign(editingStep.subOperations[index], updates);

        console.log('✅ 子操作已更新:', {
            index: index,
            updates: updates,
            updatedOperation: editingStep.subOperations[index],
            totalSubOperations: editingStep.subOperations.length
        });

        // 验证更新后的子操作
        const updatedOp = editingStep.subOperations[index];
        console.log('🔍 验证更新后的子操作:', {
            type: updatedOp.type,
            locator: updatedOp.locator,
            hasLocator: !!(updatedOp.locator && updatedOp.locator.value),
            detail: getSubOperationDetail(updatedOp)
        });

        // 更新子操作列表显示
        updateSubOperationsList();

        // 保存到工作流
        saveCurrentWorkflowState();

        // 清除子操作编辑状态
        isEditingSubOperation = false;

        // 返回父级配置，但不重新绑定按钮
        returnToParentConfig();

        showStatus('子操作已更新', 'success');

    } catch (error) {
        console.error('❌ 保存子操作失败:', error);
        showStatus(`保存子操作失败: ${error.message}`, 'error');

        // 发生错误时不要关闭模态框，只显示错误信息
        // 用户可以修正错误后重新保存
    }
}

// ==================== 定位器测试功能 ====================

// 测试主操作定位器
async function testMainLocator() {
    const strategyElement = document.getElementById('editLocatorStrategy');
    const valueElement = document.getElementById('editLocatorValue');
    const resultElement = document.getElementById('mainLocatorTestResult');
    const testBtn = document.getElementById('testMainLocatorBtn');

    if (!strategyElement || !valueElement || !resultElement) {
        console.error('❌ 找不到必要的元素');
        return;
    }

    const strategy = strategyElement.value;
    const value = valueElement.value.trim();

    if (!value) {
        showTestResult(resultElement, '请输入定位值', 'error');
        return;
    }

    // 禁用按钮并显示加载状态
    testBtn.disabled = true;
    testBtn.textContent = '🔄测试中...';

    try {
        // 发送消息到content script进行测试
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'testLocator',
            locator: { strategy, value }
        });

        if (response && response.success) {
            const count = response.count;
            if (count === 0) {
                showTestResult(resultElement, '未找到匹配元素', 'error');
            } else {
                showTestResult(resultElement, `找到 ${count} 个匹配元素`, 'success');
            }
        } else {
            showTestResult(resultElement, response?.error || '测试失败', 'error');
        }
    } catch (error) {
        console.error('❌ 测试定位器失败:', error);
        showTestResult(resultElement, '测试失败：' + error.message, 'error');
    } finally {
        // 恢复按钮状态
        testBtn.disabled = false;
        testBtn.textContent = '🔍测试';
    }
}

// 测试子操作定位器
async function testSubOpLocator() {
    const strategyElement = document.getElementById('subOpLocatorStrategy');
    const valueElement = document.getElementById('subOpLocatorValue');
    const resultElement = document.getElementById('subOpLocatorTestResult');
    const testBtn = document.getElementById('testSubOpLocatorBtn');

    if (!strategyElement || !valueElement || !resultElement) {
        console.error('❌ 找不到必要的元素');
        return;
    }

    const strategy = strategyElement.value;
    const value = valueElement.value.trim();

    if (!value) {
        showTestResult(resultElement, '请输入定位值', 'error');
        return;
    }

    // 禁用按钮并显示加载状态
    testBtn.disabled = true;
    testBtn.textContent = '🔄测试中...';

    try {
        // 发送消息到content script进行测试
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'testLocator',
            locator: { strategy, value }
        });

        if (response && response.success) {
            const count = response.count;
            if (count === 0) {
                showTestResult(resultElement, '未找到匹配元素', 'error');
            } else {
                showTestResult(resultElement, `找到 ${count} 个匹配元素`, 'success');
            }
        } else {
            showTestResult(resultElement, response?.error || '测试失败', 'error');
        }
    } catch (error) {
        console.error('❌ 测试定位器失败:', error);
        showTestResult(resultElement, '测试失败：' + error.message, 'error');
    } finally {
        // 恢复按钮状态
        testBtn.disabled = false;
        testBtn.textContent = '🔍测试';
    }
}

// 显示测试结果
function showTestResult(resultElement, message, type) {
    resultElement.textContent = message;
    resultElement.className = `test-result ${type}`;
}

// 清除测试结果
function clearTestResult(resultElementId) {
    const resultElement = document.getElementById(resultElementId);
    if (resultElement) {
        resultElement.textContent = '';
        resultElement.className = 'test-result empty';
    }
}

// 设置定位器测试监听器
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

    if (mainLocatorValue) {
        mainLocatorValue.addEventListener('input', () => {
            clearTestResult('mainLocatorTestResult');
        });
    }

    if (mainLocatorStrategy) {
        mainLocatorStrategy.addEventListener('change', () => {
            clearTestResult('mainLocatorTestResult');
        });
    }

    // 子操作定位器输入框监听
    const subOpLocatorValue = document.getElementById('subOpLocatorValue');
    const subOpLocatorStrategy = document.getElementById('subOpLocatorStrategy');

    if (subOpLocatorValue) {
        subOpLocatorValue.addEventListener('input', () => {
            clearTestResult('subOpLocatorTestResult');
        });
    }

    if (subOpLocatorStrategy) {
        subOpLocatorStrategy.addEventListener('change', () => {
            clearTestResult('subOpLocatorTestResult');
        });
    }
}

// ==================== 导入导出功能 ====================

// 导出工作流配置
function exportWorkflow() {
    if (!currentWorkflow) {
        showStatus('没有工作流可导出', 'error');
        return;
    }

    try {
        // 创建带注释的导出数据
        const exportData = createAnnotatedWorkflowData(currentWorkflow);

        // 创建下载链接
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        // 创建下载元素
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `workflow_${currentWorkflow.name}_${new Date().toISOString().slice(0, 10)}.json`;

        // 触发下载
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // 清理URL
        URL.revokeObjectURL(url);

        console.log('✅ 工作流配置已导出:', exportData);
        showStatus('工作流配置已导出', 'success');

    } catch (error) {
        console.error('❌ 导出工作流失败:', error);
        showStatus(`导出失败: ${error.message}`, 'error');
    }
}

// 创建带注释的工作流数据
function createAnnotatedWorkflowData(workflow) {
    // 注意：JSON不支持注释，这里我们创建一个带有描述性字段的结构
    const annotatedData = {
        "配置文件版本": "1.0",
        "导出时间": new Date().toISOString(),
        "工作流配置": {
            "工作流ID": workflow.id,
            "工作流名称": workflow.name,
            "工作流描述": workflow.description || '无描述',
            "创建时间": workflow.createdAt,
            "更新时间": workflow.updatedAt,
            "步骤总数": workflow.steps.length,
            "自动化步骤": workflow.steps.map((step, index) => {
                const annotatedStep = {
                    "步骤序号": index + 1,
                    "步骤ID": step.id,
                    "步骤名称": step.name,
                    "步骤类型": step.type,
                    "步骤类型说明": getStepTypeDescription(step.type)
                };

                // 添加定位器信息
                if (step.locator) {
                    annotatedStep["定位器配置"] = {
                        "定位策略": step.locator.strategy,
                        "定位策略说明": getLocatorStrategyDescription(step.locator.strategy),
                        "定位值": step.locator.value
                    };
                }

                // 根据步骤类型添加特定配置
                switch (step.type) {
                    case 'click':
                        if (step.delay) annotatedStep["点击后延迟(毫秒)"] = step.delay;
                        break;

                    case 'input':
                        if (step.text) annotatedStep["输入文本"] = step.text;
                        if (step.delay) annotatedStep["输入后延迟(毫秒)"] = step.delay;
                        break;

                    case 'wait':
                        annotatedStep["等待时间(毫秒)"] = step.duration || 1000;
                        break;

                    case 'smartWait':
                        if (step.timeout) annotatedStep["超时时间(毫秒)"] = step.timeout;
                        break;

                    case 'loop':
                        annotatedStep["循环类型"] = step.loopType;
                        annotatedStep["循环类型说明"] = step.loopType === 'parentLoop' ? '父级循环（带子操作）' : '简单循环（单一操作）';
                        annotatedStep["起始索引"] = step.startIndex || 0;
                        annotatedStep["结束索引"] = step.endIndex || -1;
                        annotatedStep["结束索引说明"] = step.endIndex === -1 ? '处理所有元素' : `处理到第${step.endIndex + 1}个元素`;

                        if (step.loopType === 'parentLoop') {
                            if (step.waitAfterClick) annotatedStep["点击后等待时间(毫秒)"] = step.waitAfterClick;
                            if (step.loopDelay) annotatedStep["循环间隔(毫秒)"] = step.loopDelay;
                            if (step.errorHandling) annotatedStep["错误处理策略"] = step.errorHandling === 'continue' ? '跳过错误继续' : '遇到错误停止';

                            // 添加子操作配置
                            if (step.subOperations && step.subOperations.length > 0) {
                                annotatedStep["子操作数量"] = step.subOperations.length;
                                annotatedStep["子操作列表"] = step.subOperations.map((subOp, subIndex) => {
                                    const annotatedSubOp = {
                                        "子操作序号": subIndex + 1,
                                        "操作类型": subOp.type,
                                        "操作类型说明": getSubOperationTypeDescription(subOp.type)
                                    };

                                    if (subOp.locator) {
                                        annotatedSubOp["定位器配置"] = {
                                            "定位策略": subOp.locator.strategy,
                                            "定位值": subOp.locator.value
                                        };
                                    }

                                    if (subOp.text) annotatedSubOp["输入文本"] = subOp.text;
                                    if (subOp.value) annotatedSubOp["选择值"] = subOp.value;
                                    if (subOp.duration) annotatedSubOp["等待时间(毫秒)"] = subOp.duration;
                                    if (subOp.timeout) annotatedSubOp["超时时间(毫秒)"] = subOp.timeout;
                                    if (subOp.delay) annotatedSubOp["操作后延迟(毫秒)"] = subOp.delay;

                                    return annotatedSubOp;
                                });
                            }
                        } else if (step.loopType === 'simpleLoop') {
                            if (step.actionType) annotatedStep["循环操作类型"] = step.actionType;
                            if (step.actionDelay) annotatedStep["操作后延迟(毫秒)"] = step.actionDelay;
                        }
                        break;

                    case 'rangeSelect':
                        if (step.startIndex !== undefined) annotatedStep["起始索引"] = step.startIndex;
                        if (step.endIndex !== undefined) annotatedStep["结束索引"] = step.endIndex;
                        if (step.interval !== undefined) annotatedStep["选择间隔"] = step.interval;
                        break;
                }

                // 保留原始数据以便导入
                annotatedStep["原始步骤数据"] = step;

                return annotatedStep;
            })
        }
    };

    return annotatedData;
}

// 获取步骤类型的中文描述
function getStepTypeDescription(type) {
    const descriptions = {
        'click': '点击操作 - 点击页面元素',
        'input': '输入操作 - 在输入框中输入文本',
        'wait': '等待操作 - 固定时间等待',
        'smartWait': '智能等待 - 等待元素出现',
        'loop': '循环操作 - 对多个元素执行重复操作',
        'rangeSelect': '范围选择 - 选择指定范围的元素',
        'custom': '自定义操作 - 执行自定义脚本'
    };
    return descriptions[type] || '未知操作类型';
}

// 获取定位策略的中文描述
function getLocatorStrategyDescription(strategy) {
    const descriptions = {
        'css': 'CSS选择器 - 使用CSS语法定位元素',
        'xpath': 'XPath表达式 - 使用XPath语法定位元素',
        'id': 'ID选择器 - 通过元素ID定位',
        'className': '类名选择器 - 通过CSS类名定位'
    };
    return descriptions[strategy] || '未知定位策略';
}

// 获取子操作类型的中文描述
function getSubOperationTypeDescription(type) {
    const descriptions = {
        'click': '点击 - 点击指定元素',
        'input': '输入 - 在输入框中输入文本',
        'wait': '等待 - 固定时间等待',
        'waitForElement': '等待元素 - 等待指定元素出现',
        'check': '勾选 - 勾选复选框',
        'select': '选择 - 在下拉框中选择选项'
    };
    return descriptions[type] || '未知子操作类型';
}

// 导入工作流配置
function importWorkflow(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importData = JSON.parse(e.target.result);

            let workflow;

            // 检查是否是新格式（带注释）的配置文件
            if (importData["工作流配置"]) {
                console.log('🔍 检测到带注释的配置文件格式');
                workflow = parseAnnotatedWorkflowData(importData);
            } else if (importData.workflow) {
                console.log('🔍 检测到标准配置文件格式');
                workflow = importData.workflow;
            } else {
                throw new Error('无效的工作流配置文件格式');
            }

            // 验证工作流数据
            if (!workflow.steps) {
                throw new Error('配置文件中缺少步骤数据');
            }

            // 创建新的工作流ID（避免冲突）
            const newWorkflowId = 'workflow_' + Date.now();
            workflow.id = newWorkflowId;
            workflow.name = (workflow.name || '未命名工作流') + '_导入';
            workflow.updatedAt = new Date().toISOString();

            // 重新生成步骤ID（避免冲突）
            workflow.steps.forEach(step => {
                step.id = 'step_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            });

            // 保存到工作流管理器
            workflowManager.workflows.set(newWorkflowId, workflow);
            workflowManager.saveToStorage(newWorkflowId);

            // 设置为当前工作流
            currentWorkflow = workflow;
            updateWorkflowInfo();
            renderSteps();
            saveCurrentWorkflowState();

            console.log('✅ 工作流配置已导入:', workflow);
            showStatus(`工作流 "${workflow.name}" 导入成功`, 'success');

            // 清空文件输入
            event.target.value = '';

        } catch (error) {
            console.error('❌ 导入工作流失败:', error);
            showStatus(`导入失败: ${error.message}`, 'error');
            event.target.value = '';
        }
    };

    reader.readAsText(file);
}

// 解析带注释的工作流数据
function parseAnnotatedWorkflowData(annotatedData) {
    const workflowConfig = annotatedData["工作流配置"];

    const workflow = {
        id: workflowConfig["工作流ID"],
        name: workflowConfig["工作流名称"],
        description: workflowConfig["工作流描述"],
        createdAt: workflowConfig["创建时间"],
        updatedAt: workflowConfig["更新时间"],
        steps: []
    };

    // 解析步骤数据
    if (workflowConfig["自动化步骤"]) {
        workflow.steps = workflowConfig["自动化步骤"].map(annotatedStep => {
            // 如果有原始步骤数据，直接使用
            if (annotatedStep["原始步骤数据"]) {
                return annotatedStep["原始步骤数据"];
            }

            // 否则从注释数据重构步骤
            const step = {
                id: annotatedStep["步骤ID"],
                name: annotatedStep["步骤名称"],
                type: annotatedStep["步骤类型"]
            };

            // 重构定位器
            if (annotatedStep["定位器配置"]) {
                step.locator = {
                    strategy: annotatedStep["定位器配置"]["定位策略"],
                    value: annotatedStep["定位器配置"]["定位值"]
                };
            }

            // 根据步骤类型重构特定配置
            switch (step.type) {
                case 'loop':
                    step.loopType = annotatedStep["循环类型"];
                    step.startIndex = annotatedStep["起始索引"];
                    step.endIndex = annotatedStep["结束索引"];

                    if (annotatedStep["点击后等待时间(毫秒)"]) {
                        step.waitAfterClick = annotatedStep["点击后等待时间(毫秒)"];
                    }
                    if (annotatedStep["循环间隔(毫秒)"]) {
                        step.loopDelay = annotatedStep["循环间隔(毫秒)"];
                    }

                    // 重构子操作
                    if (annotatedStep["子操作列表"]) {
                        step.subOperations = annotatedStep["子操作列表"].map(annotatedSubOp => {
                            const subOp = {
                                type: annotatedSubOp["操作类型"]
                            };

                            if (annotatedSubOp["定位器配置"]) {
                                subOp.locator = {
                                    strategy: annotatedSubOp["定位器配置"]["定位策略"],
                                    value: annotatedSubOp["定位器配置"]["定位值"]
                                };
                            }

                            if (annotatedSubOp["输入文本"]) subOp.text = annotatedSubOp["输入文本"];
                            if (annotatedSubOp["选择值"]) subOp.value = annotatedSubOp["选择值"];
                            if (annotatedSubOp["等待时间(毫秒)"]) subOp.duration = annotatedSubOp["等待时间(毫秒)"];
                            if (annotatedSubOp["超时时间(毫秒)"]) subOp.timeout = annotatedSubOp["超时时间(毫秒)"];
                            if (annotatedSubOp["操作后延迟(毫秒)"]) subOp.delay = annotatedSubOp["操作后延迟(毫秒)"];

                            return subOp;
                        });
                    }
                    break;

                // 可以继续添加其他步骤类型的重构逻辑
            }

            return step;
        });
    }

    return workflow;
}
