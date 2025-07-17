/**
 * mxGraph工作流执行模块
 * 负责工作流的执行控制和节点执行
 */

/**
 * 执行工作流
 */
async function executeWorkflow(designer) {
    const data = designer.exportWorkflowData();

    if (!data.steps || data.steps.length === 0) {
        alert('工作流为空，请先添加一些节点');
        return;
    }

    // 初始化执行状态
    designer.executionState = {
        isRunning: true,
        isPaused: false,
        currentNodeIndex: 0,
        totalNodes: data.steps.length,
        currentWorkflow: data
    };

    console.log('开始执行工作流:', data);

    // 更新UI状态
    updateExecutionUI(designer);

    try {
        // 按顺序执行每个步骤
        for (let i = 0; i < data.steps.length; i++) {
            // 检查是否被停止
            if (!designer.executionState.isRunning) {
                break;
            }

            // 等待暂停状态解除
            while (designer.executionState.isPaused && designer.executionState.isRunning) {
                await delay(100);
            }

            // 再次检查是否被停止
            if (!designer.executionState.isRunning) {
                break;
            }

            designer.executionState.currentNodeIndex = i;
            const step = data.steps[i];

            console.log(`执行步骤 ${i + 1}/${data.steps.length}:`, step);

            // 更新执行状态显示
            updateExecutionStatus(designer, `执行步骤 ${i + 1}/${data.steps.length}: ${step.name || step.type}`, (i / data.steps.length) * 100);

            // 高亮当前执行的节点
            try {
                highlightExecutingNode(designer, step.id);
            } catch (error) {
                console.warn('高亮节点失败:', error);
            }

            // 执行步骤
            await executeStep(step);

            // 移除高亮
            try {
                removeNodeHighlight(designer, step.id);
            } catch (error) {
                console.warn('移除高亮失败:', error);
            }

            // 短暂延迟，让用户看到执行过程
            await delay(500);
        }

        // 执行完成
        if (designer.executionState.isRunning) {
            updateExecutionStatus(designer, '工作流执行完成', 100);
            alert('工作流执行完成！');
        } else {
            updateExecutionStatus(designer, '工作流已停止', designer.executionState.currentNodeIndex / designer.executionState.totalNodes * 100);
        }

    } catch (error) {
        console.error('工作流执行失败:', error);
        updateExecutionStatus(designer, '执行失败: ' + error.message, designer.executionState.currentNodeIndex / designer.executionState.totalNodes * 100);
        alert('工作流执行失败: ' + error.message);
    } finally {
        // 重置执行状态
        designer.executionState.isRunning = false;
        designer.executionState.isPaused = false;
        updateExecutionUI(designer);
    }
}

/**
 * 执行单个步骤
 */
async function executeStep(step) {
    console.log('执行步骤:', step);
    
    switch (step.type) {
        case 'click':
            await executeClickStep(step);
            break;
        case 'input':
            await executeInputStep(step);
            break;
        case 'wait':
            await executeWaitStep(step);
            break;
        case 'smartWait':
            await executeSmartWaitStep(step);
            break;
        case 'loop':
            await executeLoopStep(step);
            break;
        case 'condition':
            await executeConditionStep(step);
            break;
        case 'checkState':
            await executeCheckStateStep(step);
            break;
        case 'extract':
            await executeExtractStep(step);
            break;
        default:
            console.warn('未知的步骤类型:', step.type);
    }
}

/**
 * 执行点击步骤
 */
async function executeClickStep(step) {
    console.log('执行点击操作:', step);
    // 这里应该调用实际的点击执行逻辑
    await delay(200); // 模拟执行时间
}

/**
 * 执行输入步骤
 */
async function executeInputStep(step) {
    console.log('执行输入操作:', step);
    // 这里应该调用实际的输入执行逻辑
    await delay(300); // 模拟执行时间
}

/**
 * 执行等待步骤
 */
async function executeWaitStep(step) {
    console.log('执行等待操作:', step);
    const waitTime = step.duration || step.waitTime || 1000;
    await delay(waitTime);
}

/**
 * 执行智能等待步骤
 */
async function executeSmartWaitStep(step) {
    console.log('执行智能等待操作:', step);
    // 这里应该调用实际的智能等待执行逻辑
    await delay(500); // 模拟执行时间
}

/**
 * 执行循环步骤
 */
