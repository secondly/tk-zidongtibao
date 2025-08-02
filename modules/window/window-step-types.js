/**
 * 新窗口相关步骤类型定义
 * 定义了新窗口操作的步骤配置格式和验证规则
 */

/**
 * 新窗口步骤类型枚举
 */
const WindowStepTypes = {
    NEW_WINDOW: 'newWindow',
    CLOSE_WINDOW: 'closeWindow',
    SWITCH_WINDOW: 'switchWindow',
    WAIT_WINDOW: 'waitWindow'
};

/**
 * 新窗口步骤配置模板
 */
const WindowStepTemplates = {
    /**
     * 新窗口步骤模板
     * 用于点击按钮打开新窗口的操作
     */
    newWindow: {
        id: '',
        name: '打开新窗口',
        type: 'click',
        action: 'click',
        opensNewWindow: true,
        locator: {
            strategy: 'css',
            value: ''
        },
        newWindowTimeout: 10000,        // 等待新窗口创建的超时时间
        windowReadyTimeout: 30000,      // 等待新窗口页面加载完成的超时时间
        switchToNewWindow: true,        // 是否自动切换到新窗口
        description: '点击元素打开新窗口'
    },

    /**
     * 关闭窗口步骤模板
     * 用于关闭当前窗口并返回上一个窗口
     */
    closeWindow: {
        id: '',
        name: '关闭窗口',
        type: 'closeWindow',
        action: 'closeWindow',
        closeTarget: 'current',         // 'current' | 'specific' | 'all'
        targetWindowId: null,           // 当closeTarget为'specific'时指定窗口ID
        returnToPrevious: true,         // 是否返回到上一个窗口
        description: '关闭当前窗口并返回上一个窗口'
    },

    /**
     * 切换窗口步骤模板
     * 用于在多个窗口之间切换
     */
    switchWindow: {
        id: '',
        name: '切换窗口',
        type: 'switchWindow',
        action: 'switchWindow',
        targetWindow: 'main',           // 'main' | 'previous' | 'specific'
        targetWindowId: null,           // 当targetWindow为'specific'时指定窗口ID
        description: '切换到指定窗口'
    },

    /**
     * 等待窗口步骤模板
     * 用于等待窗口状态变化
     */
    waitWindow: {
        id: '',
        name: '等待窗口',
        type: 'waitWindow',
        action: 'waitWindow',
        waitCondition: 'ready',         // 'ready' | 'closed' | 'focused'
        targetWindowId: null,           // 要等待的窗口ID，null表示当前窗口
        timeout: 30000,                 // 等待超时时间
        description: '等待窗口达到指定状态'
    }
};

/**
 * 验证新窗口步骤配置
 * @param {object} step - 步骤配置
 * @returns {object} 验证结果
 */
function validateWindowStep(step) {
    const result = {
        valid: true,
        errors: [],
        warnings: []
    };

    if (!step) {
        result.valid = false;
        result.errors.push('步骤配置不能为空');
        return result;
    }

    // 验证基本字段
    if (!step.type && !step.action) {
        result.valid = false;
        result.errors.push('缺少步骤类型(type)或动作(action)字段');
    }

    const stepType = step.type || step.action;

    switch (stepType) {
        case 'click':
            if (step.opensNewWindow) {
                result = validateNewWindowStep(step, result);
            }
            break;

        case WindowStepTypes.CLOSE_WINDOW:
            result = validateCloseWindowStep(step, result);
            break;

        case WindowStepTypes.SWITCH_WINDOW:
            result = validateSwitchWindowStep(step, result);
            break;

        case WindowStepTypes.WAIT_WINDOW:
            result = validateWaitWindowStep(step, result);
            break;
    }

    return result;
}

/**
 * 验证新窗口步骤配置
 * @param {object} step - 步骤配置
 * @param {object} result - 验证结果对象
 * @returns {object} 更新后的验证结果
 */
function validateNewWindowStep(step, result) {
    // 验证定位器
    if (!step.locator) {
        result.valid = false;
        result.errors.push('新窗口步骤缺少定位器(locator)配置');
    } else {
        if (!step.locator.strategy && !step.locator.type) {
            result.valid = false;
            result.errors.push('定位器缺少策略(strategy)字段');
        }
        if (!step.locator.value) {
            result.valid = false;
            result.errors.push('定位器缺少值(value)字段');
        }
    }

    // 验证超时配置
    if (step.newWindowTimeout && (typeof step.newWindowTimeout !== 'number' || step.newWindowTimeout <= 0)) {
        result.warnings.push('新窗口超时时间应为正数，使用默认值10000ms');
    }

    if (step.windowReadyTimeout && (typeof step.windowReadyTimeout !== 'number' || step.windowReadyTimeout <= 0)) {
        result.warnings.push('窗口就绪超时时间应为正数，使用默认值30000ms');
    }

    return result;
}

/**
 * 验证关闭窗口步骤配置
 * @param {object} step - 步骤配置
 * @param {object} result - 验证结果对象
 * @returns {object} 更新后的验证结果
 */
