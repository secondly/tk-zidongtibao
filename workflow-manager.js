/**
 * 工作流配置管理器
 * 负责工作流的创建、编辑、保存、加载和验证
 */

class WorkflowManager {
    constructor() {
        this.workflows = new Map();
        this.currentWorkflow = null;
        this.templates = new Map();
        this.initializeTemplates();
    }

    /**
     * 创建新的工作流
     */
    createWorkflow(name, description = '') {
        const workflow = {
            id: this.generateId(),
            name: name,
            description: description,
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            steps: [],
            settings: {
                errorHandling: 'continue', // continue, stop, skip
                stepDelay: 500,
                retryCount: 0,
                timeout: 30000
            }
        };

        this.workflows.set(workflow.id, workflow);
        this.currentWorkflow = workflow;
        return workflow;
    }

    /**
     * 从模板创建工作流
     */
    createFromTemplate(templateName, workflowName) {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`模板不存在: ${templateName}`);
        }

        const workflow = {
            ...JSON.parse(JSON.stringify(template)),
            id: this.generateId(),
            name: workflowName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.workflows.set(workflow.id, workflow);
        this.currentWorkflow = workflow;
        return workflow;
    }

    /**
     * 添加步骤到工作流
     */
    addStep(workflowId, step, parentPath = []) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`工作流不存在: ${workflowId}`);
        }

        // 简化验证，只检查基本必需字段
        if (!step.type) {
            throw new Error('步骤类型不能为空');
        }

        // 添加默认属性
        const fullStep = {
            id: this.generateId(),
            name: step.name || this.getDefaultStepName(step.type),
            type: step.type,
            errorHandling: step.errorHandling || 'continue',
            createdAt: new Date().toISOString(),
            ...step
        };

        // 根据路径添加到正确位置
        const targetSteps = this.getStepsByPath(workflow, parentPath);
        targetSteps.push(fullStep);

        workflow.updatedAt = new Date().toISOString();
        return fullStep;
    }

    /**
     * 获取默认步骤名称
     */
    getDefaultStepName(type) {
        const names = {
            'click': '点击操作',
            'input': '输入文本',
            'wait': '等待时间',
            'smartWait': '智能等待',
            'loop': '循环操作',
            'rangeSelect': '区间选择',
            'custom': '自定义操作'
        };
        return names[type] || type;
    }

    /**
     * 更新步骤
     */
    updateStep(workflowId, stepId, updates) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`工作流不存在: ${workflowId}`);
        }

        const step = this.findStepById(workflow, stepId);
        if (!step) {
            throw new Error(`步骤不存在: ${stepId}`);
        }

        Object.assign(step, updates);
        workflow.updatedAt = new Date().toISOString();
        return step;
    }

    /**
     * 删除步骤
     */
    deleteStep(workflowId, stepId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`工作流不存在: ${workflowId}`);
        }

        const result = this.removeStepById(workflow.steps, stepId);
        if (result) {
            workflow.updatedAt = new Date().toISOString();
        }
        return result;
    }

    /**
     * 移动步骤位置
     */
    moveStep(workflowId, stepId, newPath, newIndex) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`工作流不存在: ${workflowId}`);
        }

        // 先删除步骤
        const step = this.findStepById(workflow, stepId);
        if (!step) {
            throw new Error(`步骤不存在: ${stepId}`);
        }

        this.removeStepById(workflow.steps, stepId);

        // 在新位置插入
        const targetSteps = this.getStepsByPath(workflow, newPath);
        targetSteps.splice(newIndex, 0, step);

        workflow.updatedAt = new Date().toISOString();
        return step;
    }

    /**
     * 复制步骤
     */
    duplicateStep(workflowId, stepId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`工作流不存在: ${workflowId}`);
        }

        const originalStep = this.findStepById(workflow, stepId);
        if (!originalStep) {
            throw new Error(`步骤不存在: ${stepId}`);
        }

        const duplicatedStep = {
            ...JSON.parse(JSON.stringify(originalStep)),
            id: this.generateId(),
            name: `${originalStep.name} (副本)`,
            createdAt: new Date().toISOString()
        };

        // 找到原步骤的父级并插入副本
        const parentSteps = this.findParentSteps(workflow, stepId);
        const originalIndex = parentSteps.findIndex(s => s.id === stepId);
        parentSteps.splice(originalIndex + 1, 0, duplicatedStep);

        workflow.updatedAt = new Date().toISOString();
        return duplicatedStep;
    }

    /**
     * 验证工作流
     */
    validateWorkflow(workflow) {
        const errors = [];

        if (!workflow.name || workflow.name.trim() === '') {
            errors.push('工作流名称不能为空');
        }

        if (!workflow.steps || workflow.steps.length === 0) {
            errors.push('工作流至少需要一个步骤');
        }

        // 验证所有步骤
        this.validateStepsRecursive(workflow.steps, errors, []);

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * 验证步骤配置（简化版本）
     */
    validateStep(step) {
        if (!step.type) {
            throw new Error('步骤类型不能为空');
        }

        // 简化验证，只在执行时进行详细验证
        // 这样可以先创建步骤，后续再配置详细参数
        return true;
    }

    /**
     * 详细验证步骤配置（执行前验证）
     */
    validateStepForExecution(step) {
        if (!step.type) {
            throw new Error('步骤类型不能为空');
        }

        switch (step.type) {
            case 'click':
            case 'input':
            case 'smartWait':
                if (!step.locator || !step.locator.strategy || !step.locator.value) {
                    throw new Error(`${step.name || step.type}步骤需要有效的定位器`);
                }
                break;
            case 'loop':
                if (!step.locator || !step.locator.strategy || !step.locator.value) {
                    throw new Error(`${step.name || step.type}步骤需要有效的定位器`);
                }
                break;
            case 'rangeSelect':
                if (!step.locator || !step.startIndex || !step.endIndex) {
                    throw new Error(`${step.name || step.type}步骤需要定位器和索引范围`);
                }
                break;
            case 'wait':
                if (!step.duration || step.duration <= 0) {
                    throw new Error(`${step.name || step.type}步骤需要有效的持续时间`);
                }
                break;
            case 'custom':
                if (!step.handler || typeof step.handler !== 'function') {
                    throw new Error(`${step.name || step.type}步骤需要处理函数`);
                }
                break;
        }
    }

    /**
     * 保存工作流到本地存储
     */
    saveToStorage(workflowId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`工作流不存在: ${workflowId}`);
        }

        const storageKey = `workflow_${workflowId}`;
        localStorage.setItem(storageKey, JSON.stringify(workflow));
        
        // 更新工作流列表
        this.updateWorkflowList();
        return true;
    }

    /**
     * 从本地存储加载工作流
     */
    loadFromStorage(workflowId) {
        const storageKey = `workflow_${workflowId}`;
        const workflowData = localStorage.getItem(storageKey);
        
        if (!workflowData) {
            throw new Error(`工作流不存在: ${workflowId}`);
        }

        const workflow = JSON.parse(workflowData);
        this.workflows.set(workflowId, workflow);
        this.currentWorkflow = workflow;
        return workflow;
    }

    /**
     * 导出工作流为JSON
     */
    exportWorkflow(workflowId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`工作流不存在: ${workflowId}`);
        }

        return JSON.stringify(workflow, null, 2);
    }

    /**
     * 从JSON导入工作流
     */
    importWorkflow(jsonData, newName = null) {
        try {
            const workflow = JSON.parse(jsonData);
            
            // 生成新的ID和名称
            workflow.id = this.generateId();
            if (newName) {
                workflow.name = newName;
            }
            workflow.importedAt = new Date().toISOString();

            // 验证工作流
            const validation = this.validateWorkflow(workflow);
            if (!validation.isValid) {
                throw new Error(`工作流验证失败: ${validation.errors.join(', ')}`);
            }

            this.workflows.set(workflow.id, workflow);
            return workflow;
        } catch (error) {
            throw new Error(`导入工作流失败: ${error.message}`);
        }
    }

    /**
     * 获取所有工作流列表
     */
    getWorkflowList() {
        return Array.from(this.workflows.values()).map(workflow => ({
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt,
            stepCount: this.countSteps(workflow.steps)
        }));
    }

    /**
     * 初始化预设模板
     */
    initializeTemplates() {
        // 简单点击模板
        this.templates.set('simple-click', {
            name: '简单点击操作',
            description: '对页面元素执行简单的点击操作',
            steps: [
                {
                    type: 'click',
                    name: '点击目标元素',
                    locator: { strategy: 'css', value: '' },
                    errorHandling: 'stop'
                }
            ]
        });

        // 表单填写模板
        this.templates.set('form-fill', {
            name: '表单填写',
            description: '填写表单并提交',
            steps: [
                {
                    type: 'input',
                    name: '输入文本',
                    locator: { strategy: 'css', value: 'input[type="text"]' },
                    text: '',
                    clearFirst: true
                },
                {
                    type: 'click',
                    name: '提交表单',
                    locator: { strategy: 'css', value: 'button[type="submit"]' }
                }
            ]
        });

        // 简单循环模板
        this.templates.set('simple-loop', {
            name: '简单循环操作',
            description: '对多个相似元素执行相同操作',
            steps: [
                {
                    type: 'loop',
                    name: '循环点击',
                    locator: { strategy: 'css', value: '.item' },
                    steps: [
                        {
                            type: 'wait',
                            name: '等待',
                            duration: 1000
                        }
                    ]
                }
            ]
        });

        // 智能等待模板
        this.templates.set('smart-wait', {
            name: '智能等待操作',
            description: '等待元素出现后执行操作',
            steps: [
                {
                    type: 'smartWait',
                    name: '等待元素出现',
                    locator: { strategy: 'css', value: '.loading' },
                    timeout: 10000,
                    description: '等待加载完成'
                },
                {
                    type: 'click',
                    name: '点击元素',
                    locator: { strategy: 'css', value: '.button' }
                }
            ]
        });
    }

    // 辅助方法
    generateId() {
        return 'wf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getStepsByPath(workflow, path) {
        let current = workflow.steps;
        for (const index of path) {
            current = current[index].steps;
        }
        return current;
    }

    findStepById(workflow, stepId) {
        return this.findStepByIdRecursive(workflow.steps, stepId);
    }

    findStepByIdRecursive(steps, stepId) {
        for (const step of steps) {
            if (step.id === stepId) {
                return step;
            }
            if (step.steps) {
                const found = this.findStepByIdRecursive(step.steps, stepId);
                if (found) return found;
            }
        }
        return null;
    }

    removeStepById(steps, stepId) {
        for (let i = 0; i < steps.length; i++) {
            if (steps[i].id === stepId) {
                steps.splice(i, 1);
                return true;
            }
            if (steps[i].steps) {
                if (this.removeStepById(steps[i].steps, stepId)) {
                    return true;
                }
            }
        }
        return false;
    }

    findParentSteps(workflow, stepId) {
        return this.findParentStepsRecursive(workflow.steps, stepId);
    }

    findParentStepsRecursive(steps, stepId) {
        for (const step of steps) {
            if (step.id === stepId) {
                return steps;
            }
            if (step.steps) {
                const found = this.findParentStepsRecursive(step.steps, stepId);
                if (found) return found;
            }
        }
        return null;
    }

    countSteps(steps) {
        let count = 0;
        for (const step of steps) {
            count++;
            if (step.steps) {
                count += this.countSteps(step.steps);
            }
        }
        return count;
    }

    validateStepsRecursive(steps, errors, path) {
        steps.forEach((step, index) => {
            const stepPath = [...path, index];
            try {
                this.validateStep(step);
            } catch (error) {
                errors.push(`步骤 ${stepPath.join('.')} 错误: ${error.message}`);
            }

            if (step.steps) {
                this.validateStepsRecursive(step.steps, errors, stepPath);
            }
        });
    }

    updateWorkflowList() {
        const workflowList = this.getWorkflowList();
        localStorage.setItem('workflow_list', JSON.stringify(workflowList));
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkflowManager;
}

if (typeof window !== 'undefined') {
    window.WorkflowManager = WorkflowManager;
}
