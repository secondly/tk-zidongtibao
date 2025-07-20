/**
 * 数据验证和类型检查工具
 * 提供统一的数据验证、类型检查和错误处理
 */

// 验证器基类
class Validator {
    constructor(name) {
        this.name = name;
        this.errors = [];
    }

    // 添加错误
    addError(message, field = null) {
        this.errors.push({
            message,
            field,
            validator: this.name,
            timestamp: Date.now()
        });
    }

    // 清除错误
    clearErrors() {
        this.errors = [];
    }

    // 获取错误
    getErrors() {
        return [...this.errors];
    }

    // 是否有效
    isValid() {
        return this.errors.length === 0;
    }

    // 获取错误摘要
    getErrorSummary() {
        if (this.errors.length === 0) return null;

        return {
            count: this.errors.length,
            messages: this.errors.map(e => e.message),
            fields: [...new Set(this.errors.map(e => e.field).filter(Boolean))]
        };
    }
}

// 工作流验证器
class WorkflowValidator extends Validator {
    constructor() {
        super('WorkflowValidator');
    }

    // 验证工作流数据
    validate(workflow) {
        this.clearErrors();

        if (!workflow) {
            this.addError('工作流数据不能为空');
            return false;
        }

        // 验证基本字段
        this.validateBasicFields(workflow);

        // 验证步骤
        this.validateSteps(workflow.steps);

        // 验证依赖关系
        this.validateDependencies(workflow.steps);

        return this.isValid();
    }

    // 验证基本字段
    validateBasicFields(workflow) {
        const requiredFields = ['name', 'steps'];

        requiredFields.forEach(field => {
            if (!workflow[field]) {
                this.addError(`缺少必需字段: ${field}`, field);
            }
        });

        // 验证名称
        if (workflow.name && typeof workflow.name !== 'string') {
            this.addError('工作流名称必须是字符串', 'name');
        }

        if (workflow.name && workflow.name.trim().length === 0) {
            this.addError('工作流名称不能为空', 'name');
        }

        // 验证描述
        if (workflow.description && typeof workflow.description !== 'string') {
            this.addError('工作流描述必须是字符串', 'description');
        }

        // 验证步骤数组
        if (workflow.steps && !Array.isArray(workflow.steps)) {
            this.addError('步骤必须是数组', 'steps');
        }
    }

    // 验证步骤
    validateSteps(steps) {
        if (!Array.isArray(steps)) return;

        if (steps.length === 0) {
            this.addError('工作流至少需要一个步骤', 'steps');
            return;
        }

        steps.forEach((step, index) => {
            this.validateStep(step, index);
        });
    }

    // 验证单个步骤
    validateStep(step, index) {
        const stepField = `steps[${index}]`;

        if (!step || typeof step !== 'object') {
            this.addError(`步骤 ${index + 1} 必须是对象`, stepField);
            return;
        }

        // 验证必需字段
        const requiredFields = ['id', 'type', 'name'];
        requiredFields.forEach(field => {
            if (!step[field]) {
                this.addError(`步骤 ${index + 1} 缺少必需字段: ${field}`, `${stepField}.${field}`);
            }
        });

        // 验证步骤类型
        const validTypes = ['action', 'condition', 'loop', 'parallel', 'delay'];
        if (step.type && !validTypes.includes(step.type)) {
            this.addError(`步骤 ${index + 1} 类型无效: ${step.type}`, `${stepField}.type`);
        }

        // 验证特定类型的步骤
        switch (step.type) {
            case 'action':
                this.validateActionStep(step, index);
                break;
            case 'condition':
                this.validateConditionStep(step, index);
                break;
            case 'loop':
                this.validateLoopStep(step, index);
                break;
        }
    }

    // 验证动作步骤
    validateActionStep(step, index) {
        const stepField = `steps[${index}]`;

        if (!step.action) {
            this.addError(`动作步骤 ${index + 1} 缺少动作定义`, `${stepField}.action`);
            return;
        }

        const validActions = ['click', 'input', 'wait', 'navigate', 'scroll'];
        if (!validActions.includes(step.action)) {
            this.addError(`动作步骤 ${index + 1} 动作类型无效: ${step.action}`, `${stepField}.action`);
        }

        // 验证选择器
        if (['click', 'input'].includes(step.action) && !step.selector) {
            this.addError(`动作步骤 ${index + 1} 缺少选择器`, `${stepField}.selector`);
        }
    }

    // 验证条件步骤
    validateConditionStep(step, index) {
        const stepField = `steps[${index}]`;

        if (!step.condition) {
            this.addError(`条件步骤 ${index + 1} 缺少条件定义`, `${stepField}.condition`);
        }

        if (!step.trueSteps && !step.falseSteps) {
            this.addError(`条件步骤 ${index + 1} 至少需要一个分支`, stepField);
        }
    }

    // 验证循环步骤
    validateLoopStep(step, index) {
        const stepField = `steps[${index}]`;

        if (!step.loopSteps || !Array.isArray(step.loopSteps)) {
            this.addError(`循环步骤 ${index + 1} 缺少循环体`, `${stepField}.loopSteps`);
        }

        if (!step.condition && !step.count) {
            this.addError(`循环步骤 ${index + 1} 需要循环条件或次数`, stepField);
        }
    }

