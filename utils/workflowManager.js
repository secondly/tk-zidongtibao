/**
 * 工作流管理模块
 * 负责工作流的创建、保存、加载、管理等核心功能
 */

/**
 * 工作流管理器类
 */
class WorkflowManager {
    constructor() {
        this.workflows = new Map();
        this.currentWorkflowId = null;
    }

    /**
     * 创建新工作流
     */
    createWorkflow(name, description = '') {
        const workflow = {
            id: 'workflow_' + Date.now(),
            name: name || '新工作流',
            description: description,
            steps: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: '1.0.0'
        };

        this.workflows.set(workflow.id, workflow);
        this.currentWorkflowId = workflow.id;

        console.log('✅ 创建新工作流:', workflow.name);
        return workflow;
    }

    /**
     * 获取工作流
     */
    getWorkflow(id) {
        return this.workflows.get(id);
    }

    /**
     * 获取当前工作流
     */
    getCurrentWorkflow() {
        if (this.currentWorkflowId) {
            return this.workflows.get(this.currentWorkflowId);
        }
        return null;
    }

    /**
     * 设置当前工作流
     */
    setCurrentWorkflow(id) {
        if (this.workflows.has(id)) {
            this.currentWorkflowId = id;
            return this.workflows.get(id);
        }
        return null;
    }

    /**
     * 更新工作流
     */
    updateWorkflow(id, updates) {
        const workflow = this.workflows.get(id);
        if (!workflow) {
            throw new Error('工作流不存在');
        }

        Object.assign(workflow, updates, {
            updatedAt: new Date().toISOString()
        });

        this.workflows.set(id, workflow);
        console.log('✅ 工作流已更新:', workflow.name);
        return workflow;
    }

    /**
     * 删除工作流
     */
    deleteWorkflow(id) {
        const workflow = this.workflows.get(id);
        if (!workflow) {
            throw new Error('工作流不存在');
        }

        this.workflows.delete(id);

        // 如果删除的是当前工作流，清空当前工作流
        if (this.currentWorkflowId === id) {
            this.currentWorkflowId = null;
        }

        console.log('✅ 工作流已删除:', workflow.name);
        return true;
    }

