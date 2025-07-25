/**
 * 拖拽操作配置界面模块
 * 负责生成拖拽操作的配置表单和事件处理
 */

class DragConfigUI {
  constructor() {
    this.locatorStrategies = [
      { value: 'css', text: 'CSS选择器', example: '.button, #submit' },
      { value: 'xpath', text: 'XPath路径', example: '//button[@class="submit"]' },
      { value: 'id', text: 'ID属性', example: 'submit-button' },
      { value: 'className', text: 'Class名称', example: 'btn-primary' },
      { value: 'tagName', text: '标签名称', example: 'button' },
      { value: 'text', text: '精确文本', example: '提交' },
      { value: 'contains', text: '包含文本', example: '确认' }
    ];
  }

  /**
   * 生成拖拽操作配置表单
   * @param {Object} config - 当前配置
   * @returns {string} HTML表单字符串
   */
  generateDragForm(config) {
    const locator = config.locator || { strategy: 'css', value: '' };
    
    return `
      <!-- 元素定位配置 -->
      <div class="form-group">
        <label class="form-label">元素定位策略</label>
        <select id="locatorType" class="form-control form-input">
          ${this.locatorStrategies.map(strategy => 
            `<option value="${strategy.value}" ${locator.strategy === strategy.value ? 'selected' : ''}>
              ${strategy.text}
            </option>`
          ).join('')}
        </select>
        <div class="form-help">选择用于定位目标元素的策略</div>
      </div>

      <div class="form-group">
        <label class="form-label">定位表达式</label>
        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="text" id="locatorValue" class="form-control form-input" 
                 value="${locator.value}" placeholder="输入定位表达式">
        </div>
        <button type="button" class="test-locator-btn" 
                  style="padding: 5px 10px; background: #27ae60; color: white; border: none; border-radius: 3px; cursor: pointer;">
            🔍 测试
          </button>
        <div class="form-help" id="locatorHelp">
          ${this.getLocatorHelp(locator.strategy)}
        </div>
      </div>

      <!-- 拖拽距离配置 -->
      <div class="form-group">
        <label class="form-label">水平移动距离（像素）</label>
        <input type="number" id="horizontalDistance" class="form-control form-input" 
               value="${config.horizontalDistance || 0}" 
               min="-2000" max="2000" step="1">
        <div class="form-help">正数向右移动，负数向左移动</div>
      </div>

      <div class="form-group">
        <label class="form-label">垂直移动距离（像素）</label>
        <input type="number" id="verticalDistance" class="form-control form-input" 
               value="${config.verticalDistance || 0}" 
               min="-2000" max="2000" step="1">
        <div class="form-help">正数向下移动，负数向上移动</div>
      </div>

      <!-- 高级配置 -->
      <div class="form-group">
        <label class="form-label">操作超时（毫秒）</label>
        <input type="number" id="dragTimeout" class="form-control form-input" 
               value="${config.timeout || 10000}" 
               min="1000" max="60000" step="1000">
        <div class="form-help">查找元素和执行拖拽的最大等待时间</div>
      </div>

      <div class="form-group">
        <label class="form-label">拖拽速度（毫秒）</label>
        <input type="number" id="dragSpeed" class="form-control form-input" 
               value="${config.dragSpeed || 100}" 
               min="50" max="1000" step="50">
        <div class="form-help">拖拽动作的执行速度，数值越小速度越快</div>
      </div>

      <div class="form-group">
        <label class="form-label">拖拽后等待（毫秒）</label>
        <input type="number" id="waitAfterDrag" class="form-control form-input" 
               value="${config.waitAfterDrag || 1000}" 
               min="0" max="10000" step="100">
        <div class="form-help">拖拽完成后的等待时间</div>
      </div>

      <!-- 预览区域 -->
      <div class="form-group">
        <label class="form-label">拖拽预览</label>
        <div id="dragPreview" style="
          border: 1px solid #ddd; 
          border-radius: 4px; 
          padding: 20px; 
          background: #f9f9f9; 
          text-align: center;
          position: relative;
          height: 120px;
          overflow: hidden;
        ">
          <div id="dragPreviewElement" style="
            width: 20px; 
            height: 20px; 
            background: #ff6b35; 
            border-radius: 50%; 
            position: absolute;
            top: 50px;
            left: 50px;
            transition: all 0.3s ease;
          "></div>
          <div style="color: #666; margin-top: 80px; font-size: 12px;">
            拖拽路径预览（调整距离参数查看效果）
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 获取定位策略的帮助文本
   * @param {string} strategy - 定位策略
   * @returns {string} 帮助文本
   */
  getLocatorHelp(strategy) {
    const strategyInfo = this.locatorStrategies.find(s => s.value === strategy);
    return strategyInfo ? `示例: ${strategyInfo.example}` : '';
  }

  /**
   * 绑定拖拽配置表单事件
   * @param {HTMLElement} cell - 当前节点
   * @param {Object} designerInstance - 设计器实例
   */
  bindDragFormEvents(cell, designerInstance) {
    // 绑定定位策略变化事件
    const locatorType = document.getElementById('locatorType');
    if (locatorType) {
      locatorType.addEventListener('change', () => {
        this.updateLocatorHelp();
        this.updateDragPreview();
      });
    }

    // 绑定距离输入变化事件
    const horizontalDistance = document.getElementById('horizontalDistance');
    const verticalDistance = document.getElementById('verticalDistance');
    
    if (horizontalDistance) {
      horizontalDistance.addEventListener('input', () => {
        this.updateDragPreview();
      });
    }

    if (verticalDistance) {
      verticalDistance.addEventListener('input', () => {
        this.updateDragPreview();
      });
    }

    // 绑定测试按钮事件
    const testBtn = document.querySelector('.test-locator-btn');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        this.testDragLocator(testBtn);
      });
    }

    // 初始化预览
    setTimeout(() => {
      this.updateDragPreview();
    }, 100);
  }

  /**
   * 更新定位器帮助文本
   */
  updateLocatorHelp() {
    const locatorType = document.getElementById('locatorType');
    const helpElement = document.getElementById('locatorHelp');
    
    if (locatorType && helpElement) {
      helpElement.textContent = this.getLocatorHelp(locatorType.value);
    }
  }

  /**
   * 更新拖拽预览
   */
  updateDragPreview() {
    const horizontalDistance = document.getElementById('horizontalDistance');
    const verticalDistance = document.getElementById('verticalDistance');
    const previewElement = document.getElementById('dragPreviewElement');

    if (horizontalDistance && verticalDistance && previewElement) {
      const hDistance = parseInt(horizontalDistance.value) || 0;
      const vDistance = parseInt(verticalDistance.value) || 0;

      // 计算预览位置（缩放到预览区域）
      const scale = 0.5; // 缩放比例
      const baseX = 50; // 起始X位置
      const baseY = 50; // 起始Y位置
      
      const newX = baseX + (hDistance * scale);
      const newY = baseY + (vDistance * scale);

      // 限制在预览区域内
      const maxX = 200; // 预览区域宽度 - 元素宽度
      const maxY = 80;  // 预览区域高度 - 元素高度
      
      const clampedX = Math.max(10, Math.min(newX, maxX));
      const clampedY = Math.max(10, Math.min(newY, maxY));

      previewElement.style.left = clampedX + 'px';
      previewElement.style.top = clampedY + 'px';

      // 添加箭头指示
      this.updatePreviewArrow(baseX, baseY, clampedX, clampedY);
    }
  }

  /**
   * 更新预览箭头
   * @param {number} startX - 起始X坐标
   * @param {number} startY - 起始Y坐标
   * @param {number} endX - 结束X坐标
   * @param {number} endY - 结束Y坐标
   */
  updatePreviewArrow(startX, startY, endX, endY) {
    const previewContainer = document.getElementById('dragPreview');
    if (!previewContainer) return;

    // 移除之前的箭头
    const existingArrow = previewContainer.querySelector('.drag-arrow');
    if (existingArrow) {
      existingArrow.remove();
    }

    // 如果起点和终点相同，不显示箭头
    if (startX === endX && startY === endY) return;

    // 创建SVG箭头
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.className = 'drag-arrow';
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '1';

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', startX + 10); // 元素中心
    line.setAttribute('y1', startY + 10);
    line.setAttribute('x2', endX + 10);
    line.setAttribute('y2', endY + 10);
    line.setAttribute('stroke', '#007bff');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '5,5');

    svg.appendChild(line);
    previewContainer.appendChild(svg);
  }

  /**
   * 测试拖拽定位器
   * @param {HTMLElement} button - 测试按钮
   */
  async testDragLocator(button) {
    const locatorType = document.getElementById('locatorType');
    const locatorValue = document.getElementById('locatorValue');

    if (!locatorType || !locatorValue || !locatorValue.value.trim()) {
      alert('请先选择定位策略并输入定位值');
      return;
    }

    const originalText = button.textContent;
    const originalBg = button.style.background;

    try {
      button.textContent = '🔍 测试中...';
      button.style.background = '#007bff';
      button.disabled = true;

      // 使用全局定位器测试器
      if (window.testLocator) {
        const result = await window.testLocator(locatorType.value, locatorValue.value);
        
        if (result.success) {
          button.textContent = '✅ 找到元素';
          button.style.background = '#28a745';
          setTimeout(() => {
            button.textContent = originalText;
            button.style.background = originalBg;
            button.disabled = false;
          }, 2000);
        } else {
          throw new Error(result.error || '未找到元素');
        }
      } else {
        throw new Error('测试功能不可用');
      }

    } catch (error) {
      console.error('测试定位器失败:', error);
      button.textContent = '❌ 测试失败';
      button.style.background = '#dc3545';
      
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = originalBg;
        button.disabled = false;
      }, 2000);
    }
  }

  /**
   * 保存拖拽配置
   * @param {Object} config - 配置对象
   */
  saveDragConfig(config) {
    // 保存定位器配置
    const locatorType = document.getElementById('locatorType');
    const locatorValue = document.getElementById('locatorValue');
    
    if (locatorType && locatorValue) {
      config.locator = {
        strategy: locatorType.value,
        value: locatorValue.value.trim()
      };
    }

    // 保存拖拽距离
    const horizontalDistance = document.getElementById('horizontalDistance');
    if (horizontalDistance) {
      config.horizontalDistance = parseInt(horizontalDistance.value) || 0;
    }

    const verticalDistance = document.getElementById('verticalDistance');
    if (verticalDistance) {
      config.verticalDistance = parseInt(verticalDistance.value) || 0;
    }

    // 保存高级配置
    const dragTimeout = document.getElementById('dragTimeout');
    if (dragTimeout) {
      config.timeout = parseInt(dragTimeout.value) || 10000;
    }

    const dragSpeed = document.getElementById('dragSpeed');
    if (dragSpeed) {
      config.dragSpeed = parseInt(dragSpeed.value) || 100;
    }

    const waitAfterDrag = document.getElementById('waitAfterDrag');
    if (waitAfterDrag) {
      config.waitAfterDrag = parseInt(waitAfterDrag.value) || 1000;
    }

    console.log('保存拖拽配置:', config);
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DragConfigUI;
} else {
  window.DragConfigUI = DragConfigUI;
}

console.log('✅ 拖拽配置界面模块已加载');
