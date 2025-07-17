/**
 * UI渲染模块
 * 负责渲染步骤列表、工作流信息等UI组件
 */

/**
 * 渲染步骤列表
 */
function renderSteps() {
    const container = document.getElementById('stepsContainer');

    if (!currentWorkflow || currentWorkflow.steps.length === 0) {
        container.innerHTML = `
            <div class="empty-steps">
                暂无操作步骤<br>
                点击上方工具添加操作或使用"流程图设计"创建复杂工作流
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    // 渲染所有步骤，支持嵌套结构
    currentWorkflow.steps.forEach((step, index) => {
        const stepElement = createStepElement(step, index);
        container.appendChild(stepElement);

        // 如果步骤有子操作，也渲染出来
        if (step.subOperations && step.subOperations.length > 0) {
            step.subOperations.forEach((subOp, subIndex) => {
                const subElement = createSubStepElement(subOp, index, subIndex);
                container.appendChild(subElement);
            });
        }
    });

    console.log(`✅ 已渲染 ${currentWorkflow.steps.length} 个主步骤`);
}

/**
 * 创建步骤元素
 */
function createStepElement(step, index) {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step-item';
    stepDiv.dataset.stepId = step.id;
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

    // 添加左键点击事件监听器
    stepDiv.querySelectorAll('.step-action-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // 防止触发右键菜单
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

    // 添加右键菜单支持
    stepDiv.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showStepContextMenu(e, step.id);
    });

    return stepDiv;
}

/**
 * 创建子步骤元素
 */
function createSubStepElement(subOp, parentIndex, subIndex) {
    const subDiv = document.createElement('div');
    subDiv.className = 'sub-step-item';
    subDiv.innerHTML = `
        <div class="sub-step-info">
            <div class="sub-step-name">└─ ${subOp.name || getStepTypeName(subOp.type)}</div>
            <div class="sub-step-details">${getSubStepDetails(subOp)}</div>
        </div>
    `;
    return subDiv;
}

/**
 * 获取步骤详情文本
 */
function getStepDetails(step) {
    switch (step.type) {
        case 'click':
            return step.locator ? `点击: ${step.locator.value}` : '点击操作';
        case 'input':
            const inputText = step.inputText || step.text || '';
            const locatorText = step.locator ? step.locator.value : '';
            return `输入"${inputText}"到 ${locatorText}`;
        case 'wait':
            return `等待 ${step.waitTime || step.duration || 3} 秒`;
        case 'smartWait':
            return step.locator ? `智能等待: ${step.locator.value}` : '智能等待';
        case 'loop':
            const loopTypeText = step.loopType === 'container' ? '容器循环' : '自循环';
            const locatorText2 = step.locator ? step.locator.value : '';
            const subOpsCount = step.subOperations ? step.subOperations.length : 0;
            return `${loopTypeText}: ${locatorText2} (${subOpsCount}个子操作)`;
        case 'condition':
            return step.locator ? `条件判断: ${step.locator.value}` : '条件判断';
        case 'checkState':
            return step.locator ? `状态检测: ${step.locator.value}` : '状态检测';
        default:
            return step.name || '未知操作';
    }
}

/**
 * 获取子步骤详情文本
 */
function getSubStepDetails(subOp) {
    switch (subOp.type) {
        case 'click':
            return subOp.locator ? `点击: ${subOp.locator.value}` : '点击操作';
        case 'input':
            const inputText = subOp.inputText || subOp.text || '';
            const locatorText = subOp.locator ? subOp.locator.value : '';
            return `输入"${inputText}"到 ${locatorText}`;
        case 'wait':
            return `等待 ${subOp.waitTime || subOp.duration || 1} 秒`;
        case 'waitForElement':
            return subOp.locator ? `等待元素: ${subOp.locator.value}` : '等待元素';
        case 'check':
            return subOp.locator ? `勾选: ${subOp.locator.value}` : '勾选操作';
        case 'select':
            return subOp.locator ? `选择: ${subOp.locator.value}` : '选择操作';
        case 'autoLoop':
            const actionType = subOp.actionType || 'click';
            const locatorText2 = subOp.locator ? subOp.locator.value : '';
            return `自循环${actionType}: ${locatorText2}`;
        default:
            return subOp.name || '未知子操作';
    }
}

/**
 * 更新工作流信息显示
 */
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

/**
 * 显示状态消息
 */
function showStatus(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // 这里可以添加UI状态显示逻辑
    // 例如显示toast消息或更新状态栏
    
    // 临时使用console输出，实际项目中应该有专门的状态显示组件
    const statusColors = {
        info: '#3498db',
        success: '#27ae60',
        warning: '#f39c12',
        error: '#e74c3c'
    };
    
    console.log(`%c${message}`, `color: ${statusColors[type] || statusColors.info}; font-weight: bold;`);
}

/**
 * 渲染子操作列表
 */
function renderSubOperationsList(subOperations) {
    if (!subOperations || subOperations.length === 0) {
        return '<div class="no-sub-operations">暂无子操作</div>';
    }

    let html = '<div class="sub-operations-list">';
    subOperations.forEach((subOp, index) => {
        html += `
            <div class="sub-operation-item" data-index="${index}">
                <div class="sub-op-info">
                    <div class="sub-op-name">${subOp.name || getStepTypeName(subOp.type)}</div>
                    <div class="sub-op-details">${getSubStepDetails(subOp)}</div>
                </div>
                <div class="sub-op-actions">
                    <button class="btn btn-sm edit-sub-op" data-index="${index}">编辑</button>
                    <button class="btn btn-sm btn-danger remove-sub-op" data-index="${index}">删除</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    return html;
}

/**
 * 更新进度显示
 */
function updateProgress(progressData) {
    console.log('📊 更新进度:', progressData);
    
    if (progressData.isRunning !== undefined) {
        executionState.isRunning = progressData.isRunning;
    }
    if (progressData.isPaused !== undefined) {
        executionState.isPaused = progressData.isPaused;
    }
    if (progressData.totalSteps !== undefined) {
        executionState.totalSteps = progressData.totalSteps;
    }
    if (progressData.completedSteps !== undefined) {
        executionState.completedSteps = progressData.completedSteps;
    }
    if (progressData.currentOperation !== undefined) {
        executionState.currentOperation = progressData.currentOperation;
    }

    // 更新UI显示
    updateExecutionStatusIndicator();
}

/**
 * 执行完成处理
 */
function onExecutionComplete(data) {
    console.log('✅ 执行完成:', data);
    showStatus('工作流执行完成', 'success');
    
    // 延迟重置状态，让用户看到完成信息
    setTimeout(() => {
        resetExecutionState();
    }, 2000);
}

/**
 * 执行错误处理
 */
function onExecutionError(data) {
    console.error('❌ 执行错误:', data);
    showStatus(`执行失败: ${data.error}`, 'error');
    
    // 延迟重置状态，让用户看到错误信息
    setTimeout(() => {
        resetExecutionState();
    }, 3000);
}

// 导出函数供主文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderSteps,
        createStepElement,
        createSubStepElement,
        getStepDetails,
        getSubStepDetails,
        updateWorkflowInfo,
        showStatus,
        renderSubOperationsList,
        updateProgress,
        onExecutionComplete,
        onExecutionError
    };
}

// 在浏览器环境中，将函数添加到全局作用域
if (typeof window !== 'undefined') {
    window.renderSteps = renderSteps;
    window.createStepElement = createStepElement;
    window.createSubStepElement = createSubStepElement;
    window.getStepDetails = getStepDetails;
    window.getSubStepDetails = getSubStepDetails;
    window.updateWorkflowInfo = updateWorkflowInfo;
    window.showStatus = showStatus;
    window.renderSubOperationsList = renderSubOperationsList;
    window.updateProgress = updateProgress;
    window.onExecutionComplete = onExecutionComplete;
    window.onExecutionError = onExecutionError;
}
