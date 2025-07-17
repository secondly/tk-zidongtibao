/**
 * 右键菜单模块
 * 负责步骤的右键菜单功能
 */

/**
 * 初始化右键菜单
 */
function initializeContextMenu() {
    const contextMenu = document.getElementById('stepContextMenu');
    
    // 如果右键菜单元素不存在，跳过初始化
    if (!contextMenu) {
        console.warn('stepContextMenu 元素不存在，跳过右键菜单初始化');
        return;
    }

    // 点击菜单项
    contextMenu.addEventListener('click', function(e) {
        const action = e.target.dataset.action;
        const stepId = contextMenu.dataset.stepId;

        if (action && stepId) {
            handleContextMenuAction(action, stepId);
        }

        hideContextMenu();
    });

    // 点击其他地方隐藏菜单
    document.addEventListener('click', function(e) {
        if (!contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    // 滚动时隐藏菜单
    document.addEventListener('scroll', hideContextMenu);
}

/**
 * 显示步骤右键菜单
 */
function showStepContextMenu(event, stepId) {
    event.preventDefault();
    
    const contextMenu = document.getElementById('stepContextMenu');
    if (!contextMenu) {
        console.warn('stepContextMenu 元素不存在');
        return;
    }

    // 设置菜单关联的步骤ID
    contextMenu.dataset.stepId = stepId;

    // 获取步骤信息
    const step = currentWorkflow.steps.find(s => s.id === stepId);
    if (!step) {
        console.error('找不到步骤:', stepId);
        return;
    }

    // 根据步骤类型动态生成菜单项
    const menuItems = generateContextMenuItems(step);
    contextMenu.innerHTML = menuItems;

    // 计算菜单位置
    const x = event.pageX;
    const y = event.pageY;
    
    // 确保菜单不会超出视窗
    const menuRect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let menuX = x;
    let menuY = y;
    
    if (x + menuRect.width > viewportWidth) {
        menuX = x - menuRect.width;
    }
    
    if (y + menuRect.height > viewportHeight) {
        menuY = y - menuRect.height;
    }

    // 显示菜单
    contextMenu.style.left = menuX + 'px';
    contextMenu.style.top = menuY + 'px';
    contextMenu.style.display = 'block';

    console.log('📋 显示右键菜单:', step.name);
}

/**
 * 隐藏右键菜单
 */
function hideContextMenu() {
    const contextMenu = document.getElementById('stepContextMenu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
        contextMenu.dataset.stepId = '';
    }
}

/**
 * 生成右键菜单项
 */
function generateContextMenuItems(step) {
    const baseItems = [
        { action: 'test', icon: '🧪', text: '测试此步骤' },
        { action: 'edit', icon: '✏️', text: '编辑' },
        { action: 'duplicate', icon: '📋', text: '复制' },
        { action: 'moveUp', icon: '⬆️', text: '上移' },
        { action: 'moveDown', icon: '⬇️', text: '下移' },
        { action: 'delete', icon: '🗑️', text: '删除', class: 'danger' }
    ];

    // 根据步骤类型添加特殊菜单项
    const specialItems = [];
    
    if (step.type === 'loop') {
        specialItems.push(
            { action: 'addSubOperation', icon: '➕', text: '添加子操作' },
            { action: 'clearSubOperations', icon: '🧹', text: '清空子操作' }
        );
    }

    if (step.locator) {
        specialItems.push(
            { action: 'copyLocator', icon: '📎', text: '复制定位器' }
        );
    }

    const allItems = [...baseItems.slice(0, 3), ...specialItems, ...baseItems.slice(3)];

    return allItems.map(item => 
        `<div class="context-menu-item ${item.class || ''}" data-action="${item.action}">
            <span class="menu-icon">${item.icon}</span>
            <span class="menu-text">${item.text}</span>
        </div>`
    ).join('');
}

/**
 * 处理右键菜单操作
 */
function handleContextMenuAction(action, stepId) {
    const step = currentWorkflow.steps.find(s => s.id === stepId);
    if (!step) {
        showStatus('找不到指定的步骤', 'error');
        return;
    }

    console.log('📋 执行右键菜单操作:', action, step.name);

    switch (action) {
        case 'test':
            testStep(stepId);
            break;
        case 'edit':
            editStep(stepId);
            break;
        case 'duplicate':
            duplicateStep(stepId);
            break;
        case 'moveUp':
            moveStep(stepId, 'up');
            break;
        case 'moveDown':
            moveStep(stepId, 'down');
            break;
        case 'delete':
            deleteStep(stepId);
            break;
        case 'addSubOperation':
            addSubOperationToStep(stepId);
            break;
        case 'clearSubOperations':
            clearSubOperations(stepId);
            break;
        case 'copyLocator':
            copyLocatorToClipboard(step);
            break;
        default:
            console.warn('未知的右键菜单操作:', action);
    }
}

/**
 * 复制步骤
 */
function duplicateStep(stepId) {
    try {
        const step = currentWorkflow.steps.find(s => s.id === stepId);
        if (!step) {
            throw new Error('找不到要复制的步骤');
        }

        // 创建步骤副本
        const duplicatedStep = JSON.parse(JSON.stringify(step));
        duplicatedStep.id = 'step_' + Date.now();
        duplicatedStep.name = step.name + ' (副本)';

        // 如果有子操作，也要更新子操作的ID
        if (duplicatedStep.subOperations) {
            duplicatedStep.subOperations.forEach((subOp, index) => {
                subOp.id = `subop_${Date.now()}_${index}`;
            });
        }

        // 添加到工作流
        workflowManager.addStep(currentWorkflow.id, duplicatedStep);
        
        // 更新UI
        renderSteps();
        updateWorkflowInfo();
        saveCurrentWorkflowState();
        
        showStatus(`已复制步骤: ${step.name}`, 'success');
    } catch (error) {
        showStatus(`复制步骤失败: ${error.message}`, 'error');
    }
}

/**
 * 移动步骤
 */
function moveStep(stepId, direction) {
    try {
        const stepIndex = currentWorkflow.steps.findIndex(s => s.id === stepId);
        if (stepIndex === -1) {
            throw new Error('找不到要移动的步骤');
        }

        const newIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
        
        if (newIndex < 0 || newIndex >= currentWorkflow.steps.length) {
            showStatus('无法移动到指定位置', 'warning');
            return;
        }

        // 交换步骤位置
        const steps = currentWorkflow.steps;
        [steps[stepIndex], steps[newIndex]] = [steps[newIndex], steps[stepIndex]];

        // 更新UI
        renderSteps();
        saveCurrentWorkflowState();
        
        showStatus(`步骤已${direction === 'up' ? '上移' : '下移'}`, 'success');
    } catch (error) {
        showStatus(`移动步骤失败: ${error.message}`, 'error');
    }
}

/**
 * 为步骤添加子操作
 */
function addSubOperationToStep(stepId) {
    const step = currentWorkflow.steps.find(s => s.id === stepId);
    if (!step) {
        showStatus('找不到指定的步骤', 'error');
        return;
    }

    if (step.type !== 'loop') {
        showStatus('只有循环步骤可以添加子操作', 'warning');
        return;
    }

    // 打开步骤编辑模态框，并自动添加一个子操作
    editStep(stepId);
    
    // 延迟执行，确保模态框已打开
    setTimeout(() => {
        addSubOperation();
    }, 100);
}

/**
 * 清空子操作
 */
function clearSubOperations(stepId) {
    if (!confirm('确定要清空所有子操作吗？')) {
        return;
    }

    try {
        const step = currentWorkflow.steps.find(s => s.id === stepId);
        if (!step) {
            throw new Error('找不到指定的步骤');
        }

        step.subOperations = [];
        
        // 更新工作流
        workflowManager.updateStep(currentWorkflow.id, stepId, step);
        
        // 更新UI
        renderSteps();
        saveCurrentWorkflowState();
        
        showStatus('子操作已清空', 'success');
    } catch (error) {
        showStatus(`清空子操作失败: ${error.message}`, 'error');
    }
}

/**
 * 复制定位器到剪贴板
 */
function copyLocatorToClipboard(step) {
    if (!step.locator) {
        showStatus('此步骤没有定位器', 'warning');
        return;
    }

    const locatorText = `${step.locator.strategy}: ${step.locator.value}`;
    
    navigator.clipboard.writeText(locatorText).then(() => {
        showStatus('定位器已复制到剪贴板', 'success');
    }).catch(() => {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = locatorText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showStatus('定位器已复制到剪贴板', 'success');
    });
}

// 导出函数供主文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeContextMenu,
        showStepContextMenu,
        hideContextMenu,
        generateContextMenuItems,
        handleContextMenuAction,
        duplicateStep,
        moveStep,
        addSubOperationToStep,
        clearSubOperations,
        copyLocatorToClipboard
    };
}

// 在浏览器环境中，将函数添加到全局作用域
if (typeof window !== 'undefined') {
    window.initializeContextMenu = initializeContextMenu;
    window.showStepContextMenu = showStepContextMenu;
    window.hideContextMenu = hideContextMenu;
    window.generateContextMenuItems = generateContextMenuItems;
    window.handleContextMenuAction = handleContextMenuAction;
    window.duplicateStep = duplicateStep;
    window.moveStep = moveStep;
    window.addSubOperationToStep = addSubOperationToStep;
    window.clearSubOperations = clearSubOperations;
    window.copyLocatorToClipboard = copyLocatorToClipboard;
}
