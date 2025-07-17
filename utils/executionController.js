/**
 * 执行控制模块
 * 负责工作流的执行、暂停、继续、停止等控制功能
 */

// 执行状态管理
let executionState = {
    isRunning: false,
    isPaused: false,
    startTime: null,
    totalSteps: 0,
    completedSteps: 0,
    currentMainLoop: 0,
    totalMainLoops: 0,
    currentSubOperation: 0,
    totalSubOperations: 0,
    currentOperation: '等待执行...'
};

// 将executionState暴露到全局作用域
if (typeof window !== 'undefined') {
    window.executionState = executionState;
}

/**
 * 执行工作流
 */
async function executeWorkflow() {
    if (!currentWorkflow || currentWorkflow.steps.length === 0) {
        showStatus('请先创建工作流并添加步骤', 'warning');
        return;
    }

    console.log('🚀 开始执行工作流:', currentWorkflow.name);

    try {
        // 使用页面选择器选择目标页面，确保与设计器测试环境一致
        let tab;
        try {
            // 初始化页面选择器
            if (!window.tabSelector) {
                window.tabSelector = new TabSelector();
            }

            console.log('🎯 显示页面选择器...');
            // 显示页面选择器
            tab = await window.tabSelector.showTabSelector();
            if (!tab) {
                showStatus('已取消执行', 'info');
                return;
            }
            console.log('✅ 用户选择的目标页面:', tab.title, tab.url);
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

        // 更新执行状态
        executionState.isRunning = true;
        executionState.isPaused = false;
        executionState.startTime = Date.now();

        // 保存执行状态
        saveExecutionState();

        // 禁用执行按钮
        document.getElementById('executeBtn').disabled = true;

        // 立即显示暂停按钮（强制显示）
        const pauseBtn = document.getElementById('pauseResumeBtn');
        if (pauseBtn) {
            pauseBtn.style.display = 'inline-block';
            pauseBtn.disabled = false;
            pauseBtn.textContent = '⏸️ 暂停';
            pauseBtn.className = 'btn btn-warning';
            console.log('🔧 [DEBUG] 暂停按钮已强制显示');
        } else {
            console.log('❌ [DEBUG] 找不到暂停按钮元素！');
        }

        // 更新执行状态指示器
        updateExecutionStatusIndicator();

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
                // 不立即重置状态，让用户看到错误信息
                setTimeout(() => {
                    resetExecutionState();
                }, 2000);
                showStatus(`执行失败: ${chrome.runtime.lastError.message}`, 'error');
            } else if (response && response.success) {
                // 成功时也延迟重置，让用户看到完成状态
                setTimeout(() => {
                    resetExecutionState();
                }, 1000);
                showStatus('工作流执行完成', 'success');
            } else {
                setTimeout(() => {
                    resetExecutionState();
                }, 2000);
                showStatus(`执行失败: ${response?.error || '未知错误'}`, 'error');
            }
        });

    } catch (error) {
        console.error('执行工作流失败:', error);
        showStatus(`执行工作流失败: ${error.message}`, 'error');
        // 重置执行状态
        resetExecutionState();
    }
}

/**
 * 切换暂停/继续状态
 */
async function togglePauseResume() {
    console.log('🔧 [DEBUG] togglePauseResume 被调用，当前状态:', {
        isRunning: executionState.isRunning,
        isPaused: executionState.isPaused
    });

    if (!executionState.isRunning) {
        console.log('❌ [DEBUG] 执行未运行，忽略暂停/继续请求');
        return;
    }

    if (executionState.isPaused) {
        console.log('▶️ [DEBUG] 当前已暂停，执行继续操作');
        await resumeExecution();
    } else {
        console.log('⏸️ [DEBUG] 当前正在运行，执行暂停操作');
        await pauseExecution();
    }
}

/**
 * 暂停执行
 */
async function pauseExecution() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // 确保content script已加载
        const isLoaded = await ensureContentScriptLoaded(tab.id);
        if (!isLoaded) {
            console.log('Content script未加载，无法暂停');
            return;
        }

        console.log('🔧 [DEBUG] 发送暂停消息到content script');
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'pauseExecution'
        });

        console.log('🔧 [DEBUG] 收到暂停响应:', response);

        if (response && response.success) {
            executionState.isPaused = true;
            updatePauseResumeButton();
            updateExecutionStatusIndicator();

            // 保存执行状态
            saveExecutionState();

            console.log('⏸️ 执行已暂停');
        } else {
            console.error('❌ 暂停失败:', response?.error || '未知错误');
        }
    } catch (error) {
        console.error('❌ 暂停执行失败:', error);
    }
}

/**
 * 继续执行
 */
async function resumeExecution() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // 确保content script已加载
        const isLoaded = await ensureContentScriptLoaded(tab.id);
        if (!isLoaded) {
            console.log('Content script未加载，无法继续');
            return;
        }

        await chrome.tabs.sendMessage(tab.id, {
            action: 'resumeExecution'
        });

        executionState.isPaused = false;
        updatePauseResumeButton();
        updateExecutionStatusIndicator();

        // 保存执行状态
        saveExecutionState();

        console.log('▶️ 继续执行');
    } catch (error) {
        console.error('❌ 继续执行失败:', error);
    }
}

