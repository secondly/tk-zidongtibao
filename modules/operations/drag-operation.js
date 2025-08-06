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
    console.log('🖱️ 开始真实拖拽模拟');

    // 获取元素的精确位置
    const rect = element.getBoundingClientRect();

    // 计算元素中心的绝对坐标
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    // 计算目标位置
    const endX = startX + config.horizontalDistance;
    const endY = startY + config.verticalDistance;

    console.log(`🖱️ 拖拽路径: (${Math.round(startX)}, ${Math.round(startY)}) -> (${Math.round(endX)}, ${Math.round(endY)})`);
    console.log(`🖱️ 拖拽距离: 水平${config.horizontalDistance}px, 垂直${config.verticalDistance}px`);

    // 1. 模拟鼠标按下 - 更真实的事件序列
    console.log('🖱️ 第1步: 模拟鼠标按下');

    // 先触发 mouseenter 和 mouseover
    element.dispatchEvent(new MouseEvent('mouseenter', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: startX,
      clientY: startY
    }));

    element.dispatchEvent(new MouseEvent('mouseover', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: startX,
      clientY: startY
    }));

    // 触发 mousedown 事件
    const mouseDownEvent = new MouseEvent('mousedown', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: startX,
      clientY: startY,
      button: 0,
      buttons: 1,
      detail: 1
    });
    element.dispatchEvent(mouseDownEvent);

    // 触发 dragstart 事件（如果元素支持拖拽）
    if (element.draggable || element.getAttribute('draggable') === 'true') {
      console.log('🖱️ 检测到可拖拽元素，触发 dragstart 事件');
      const dragStartEvent = new DragEvent('dragstart', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: startX,
        clientY: startY
      });
      element.dispatchEvent(dragStartEvent);
    }

    // 等待一小段时间，模拟用户按下鼠标的停顿
    await this.sleep(Math.max(50, config.dragSpeed / 10));

    // 2. 模拟拖拽过程 - 分步移动
    console.log('🖱️ 第2步: 模拟拖拽移动');

    const totalDistance = Math.sqrt(
      Math.pow(config.horizontalDistance, 2) + Math.pow(config.verticalDistance, 2)
    );
    const stepCount = Math.min(Math.max(Math.ceil(totalDistance / 5), 3), 30); // 根据距离调整步数

    console.log(`🖱️ 将分 ${stepCount} 步完成拖拽，总距离: ${Math.round(totalDistance)}px`);

    for (let i = 1; i <= stepCount; i++) {
      const progress = i / stepCount;
      const currentX = startX + (config.horizontalDistance * progress);
      const currentY = startY + (config.verticalDistance * progress);

      // 创建更真实的 mousemove 事件
      const mouseMoveEvent = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: currentX,
        clientY: currentY,
        button: 0,
        buttons: 1,
        movementX: i === 1 ? 0 : (currentX - (startX + (config.horizontalDistance * (i - 1) / stepCount))),
        movementY: i === 1 ? 0 : (currentY - (startY + (config.verticalDistance * (i - 1) / stepCount)))
      });

      // 在document和元素上都触发mousemove事件
      document.dispatchEvent(mouseMoveEvent);
      element.dispatchEvent(mouseMoveEvent);

      // 如果是HTML5拖拽，触发drag事件
      if (element.draggable || element.getAttribute('draggable') === 'true') {
        const dragEvent = new DragEvent('drag', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: currentX,
          clientY: currentY
        });
        element.dispatchEvent(dragEvent);
      }

      // 动态调整等待时间，开始慢，中间快，结束慢
      const speedMultiplier = 1 - Math.abs(0.5 - progress) * 0.5;
      const stepDelay = Math.max(10, (config.dragSpeed / stepCount) * speedMultiplier);
      await this.sleep(stepDelay);
    }

    console.log('🖱️ 第3步: 完成拖拽移动序列');

    // 3. 模拟鼠标松开 - 完整的事件序列
    console.log('🖱️ 第4步: 模拟鼠标松开');

    // 触发最后的 mousemove 到精确位置
    const finalMoveEvent = new MouseEvent('mousemove', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: endX,
      clientY: endY,
      button: 0,
      buttons: 1
    });
    document.dispatchEvent(finalMoveEvent);

    // 等待一小段时间
    await this.sleep(50);

    // 触发 mouseup 事件
    const mouseUpEvent = new MouseEvent('mouseup', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: endX,
      clientY: endY,
      button: 0,
      buttons: 0,
      detail: 1
    });

    // 在document和元素上都触发mouseup
    document.dispatchEvent(mouseUpEvent);
    element.dispatchEvent(mouseUpEvent);

    // 如果是HTML5拖拽，触发dragend事件
    if (element.draggable || element.getAttribute('draggable') === 'true') {
      console.log('🖱️ 触发 dragend 事件');
      const dragEndEvent = new DragEvent('dragend', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: endX,
        clientY: endY
      });
      element.dispatchEvent(dragEndEvent);
    }

    // 触发 click 事件（如果拖拽距离很小）
    const dragDistance = Math.sqrt(
      Math.pow(config.horizontalDistance, 2) + Math.pow(config.verticalDistance, 2)
    );

    if (dragDistance < 5) {
      console.log('🖱️ 拖拽距离很小，触发 click 事件');
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: endX,
        clientY: endY,
        button: 0,
        detail: 1
      });
      element.dispatchEvent(clickEvent);
    }

    console.log('🖱️ 拖拽操作完成，等待页面响应');

    // 等待拖拽完成和页面响应
    await this.sleep(config.waitAfterDrag);

    console.log(`✅ 真实拖拽模拟完成: 移动了${Math.round(dragDistance)}px`);
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
