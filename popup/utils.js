/**
 * 工具函数模块
 * 提供通用的工具函数和错误处理机制
 */

/**
 * 错误类型枚举
 */
const ErrorTypes = {
  VALIDATION: 'validation',
  COMMUNICATION: 'communication',
  EXECUTION: 'execution',
  TIMEOUT: 'timeout',
  PERMISSION: 'permission'
};

/**
 * 自定义错误类
 */
class AutomationError extends Error {
  constructor(message, type = ErrorTypes.EXECUTION, details = null) {
    super(message);
    this.name = 'AutomationError';
    this.type = type;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * 错误处理器
 */
class ErrorHandler {
  /**
   * 处理错误并返回用户友好的消息
   * @param {Error} error - 错误对象
   * @returns {string} 用户友好的错误消息
   */
  static getErrorMessage(error) {
    if (error instanceof AutomationError) {
      switch (error.type) {
        case ErrorTypes.VALIDATION:
          return `配置错误：${error.message}`;
        case ErrorTypes.COMMUNICATION:
          return `通信错误：${error.message}`;
        case ErrorTypes.EXECUTION:
          return `执行错误：${error.message}`;
        case ErrorTypes.TIMEOUT:
          return `操作超时：${error.message}`;
        case ErrorTypes.PERMISSION:
          return `权限错误：${error.message}`;
        default:
          return `未知错误：${error.message}`;
      }
    }
    
    // 处理Chrome扩展API错误
    if (error.message && error.message.includes('Extension context invalidated')) {
      return '扩展已重新加载，请刷新页面后重试';
    }
    
    if (error.message && error.message.includes('Could not establish connection')) {
      return '无法连接到页面，请确保页面已完全加载';
    }
    
    return `系统错误：${error.message || '未知错误'}`;
  }

  /**
   * 记录错误到控制台
   * @param {Error} error - 错误对象
   * @param {string} context - 错误上下文
   */
  static logError(error, context = '') {
    try {
      const errorInfo = {
        message: error?.message || 'Unknown error',
        context,
        timestamp: new Date().toISOString()
      };

      if (error instanceof AutomationError) {
        errorInfo.type = error.type;
        errorInfo.details = error.details;
      }

      // 安全地记录错误，避免循环引用
      console.error('AutomationError:', errorInfo.message, 'Context:', errorInfo.context);

      // 如果有stack信息，单独记录
      if (error?.stack) {
        console.error('Stack trace:', error.stack);
      }
    } catch (logError) {
      // 如果记录错误本身出错，使用最简单的方式记录
      console.error('Error logging failed:', error?.message || 'Unknown error');
    }
  }
}

/**
 * 输入验证器
 */
class Validator {
  /**
   * 验证步骤配置
   * @param {object} step - 步骤配置
   * @param {number} stepIndex - 步骤索引
   * @throws {AutomationError} 验证失败时抛出错误
   */
  static validateStep(step, stepIndex) {
    if (!step) {
      throw new AutomationError(
        `步骤 ${stepIndex + 1} 配置为空`,
        ErrorTypes.VALIDATION
      );
    }

    // 验证等待操作
    if (step.action === 'wait') {
      const waitTime = step.waitTime;
      if (!waitTime || waitTime < 1 || waitTime > 60) {
        throw new AutomationError(
          `步骤 ${stepIndex + 1} 的等待时间必须在1-60秒之间`,
          ErrorTypes.VALIDATION
        );
      }
      return; // 等待操作不需要定位器
    }

    // 验证循环操作
    if (step.action === 'loop') {
      if (!step.loopSteps || step.loopSteps.length === 0) {
        throw new AutomationError(
          `步骤 ${stepIndex + 1} 的循环操作中需要至少添加一个步骤`,
          ErrorTypes.VALIDATION
        );
      }

      // 验证循环内的步骤
      step.loopSteps.forEach((loopStep, loopIndex) => {
        this.validateLoopStep(loopStep, stepIndex, loopIndex);
      });
      return; // 循环操作本身不需要定位器
    }

    // 验证定位器（只对需要定位器的操作）
    if (!step.locator || !step.locator.value) {
      throw new AutomationError(
        `步骤 ${stepIndex + 1} 的定位值不能为空`,
        ErrorTypes.VALIDATION
      );
    }

    // 验证输入操作
    if (step.action === 'input' && !step.inputText) {
      throw new AutomationError(
        `步骤 ${stepIndex + 1} 的输入内容不能为空`,
        ErrorTypes.VALIDATION
      );
    }
  }

  /**
   * 验证循环内步骤配置
   * @param {object} loopStep - 循环步骤配置
   * @param {number} stepIndex - 主步骤索引
   * @param {number} loopIndex - 循环步骤索引
   * @throws {AutomationError} 验证失败时抛出错误
   */
  static validateLoopStep(loopStep, stepIndex, loopIndex) {
    if (loopStep.action !== 'wait' && !loopStep.locator.value) {
      throw new AutomationError(
        `步骤 ${stepIndex + 1} 中的循环步骤 ${loopIndex + 1} 的定位值不能为空`,
        ErrorTypes.VALIDATION
      );
    }

    if (loopStep.action === 'input' && !loopStep.inputText) {
      throw new AutomationError(
        `步骤 ${stepIndex + 1} 中的循环步骤 ${loopIndex + 1} 的输入内容不能为空`,
        ErrorTypes.VALIDATION
      );
    }
  }

  /**
   * 清理和验证HTML输入
   * @param {string} input - 用户输入
   * @returns {string} 清理后的输入
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return '';
    }
    
    // 移除潜在的HTML标签和脚本
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  /**
   * 验证选择器语法
   * @param {string} strategy - 定位策略
   * @param {string} value - 选择器值
   * @returns {boolean} 是否有效
   */
  static isValidSelector(strategy, value) {
    if (!value || typeof value !== 'string') {
      return false;
    }

    try {
      switch (strategy) {
        case 'css':
          document.querySelector(value);
          return true;
        case 'xpath':
          document.evaluate(value, document, null, XPathResult.ANY_TYPE, null);
          return true;
        case 'id':
        case 'class':
        case 'text':
        case 'contains':
        case 'outerhtml':
        case 'all':
          return value.length > 0;
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }
}

/**
 * 通用工具函数
 */
class Utils {
  /**
   * 防抖函数
   * @param {Function} func - 要防抖的函数
   * @param {number} wait - 等待时间（毫秒）
   * @returns {Function} 防抖后的函数
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * 节流函数
   * @param {Function} func - 要节流的函数
   * @param {number} limit - 限制时间（毫秒）
   * @returns {Function} 节流后的函数
   */
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * 深拷贝对象
   * @param {any} obj - 要拷贝的对象
   * @returns {any} 拷贝后的对象
   */
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item));
    }
    
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  }

  /**
   * 格式化时间戳
   * @param {Date} date - 日期对象
   * @returns {string} 格式化的时间字符串
   */
  static formatTime(date = new Date()) {
    return date.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * 生成唯一ID
   * @returns {string} 唯一ID
   */
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}

// 导出到全局作用域（用于浏览器扩展环境）
if (typeof window !== 'undefined') {
  window.AutomationUtils = {
    ErrorTypes,
    AutomationError,
    ErrorHandler,
    Validator,
    Utils
  };
}