function validateCloseWindowStep(step, result) {
    const validCloseTargets = ['current', 'specific', 'all'];

    if (!step.closeTarget) {
        result.warnings.push('未指定关闭目标，使用默认值"current"');
    } else if (!validCloseTargets.includes(step.closeTarget)) {
        result.valid = false;
        result.errors.push(`无效的关闭目标: ${step.closeTarget}，有效值: ${validCloseTargets.join(', ')}`);
    }

    if (step.closeTarget === 'specific' && !step.targetWindowId) {
        result.valid = false;
        result.errors.push('关闭特定窗口时必须指定目标窗口ID(targetWindowId)');
    }

    return result;
}

/**
 * 验证切换窗口步骤配置
 * @param {object} step - 步骤配置
 * @param {object} result - 验证结果对象
 * @returns {object} 更新后的验证结果
 */
function validateSwitchWindowStep(step, result) {
    const validTargets = ['main', 'previous', 'specific'];

    if (!step.targetWindow) {
        result.warnings.push('未指定切换目标，使用默认值"main"');
    } else if (!validTargets.includes(step.targetWindow)) {
        result.valid = false;
        result.errors.push(`无效的切换目标: ${step.targetWindow}，有效值: ${validTargets.join(', ')}`);
    }

    if (step.targetWindow === 'specific' && !step.targetWindowId) {
        result.valid = false;
        result.errors.push('切换到特定窗口时必须指定目标窗口ID(targetWindowId)');
    }

    return result;
}

/**
 * 验证等待窗口步骤配置
 * @param {object} step - 步骤配置
 * @param {object} result - 验证结果对象
 * @returns {object} 更新后的验证结果
 */
function validateWaitWindowStep(step, result) {
    const validConditions = ['ready', 'closed', 'focused'];

    if (!step.waitCondition) {
        result.warnings.push('未指定等待条件，使用默认值"ready"');
    } else if (!validConditions.includes(step.waitCondition)) {
        result.valid = false;
        result.errors.push(`无效的等待条件: ${step.waitCondition}，有效值: ${validConditions.join(', ')}`);
    }

    if (step.timeout && (typeof step.timeout !== 'number' || step.timeout <= 0)) {
        result.warnings.push('等待超时时间应为正数，使用默认值30000ms');
    }

    return result;
}

/**
 * 创建新窗口步骤配置
 * @param {string} stepType - 步骤类型
 * @param {object} customConfig - 自定义配置
 * @returns {object} 步骤配置
 */
function createWindowStep(stepType, customConfig = {}) {
    const template = WindowStepTemplates[stepType];
    if (!template) {
        throw new Error(`不支持的窗口步骤类型: ${stepType}`);
    }

    // 深度合并配置
    const step = JSON.parse(JSON.stringify(template));
    Object.assign(step, customConfig);

    // 生成唯一ID
    if (!step.id) {
        step.id = `${stepType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    return step;
}

/**
 * 转换旧格式步骤为新格式
 * @param {object} oldStep - 旧格式步骤
 * @returns {object} 新格式步骤
 */
function convertLegacyWindowStep(oldStep) {
    const newStep = { ...oldStep };

    // 转换定位器格式
    if (newStep.locator && newStep.locator.type && !newStep.locator.strategy) {
        newStep.locator.strategy = newStep.locator.type;
        delete newStep.locator.type;
    }

    // 转换opensNewWindow标志
    if (newStep.opensNewWindow && newStep.type === 'click') {
        // 保持原有配置，只是标记为新窗口操作
        newStep.description = newStep.description || '点击元素打开新窗口';
    }

    return newStep;
}

/**
 * 获取步骤的窗口操作类型
 * @param {object} step - 步骤配置
 * @returns {string|null} 窗口操作类型
 */
function getWindowOperationType(step) {
    if (!step) return null;

    if (step.opensNewWindow || step.action === 'newWindow') {
        return 'newWindow';
    }

    if (step.action === 'closeWindow' || step.type === 'closeWindow') {
        return 'closeWindow';
    }

    if (step.action === 'switchWindow' || step.type === 'switchWindow') {
        return 'switchWindow';
    }

    if (step.action === 'waitWindow' || step.type === 'waitWindow') {
        return 'waitWindow';
    }

    return null;
}

/**
 * 检查步骤是否为窗口操作
 * @param {object} step - 步骤配置
 * @returns {boolean} 是否为窗口操作
 */
function isWindowStep(step) {
    return getWindowOperationType(step) !== null;
}

// 导出模块
if (typeof window !== 'undefined') {
    window.WindowStepTypes = WindowStepTypes;
    window.WindowStepTemplates = WindowStepTemplates;
    window.validateWindowStep = validateWindowStep;
    window.createWindowStep = createWindowStep;
    window.convertLegacyWindowStep = convertLegacyWindowStep;
    window.getWindowOperationType = getWindowOperationType;
    window.isWindowStep = isWindowStep;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WindowStepTypes,
        WindowStepTemplates,
        validateWindowStep,
        createWindowStep,
        convertLegacyWindowStep,
        getWindowOperationType,
        isWindowStep
    };
}

console.log('📦 窗口步骤类型定义模块已加载');