/**
 * 重置执行状态
 */
function resetExecutionState() {
    console.log('🔄 重置执行状态');
    
    executionState.isRunning = false;
    executionState.isPaused = false;
    executionState.startTime = null;
    executionState.totalSteps = 0;
    executionState.completedSteps = 0;
    executionState.currentMainLoop = 0;
    executionState.totalMainLoops = 0;
    executionState.currentSubOperation = 0;
    executionState.totalSubOperations = 0;
    executionState.currentOperation = '等待执行...';

    // 恢复UI状态
    const executeBtn = document.getElementById('executeBtn');
    const pauseBtn = document.getElementById('pauseResumeBtn');

    if (executeBtn) {
        executeBtn.disabled = false;
        executeBtn.textContent = '执行';
    }

    if (pauseBtn) {
        pauseBtn.style.display = 'none';
        pauseBtn.disabled = true;
    }

    // 更新执行状态指示器
    updateExecutionStatusIndicator();

    // 清除保存的执行状态
    clearExecutionState();
}

/**
 * 更新暂停/继续按钮
 */
function updatePauseResumeButton() {
    const pauseBtn = document.getElementById('pauseResumeBtn');
    if (!pauseBtn) return;

    if (executionState.isPaused) {
        pauseBtn.textContent = '▶️ 继续';
        pauseBtn.className = 'btn btn-success';
    } else {
        pauseBtn.textContent = '⏸️ 暂停';
        pauseBtn.className = 'btn btn-warning';
    }
}

/**
 * 更新执行状态指示器
 */
function updateExecutionStatusIndicator() {
    // 这里可以添加状态指示器的更新逻辑
    console.log('🔄 更新执行状态指示器:', executionState);
}

/**
 * 保存执行状态到本地存储
 */
function saveExecutionState() {
    try {
        const stateToSave = {
            isRunning: executionState.isRunning,
            isPaused: executionState.isPaused,
            startTime: executionState.startTime,
            totalSteps: executionState.totalSteps,
            completedSteps: executionState.completedSteps,
            timestamp: Date.now() // 添加时间戳用于验证状态有效性
        };

        localStorage.setItem('execution_state', JSON.stringify(stateToSave));
        console.log('✅ 执行状态已保存:', stateToSave);
    } catch (error) {
        console.error('❌ 保存执行状态失败:', error);
    }
}

/**
 * 从本地存储加载执行状态
 */
function loadExecutionState() {
    try {
        const savedState = localStorage.getItem('execution_state');
        if (!savedState) {
            console.log('🔍 没有保存的执行状态');
            return;
        }

        const state = JSON.parse(savedState);
        console.log('🔍 尝试恢复执行状态:', state);

        // 检查状态是否过期（超过1小时认为无效）
        const now = Date.now();
        const stateAge = now - (state.timestamp || 0);
        const maxAge = 60 * 60 * 1000; // 1小时

        if (stateAge > maxAge) {
            console.log('⚠️ 执行状态已过期，清除状态');
            clearExecutionState();
            return;
        }

        // 只有在确实有执行中的任务时才恢复状态
        if (state.isRunning) {
            console.log('🔄 恢复执行状态...');

            executionState.isRunning = state.isRunning;
            executionState.isPaused = state.isPaused;
            executionState.startTime = state.startTime;
            executionState.totalSteps = state.totalSteps || 0;
            executionState.completedSteps = state.completedSteps || 0;

            // 更新UI状态
            updatePauseResumeButton();
            updateExecutionStatusIndicator();

            console.log('✅ 执行状态已恢复');
            if (typeof showStatus === 'function') {
                showStatus(`已恢复执行状态: ${state.isPaused ? '已暂停' : '执行中'}`, 'info');
            }
        } else {
            console.log('🔍 没有执行中的任务，清除状态');
            clearExecutionState();
        }

    } catch (error) {
        console.error('❌ 加载执行状态失败:', error);
        clearExecutionState();
    }
}

/**
 * 清除保存的执行状态
 */
function clearExecutionState() {
    try {
        localStorage.removeItem('execution_state');
        console.log('🗑️ 执行状态已清除');
    } catch (error) {
        console.error('❌ 清除执行状态失败:', error);
    }
}

// 导出函数供主文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        executionState,
        executeWorkflow,
        togglePauseResume,
        pauseExecution,
        resumeExecution,
        resetExecutionState,
        updatePauseResumeButton,
        updateExecutionStatusIndicator,
        saveExecutionState,
        loadExecutionState,
        clearExecutionState
    };
}

// 在浏览器环境中，将函数添加到全局作用域
if (typeof window !== 'undefined') {
    window.executeWorkflow = executeWorkflow;
    window.togglePauseResume = togglePauseResume;
    window.pauseExecution = pauseExecution;
    window.resumeExecution = resumeExecution;
    window.resetExecutionState = resetExecutionState;
    window.updatePauseResumeButton = updatePauseResumeButton;
    window.updateExecutionStatusIndicator = updateExecutionStatusIndicator;
    window.saveExecutionState = saveExecutionState;
    window.loadExecutionState = loadExecutionState;
    window.clearExecutionState = clearExecutionState;
}
