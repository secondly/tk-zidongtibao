/**
 * 步骤管理器模块
 * 负责步骤的创建、编辑、删除和验证
 */

class StepManager {
  constructor() {
    this.steps = [];
    this.listeners = new Set();
  }

  /**
   * 添加步骤变更监听器
   * @param {Function} listener - 监听器函数
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * 移除步骤变更监听器
   * @param {Function} listener - 监听器函数
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   * @param {string} event - 事件类型
   * @param {any} data - 事件数据
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('监听器执行错误:', error);
      }
    });
  }

  /**
   * 创建默认步骤配置
   * @returns {object} 默认步骤配置
   */
  createDefaultStep() {
    return {
      id: Utils.generateId(),
      locator: {
        strategy: "id",
        value: "",
      },
      action: "click",
      inputText: "",
      waitTime: 3,
      loopSteps: [],
      startIndex: 0,
      endIndex: -1,
      skipIndices: [],
    };
  }

  /**
   * 创建默认循环步骤配置
   * @returns {object} 默认循环步骤配置
   */
  createDefaultLoopStep() {
    return {
      id: Utils.generateId(),
      locator: {
        strategy: "id",
        value: "",
      },
      action: "click",
      inputText: "",
      waitTime: 3,
    };
  }

  /**
   * 添加新步骤
   * @returns {number} 新步骤的索引
   */
  addStep() {
    const newStep = this.createDefaultStep();
    const index = this.steps.length;
    this.steps.push(newStep);
    
    this.notifyListeners('stepAdded', { step: newStep, index });
    return index;
  }

  /**
   * 删除步骤
   * @param {number} index - 步骤索引
   * @returns {boolean} 是否删除成功
   */
  removeStep(index) {
    if (index < 0 || index >= this.steps.length) {
      return false;
    }

    const removedStep = this.steps.splice(index, 1)[0];
    this.notifyListeners('stepRemoved', { step: removedStep, index });
    return true;
  }

  /**
   * 更新步骤
   * @param {number} index - 步骤索引
   * @param {object} updates - 更新的字段
   * @returns {boolean} 是否更新成功
   */
  updateStep(index, updates) {
    if (index < 0 || index >= this.steps.length) {
      return false;
    }

    const oldStep = Utils.deepClone(this.steps[index]);
    Object.assign(this.steps[index], updates);
    
    this.notifyListeners('stepUpdated', { 
      oldStep, 
      newStep: this.steps[index], 
      index 
    });
    return true;
  }