    /**
     * 添加步骤
     */
    addStep(workflowId, step) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error('工作流不存在');
        }

        // 确保步骤有唯一ID
        if (!step.id) {
            step.id = 'step_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        // 确保步骤有基本属性
        if (!step.name) {
            step.name = getStepTypeName(step.type);
        }

        workflow.steps.push(step);
        workflow.updatedAt = new Date().toISOString();

        console.log('✅ 添加步骤:', step.name);
        return step;
    }

    /**
     * 更新步骤
     */
    updateStep(workflowId, stepId, updates) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error('工作流不存在');
        }

        const stepIndex = workflow.steps.findIndex(s => s.id === stepId);
        if (stepIndex === -1) {
            throw new Error('步骤不存在');
        }

        Object.assign(workflow.steps[stepIndex], updates);
        workflow.updatedAt = new Date().toISOString();

        console.log('✅ 步骤已更新:', workflow.steps[stepIndex].name);
        return workflow.steps[stepIndex];
    }

    /**
     * 删除步骤
     */
    removeStep(workflowId, stepId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error('工作流不存在');
        }

        const stepIndex = workflow.steps.findIndex(s => s.id === stepId);
        if (stepIndex === -1) {
            throw new Error('步骤不存在');
        }

        const removedStep = workflow.steps.splice(stepIndex, 1)[0];
        workflow.updatedAt = new Date().toISOString();

        console.log('✅ 步骤已删除:', removedStep.name);
        return removedStep;
    }

    /**
     * 移动步骤
     */
    moveStep(workflowId, stepId, newIndex) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error('工作流不存在');
        }

        const stepIndex = workflow.steps.findIndex(s => s.id === stepId);
        if (stepIndex === -1) {
            throw new Error('步骤不存在');
        }

        if (newIndex < 0 || newIndex >= workflow.steps.length) {
            throw new Error('目标位置无效');
        }

        // 移动步骤
        const [step] = workflow.steps.splice(stepIndex, 1);
        workflow.steps.splice(newIndex, 0, step);
        workflow.updatedAt = new Date().toISOString();

        console.log('✅ 步骤已移动:', step.name);
        return step;
    }

    /**
     * 复制步骤
     */
    duplicateStep(workflowId, stepId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error('工作流不存在');
        }

        const step = workflow.steps.find(s => s.id === stepId);
        if (!step) {
            throw new Error('步骤不存在');
        }

        // 深拷贝步骤
        const duplicatedStep = JSON.parse(JSON.stringify(step));
        duplicatedStep.id = 'step_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        duplicatedStep.name = step.name + ' (副本)';

        // 如果有子操作，也要更新子操作的ID
        if (duplicatedStep.subOperations) {
            duplicatedStep.subOperations.forEach((subOp, index) => {
                subOp.id = `subop_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
            });
        }

        workflow.steps.push(duplicatedStep);
        workflow.updatedAt = new Date().toISOString();

        console.log('✅ 步骤已复制:', duplicatedStep.name);
        return duplicatedStep;
    }

    /**
     * 获取所有工作流
     */
    getAllWorkflows() {
        return Array.from(this.workflows.values());
    }

    /**
     * 清空所有工作流
     */
    clearAllWorkflows() {
        this.workflows.clear();
        this.currentWorkflowId = null;
        console.log('✅ 所有工作流已清空');
    }

    /**
     * 导入工作流数据
     */
    importWorkflows(workflowsData) {
        if (!Array.isArray(workflowsData)) {
            throw new Error('导入数据必须是数组');
        }

        let importedCount = 0;
        workflowsData.forEach(workflowData => {
            try {
                // 生成新的ID避免冲突
                const workflow = {
                    ...workflowData,
                    id: 'workflow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    importedAt: new Date().toISOString()
                };

                // 确保所有步骤都有唯一ID
                if (workflow.steps) {
                    workflow.steps.forEach((step, index) => {
                        if (!step.id) {
                            step.id = `step_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
                        }

                        // 确保子操作也有ID
                        if (step.subOperations) {
                            step.subOperations.forEach((subOp, subIndex) => {
                                if (!subOp.id) {
                                    subOp.id = `subop_${Date.now()}_${index}_${subIndex}_${Math.random().toString(36).substr(2, 9)}`;
                                }
                            });
                        }
                    });
                }

                this.workflows.set(workflow.id, workflow);
                importedCount++;
            } catch (error) {
                console.error('导入工作流失败:', workflowData.name, error);
            }
        });

        console.log(`✅ 成功导入${importedCount}个工作流`);
        return importedCount;
    }

    /**
     * 保存到本地存储
     */
    saveToStorage() {
        try {
            const data = {
                workflows: Array.from(this.workflows.entries()),
                currentWorkflowId: this.currentWorkflowId,
                savedAt: new Date().toISOString()
            };

            localStorage.setItem('automationWorkflows', JSON.stringify(data));
            const value = localStorage.getItem('automationWorkflows'); // 从扩展的 localStorage 获取数据

            console.log('📡 [数据同步-DEBUG] 开始同步工作流数据到浏览器缓存');
            console.log('📡 [数据同步-DEBUG] 同步的数据大小:', value ? value.length : 0, '字符');
            console.log('📡 [数据同步-DEBUG] 工作流数量:', this.workflows.size);

            chrome.runtime.sendMessage({
                action: 'sendToWebpageStorage',
                data: {
                    key: 'automationWorkflows',
                    value: value
                }
            }).then(response => {
                console.log('✅ [数据同步-DEBUG] 数据同步请求已发送到background script:', response);
            }).catch(error => {
                console.error('❌ [数据同步-DEBUG] 数据同步请求发送失败:', error);
            });

            console.log('✅ 工作流已保存到本地存储');
            return true;
        } catch (error) {
            console.error('保存工作流失败:', error);
            return false;
        }
    }

    /**
     * 从本地存储加载
     */
    loadFromStorage() {
        try {
            const data = localStorage.getItem('automationWorkflows');
            if (!data) {
                console.log('📭 本地存储中没有工作流数据');
                return false;
            }

            const parsed = JSON.parse(data);

            // 恢复工作流数据
            this.workflows = new Map(parsed.workflows || []);
            this.currentWorkflowId = parsed.currentWorkflowId;

            console.log(`✅ 从本地存储加载了${this.workflows.size}个工作流`);
            return true;
        } catch (error) {
            console.error('加载工作流失败:', error);
            return false;
        }
    }

    /**
     * 获取工作流统计信息
     */
    getStatistics() {
        const workflows = this.getAllWorkflows();
        const totalSteps = workflows.reduce((sum, workflow) => sum + workflow.steps.length, 0);

        return {
            totalWorkflows: workflows.length,
            totalSteps: totalSteps,
            averageStepsPerWorkflow: workflows.length > 0 ? Math.round(totalSteps / workflows.length) : 0,
            lastUpdated: workflows.length > 0 ? Math.max(...workflows.map(w => new Date(w.updatedAt).getTime())) : null
        };
    }
}

// 导出供主文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WorkflowManager
    };
}

// 在浏览器环境中，将工作流管理器类添加到全局作用域
if (typeof window !== 'undefined') {
    window.WorkflowManager = WorkflowManager;
    // 不再自动创建实例，让主文件自己创建
}
