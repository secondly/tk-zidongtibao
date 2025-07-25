/**
 * 拖拽操作模块
 * 负责处理元素拖拽操作的核心逻辑
 */

class DragOperation {
  constructor() {
    this.defaultConfig = {
      name: '拖拽操作',
      type: 'drag',
      locator: { strategy: 'css', value: '' },
      horizontalDistance: 0,  // 水平移动距离（像素）
      verticalDistance: 0,    // 垂直移动距离（像素）
      timeout: 10000,         // 操作超时时间（毫秒）
      dragSpeed: 100,         // 拖拽速度（毫秒）
      waitAfterDrag: 1000     // 拖拽后等待时间（毫秒）
    };
  }

  /**
   * 创建默认拖拽配置
   * @returns {Object} 默认配置对象
   */
  createDefaultConfig() {
    return { ...this.defaultConfig };
  }

  /**
   * 验证拖拽配置
   * @param {Object} config - 拖拽配置
   * @returns {Object} 验证结果 {valid: boolean, errors: string[]}
   */
  validateConfig(config) {
    const errors = [];

    if (!config.locator || !config.locator.value.trim()) {
      errors.push('请设置元素定位器');
    }

    if (config.horizontalDistance === 0 && config.verticalDistance === 0) {
      errors.push('水平距离和垂直距离不能同时为0');
    }

    if (config.timeout < 1000) {
      errors.push('超时时间不能少于1秒');
    }

    if (config.dragSpeed < 50) {
      errors.push('拖拽速度不能少于50毫秒');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 执行拖拽操作
   * @param {Object} config - 拖拽配置
   * @returns {Promise<Object>} 执行结果
   */
  async executeDrag(config) {
    console.log('🖱️ 开始执行拖拽操作:', config);

    try {
      // 验证配置
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
      }

      // 查找目标元素
      const element = await this.findElement(config.locator, config.timeout);
      if (!element) {
        throw new Error(`找不到目标元素: ${config.locator.strategy}=${config.locator.value}`);
      }

      // 滚动到元素位置
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(500);

      // 高亮显示元素
      this.highlightElement(element, 'drag');

      // 执行拖拽操作
      await this.performDragOperation(element, config);

      // 清除高亮
      setTimeout(() => {
        this.clearElementHighlight(element);
      }, 2000);

      console.log('✅ 拖拽操作执行成功');
      return { success: true, message: '拖拽操作完成' };

    } catch (error) {
      console.error('❌ 拖拽操作执行失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 执行具体的拖拽操作
   * @param {HTMLElement} element - 目标元素
   * @param {Object} config - 拖拽配置
   */
  async performDragOperation(element, config) {
    // 获取元素的中心位置
    const rect = element.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    // 计算目标位置
    const endX = startX + config.horizontalDistance;
    const endY = startY + config.verticalDistance;

    console.log(`🖱️ 拖拽路径: (${startX}, ${startY}) -> (${endX}, ${endY})`);

    // 1. 触发 mousedown 事件
    const mouseDownEvent = new MouseEvent('mousedown', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: startX,
      clientY: startY,
      button: 0,
      buttons: 1
    });
    element.dispatchEvent(mouseDownEvent);
    console.log('🖱️ 已触发 mousedown 事件');

    // 等待一小段时间
    await this.sleep(config.dragSpeed);

    // 2. 触发 mousemove 事件（可选：分步移动以模拟真实拖拽）
    const steps = Math.max(Math.abs(config.horizontalDistance), Math.abs(config.verticalDistance)) / 10;
    const stepCount = Math.min(Math.max(steps, 1), 20); // 限制步数在1-20之间

    for (let i = 1; i <= stepCount; i++) {
      const progress = i / stepCount;
      const currentX = startX + (config.horizontalDistance * progress);
      const currentY = startY + (config.verticalDistance * progress);

      const mouseMoveEvent = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: currentX,
        clientY: currentY,
        button: 0,
        buttons: 1
      });

      // 在document上触发mousemove事件
      document.dispatchEvent(mouseMoveEvent);
      
      // 短暂等待以模拟真实拖拽速度
      await this.sleep(config.dragSpeed / stepCount);
    }

    console.log('🖱️ 已完成 mousemove 事件序列');

    // 3. 触发 mouseup 事件
    const mouseUpEvent = new MouseEvent('mouseup', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: endX,
      clientY: endY,
      button: 0,
      buttons: 0
    });
    document.dispatchEvent(mouseUpEvent);
    console.log('🖱️ 已触发 mouseup 事件');

    // 等待拖拽完成
    await this.sleep(config.waitAfterDrag);
  }

  /**
   * 查找元素
   * @param {Object} locator - 定位器配置
   * @param {number} timeout - 超时时间
   * @returns {Promise<HTMLElement>} 找到的元素
   */
  async findElement(locator, timeout = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      let element = null;

      try {
        switch (locator.strategy) {
          case 'css':
            element = document.querySelector(locator.value);
            break;
          case 'xpath':
            const result = document.evaluate(locator.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            element = result.singleNodeValue;
            break;
          case 'id':
            element = document.getElementById(locator.value);
            break;
          case 'className':
            element = document.getElementsByClassName(locator.value)[0];
            break;
          case 'tagName':
            element = document.getElementsByTagName(locator.value)[0];
            break;
          case 'text':
            const textElements = Array.from(document.querySelectorAll('*')).filter(el =>
              el.textContent && el.textContent.trim() === locator.value.trim()
            );
            element = textElements[0];
            break;
          case 'contains':
            const containsElements = Array.from(document.querySelectorAll('*')).filter(el =>
              el.textContent && el.textContent.includes(locator.value)
            );
            element = containsElements[0];
            break;
          default:
            throw new Error(`不支持的定位策略: ${locator.strategy}`);
        }

        if (element) {
          return element;
        }
      } catch (error) {
        console.warn(`查找元素时出错:`, error);
      }

      // 等待一段时间后重试
      await this.sleep(100);
    }

    return null;
  }

  /**
   * 高亮显示元素
   * @param {HTMLElement} element - 要高亮的元素
   * @param {string} type - 高亮类型
   */
  highlightElement(element, type = 'drag') {
    if (!element) return;

    // 移除之前的高亮
    this.clearElementHighlight(element);

    // 添加高亮样式
    element.style.outline = '3px solid #ff6b35';
    element.style.outlineOffset = '2px';
    element.style.backgroundColor = 'rgba(255, 107, 53, 0.1)';
    element.setAttribute('data-automation-highlight', type);
  }

  /**
   * 清除元素高亮
   * @param {HTMLElement} element - 要清除高亮的元素
   */
  clearElementHighlight(element) {
    if (!element) return;

    element.style.outline = '';
    element.style.outlineOffset = '';
    element.style.backgroundColor = '';
    element.removeAttribute('data-automation-highlight');
  }

  /**
   * 等待指定时间
   * @param {number} ms - 等待时间（毫秒）
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DragOperation;
} else {
  window.DragOperation = DragOperation;
}

console.log('✅ 拖拽操作模块已加载');