  /**
   * 添加循环步骤
   * @param {number} stepIndex - 主步骤索引
   * @returns {number} 新循环步骤的索引
   */
  addLoopStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      return -1;
    }

    const step = this.steps[stepIndex];
    if (!step.loopSteps) {
      step.loopSteps = [];
    }

    const newLoopStep = this.createDefaultLoopStep();
    const loopIndex = step.loopSteps.length;
    step.loopSteps.push(newLoopStep);

    this.notifyListeners('loopStepAdded', {
      loopStep: newLoopStep,
      stepIndex,
      loopIndex
    });
    return loopIndex;
  }

  /**
   * 删除循环步骤
   * @param {number} stepIndex - 主步骤索引
   * @param {number} loopIndex - 循环步骤索引
   * @returns {boolean} 是否删除成功
   */
  removeLoopStep(stepIndex, loopIndex) {
    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      return false;
    }

    const step = this.steps[stepIndex];
    if (!step.loopSteps || loopIndex < 0 || loopIndex >= step.loopSteps.length) {
      return false;
    }

    const removedLoopStep = step.loopSteps.splice(loopIndex, 1)[0];
    this.notifyListeners('loopStepRemoved', { 
      loopStep: removedLoopStep, 
      stepIndex, 
      loopIndex 
    });
    return true;
  }

  /**
   * 更新循环步骤
   * @param {number} stepIndex - 主步骤索引
   * @param {number} loopIndex - 循环步骤索引
   * @param {object} updates - 更新的字段
   * @returns {boolean} 是否更新成功
   */
  updateLoopStep(stepIndex, loopIndex, updates) {
    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      return false;
    }

    const step = this.steps[stepIndex];
    if (!step.loopSteps || loopIndex < 0 || loopIndex >= step.loopSteps.length) {
      return false;
    }

    const oldLoopStep = Utils.deepClone(step.loopSteps[loopIndex]);
    Object.assign(step.loopSteps[loopIndex], updates);

    this.notifyListeners('loopStepUpdated', { 
      oldLoopStep, 
      newLoopStep: step.loopSteps[loopIndex], 
      stepIndex, 
      loopIndex 
    });
    return true;
  }

  /**
   * 清除所有步骤
   */
  clearSteps() {
    const oldSteps = [...this.steps];
    this.steps = [];
    this.notifyListeners('stepsCleared', { oldSteps });
  }

  /**
   * 获取所有步骤
   * @returns {Array} 步骤数组的副本
   */
  getSteps() {
    return Utils.deepClone(this.steps);
  }

  /**
   * 设置步骤数组
   * @param {Array} steps - 新的步骤数组
   */
  setSteps(steps) {
    const oldSteps = [...this.steps];
    this.steps = Utils.deepClone(steps);
    this.notifyListeners('stepsReplaced', { oldSteps, newSteps: this.steps });
  }

  /**
   * 获取步骤数量
   * @returns {number} 步骤数量
   */
  getStepCount() {
    return this.steps.length;
  }

  /**
   * 验证所有步骤
   * @throws {AutomationError} 验证失败时抛出错误
   */
  validateAllSteps() {
    if (this.steps.length === 0) {
      throw new window.AutomationUtils.AutomationError(
        '请先添加操作步骤！',
        window.AutomationUtils.ErrorTypes.VALIDATION
      );
    }

    this.steps.forEach((step, index) => {
      window.AutomationUtils.Validator.validateStep(step, index);
    });
  }

  /**
   * 导出配置
   * @returns {object} 导出的配置对象
   */
  exportConfig() {
    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      steps: this.getSteps(),
    };
  }

  /**
   * 导入配置
   * @param {object} config - 配置对象
   * @throws {AutomationError} 导入失败时抛出错误
   */
  importConfig(config) {
    if (!config || !config.steps || !Array.isArray(config.steps)) {
      throw new window.AutomationUtils.AutomationError(
        '无效的配置文件格式',
        window.AutomationUtils.ErrorTypes.VALIDATION
      );
    }

    if (config.steps.length === 0) {
      throw new window.AutomationUtils.AutomationError(
        '配置文件不包含任何步骤',
        window.AutomationUtils.ErrorTypes.VALIDATION
      );
    }

    // 验证导入的步骤
    config.steps.forEach((step, index) => {
      window.AutomationUtils.Validator.validateStep(step, index);
    });

    this.setSteps(config.steps);
  }

  /**
   * 移动步骤位置
   * @param {number} fromIndex - 源索引
   * @param {number} toIndex - 目标索引
   * @returns {boolean} 是否移动成功
   */
  moveStep(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.steps.length ||
        toIndex < 0 || toIndex >= this.steps.length ||
        fromIndex === toIndex) {
      return false;
    }

    const step = this.steps.splice(fromIndex, 1)[0];
    this.steps.splice(toIndex, 0, step);

    this.notifyListeners('stepMoved', { fromIndex, toIndex, step });
    return true;
  }

  /**
   * 复制步骤
   * @param {number} index - 要复制的步骤索引
   * @returns {number} 新步骤的索引，失败返回-1
   */
  duplicateStep(index) {
    if (index < 0 || index >= this.steps.length) {
      return -1;
    }

    const originalStep = this.steps[index];
    const duplicatedStep = Utils.deepClone(originalStep);
    duplicatedStep.id = Utils.generateId();
    
    // 为循环步骤也生成新ID
    if (duplicatedStep.loopSteps) {
      duplicatedStep.loopSteps.forEach(loopStep => {
        loopStep.id = Utils.generateId();
      });
    }

    const newIndex = index + 1;
    this.steps.splice(newIndex, 0, duplicatedStep);

    this.notifyListeners('stepDuplicated', { 
      originalIndex: index, 
      newIndex, 
      step: duplicatedStep 
    });
    return newIndex;
  }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
  window.StepManager = StepManager;
}
