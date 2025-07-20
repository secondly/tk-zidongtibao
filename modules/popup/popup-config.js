/**
 * 弹窗配置管理模块
 * 负责工作流配置的加载、选择、编辑和删除
 */

import { debugLog, updateExecutionStatus, getElement, validateWorkflow } from '../../shared/popup/popup-utils.js';
import { EXECUTION_STATUS } from '../../shared/popup/popup-constants.js';
import { getWorkflowsFromStorage, saveWorkflowsToStorage } from './popup-storage.js';
import { setCurrentWorkflow, getCurrentWorkflow } from './popup-core.js';

/**
 * 加载保存的工作流列表
 */
export function loadSavedWorkflows() {
    debugLog('开始加载保存的工作流列表...');

    try {
        const workflows = getWorkflowsFromStorage();
        debugLog(`找到 ${workflows.length} 个保存的工作流`);

        // 渲染配置选择框
        renderConfigSelect(workflows);

        if (workflows.length === 0) {
            updateExecutionStatus(EXECUTION_STATUS.WARNING, '没有找到保存的工作流配置');
        } else {
            updateExecutionStatus(EXECUTION_STATUS.IDLE, `找到 ${workflows.length} 个配置`);
        }
    } catch (error) {
        console.error('加载工作流列表失败:', error);
        updateExecutionStatus(EXECUTION_STATUS.ERROR, '加载配置失败');
    }
}

/**
 * 渲染配置下拉选择框
 * @param {Array} workflows - 工作流列表
 */
