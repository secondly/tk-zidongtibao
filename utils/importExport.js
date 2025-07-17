/**
 * 导入导出模块
 * 负责工作流的导入导出功能
 */

/**
 * 导出工作流
 */
function exportWorkflow() {
    if (!currentWorkflow) {
        showStatus('没有可导出的工作流', 'warning');
        return;
    }

    try {
        // 创建导出数据
        const exportData = {
            version: '2.0.0',
            exportTime: new Date().toISOString(),
            workflow: {
                ...currentWorkflow,
                // 添加一些元数据
                metadata: {
                    createdAt: currentWorkflow.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: currentWorkflow.version || '1.0.0'
                }
            }
        };

        // 转换为JSON字符串，格式化输出
        const jsonString = JSON.stringify(exportData, null, 2);

        // 创建下载链接
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentWorkflow.name || 'workflow'}_${new Date().toISOString().slice(0, 10)}.json`;
        
        // 触发下载
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // 清理URL对象
        URL.revokeObjectURL(url);

        showStatus('工作流导出成功', 'success');
        console.log('✅ 工作流已导出:', exportData);
    } catch (error) {
        showStatus(`导出失败: ${error.message}`, 'error');
        console.error('导出工作流失败:', error);
    }
}

/**
 * 导入工作流
 */
function importWorkflow(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    // 检查文件类型
    if (!file.name.endsWith('.json')) {
        showStatus('请选择JSON格式的工作流文件', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importData = JSON.parse(e.target.result);
            
            // 验证导入数据格式
            if (!validateImportData(importData)) {
                throw new Error('工作流文件格式不正确');
            }

            const workflow = importData.workflow;
            
            // 生成新的ID避免冲突
            workflow.id = 'workflow_' + Date.now();
            
            // 确保所有步骤都有唯一ID
            if (workflow.steps) {
                workflow.steps.forEach((step, index) => {
                    if (!step.id) {
                        step.id = `step_${Date.now()}_${index}`;
                    }
                    
                    // 确保子操作也有ID
                    if (step.subOperations) {
                        step.subOperations.forEach((subOp, subIndex) => {
                            if (!subOp.id) {
                                subOp.id = `subop_${Date.now()}_${index}_${subIndex}`;
                            }
                        });
                    }
                });
            }

            // 添加到工作流管理器
            workflowManager.workflows.set(workflow.id, workflow);
            
            // 设置为当前工作流
            currentWorkflow = workflow;
            
            // 更新UI
            renderSteps();
            updateWorkflowInfo();
            loadSavedWorkflows();
            
            // 保存状态
            saveCurrentWorkflowState();
            
            showStatus(`工作流"${workflow.name}"导入成功`, 'success');
            console.log('✅ 工作流已导入:', workflow);
            
        } catch (error) {
            showStatus(`导入失败: ${error.message}`, 'error');
            console.error('导入工作流失败:', error);
        }
    };

    reader.onerror = function() {
        showStatus('读取文件失败', 'error');
    };

    reader.readAsText(file);
    
    // 清空文件输入，允许重复选择同一文件
    event.target.value = '';
}

/**
 * 验证导入数据格式
 */
function validateImportData(data) {
    // 检查基本结构
    if (!data || typeof data !== 'object') {
        console.error('导入数据不是有效的对象');
        return false;
    }

    // 检查是否有workflow字段
    if (!data.workflow) {
        console.error('导入数据缺少workflow字段');
        return false;
    }

    const workflow = data.workflow;

    // 检查工作流基本字段
    if (!workflow.name || typeof workflow.name !== 'string') {
        console.error('工作流缺少有效的name字段');
        return false;
    }

    // 检查steps字段
    if (!Array.isArray(workflow.steps)) {
        console.error('工作流的steps字段必须是数组');
        return false;
    }

    // 验证每个步骤的基本结构
    for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        
        if (!step.type || typeof step.type !== 'string') {
            console.error(`步骤${i}缺少有效的type字段`);
            return false;
        }

        if (!step.name || typeof step.name !== 'string') {
            console.error(`步骤${i}缺少有效的name字段`);
            return false;
        }

        // 验证子操作（如果存在）
        if (step.subOperations && !Array.isArray(step.subOperations)) {
            console.error(`步骤${i}的subOperations字段必须是数组`);
            return false;
        }
    }

    console.log('✅ 导入数据验证通过');
    return true;
}

/**
 * 导出工作流配置（带注释）
 */
function exportWorkflowWithComments() {
    if (!currentWorkflow) {
        showStatus('没有可导出的工作流', 'warning');
        return;
    }

    try {
        // 创建带注释的配置文件内容
        let configContent = `// 工作流配置文件
// 导出时间: ${new Date().toLocaleString()}
// 工作流名称: ${currentWorkflow.name}
// 步骤数量: ${currentWorkflow.steps.length}

const workflowConfig = `;

        // 添加工作流数据
        const exportData = {
            name: currentWorkflow.name, // 工作流名称
            description: currentWorkflow.description || '', // 工作流描述
            version: currentWorkflow.version || '1.0.0', // 版本号
            steps: currentWorkflow.steps.map(step => ({
                id: step.id, // 步骤唯一标识
                type: step.type, // 步骤类型：click, input, wait, loop等
                name: step.name, // 步骤显示名称
                locator: step.locator ? {
                    strategy: step.locator.strategy, // 定位策略：css, xpath, id等
                    value: step.locator.value // 定位器值
                } : null,
                inputText: step.inputText || '', // 输入文本（input类型步骤）
                waitTime: step.waitTime || 0, // 等待时间（wait类型步骤）
                loopType: step.loopType || '', // 循环类型：container, self
                subOperations: step.subOperations || [], // 子操作列表
                errorHandling: step.errorHandling || 'continue' // 错误处理方式
            }))
        };

        configContent += JSON.stringify(exportData, null, 2);
        configContent += `;\n\n// 导出说明：\n// 1. 此文件包含完整的工作流配置\n// 2. 可以通过导入功能重新加载\n// 3. 修改配置时请保持JSON格式正确\n\nmodule.exports = workflowConfig;`;

        // 创建下载
        const blob = new Blob([configContent], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentWorkflow.name || 'workflow'}_config.js`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);

        showStatus('工作流配置文件导出成功', 'success');
    } catch (error) {
        showStatus(`导出配置失败: ${error.message}`, 'error');
        console.error('导出配置失败:', error);
    }
}

/**
 * 批量导出所有工作流
 */
function exportAllWorkflows() {
    const workflows = Array.from(workflowManager.workflows.values());
    
    if (workflows.length === 0) {
        showStatus('没有可导出的工作流', 'warning');
        return;
    }

    try {
        const exportData = {
            version: '2.0.0',
            exportTime: new Date().toISOString(),
            count: workflows.length,
            workflows: workflows.map(workflow => ({
                ...workflow,
                metadata: {
                    createdAt: workflow.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: workflow.version || '1.0.0'
                }
            }))
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `all_workflows_${new Date().toISOString().slice(0, 10)}.json`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);

        showStatus(`成功导出${workflows.length}个工作流`, 'success');
    } catch (error) {
        showStatus(`批量导出失败: ${error.message}`, 'error');
        console.error('批量导出失败:', error);
    }
}

// 导出函数供主文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        exportWorkflow,
        importWorkflow,
        validateImportData,
        exportWorkflowWithComments,
        exportAllWorkflows
    };
}

// 在浏览器环境中，将函数添加到全局作用域
if (typeof window !== 'undefined') {
    window.exportWorkflow = exportWorkflow;
    window.importWorkflow = importWorkflow;
    window.validateImportData = validateImportData;
    window.exportWorkflowWithComments = exportWorkflowWithComments;
    window.exportAllWorkflows = exportAllWorkflows;
}