    // 验证依赖关系
    validateDependencies(steps) {
        if (!Array.isArray(steps)) return;

        const stepIds = new Set(steps.map(step => step.id).filter(Boolean));

        steps.forEach((step, index) => {
            if (step.dependencies && Array.isArray(step.dependencies)) {
                step.dependencies.forEach(depId => {
                    if (!stepIds.has(depId)) {
                        this.addError(`步骤 ${index + 1} 依赖的步骤不存在: ${depId}`, `steps[${index}].dependencies`);
                    }
                });
            }
        });
    }
}

// 配置验证器
class ConfigValidator extends Validator {
    constructor() {
        super('ConfigValidator');
    }

    // 验证配置数据
    validate(config) {
        this.clearErrors();

        if (!config) {
            this.addError('配置数据不能为空');
            return false;
        }

        // 验证基本结构
        if (typeof config !== 'object') {
            this.addError('配置必须是对象');
            return false;
        }

        // 验证各个部分
        this.validateSettings(config.settings);
        this.validateWorkflows(config.workflows);

        return this.isValid();
    }

    // 验证设置
    validateSettings(settings) {
        if (!settings) return;

        if (typeof settings !== 'object') {
            this.addError('设置必须是对象', 'settings');
            return;
        }

        // 验证延迟设置
        if (settings.defaultDelay !== undefined) {
            if (typeof settings.defaultDelay !== 'number' || settings.defaultDelay < 0) {
                this.addError('默认延迟必须是非负数', 'settings.defaultDelay');
            }
        }

        // 验证超时设置
        if (settings.timeout !== undefined) {
            if (typeof settings.timeout !== 'number' || settings.timeout <= 0) {
                this.addError('超时时间必须是正数', 'settings.timeout');
            }
        }
    }

    // 验证工作流列表
    validateWorkflows(workflows) {
        if (!workflows) return;

        if (!Array.isArray(workflows)) {
            this.addError('工作流列表必须是数组', 'workflows');
            return;
        }

        const workflowValidator = new WorkflowValidator();
        workflows.forEach((workflow, index) => {
            if (!workflowValidator.validate(workflow)) {
                const errors = workflowValidator.getErrors();
                errors.forEach(error => {
                    this.addError(`工作流 ${index + 1}: ${error.message}`, `workflows[${index}].${error.field}`);
                });
            }
        });
    }
}

// 类型检查工具
class TypeChecker {
    // 检查是否为字符串
    static isString(value) {
        return typeof value === 'string';
    }

    // 检查是否为非空字符串
    static isNonEmptyString(value) {
        return this.isString(value) && value.trim().length > 0;
    }

    // 检查是否为数字
    static isNumber(value) {
        return typeof value === 'number' && !isNaN(value);
    }

    // 检查是否为正数
    static isPositiveNumber(value) {
        return this.isNumber(value) && value > 0;
    }

    // 检查是否为非负数
    static isNonNegativeNumber(value) {
        return this.isNumber(value) && value >= 0;
    }

    // 检查是否为布尔值
    static isBoolean(value) {
        return typeof value === 'boolean';
    }

    // 检查是否为数组
    static isArray(value) {
        return Array.isArray(value);
    }

    // 检查是否为非空数组
    static isNonEmptyArray(value) {
        return this.isArray(value) && value.length > 0;
    }

    // 检查是否为对象
    static isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    // 检查是否为函数
    static isFunction(value) {
        return typeof value === 'function';
    }

    // 检查是否为有效的URL
    static isValidUrl(value) {
        if (!this.isString(value)) return false;
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    }

    // 检查是否为有效的CSS选择器
    static isValidSelector(value) {
        if (!this.isString(value)) return false;
        try {
            document.querySelector(value);
            return true;
        } catch {
            return false;
        }
    }

    // 检查是否为有效的JSON
    static isValidJson(value) {
        if (!this.isString(value)) return false;
        try {
            JSON.parse(value);
            return true;
        } catch {
            return false;
        }
    }
}

// 数据清理工具
class DataSanitizer {
    // 清理字符串
    static sanitizeString(value, maxLength = 1000) {
        if (!TypeChecker.isString(value)) return '';

        return value
            .trim()
            .substring(0, maxLength)
            .replace(/[<>]/g, ''); // 移除潜在的HTML标签
    }

    // 清理数字
    static sanitizeNumber(value, min = -Infinity, max = Infinity) {
        const num = Number(value);
        if (isNaN(num)) return 0;
        return Math.max(min, Math.min(max, num));
    }

    // 清理数组
    static sanitizeArray(value, maxLength = 100) {
        if (!TypeChecker.isArray(value)) return [];
        return value.slice(0, maxLength);
    }

    // 清理对象
    static sanitizeObject(value, allowedKeys = null) {
        if (!TypeChecker.isObject(value)) return {};

        if (!allowedKeys) return { ...value };

        const sanitized = {};
        allowedKeys.forEach(key => {
            if (key in value) {
                sanitized[key] = value[key];
            }
        });

        return sanitized;
    }
}

// 创建验证器实例
const workflowValidator = new WorkflowValidator();
const configValidator = new ConfigValidator();

// 导出
export {
    Validator,
    WorkflowValidator,
    ConfigValidator,
    TypeChecker,
    DataSanitizer,
    workflowValidator,
    configValidator
};