export function renderConfigSelect(workflows) {
    debugLog('开始渲染配置选择框，工作流数量:', workflows ? workflows.length : 0);

    const configSelect = getElement('#configSelect');
    if (!configSelect) {
        console.error('配置选择框元素未找到');
        return;
    }

    // 清空现有选项
    configSelect.innerHTML = '<option value="">请选择一个配置...</option>';

    if (!workflows || workflows.length === 0) {
        debugLog('没有工作流可显示');
        return;
    }

    // 添加工作流选项
    workflows.forEach((workflow, index) => {
        if (workflow && workflow.name) {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${workflow.name} (${workflow.steps?.length || 0}步)`;

            // 添加额外信息作为title
            if (workflow.description) {
                option.title = workflow.description;
            }

            configSelect.appendChild(option);
        }
    });

    debugLog(`已渲染 ${workflows.length} 个配置选项`);
}

/**
 * 选择配置
 * @param {number} index - 配置索引
 */
export function selectConfig(index) {
    debugLog(`选择配置，索引: ${index}`);

    try {
        const savedWorkflows = getWorkflowsFromStorage();

        if (!savedWorkflows || savedWorkflows.length === 0) {
            updateExecutionStatus(EXECUTION_STATUS.WARNING, '没有可用的配置');
            return;
        }

        const selectedWorkflow = savedWorkflows[index];
        if (!selectedWorkflow) {
            updateExecutionStatus(EXECUTION_STATUS.ERROR, '选择的配置不存在');
            return;
        }

        // 验证工作流数据
        if (!validateWorkflow(selectedWorkflow)) {
            updateExecutionStatus(EXECUTION_STATUS.ERROR, '配置数据格式无效');
            return;
        }

        // 设置当前工作流
        setCurrentWorkflow(selectedWorkflow);

        // 更新UI显示
        updateCurrentConfigDisplay();

        // 触发配置选择事件
        const event = new CustomEvent('configSelected', {
            detail: { workflow: selectedWorkflow, index: index }
        });
        window.dispatchEvent(event);

        updateExecutionStatus(EXECUTION_STATUS.IDLE, `已选择配置: ${selectedWorkflow.name}`);
        debugLog('配置选择完成:', selectedWorkflow.name);

    } catch (error) {
        console.error('选择配置失败:', error);
        updateExecutionStatus(EXECUTION_STATUS.ERROR, '选择配置失败');
    }
}

/**
 * 处理下拉选择框变化
 * @param {Event} event - 选择事件
 */
export function handleConfigSelectChange(event) {
    debugLog('配置选择框发生变化');

    const selectedIndex = event.target.value;
    if (selectedIndex === '') {
        // 清除当前选择
        setCurrentWorkflow(null);
        hideCurrentConfigDisplay();
        clearFlowPreview();
        updateExecutionStatus(EXECUTION_STATUS.IDLE, '请选择一个配置');
        return;
    }

    // 选择指定配置
    selectConfig(parseInt(selectedIndex));
}

/**
 * 刷新配置列表
 */
export function refreshConfigList() {
    debugLog('手动刷新配置列表...');

    try {
        // 保存当前选中的配置索引
        const currentIndex = getSelectedConfigIndex();

        // 重新加载工作流列表
        loadSavedWorkflows();

        // 如果之前有选中的配置，尝试恢复选择
        if (currentIndex !== null) {
            const configSelect = getElement('#configSelect');
            if (configSelect && configSelect.options[currentIndex + 1]) {
                configSelect.selectedIndex = currentIndex + 1;
                selectConfig(currentIndex);
            }
        }

        updateExecutionStatus(EXECUTION_STATUS.IDLE, '配置列表已刷新');
        debugLog('配置列表刷新完成');

    } catch (error) {
        console.error('刷新配置列表失败:', error);
        updateExecutionStatus(EXECUTION_STATUS.ERROR, '刷新失败');
    }
}

/**
 * 更新当前配置显示
 */
function updateCurrentConfigDisplay() {
    const currentConfig = getElement('#currentConfig');
    const currentWorkflow = getCurrentWorkflow();

    if (!currentConfig || !currentWorkflow) return;

    // 显示配置信息容器
    currentConfig.style.display = 'block';

    // 只更新配置信息部分，保留操作按钮
    const configInfo = currentConfig.querySelector('.config-info');
    if (configInfo) {
        configInfo.innerHTML = `
            <div class="config-name" style="font-weight: 600; color: #333; margin-bottom: 4px;">
                ${currentWorkflow.name}
            </div>
            <div class="config-stats" style="font-size: 13px; color: #666;">
                ${currentWorkflow.steps?.length || 0} 个步骤
                ${currentWorkflow.description ? ` - ${currentWorkflow.description}` : ''}
            </div>
        `;
    } else {
        // 如果没有找到config-info元素，重新创建完整结构
        currentConfig.innerHTML = `
            <div class="config-info" style="font-size: 13px; color: #666;">
                <div class="config-name" style="font-weight: 600; color: #333; margin-bottom: 4px;">
                    ${currentWorkflow.name}
                </div>
                <div class="config-stats">
                    ${currentWorkflow.steps?.length || 0} 个步骤
                    ${currentWorkflow.description ? ` - ${currentWorkflow.description}` : ''}
                </div>
            </div>
            <!-- 配置操作按钮 -->
            <div class="config-actions" style="display: flex; gap: 8px; margin-top: 12px;">
                <button class="btn btn-sm" id="editConfigBtn"
                    style="flex: 1; background: #ff6b6b; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    编辑
                </button>
                <button class="btn btn-sm" id="deleteConfigBtn"
                    style="flex: 1; background: #ff6b6b; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    删除
                </button>
            </div>
        `;

        // 重新绑定事件监听器
        const editBtn = getElement('#editConfigBtn');
        const deleteBtn = getElement('#deleteConfigBtn');

        if (editBtn) {
            editBtn.addEventListener('click', editCurrentConfig);
        }
        if (deleteBtn) {
            deleteBtn.addEventListener('click', deleteCurrentConfig);
        }
    }

    debugLog('当前配置显示已更新');
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
 * 清除流程图预览
 */
function clearFlowPreview() {
    // 触发清除预览事件
    const event = new CustomEvent('clearPreview');
    window.dispatchEvent(event);
}

/**
 * 获取当前选中的配置索引
 * @returns {number|null} 配置索引或null
 */
function getSelectedConfigIndex() {
    const configSelect = getElement('#configSelect');
    if (configSelect && configSelect.value !== '') {
        return parseInt(configSelect.value);
    }
    return null;
}

/**
 * 初始化配置操作按钮事件监听器
 */
export function initializeConfigActionListeners() {
    debugLog('初始化配置操作按钮事件监听器');

    // 编辑配置按钮
    const editConfigBtn = getElement('#editConfigBtn');
    if (editConfigBtn) {
        editConfigBtn.addEventListener('click', editCurrentConfig);
    }

    // 删除配置按钮
    const deleteConfigBtn = getElement('#deleteConfigBtn');
    if (deleteConfigBtn) {
        deleteConfigBtn.addEventListener('click', deleteCurrentConfig);
    }

    // 刷新配置按钮
    const refreshConfigBtn = getElement('#refreshConfigBtn');
    if (refreshConfigBtn) {
        refreshConfigBtn.addEventListener('click', refreshConfigList);
    }

    // 打开设计器按钮
    const openDesignerBtn = getElement('#openDesignerBtn');
    if (openDesignerBtn) {
        openDesignerBtn.addEventListener('click', handleOpenDesigner);
    }

    // 导入配置按钮
    const importBtn = getElement('#importBtn');
    if (importBtn) {
        importBtn.addEventListener('click', handleImportConfig);
    }

    // 清除缓存按钮
    const clearCacheBtn = getElement('#clearCacheBtn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', handleClearCache);
    }

    // 配置选择框变化事件
    const configSelect = getElement('#configSelect');
    if (configSelect) {
        configSelect.addEventListener('change', handleConfigSelectChange);
    }

    debugLog('配置操作事件监听器已设置');
}

/**
 * 编辑当前配置
 */
function editCurrentConfig() {
    const currentWorkflow = getCurrentWorkflow();

    if (!currentWorkflow) {
        updateExecutionStatus(EXECUTION_STATUS.WARNING, '请先选择一个配置');
        return;
    }

    debugLog('准备编辑配置:', currentWorkflow.name);

    try {
        // 打开设计器并传递工作流数据
        openDesignerWithWorkflow(currentWorkflow);
        updateExecutionStatus(EXECUTION_STATUS.IDLE, '正在打开设计器...');

    } catch (error) {
        console.error('打开设计器失败:', error);
        updateExecutionStatus(EXECUTION_STATUS.ERROR, '打开设计器失败');
    }
}

/**
 * 删除当前配置
 */
function deleteCurrentConfig() {
    const currentWorkflow = getCurrentWorkflow();

    if (!currentWorkflow) {
        updateExecutionStatus(EXECUTION_STATUS.WARNING, '请先选择一个配置');
        return;
    }

    const confirmMessage = `确定要删除配置 "${currentWorkflow.name}" 吗？此操作不可撤销。`;
    if (!confirm(confirmMessage)) {
        return;
    }

    debugLog('准备删除配置:', currentWorkflow.name);

    try {
        const savedWorkflows = getWorkflowsFromStorage();
        const currentIndex = getSelectedConfigIndex();

        if (currentIndex === null || currentIndex >= savedWorkflows.length) {
            updateExecutionStatus(EXECUTION_STATUS.ERROR, '无法确定要删除的配置');
            return;
        }

        // 从数组中移除配置
        savedWorkflows.splice(currentIndex, 1);

        // 保存更新后的列表
        const success = saveWorkflowsToStorage(savedWorkflows);

        if (success) {
            // 清除当前选择
            setCurrentWorkflow(null);
            hideCurrentConfigDisplay();
            clearFlowPreview();

            // 刷新配置列表
            renderConfigSelect(savedWorkflows);

            // 重置选择框
            const configSelect = getElement('#configSelect');
            if (configSelect) {
                configSelect.selectedIndex = 0;
            }

            updateExecutionStatus(EXECUTION_STATUS.IDLE, '配置已删除');
            debugLog('配置删除成功');

            // 触发删除事件
            const event = new CustomEvent('configDeleted', {
                detail: { deletedWorkflow: currentWorkflow }
            });
            window.dispatchEvent(event);

        } else {
            updateExecutionStatus(EXECUTION_STATUS.ERROR, '删除配置失败');
        }

    } catch (error) {
        console.error('删除配置失败:', error);
        updateExecutionStatus(EXECUTION_STATUS.ERROR, '删除配置失败');
    }
}

/**
 * 打开设计器并传递工作流数据
 * @param {Object} workflow - 工作流数据
 */
function openDesignerWithWorkflow(workflow) {
    debugLog('准备打开设计器，工作流:', workflow);

    // 这里需要根据实际的设计器打开方式来实现
    // 可能是打开新窗口、新标签页或者模态框

    // 示例实现：打开新窗口
    const designerUrl = 'workflow-designer-mxgraph.html';
    const windowFeatures = 'width=1200,height=800,scrollbars=yes,resizable=yes';

    try {
        // 将工作流数据保存到设计器期望的临时存储键名
        const tempKey = 'temp_edit_workflow';
        localStorage.setItem(tempKey, JSON.stringify({
            workflow: workflow,
            mode: 'edit',
            timestamp: Date.now()
        }));

        debugLog('已保存工作流数据到临时存储:', tempKey);
        debugLog('工作流数据:', workflow);

        // 打开设计器窗口
        const designerWindow = window.open(
            designerUrl,
            'workflowDesigner',
            windowFeatures
        );

        if (designerWindow) {
            debugLog('设计器窗口已打开');

            // 监听设计器窗口关闭，检查是否有更新的数据
            const checkInterval = setInterval(() => {
                if (designerWindow.closed) {
                    clearInterval(checkInterval);
                    checkForUpdatedWorkflow(tempKey);
                }
            }, 1000);

        } else {
            throw new Error('无法打开设计器窗口，可能被浏览器阻止');
        }

    } catch (error) {
        console.error('打开设计器失败:', error);
        throw error;
    }
}

/**
 * 检查更新的工作流数据
 * @param {string} tempKey - 临时存储键名
 */
function checkForUpdatedWorkflow(tempKey) {
    debugLog('检查工作流是否有更新');

    try {
        const tempData = localStorage.getItem(tempKey);
        if (tempData) {
            const data = JSON.parse(tempData);

            if (data.updated && data.workflow) {
                debugLog('检测到工作流更新，准备保存');

                // 更新工作流列表
                const savedWorkflows = getWorkflowsFromStorage();
                const currentIndex = getSelectedConfigIndex();

                if (currentIndex !== null && currentIndex < savedWorkflows.length) {
                    savedWorkflows[currentIndex] = data.workflow;

                    if (saveWorkflowsToStorage(savedWorkflows)) {
                        // 更新当前工作流
                        setCurrentWorkflow(data.workflow);
                        updateCurrentConfigDisplay();

                        // 刷新配置列表
                        renderConfigSelect(savedWorkflows);

                        updateExecutionStatus(EXECUTION_STATUS.IDLE, '配置已更新');
                        debugLog('工作流更新成功');
                    }
                }
            }

            // 清理临时数据
            localStorage.removeItem(tempKey);
        }

    } catch (error) {
        console.error('检查工作流更新失败:', error);
    }
}

/**
 * 处理打开设计器按钮点击
 */
function handleOpenDesigner() {
    debugLog('用户点击打开设计器按钮');

    // 如果有选中的配置，编辑该配置
    const currentWorkflow = getCurrentWorkflow();
    if (currentWorkflow) {
        editCurrentConfig();
    } else {
        // 没有选中配置，创建新的工作流
        createNewWorkflow();
    }
}

/**
 * 创建新工作流
 */
function createNewWorkflow() {
    debugLog('创建新工作流');

    const designerUrl = 'workflow-designer-mxgraph.html';
    const windowFeatures = 'width=1200,height=800,scrollbars=yes,resizable=yes';

    try {
        // 打开设计器窗口（新建模式）
        const designerWindow = window.open(
            designerUrl,
            'workflowDesigner',
            windowFeatures
        );

        if (designerWindow) {
            debugLog('设计器窗口已打开（新建模式）');
            updateExecutionStatus(EXECUTION_STATUS.IDLE, '正在打开设计器...');
        } else {
            throw new Error('无法打开设计器窗口，可能被浏览器阻止');
        }

    } catch (error) {
        console.error('打开设计器失败:', error);
        updateExecutionStatus(EXECUTION_STATUS.ERROR, '打开设计器失败');
    }
}

/**
 * 处理导入配置按钮点击
 */
function handleImportConfig() {
    debugLog('用户点击导入配置按钮');

    // 创建文件输入元素
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            importWorkflowFromFile(file);
        }
    });

    // 触发文件选择
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

/**
 * 从文件导入工作流
 * @param {File} file - 工作流文件
 */
function importWorkflowFromFile(file) {
    debugLog('开始导入工作流文件:', file.name);

    const reader = new FileReader();

    reader.onload = (event) => {
        try {
            const jsonData = event.target.result;
            const workflowData = JSON.parse(jsonData);

            // 验证工作流数据
            if (!validateWorkflow(workflowData)) {
                throw new Error('工作流数据格式无效');
            }

            // 添加导入时间戳
            workflowData.importedAt = Date.now();
            workflowData.updatedAt = Date.now();

            // 如果没有创建时间，添加创建时间
            if (!workflowData.createdAt) {
                workflowData.createdAt = Date.now();
            }

            // 保存到存储
            const savedWorkflows = getWorkflowsFromStorage();
            savedWorkflows.push(workflowData);

            const success = saveWorkflowsToStorage(savedWorkflows);

            if (success) {
                // 刷新配置列表
                renderConfigSelect(savedWorkflows);

                // 自动选择导入的配置
                const configSelect = getElement('#configSelect');
                if (configSelect) {
                    configSelect.selectedIndex = savedWorkflows.length; // 最后一个选项
                    selectConfig(savedWorkflows.length - 1);
                }

                updateExecutionStatus(EXECUTION_STATUS.IDLE, `配置 "${workflowData.name}" 导入成功`);
                debugLog('工作流导入成功:', workflowData.name);

            } else {
                throw new Error('保存工作流失败');
            }

        } catch (error) {
            console.error('导入工作流失败:', error);
            updateExecutionStatus(EXECUTION_STATUS.ERROR, `导入失败: ${error.message}`);
            alert(`导入失败: ${error.message}`);
        }
    };

    reader.onerror = () => {
        console.error('读取文件失败');
        updateExecutionStatus(EXECUTION_STATUS.ERROR, '读取文件失败');
        alert('读取文件失败');
    };

    reader.readAsText(file);
}

/**
 * 处理清除缓存按钮点击
 */
function handleClearCache() {
    debugLog('用户点击清除缓存按钮');

    const confirmMessage = '确定要清除所有缓存数据吗？这将清除保存的执行状态和工作流缓存。';
    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        // 清除状态缓存
        localStorage.removeItem('automation_state_cache');
        localStorage.removeItem('automation_workflow_cache');

        updateExecutionStatus(EXECUTION_STATUS.IDLE, '缓存已清除');
        debugLog('缓存清除成功');

        // 询问是否重新加载页面
        const reloadConfirm = '缓存已清除。是否重新加载页面以完全重置状态？';
        if (confirm(reloadConfirm)) {
            window.location.reload();
        }

    } catch (error) {
        console.error('清除缓存失败:', error);
        updateExecutionStatus(EXECUTION_STATUS.ERROR, '清除缓存失败');
        alert('清除缓存失败，请检查浏览器控制台获取详细信息。');
    }
}