async function executeLoopStep(step) {
    console.log('执行循环操作:', step);
    // 这里应该调用实际的循环执行逻辑
    await delay(1000); // 模拟执行时间
}

/**
 * 执行条件步骤
 */
async function executeConditionStep(step) {
    console.log('执行条件判断:', step);
    // 这里应该调用实际的条件判断执行逻辑
    await delay(300); // 模拟执行时间
}

/**
 * 执行状态检测步骤
 */
async function executeCheckStateStep(step) {
    console.log('执行状态检测:', step);
    // 这里应该调用实际的状态检测执行逻辑
    await delay(200); // 模拟执行时间
}

/**
 * 执行数据提取步骤
 */
async function executeExtractStep(step) {
    console.log('执行数据提取:', step);
    // 这里应该调用实际的数据提取执行逻辑
    await delay(400); // 模拟执行时间
}

/**
 * 暂停工作流
 */
function pauseWorkflow(designer) {
    if (designer.executionState.isRunning && !designer.executionState.isPaused) {
        designer.executionState.isPaused = true;
        updateExecutionUI(designer);
        updateExecutionStatus(designer, '工作流已暂停', null);
        console.log('工作流已暂停');
    }
}

/**
 * 恢复工作流
 */
function resumeWorkflow(designer) {
    if (designer.executionState.isRunning && designer.executionState.isPaused) {
        designer.executionState.isPaused = false;
        updateExecutionUI(designer);
        updateExecutionStatus(designer, '工作流已恢复', null);
        console.log('工作流已恢复');
    }
}

/**
 * 停止工作流
 */
function stopWorkflow(designer) {
    if (designer.executionState.isRunning) {
        designer.executionState.isRunning = false;
        designer.executionState.isPaused = false;
        updateExecutionUI(designer);
        updateExecutionStatus(designer, '工作流已停止', null);
        console.log('工作流已停止');
    }
}

/**
 * 更新执行UI状态
 */
function updateExecutionUI(designer) {
    const executionStatus = document.getElementById('executionStatus');
    const executeBtn = document.getElementById('executeWorkflow');
    const pauseBtn = document.getElementById('pauseWorkflow');
    const resumeBtn = document.getElementById('resumeWorkflow');
    const stopBtn = document.getElementById('stopWorkflow');

    if (designer.executionState.isRunning) {
        if (executeBtn) executeBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        
        if (designer.executionState.isPaused) {
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'inline-block';
        } else {
            if (pauseBtn) pauseBtn.style.display = 'inline-block';
            if (resumeBtn) resumeBtn.style.display = 'none';
        }
    } else {
        if (executeBtn) executeBtn.disabled = false;
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'none';
        if (stopBtn) stopBtn.disabled = true;
    }
}

/**
 * 更新执行状态显示
 */
function updateExecutionStatus(designer, message, progress) {
    const statusElement = document.getElementById('executionStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
    
    const progressElement = document.getElementById('executionProgress');
    if (progressElement && progress !== null) {
        progressElement.style.width = progress + '%';
    }
    
    console.log('执行状态:', message, progress ? `${progress.toFixed(1)}%` : '');
}

/**
 * 高亮正在执行的节点
 */
function highlightExecutingNode(designer, nodeId) {
    // 实现节点高亮逻辑
    console.log('高亮节点:', nodeId);
}

/**
 * 移除节点高亮
 */
function removeNodeHighlight(designer, nodeId) {
    // 实现移除高亮逻辑
    console.log('移除节点高亮:', nodeId);
}

/**
 * 延迟函数
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 导出函数供主文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        executeWorkflow,
        executeStep,
        pauseWorkflow,
        resumeWorkflow,
        stopWorkflow,
        updateExecutionUI,
        updateExecutionStatus,
        highlightExecutingNode,
        removeNodeHighlight,
        delay
    };
}

// 在浏览器环境中，将函数添加到全局作用域
if (typeof window !== 'undefined') {
    window.executeWorkflow = executeWorkflow;
    window.executeStep = executeStep;
    window.pauseWorkflow = pauseWorkflow;
    window.resumeWorkflow = resumeWorkflow;
    window.stopWorkflow = stopWorkflow;
    window.updateExecutionUI = updateExecutionUI;
    window.updateExecutionStatus = updateExecutionStatus;
    window.highlightExecutingNode = highlightExecutingNode;
    window.removeNodeHighlight = removeNodeHighlight;
    window.delay = delay;
}
