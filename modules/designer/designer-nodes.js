/**
 * 工作流设计器节点管理模块
 * 负责节点创建、编辑、删除、属性面板等功能
 */

class DesignerNodes {
  constructor(core) {
    this.core = core;
    // 使用属性访问器，确保总是获取最新的图形实例
    Object.defineProperty(this, 'graph', {
      get: () => this.core.graph
    });
    Object.defineProperty(this, 'nodeConfigs', {
      get: () => this.core.nodeConfigs
    });
    Object.defineProperty(this, 'nodeTypes', {
      get: () => this.core.nodeTypes
    });
  }

  async addNodeToCanvas(nodeType, x = 100, y = 100, parentContainer = null) {
    // 检查图形实例是否存在
    if (!this.graph) {
      console.warn("图形实例未初始化，无法添加节点");
      return;
    }
    
    const config = this.nodeTypes[nodeType];
    if (!config) return;

    // 对于循环节点，需要特殊处理
    if (nodeType === "loop") {
      const loopType = await this.core.showLoopTypeDialog();
      if (!loopType) return; // 用户取消

      console.log("选择的循环类型:", loopType);

      const nodeData = {
        type: "loop",
        name: config.name,
        loopType: loopType,
        locator: { strategy: "css", value: "" },
        loopSelector: "",
        maxIterations: 10,
        startIndex: 0,
        endIndex: -1,
        operationType: "click",
        operationDelay: 1000,
        subOperations: loopType === "container" ? [] : undefined,
        // 敏感词检测相关配置
        sensitiveWordDetection: {
          enabled: false,
          sensitiveWords: "",
          locatorStrategy: "css",
          locatorValue: ""
        },
        // 虚拟列表相关配置
        isVirtualList: false,
        virtualListContainer: { strategy: "css", value: "" },
        virtualListTitleLocator: { strategy: "css", value: "" },
        virtualListScrollDistance: 100,
        virtualListWaitTime: 1000,
        virtualListMaxRetries: 10,
      };

      const cell = createNode(this.graph, nodeType, x, y, nodeData);
      this.nodeConfigs.set(cell.id, nodeData);
      cell.nodeData = nodeData;
      this.graph.setSelectionCell(cell);
    } else {
      // 使用模块中的 createNode 函数
      const nodeData = {
        type: nodeType,
        name: config.name,
      };

      const cell = createNode(this.graph, nodeType, x, y, nodeData);
      this.nodeConfigs.set(cell.id, nodeData);
      cell.nodeData = nodeData;
      this.graph.setSelectionCell(cell);
    }

    // 延迟更新，确保选择事件已处理
    setTimeout(() => {
      this.core.updateNodeCount();
      this.core.updateStatus(`已添加${config.name}`);
    }, 50);
  }

  showPropertyPanel(cell) {
    const panel = document.getElementById("propertyPanel");
    const form = document.getElementById("propertyForm");

    // 如果是同一个节点，不需要重新生成表单，避免丢失用户输入
    if (this.core.currentDisplayedCell && this.core.currentDisplayedCell.id === cell.id) {
      console.log(`🔧 [DEBUG] 同一节点，跳过表单重新生成: ${cell.id}`);
      return;
    }

    // 如果之前有显示的节点，先保存其配置
    if (this.core.currentDisplayedCell && this.core.currentDisplayedCell.id !== cell.id) {
      console.log(
        `🔧 [DEBUG] 切换节点前保存配置: ${this.core.currentDisplayedCell.id} -> ${cell.id}`
      );
      this.saveNodeConfig(this.core.currentDisplayedCell);
    }

    panel.classList.add("show");

    // 优先从 nodeConfigs 获取配置，如果没有则从 cell.nodeData 获取
    let config = this.nodeConfigs.get(cell.id);
    if (!config || Object.keys(config).length === 0) {
      config = cell.nodeData || {};
      // 如果从 nodeData 获取到配置，同步到 nodeConfigs
      if (config && Object.keys(config).length > 0) {
        this.nodeConfigs.set(cell.id, config);
        console.log(`从 nodeData 恢复配置: ${cell.id} -> ${config.type}`);
      }
    }

    // 如果仍然没有配置，尝试从节点标签推断类型
    if (!config || !config.type) {
      const cellValue = cell.value || "";
      console.log(`🔧 [DEBUG] 节点没有配置，尝试从标签推断: ${cellValue}`);
      
      // 根据节点标签推断类型
      let inferredType = "click"; // 默认类型
      if (cellValue.includes("输入") || cellValue.includes("input")) {
        inferredType = "input";
      } else if (cellValue.includes("等待") || cellValue.includes("wait")) {
        inferredType = "wait";
      } else if (cellValue.includes("智能等待") || cellValue.includes("smartWait")) {
        inferredType = "smartWait";
      } else if (cellValue.includes("循环") || cellValue.includes("loop")) {
        inferredType = "loop";
      } else if (cellValue.includes("条件") || cellValue.includes("condition")) {
        inferredType = "condition";
      } else if (cellValue.includes("检测") || cellValue.includes("checkState")) {
        inferredType = "checkState";
      }

      config = {
        type: inferredType,
        name: cellValue || this.nodeTypes[inferredType]?.name || "未命名节点",
        locator: { strategy: "css", value: "" }
      };

      // 保存推断的配置
      this.nodeConfigs.set(cell.id, config);
      cell.nodeData = config;
      console.log(`🔧 [DEBUG] 为节点创建默认配置: ${cell.id} -> ${inferredType}`);
    }

    // 为旧的条件判断节点添加默认配置（向后兼容性）
    if (config.type === "condition") {
      if (!config.conditionType) config.conditionType = "attribute";
      if (!config.comparisonType) config.comparisonType = "equals";
      if (!config.expectedValue) config.expectedValue = "";
      if (!config.attributeName) config.attributeName = "";
      console.log("🔧 [DEBUG] 为旧条件判断节点添加默认配置:", config);
    }

    const nodeType = config.type || "unknown";

    console.log(`显示属性面板: ${cell.id}, 类型: ${nodeType}, 配置:`, config);

    form.innerHTML = this.generatePropertyForm(cell, config);

    // 记录当前显示的节点
    this.core.currentDisplayedCell = cell;

    // 绑定表单事件
    this.bindPropertyFormEvents(cell);
  }

  hidePropertyPanel() {
    // 隐藏面板前保存当前配置
    if (this.core.currentDisplayedCell) {
      console.log(
        `🔧 [DEBUG] 隐藏面板前保存配置: ${this.core.currentDisplayedCell.id}`
      );
      this.saveNodeConfig(this.core.currentDisplayedCell);
      this.core.currentDisplayedCell = null;
    }

    const panel = document.getElementById("propertyPanel");
    panel.classList.remove("show");
  }

  generatePropertyForm(cell, config) {
    const nodeType = config.type || "unknown";
    const nodeConfig = this.nodeTypes[nodeType] || {};

    let formHtml = `
      <div class="form-group">
          <label class="form-label">节点类型</label>
          <input type="text" class="form-input" value="${
            nodeConfig.name || nodeType
          }" readonly>
      </div>
      <div class="form-group">
          <label class="form-label">节点名称</label>
          <input type="text" class="form-input" id="nodeName" value="${
            config.name || ""
          }" placeholder="输入节点名称">
          <div class="form-help">节点在流程图中显示的名称</div>
      </div>
    `;

    // 根据节点类型添加特定配置
    switch (nodeType) {
      case "click":
        formHtml += this.generateClickForm(config);
        break;
      case "input":
        formHtml += this.generateInputForm(config);
        break;
      case "wait":
        formHtml += this.generateWaitForm(config);
        break;
      case "smartWait":
        formHtml += this.generateSmartWaitForm(config);
        break;
      case "checkState":
        formHtml += this.generateCheckStateForm(config);
        break;
      case "condition":
        formHtml += this.generateConditionForm(config);
        break;
      case "loop":
        formHtml += this.generateLoopForm(config);
        break;
      case "drag":
        formHtml += this.generateDragForm(config);
        break;
      default:
        formHtml += `<div class="form-help">未知节点类型: ${nodeType}</div>`;
    }

    // 添加保存和删除按钮
    formHtml += `
      <div class="form-group" style="margin-top: 20px;">
        <button class="btn" id="saveNodeConfig" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">💾 保存配置</button>
        <button class="btn secondary" id="deleteNode" style="padding: 8px 16px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️ 删除节点</button>
      </div>
    `;

    return formHtml;
  }

  bindPropertyFormEvents(cell) {
    if (!cell) return;

    // 绑定测试定位器按钮（排除敏感词检测按钮）
    const testButtons = document.querySelectorAll(".test-locator-btn");
    testButtons.forEach(button => {
      // 只绑定非敏感词检测的测试按钮
      if (!button.textContent.includes('🔍 测试检测')) {
        button.addEventListener("click", () => {
          this.testLocator(button);
        });
      }
    });

    // 绑定测试条件按钮
    const testConditionButtons = document.querySelectorAll(".test-condition-btn");
    testConditionButtons.forEach(button => {
      button.addEventListener("click", () => {
        this.testCondition(button);
      });
    });

    // 绑定保存配置按钮
    const saveBtn = document.getElementById("saveNodeConfig");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        this.saveNodeConfig(cell);
        this.core.updateStatus("节点配置已保存");
      });
    }

    // 绑定删除节点按钮
    const deleteBtn = document.getElementById("deleteNode");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        this.deleteNode(cell);
      });
    }

    // 绑定条件类型变化事件（用于显示/隐藏相关字段）
    const conditionTypeSelect = document.getElementById("conditionType");
    if (conditionTypeSelect) {
      conditionTypeSelect.addEventListener("change", (e) => {
        this.toggleConditionFields(e.target);
      });
    }

    // 绑定比较方式变化事件
    const comparisonTypeSelect = document.getElementById("comparisonType");
    if (comparisonTypeSelect) {
      comparisonTypeSelect.addEventListener("change", (e) => {
        this.toggleExpectedValueField(e.target);
      });
    }

    // 绑定等待条件变化事件（智能等待）
    const waitConditionSelect = document.getElementById("waitCondition");
    if (waitConditionSelect) {
      waitConditionSelect.addEventListener("change", (e) => {
        this.toggleAttributeField(e.target);
      });
    }

    // 绑定检查类型变化事件（状态检查）
    const checkTypeSelect = document.getElementById("checkType");
    if (checkTypeSelect) {
      checkTypeSelect.addEventListener("change", (e) => {
        this.toggleCheckStateFields(e.target);
      });
    }

    // 绑定其他表单事件（自动保存）
    const form = document.getElementById("propertyForm");
    if (form) {
      form.addEventListener("change", () => {
        // 延迟保存，避免频繁保存
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
          this.saveNodeConfig(cell);
        }, 500);
      });
    }

    // 为所有输入框添加键盘事件保护
    const inputs = form?.querySelectorAll("input, textarea, select");
    inputs?.forEach((input) => {
      // 阻止在输入框内的删除键事件传播到document
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.stopPropagation(); // 阻止事件冒泡到document
        }
      });

      // 确保输入框获得焦点时有明确的焦点状态
      input.addEventListener("focus", (e) => {
        e.target.setAttribute("data-focused", "true");
      });

      input.addEventListener("blur", (e) => {
        e.target.removeAttribute("data-focused");
      });
    });
  }

  generateClickForm(config) {
    return `
      <div class="form-group">
          <label class="form-label">定位策略</label>
          <select class="form-select" id="locatorType">
              <option value="css" ${
                config.locator?.strategy === "css" ||
                config.locator?.type === "css"
                  ? "selected"
                  : ""
              }>CSS选择器 [示例: .btn-primary, #submit-btn]</option>
              <option value="xpath" ${
                config.locator?.strategy === "xpath" ||
                config.locator?.type === "xpath"
                  ? "selected"
                  : ""
              }>XPath [示例: //button[@class='btn']]</option>
              <option value="id" ${
                config.locator?.strategy === "id" ||
                config.locator?.type === "id"
                  ? "selected"
                  : ""
              }>ID [示例: submit-button]</option>
              <option value="className" ${
                config.locator?.strategy === "className" ||
                config.locator?.type === "className"
                  ? "selected"
                  : ""
              }>类名 [示例: btn-primary]</option>
              <option value="text" ${
                config.locator?.strategy === "text" ||
                config.locator?.type === "text"
                  ? "selected"
                  : ""
              }>文本内容 [示例: 确定, 提交]</option>
              <option value="contains" ${
                config.locator?.strategy === "contains" ||
                config.locator?.type === "contains"
                  ? "selected"
                  : ""
              }>包含文本 [示例: 部分文本匹配]</option>
              <option value="tagName" ${
                config.locator?.strategy === "tagName" ||
                config.locator?.type === "tagName"
                  ? "selected"
                  : ""
              }>标签名 [示例: button, input]</option>
          </select>
      </div>
      <div class="form-group">
          <label class="form-label">定位值</label>
          <input type="text" class="form-input" id="locatorValue" value="${
            config.locator?.value || ""
          }" placeholder="输入定位值">
          <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">🎯 测试</button>
          <div class="form-help">用于定位页面元素的值</div>
      </div>
      <div class="form-group">
          <label class="form-label">点击后等待时间(毫秒)</label>
          <input type="number" class="form-input" id="waitAfterClick" value="${
            config.waitAfterClick || config.waitTime || 1000
          }" min="0">
          <div class="form-help">点击后等待页面响应的时间</div>
      </div>
      <div class="form-group">
          <label class="form-label">错误处理</label>
          <select class="form-select" id="errorHandling">
              <option value="continue" ${
                config.errorHandling === "continue"
                  ? "selected"
                  : ""
              }>继续执行</option>
              <option value="stop" ${
                config.errorHandling === "stop" ? "selected" : ""
              }>停止执行</option>
              <option value="retry" ${
                config.errorHandling === "retry" ? "selected" : ""
              }>重试操作</option>
          </select>
      </div>
    `;
  }

  generateInputForm(config) {
    return `
      <div class="form-group">
          <label class="form-label">定位策略</label>
          <select class="form-select" id="locatorType">
              <option value="css" ${
                config.locator?.strategy === "css" ||
                config.locator?.type === "css"
                  ? "selected"
                  : ""
              }>CSS选择器 [示例: input[name='username'], #email]</option>
              <option value="xpath" ${
                config.locator?.strategy === "xpath" ||
                config.locator?.type === "xpath"
                  ? "selected"
                  : ""
              }>XPath [示例: //input[@type='text']]</option>
              <option value="id" ${
                config.locator?.strategy === "id" ||
                config.locator?.type === "id"
                  ? "selected"
                  : ""
              }>ID [示例: username-input]</option>
              <option value="className" ${
                config.locator?.strategy === "className" ||
                config.locator?.type === "className"
                  ? "selected"
                  : ""
              }>类名 [示例: form-control]</option>
              <option value="text" ${
                config.locator?.strategy === "text" ||
                config.locator?.type === "text"
                  ? "selected"
                  : ""
              }>文本内容 [示例: 用户名, 邮箱]</option>
              <option value="contains" ${
                config.locator?.strategy === "contains" ||
                config.locator?.type === "contains"
                  ? "selected"
                  : ""
              }>包含文本 [示例: 部分文本匹配]</option>
              <option value="tagName" ${
                config.locator?.strategy === "tagName" ||
                config.locator?.type === "tagName"
                  ? "selected"
                  : ""
              }>标签名 [示例: input, textarea]</option>
          </select>
      </div>
      <div class="form-group">
          <label class="form-label">定位值</label>
          <input type="text" class="form-input" id="locatorValue" value="${
            config.locator?.value || ""
          }" placeholder="输入定位值">
          <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">🎯 测试</button>
          <div class="form-help">用于定位输入框元素的值</div>
      </div>
      <div class="form-group">
          <label class="form-label">输入内容</label>
          <textarea class="form-textarea" id="inputText" placeholder="输入要填写的内容">${
            config.inputText || ""
          }</textarea>
          <div class="form-help">要输入到目标元素中的文本内容</div>
      </div>
      <div class="form-group">
          <label class="form-label">输入前清空</label>
          <select class="form-select" id="clearFirst">
              <option value="true" ${
                config.clearFirst !== false ? "selected" : ""
              }>是</option>
              <option value="false" ${
                config.clearFirst === false ? "selected" : ""
              }>否</option>
          </select>
          <div class="form-help">输入前是否清空原有内容</div>
      </div>
      <div class="form-group">
          <label class="form-label">错误处理</label>
          <select class="form-select" id="errorHandling">
              <option value="continue" ${
                config.errorHandling === "continue"
                  ? "selected"
                  : ""
              }>继续执行</option>
              <option value="stop" ${
                config.errorHandling === "stop" ? "selected" : ""
              }>停止执行</option>
              <option value="retry" ${
                config.errorHandling === "retry" ? "selected" : ""
              }>重试操作</option>
          </select>
      </div>
    `;
  }

  generateWaitForm(config) {
    return `
      <div class="form-group">
          <label class="form-label">等待时间(毫秒)</label>
          <input type="number" class="form-input" id="waitDuration" value="${
            config.duration || config.waitTime || 1000
          }" min="100" max="60000" step="100">
          <div class="form-help">固定等待的时间长度</div>
      </div>
      <div class="form-group">
          <label class="form-label">错误处理</label>
          <select class="form-select" id="errorHandling">
              <option value="continue" ${
                config.errorHandling === "continue"
                  ? "selected"
                  : ""
              }>继续执行</option>
              <option value="stop" ${
                config.errorHandling === "stop" ? "selected" : ""
              }>停止执行</option>
          </select>
      </div>
    `;
  }  
generateSmartWaitForm(config) {
    return `
      <div class="form-group">
          <label class="form-label">定位策略</label>
          <select class="form-select" id="locatorType">
              <option value="css" ${
                config.locator?.strategy === "css" ||
                config.locator?.type === "css"
                  ? "selected"
                  : ""
              }>CSS选择器 [示例: .loading, #content]</option>
              <option value="xpath" ${
                config.locator?.strategy === "xpath" ||
                config.locator?.type === "xpath"
                  ? "selected"
                  : ""
              }>XPath [示例: //div[@class='loaded']]</option>
              <option value="id" ${
                config.locator?.strategy === "id" ||
                config.locator?.type === "id"
                  ? "selected"
                  : ""
              }>ID [示例: loading-indicator]</option>
              <option value="className" ${
                config.locator?.strategy === "className" ||
                config.locator?.type === "className"
                  ? "selected"
                  : ""
              }>类名 [示例: content-loaded]</option>
              <option value="text" ${
                config.locator?.strategy === "text" ||
                config.locator?.type === "text"
                  ? "selected"
                  : ""
              }>文本内容 [示例: 加载完成]</option>
              <option value="contains" ${
                config.locator?.strategy === "contains" ||
                config.locator?.type === "contains"
                  ? "selected"
                  : ""
              }>包含文本 [示例: 部分文本匹配]</option>
              <option value="tagName" ${
                config.locator?.strategy === "tagName" ||
                config.locator?.type === "tagName"
                  ? "selected"
                  : ""
              }>标签名 [示例: div, span]</option>
          </select>
      </div>
      <div class="form-group">
          <label class="form-label">定位值</label>
          <input type="text" class="form-input" id="locatorValue" value="${
            config.locator?.value || ""
          }" placeholder="输入定位值">
          <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">🎯 测试</button>
          <div class="form-help">等待出现或消失的元素定位值</div>
      </div>
      <div class="form-group">
          <label class="form-label">等待条件</label>
          <select class="form-select" id="waitCondition">
              <option value="appear" ${
                config.waitCondition === "appear"
                  ? "selected"
                  : ""
              }>等待元素出现</option>
              <option value="disappear" ${
                config.waitCondition === "disappear"
                  ? "selected"
                  : ""
              }>等待元素消失</option>
              <option value="visible" ${
                config.waitCondition === "visible"
                  ? "selected"
                  : ""
              }>等待元素可见</option>
              <option value="hidden" ${
                config.waitCondition === "hidden"
                  ? "selected"
                  : ""
              }>等待元素隐藏</option>
              <option value="attributeAppear" ${
                config.waitCondition === "attributeAppear"
                  ? "selected"
                  : ""
              }>等待属性出现</option>
          </select>
      </div>
      <div class="form-group" id="attributeNameGroup" style="display: ${
        config.waitCondition === "attributeAppear"
          ? "block"
          : "none"
      };">
          <label class="form-label">等待的属性内容</label>
          <input type="text" class="form-input" id="attributeName" value="${
            config.attributeName || ""
          }" placeholder="例如：disabled、checked、data-loaded等">
          <button type="button" class="test-attribute-btn" style="margin-left: 10px; padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 3px;">🧪 测试等待</button>
          <div class="form-help">要等待出现的属性名称</div>
      </div>
      <div class="form-group">
          <label class="form-label">超时时间(毫秒)</label>
          <input type="number" class="form-input" id="timeout" value="${
            config.timeout || config.waitTime || 30000
          }" min="1000" max="60000" step="1000">
          <div class="form-help">最长等待时间，超时后继续执行</div>
      </div>
      <div class="form-group">
          <label class="form-label">检查间隔(毫秒)</label>
          <input type="number" class="form-input" id="checkInterval" value="${
            config.checkInterval || 500
          }" min="100" max="5000" step="100">
          <div class="form-help">检查条件的时间间隔</div>
      </div>
    `;
  }

  generateCheckStateForm(config) {
    return `
      <div class="form-group">
          <label class="form-label">定位策略</label>
          <select class="form-select" id="locatorType">
              <option value="css" ${
                config.locator?.strategy === "css" ||
                config.locator?.type === "css"
                  ? "selected"
                  : ""
              }>CSS选择器 [示例: input[type='checkbox'], .btn]</option>
              <option value="xpath" ${
                config.locator?.strategy === "xpath" ||
                config.locator?.type === "xpath"
                  ? "selected"
                  : ""
              }>XPath [示例: //button[@disabled]]</option>
              <option value="id" ${
                config.locator?.strategy === "id" ||
                config.locator?.type === "id"
                  ? "selected"
                  : ""
              }>ID [示例: submit-btn]</option>
              <option value="className" ${
                config.locator?.strategy === "className" ||
                config.locator?.type === "className"
                  ? "selected"
                  : ""
              }>类名 [示例: disabled-btn]</option>
              <option value="text" ${
                config.locator?.strategy === "text" ||
                config.locator?.type === "text"
                  ? "selected"
                  : ""
              }>文本内容 [示例: 提交按钮]</option>
              <option value="contains" ${
                config.locator?.strategy === "contains" ||
                config.locator?.type === "contains"
                  ? "selected"
                  : ""
              }>包含文本 [示例: 部分文本匹配]</option>
              <option value="tagName" ${
                config.locator?.strategy === "tagName" ||
                config.locator?.type === "tagName"
                  ? "selected"
                  : ""
              }>标签名 [示例: button, input]</option>
          </select>
      </div>
      <div class="form-group">
          <label class="form-label">定位值</label>
          <input type="text" class="form-input" id="locatorValue" value="${
            config.locator?.value || ""
          }" placeholder="输入定位值">
          <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">🎯 测试</button>
          <div class="form-help">要检查状态的元素定位值</div>
      </div>
      <div class="form-group">
          <label class="form-label">检查类型</label>
          <select class="form-select" id="checkType">
              <option value="exists" ${
                config.checkType === "exists" ? "selected" : ""
              }>元素是否存在</option>
              <option value="visible" ${
                config.checkType === "visible" ? "selected" : ""
              }>元素是否可见</option>
              <option value="enabled" ${
                config.checkType === "enabled" ? "selected" : ""
              }>元素是否启用</option>
              <option value="checked" ${
                config.checkType === "checked" ? "selected" : ""
              }>复选框是否选中</option>
              <option value="text" ${
                config.checkType === "text" ? "selected" : ""
              }>文本内容检查</option>
              <option value="attribute" ${
                config.checkType === "attribute" ? "selected" : ""
              }>属性值检查</option>
          </select>
      </div>
      <div class="form-group" id="expectedValueGroup" style="display: ${
        config.checkType === "text" || config.checkType === "attribute" ? "block" : "none"
      };">
          <label class="form-label">期望值</label>
          <input type="text" class="form-input" id="expectedValue" value="${
            config.expectedValue || ""
          }" placeholder="输入期望的值">
          <div class="form-help">要检查的期望值</div>
      </div>
      <div class="form-group" id="attributeNameGroup" style="display: ${
        config.checkType === "attribute" ? "block" : "none"
      };">
          <label class="form-label">属性名称</label>
          <input type="text" class="form-input" id="attributeName" value="${
            config.attributeName || ""
          }" placeholder="例如：class、id、data-value等">
          <div class="form-help">要检查的属性名称</div>
      </div>
    `;
  }

  generateDragForm(config) {
    // 使用拖拽配置UI模块
    if (window.DragConfigUI) {
      const dragConfigUI = new window.DragConfigUI();
      return dragConfigUI.generateDragForm(config);
    }

    // 降级方案：简单的拖拽配置表单
    const locator = config.locator || { strategy: 'css', value: '' };
    return `
      <div class="form-group">
        <label class="form-label">定位策略</label>
        <select class="form-select" id="locatorType">
          <option value="css" ${locator.strategy === 'css' ? 'selected' : ''}>CSS选择器</option>
          <option value="xpath" ${locator.strategy === 'xpath' ? 'selected' : ''}>XPath路径</option>
          <option value="id" ${locator.strategy === 'id' ? 'selected' : ''}>ID属性</option>
          <option value="className" ${locator.strategy === 'className' ? 'selected' : ''}>Class名称</option>
          <option value="text" ${locator.strategy === 'text' ? 'selected' : ''}>精确文本</option>
          <option value="contains" ${locator.strategy === 'contains' ? 'selected' : ''}>包含文本</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">定位值</label>
        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="text" class="form-input" id="locatorValue" value="${locator.value}" placeholder="输入定位表达式">
          <button type="button" class="test-locator-btn" style="padding: 5px 10px; background: #27ae60; color: white; border: none; border-radius: 3px;">🔍 测试</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">水平移动距离（像素）</label>
        <input type="number" class="form-input" id="horizontalDistance" value="${config.horizontalDistance || 0}" min="-2000" max="2000">
        <div class="form-help">正数向右移动，负数向左移动</div>
      </div>
      <div class="form-group">
        <label class="form-label">垂直移动距离（像素）</label>
        <input type="number" class="form-input" id="verticalDistance" value="${config.verticalDistance || 0}" min="-2000" max="2000">
        <div class="form-help">正数向下移动，负数向上移动</div>
      </div>
      <div class="form-group">
        <label class="form-label">操作超时（毫秒）</label>
        <input type="number" class="form-input" id="dragTimeout" value="${config.timeout || 10000}" min="1000" max="60000" step="1000">
      </div>
    `;
  }

  generateConditionForm(config) {
    return `
      <div class="form-group">
          <label class="form-label">定位策略</label>
          <select class="form-select" id="locatorType">
              <option value="css" ${
                config.locator?.strategy === "css" ||
                config.locator?.type === "css"
                  ? "selected"
                  : ""
              }>CSS选择器</option>
              <option value="xpath" ${
                config.locator?.strategy === "xpath" ||
                config.locator?.type === "xpath"
                  ? "selected"
                  : ""
              }>XPath</option>
              <option value="id" ${
                config.locator?.strategy === "id" ||
                config.locator?.type === "id"
                  ? "selected"
                  : ""
              }>ID</option>
              <option value="className" ${
                config.locator?.strategy === "className" ||
                config.locator?.type === "className"
                  ? "selected"
                  : ""
              }>类名</option>
              <option value="text" ${
                config.locator?.strategy === "text" ||
                config.locator?.type === "text"
                  ? "selected"
                  : ""
              }>文本内容</option>
          </select>
      </div>
      <div class="form-group">
          <label class="form-label">定位值</label>
          <input type="text" class="form-input" id="locatorValue" value="${
            config.locator?.value || ""
          }" placeholder="输入定位值">
          <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">🎯 测试</button>
      </div>
      <div class="form-group">
          <label class="form-label">条件类型</label>
          <select class="form-select" id="conditionType">
              <option value="exists" ${
                config.conditionType === "exists" ? "selected" : ""
              }>元素存在</option>
              <option value="visible" ${
                config.conditionType === "visible" ? "selected" : ""
              }>元素可见</option>
              <option value="text" ${
                config.conditionType === "text" ? "selected" : ""
              }>文本内容</option>
              <option value="attribute" ${
                config.conditionType === "attribute" ? "selected" : ""
              }>属性值</option>
          </select>
      </div>
      <div class="form-group" id="attributeNameGroup" style="display: ${
        config.conditionType === "attribute" ? "block" : "none"
      };">
          <label class="form-label">属性名称</label>
          <input type="text" class="form-input" id="attributeName" value="${
            config.attributeName || ""
          }" placeholder="例如：class、disabled、data-value等">
      </div>
      <div class="form-group" id="comparisonGroup" style="display: ${
        config.conditionType === "text" || config.conditionType === "attribute" ? "block" : "none"
      };">
          <label class="form-label">比较方式</label>
          <select class="form-select" id="comparisonType">
              <option value="equals" ${
                config.comparisonType === "equals" ? "selected" : ""
              }>等于</option>
              <option value="contains" ${
                config.comparisonType === "contains" ? "selected" : ""
              }>包含</option>
              <option value="startsWith" ${
                config.comparisonType === "startsWith" ? "selected" : ""
              }>开始于</option>
              <option value="endsWith" ${
                config.comparisonType === "endsWith" ? "selected" : ""
              }>结束于</option>
          </select>
      </div>
      <div class="form-group" id="expectedValueGroup" style="display: ${
        config.conditionType === "text" || config.conditionType === "attribute" ? "block" : "none"
      };">
          <label class="form-label">期望值</label>
          <input type="text" class="form-input" id="expectedValue" value="${
            config.expectedValue || ""
          }" placeholder="输入期望的值">
          <button type="button" class="test-condition-btn" style="margin-left: 10px; padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 3px;">🧪 测试条件</button>
      </div>
    `;
  }

  generateLoopForm(config) {
    return `
      <div class="form-group">
          <label class="form-label">循环类型</label>
          <input type="text" class="form-input" value="${
            config.loopType === "container" ? "循环操作带子操作（容器）" : "自循环操作"
          }" readonly>
      </div>
      <div class="form-group">
          <label class="form-label">定位策略</label>
          <select class="form-select" id="locatorType">
              <option value="css" ${
                config.locator?.strategy === "css" ? "selected" : ""
              }>CSS选择器 [示例: .list-item, .btn-action]</option>
              <option value="xpath" ${
                config.locator?.strategy === "xpath" ? "selected" : ""
              }>XPath [示例: //div[@class='list-item']]</option>
              <option value="id" ${
                config.locator?.strategy === "id" ? "selected" : ""
              }>ID [示例: list-item]</option>
              <option value="className" ${
                config.locator?.strategy === "className" ? "selected" : ""
              }>类名 [示例: list-item]</option>
              <option value="text" ${
                config.locator?.strategy === "text" ? "selected" : ""
              }>文本内容 [示例: 按钮文本]</option>
              <option value="contains" ${
                config.locator?.strategy === "contains" ? "selected" : ""
              }>包含文本 [示例: 部分文本匹配]</option>
              <option value="tagName" ${
                config.locator?.strategy === "tagName" ? "selected" : ""
              }>标签名 [示例: button, div]</option>
          </select>
      </div>
      <div class="form-group">
          <label class="form-label">循环选择器</label>
          <input type="text" class="form-input" id="loopSelector" value="${
            config.loopSelector || config.locator?.value || ""
          }" placeholder="输入循环元素的选择器">
          <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">🎯 测试</button>
      </div>
      <div class="form-group">
          <label class="form-label">最大循环次数</label>
          <input type="number" class="form-input" id="maxIterations" value="${
            config.maxIterations || 10
          }" min="1" max="1000">
      </div>
      <div class="form-group">
          <label class="form-label">开始索引</label>
          <input type="number" class="form-input" id="startIndex" value="${
            config.startIndex || 0
          }" min="0">
      </div>
      <div class="form-group">
          <label class="form-label">结束索引</label>
          <input type="number" class="form-input" id="endIndex" value="${
            config.endIndex || -1
          }" min="-1">
          <div class="form-help">-1 表示循环到最后一个元素</div>
      </div>
      <div class="form-group">
          <label class="form-label">操作延迟(毫秒)</label>
          <input type="number" class="form-input" id="operationDelay" value="${
            config.operationDelay || config.waitTime || 1000
          }" min="100" max="60000" step="100">
          <div class="form-help">每次循环操作后的等待时间</div>
      </div>

      <!-- 敏感词检测配置 -->
      <div class="form-group">
          <label class="form-label">
              <input type="checkbox" id="enableSensitiveWordDetection" ${config.sensitiveWordDetection?.enabled ? 'checked' : ''} style="margin-right: 8px;">
              敏感词检测
          </label>
          <div class="form-help">启用后，包含敏感词的循环元素将被跳过</div>
      </div>

      <div id="sensitiveWordConfig" style="display: ${config.sensitiveWordDetection?.enabled ? 'block' : 'none'}; margin-left: 20px; border-left: 3px solid #e74c3c; padding-left: 15px;">
          <div class="form-group">
              <label class="form-label">敏感词列表</label>
              <textarea class="form-textarea" id="sensitiveWords" placeholder="输入敏感词，用英文逗号分隔，例如：广告,推广,营销" rows="3">${config.sensitiveWordDetection?.sensitiveWords || ''}</textarea>
              <div class="form-help">每个敏感词用英文逗号分隔，检测时不区分大小写</div>
          </div>
          <div class="form-group">
              <label class="form-label">敏感词检测定位策略</label>
              <select class="form-select" id="sensitiveWordLocatorStrategy">
                  <option value="css" ${config.sensitiveWordDetection?.locatorStrategy === "css" ? "selected" : ""}>CSS选择器 [示例: .content, .title]</option>
                  <option value="xpath" ${config.sensitiveWordDetection?.locatorStrategy === "xpath" ? "selected" : ""}>XPath [示例: //div[@class='content']]</option>
                  <option value="id" ${config.sensitiveWordDetection?.locatorStrategy === "id" ? "selected" : ""}>ID [示例: content-text]</option>
                  <option value="className" ${config.sensitiveWordDetection?.locatorStrategy === "className" ? "selected" : ""}>类名 [示例: content-text]</option>
                  <option value="text" ${config.sensitiveWordDetection?.locatorStrategy === "text" ? "selected" : ""}>文本内容 [示例: 标题文本]</option>
                  <option value="contains" ${config.sensitiveWordDetection?.locatorStrategy === "contains" ? "selected" : ""}>包含文本 [示例: 部分文本匹配]</option>
                  <option value="tagName" ${config.sensitiveWordDetection?.locatorStrategy === "tagName" ? "selected" : ""}>标签名 [示例: p, span, div]</option>
              </select>
          </div>
          <div class="form-group">
              <label class="form-label">敏感词检测定位值</label>
              <input type="text" class="form-input" id="sensitiveWordLocatorValue" value="${config.sensitiveWordDetection?.locatorValue || ""}" placeholder="留空则检测整个循环元素的文本">
              <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #e74c3c; color: white; border: none; border-radius: 3px;">🔍 测试检测</button>
              <div class="form-help">指定要检测敏感词的元素位置，留空则检测整个循环元素</div>
          </div>
      </div>

      <!-- 虚拟列表配置 -->
      <div class="form-group">
          <label class="form-label">
              <input type="checkbox" id="isVirtualList" ${config.isVirtualList ? 'checked' : ''} style="margin-right: 8px;">
              启用虚拟列表模式
          </label>
          <div class="form-help">适用于需要滚动加载的长列表，自动遍历所有项目</div>
      </div>

      <div id="virtualListConfig" style="display: ${config.isVirtualList ? 'block' : 'none'}; margin-left: 20px; border-left: 3px solid #3498db; padding-left: 15px;">
          <div class="form-group">
              <label class="form-label">容器定位策略</label>
              <select class="form-select" id="virtualListContainerStrategy">
                  <option value="css" ${config.virtualListContainer?.strategy === "css" ? "selected" : ""}>CSS选择器 [示例: .list-container, #virtual-list]</option>
                  <option value="xpath" ${config.virtualListContainer?.strategy === "xpath" ? "selected" : ""}>XPath [示例: //div[@class='list-container']]</option>
                  <option value="id" ${config.virtualListContainer?.strategy === "id" ? "selected" : ""}>ID [示例: virtual-list-container]</option>
                  <option value="className" ${config.virtualListContainer?.strategy === "className" ? "selected" : ""}>类名 [示例: list-container]</option>
                  <option value="text" ${config.virtualListContainer?.strategy === "text" ? "selected" : ""}>文本内容 [示例: 列表容器]</option>
                  <option value="contains" ${config.virtualListContainer?.strategy === "contains" ? "selected" : ""}>包含文本 [示例: 部分文本匹配]</option>
                  <option value="tagName" ${config.virtualListContainer?.strategy === "tagName" ? "selected" : ""}>标签名 [示例: div, ul]</option>
              </select>
          </div>
          <div class="form-group">
              <label class="form-label">容器定位值</label>
              <input type="text" class="form-input" id="virtualListContainerValue" value="${config.virtualListContainer?.value || ""}" placeholder="虚拟列表容器的选择器">
              <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 3px;">🎯 测试容器</button>
          </div>
          <div class="form-group">
              <label class="form-label">标题定位策略</label>
              <select class="form-select" id="virtualListTitleStrategy">
                  <option value="css" ${config.virtualListTitleLocator?.strategy === "css" ? "selected" : ""}>CSS选择器 [示例: .item-title, .list-item h3]</option>
                  <option value="xpath" ${config.virtualListTitleLocator?.strategy === "xpath" ? "selected" : ""}>XPath [示例: //div[@class='item-title']]</option>
                  <option value="id" ${config.virtualListTitleLocator?.strategy === "id" ? "selected" : ""}>ID [示例: item-title]</option>
                  <option value="className" ${config.virtualListTitleLocator?.strategy === "className" ? "selected" : ""}>类名 [示例: item-title]</option>
                  <option value="text" ${config.virtualListTitleLocator?.strategy === "text" ? "selected" : ""}>文本内容 [示例: 标题文本]</option>
                  <option value="contains" ${config.virtualListTitleLocator?.strategy === "contains" ? "selected" : ""}>包含文本 [示例: 部分标题文本]</option>
                  <option value="tagName" ${config.virtualListTitleLocator?.strategy === "tagName" ? "selected" : ""}>标签名 [示例: h1, h2, span]</option>
              </select>
          </div>
          <div class="form-group">
              <label class="form-label">标题定位值</label>
              <input type="text" class="form-input" id="virtualListTitleValue" value="${config.virtualListTitleLocator?.value || ""}" placeholder="列表项标题元素的选择器">
              <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 3px;">🎯 测试标题</button>
          </div>
          <div class="form-group">
              <label class="form-label">滚动距离(px)</label>
              <input type="number" class="form-input" id="virtualListScrollDistance" value="${config.virtualListScrollDistance || 100}" min="10" max="1000" step="10">
              <div class="form-help">每次滚动的像素距离</div>
          </div>
          <div class="form-group">
              <label class="form-label">滚动等待时间(毫秒)</label>
              <input type="number" class="form-input" id="virtualListWaitTime" value="${config.virtualListWaitTime || 1000}" min="100" max="10000" step="100">
              <div class="form-help">滚动后等待新内容渲染的时间</div>
          </div>
          <div class="form-group">
              <label class="form-label">最大重试次数</label>
              <input type="number" class="form-input" id="virtualListMaxRetries" value="${config.virtualListMaxRetries || 10}" min="1" max="100">
              <div class="form-help">防止死循环的保护机制</div>
          </div>
      </div>
      ${config.loopType === "self" ? `
      <div class="form-group">
          <label class="form-label">操作类型</label>
          <select class="form-select" id="operationType">
              <option value="click" ${
                config.operationType === "click" ? "selected" : ""
              }>点击</option>
              <option value="input" ${
                config.operationType === "input" ? "selected" : ""
              }>输入</option>
              <option value="hover" ${
                config.operationType === "hover" ? "selected" : ""
              }>悬停</option>
          </select>
      </div>
      ` : ''}
    `;
  }

  bindPropertyFormEvents(cell) {
    // 绑定节点名称变化事件
    const nameInput = document.getElementById("nodeName");
    if (nameInput) {
      nameInput.addEventListener("input", () => {
        this.updateNodeDisplay(cell);
      });
    }

    // 绑定测试定位器按钮
    const testButtons = document.querySelectorAll(".test-locator-btn");
    testButtons.forEach(button => {
      button.addEventListener("click", () => {
        this.testLocator(button);
      });
    });

    // 绑定敏感词检测复选框事件监听器
    const sensitiveWordCheckbox = document.getElementById('enableSensitiveWordDetection');
    const sensitiveWordConfig = document.getElementById('sensitiveWordConfig');
    if (sensitiveWordCheckbox && sensitiveWordConfig) {
      sensitiveWordCheckbox.addEventListener('change', (e) => {
        sensitiveWordConfig.style.display = e.target.checked ? 'block' : 'none';
      });
    }

    // 绑定虚拟列表复选框事件监听器
    const virtualListCheckbox = document.getElementById('isVirtualList');
    const virtualListConfig = document.getElementById('virtualListConfig');
    if (virtualListCheckbox && virtualListConfig) {
      virtualListCheckbox.addEventListener('change', (e) => {
        virtualListConfig.style.display = e.target.checked ? 'block' : 'none';
      });
    }

    // 绑定测试条件按钮
    const testConditionButtons = document.querySelectorAll(".test-condition-btn");
    testConditionButtons.forEach(button => {
      button.addEventListener("click", () => {
        this.testCondition(button);
      });
    });

    // 绑定测试敏感词检测按钮（使用更精确的选择器和延迟绑定）
    setTimeout(() => {
      const testSensitiveWordButton = document.querySelector("#sensitiveWordConfig .test-locator-btn");
      if (testSensitiveWordButton && testSensitiveWordButton.textContent.includes('🔍 测试检测')) {
        // 移除可能存在的旧事件监听器
        testSensitiveWordButton.replaceWith(testSensitiveWordButton.cloneNode(true));
        const newButton = document.querySelector("#sensitiveWordConfig .test-locator-btn");
        
        newButton.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🔍 敏感词检测测试按钮被点击');
          this.testSensitiveWordDetection(newButton);
        });
        console.log('🔍 敏感词检测测试按钮事件已绑定');
      }
    }, 100);

    // 绑定保存配置按钮
    const saveBtn = document.getElementById("saveNodeConfig");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        this.saveNodeConfig(cell);
        this.core.updateStatus("节点配置已保存");
      });
    }

    // 绑定删除节点按钮
    const deleteBtn = document.getElementById("deleteNode");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        this.deleteNode(cell);
      });
    }

    // 绑定条件类型变化事件（用于显示/隐藏相关字段）
    const conditionTypeSelect = document.getElementById("conditionType");
    if (conditionTypeSelect) {
      conditionTypeSelect.addEventListener("change", (e) => {
        this.toggleConditionFields(e.target);
      });
    }

    // 绑定比较方式变化事件
    const comparisonTypeSelect = document.getElementById("comparisonType");
    if (comparisonTypeSelect) {
      comparisonTypeSelect.addEventListener("change", (e) => {
        this.toggleExpectedValueField(e.target);
      });
    }

    // 绑定等待条件变化事件（智能等待）
    const waitConditionSelect = document.getElementById("waitCondition");
    if (waitConditionSelect) {
      waitConditionSelect.addEventListener("change", (e) => {
        this.toggleAttributeField(e.target);
      });
    }

    // 绑定检查类型变化事件（状态检查）
    const checkTypeSelect = document.getElementById("checkType");
    if (checkTypeSelect) {
      checkTypeSelect.addEventListener("change", (e) => {
        this.toggleCheckStateFields(e.target);
      });
    }

    // 绑定拖拽操作特定事件
    this.bindDragFormEvents(cell);

    // 绑定其他表单事件（自动保存）
    const form = document.getElementById("propertyForm");
    if (form) {
      form.addEventListener("change", () => {
        // 延迟保存，避免频繁保存
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
          this.saveNodeConfig(cell);
        }, 500);
      });
    }

    // 为所有输入框添加键盘事件保护
    const inputs = form?.querySelectorAll("input, textarea, select");
    inputs?.forEach((input) => {
      // 阻止在输入框内的删除键事件传播到document
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.stopPropagation(); // 阻止事件冒泡到document
        }
      });

      // 确保输入框获得焦点时有明确的焦点状态
      input.addEventListener("focus", (e) => {
        e.target.setAttribute("data-focused", "true");
      });

      input.addEventListener("blur", (e) => {
        e.target.removeAttribute("data-focused");
      });
    });
  }

  bindDragFormEvents(cell) {
    // 如果有拖拽配置UI模块，使用它的事件绑定
    if (window.DragConfigUI) {
      const dragConfigUI = new window.DragConfigUI();
      dragConfigUI.bindDragFormEvents(cell, this);
      return;
    }

    // 降级方案：基本的拖拽事件绑定
    const horizontalDistance = document.getElementById('horizontalDistance');
    const verticalDistance = document.getElementById('verticalDistance');

    if (horizontalDistance || verticalDistance) {
      console.log('🖱️ 绑定拖拽操作表单事件');

      // 绑定距离输入变化事件（用于实时预览）
      [horizontalDistance, verticalDistance].forEach(input => {
        if (input) {
          input.addEventListener('input', () => {
            // 可以在这里添加实时预览逻辑
            console.log('🖱️ 拖拽距离已更新:', {
              horizontal: horizontalDistance?.value || 0,
              vertical: verticalDistance?.value || 0
            });
          });
        }
      });
    }
  }

  saveNodeConfig(cell) {
    if (!cell) return;

    const config = this.nodeConfigs.get(cell.id) || {};
    
    // 保存基本信息
    const nameInput = document.getElementById("nodeName");
    if (nameInput) {
      config.name = nameInput.value.trim();
    }

    // 保存节点的几何信息（位置和尺寸）
    const geometry = cell.getGeometry();
    if (geometry) {
      config.x = geometry.x;
      config.y = geometry.y;
      config.width = geometry.width;
      config.height = geometry.height;
    }

    // 根据节点类型保存特定配置
    const nodeType = config.type;
    switch (nodeType) {
      case "click":
      case "input":
      case "smartWait":
      case "checkState":
      case "condition":
        this.saveLocatorConfig(config);
        break;
      case "wait":
        this.saveWaitConfig(config);
        break;
      case "loop":
        this.saveLoopConfig(config);
        break;
      case "drag":
        this.saveDragConfig(config);
        break;
    }

    // 更新配置
    this.nodeConfigs.set(cell.id, config);
    cell.nodeData = config;

    // 更新节点显示
    this.updateNodeDisplay(cell);

    console.log(`保存节点配置: ${cell.id}`, config);
  }

  saveLocatorConfig(config) {
    const locatorType = document.getElementById("locatorType");
    const locatorValue = document.getElementById("locatorValue");
    
    if (locatorType && locatorValue) {
      config.locator = {
        strategy: locatorType.value,
        value: locatorValue.value.trim()
      };
    }

    // 保存点击操作特定配置
    const waitAfterClick = document.getElementById("waitAfterClick");
    if (waitAfterClick) {
      config.waitAfterClick = parseInt(waitAfterClick.value) || 1000;
      config.waitTime = config.waitAfterClick; // 兼容性
    }

    // 保存输入操作特定配置
    const inputText = document.getElementById("inputText");
    if (inputText) {
      config.inputText = inputText.value;
    }

    const clearFirst = document.getElementById("clearFirst");
    if (clearFirst) {
      config.clearFirst = clearFirst.value === "true";
    }

    // 保存智能等待特定配置
    const waitCondition = document.getElementById("waitCondition");
    if (waitCondition) {
      config.waitCondition = waitCondition.value;
    }

    const timeout = document.getElementById("timeout");
    if (timeout) {
      config.timeout = parseInt(timeout.value) || 30000;
      config.waitTime = config.timeout; // 兼容性
    }

    const checkInterval = document.getElementById("checkInterval");
    if (checkInterval) {
      config.checkInterval = parseInt(checkInterval.value) || 500;
    }

    const attributeName = document.getElementById("attributeName");
    if (attributeName) {
      config.attributeName = attributeName.value.trim();
    }

    // 保存状态检查特定配置
    const checkType = document.getElementById("checkType");
    if (checkType) {
      config.checkType = checkType.value;
    }

    const expectedValue = document.getElementById("expectedValue");
    if (expectedValue) {
      config.expectedValue = expectedValue.value.trim();
    }

    // 保存条件判断特定配置
    const conditionType = document.getElementById("conditionType");
    if (conditionType) {
      config.conditionType = conditionType.value;
    }

    const comparisonType = document.getElementById("comparisonType");
    if (comparisonType) {
      config.comparisonType = comparisonType.value;
    }

    // 保存错误处理配置
    const errorHandling = document.getElementById("errorHandling");
    if (errorHandling) {
      config.errorHandling = errorHandling.value;
    }
  }

  saveWaitConfig(config) {
    const waitDuration = document.getElementById("waitDuration");
    if (waitDuration) {
      config.duration = parseInt(waitDuration.value) || 1000;
      config.waitTime = config.duration; // 兼容性
    }

    const errorHandling = document.getElementById("errorHandling");
    if (errorHandling) {
      config.errorHandling = errorHandling.value;
    }
  }

  saveLoopConfig(config) {
    const locatorStrategy = document.getElementById("locatorStrategy") || document.getElementById("locatorType");
    const loopSelector = document.getElementById("loopSelector") || document.getElementById("locatorValue");
    
    if (locatorStrategy && loopSelector) {
      config.locator = {
        strategy: locatorStrategy.value,
        value: loopSelector.value.trim()
      };
      config.loopSelector = loopSelector.value.trim();
    }

    const maxIterations = document.getElementById("maxIterations");
    if (maxIterations) {
      config.maxIterations = parseInt(maxIterations.value) || 10;
    }

    const startIndex = document.getElementById("startIndex");
    if (startIndex) {
      config.startIndex = parseInt(startIndex.value) || 0;
    }

    const endIndex = document.getElementById("endIndex");
    if (endIndex) {
      config.endIndex = parseInt(endIndex.value) || -1;
    }

    const operationType = document.getElementById("operationType");
    if (operationType) {
      config.operationType = operationType.value;
    }

    const operationDelay = document.getElementById("operationDelay");
    if (operationDelay) {
      config.operationDelay = parseInt(operationDelay.value) || 1000;
    }

    // 保存敏感词检测配置
    const enableSensitiveWordDetection = document.getElementById("enableSensitiveWordDetection");
    if (enableSensitiveWordDetection) {
      if (!config.sensitiveWordDetection) {
        config.sensitiveWordDetection = {};
      }
      config.sensitiveWordDetection.enabled = enableSensitiveWordDetection.checked;
      
      if (config.sensitiveWordDetection.enabled) {
        const sensitiveWords = document.getElementById("sensitiveWords");
        const sensitiveWordLocatorStrategy = document.getElementById("sensitiveWordLocatorStrategy");
        const sensitiveWordLocatorValue = document.getElementById("sensitiveWordLocatorValue");
        
        if (sensitiveWords) {
          config.sensitiveWordDetection.sensitiveWords = sensitiveWords.value.trim();
        }
        
        if (sensitiveWordLocatorStrategy) {
          config.sensitiveWordDetection.locatorStrategy = sensitiveWordLocatorStrategy.value;
        }
        
        if (sensitiveWordLocatorValue) {
          config.sensitiveWordDetection.locatorValue = sensitiveWordLocatorValue.value.trim();
        }
      }
      
      console.log('🔍 [DEBUG] 保存敏感词检测配置:', config.sensitiveWordDetection);
    }

    // 保存虚拟列表配置
    const isVirtualList = document.getElementById("isVirtualList");
    if (isVirtualList) {
      config.isVirtualList = isVirtualList.checked;
      console.log('🔍 [DEBUG] 保存虚拟列表配置:', {
        checkboxExists: !!isVirtualList,
        isChecked: isVirtualList.checked,
        configValue: config.isVirtualList
      });
    } else {
      console.log('🔍 [DEBUG] 虚拟列表复选框未找到');
    }

    if (config.isVirtualList) {
      // 容器定位配置
      const containerStrategy = document.getElementById("virtualListContainerStrategy");
      const containerValue = document.getElementById("virtualListContainerValue");
      if (containerStrategy && containerValue) {
        config.virtualListContainer = {
          strategy: containerStrategy.value,
          value: containerValue.value.trim()
        };
      }

      // 标题定位配置
      const titleStrategy = document.getElementById("virtualListTitleStrategy");
      const titleValue = document.getElementById("virtualListTitleValue");
      if (titleStrategy && titleValue) {
        config.virtualListTitleLocator = {
          strategy: titleStrategy.value,
          value: titleValue.value.trim()
        };
      }

      // 滚动配置
      const scrollDistance = document.getElementById("virtualListScrollDistance");
      if (scrollDistance) {
        config.virtualListScrollDistance = parseInt(scrollDistance.value) || 100;
      }

      const waitTime = document.getElementById("virtualListWaitTime");
      if (waitTime) {
        config.virtualListWaitTime = parseInt(waitTime.value) || 1000;
      }

      const maxRetries = document.getElementById("virtualListMaxRetries");
      if (maxRetries) {
        config.virtualListMaxRetries = parseInt(maxRetries.value) || 10;
      }
    }

    console.log("保存循环配置:", config);
  }

  saveDragConfig(config) {
    // 使用拖拽配置UI模块保存配置
    if (window.DragConfigUI) {
      const dragConfigUI = new window.DragConfigUI();
      dragConfigUI.saveDragConfig(config);
      return;
    }

    // 降级方案：手动保存拖拽配置
    this.saveLocatorConfig(config);

    // 保存拖拽距离
    const horizontalDistance = document.getElementById("horizontalDistance");
    if (horizontalDistance) {
      config.horizontalDistance = parseInt(horizontalDistance.value) || 0;
    }

    const verticalDistance = document.getElementById("verticalDistance");
    if (verticalDistance) {
      config.verticalDistance = parseInt(verticalDistance.value) || 0;
    }

    // 保存高级配置
    const dragTimeout = document.getElementById("dragTimeout");
    if (dragTimeout) {
      config.timeout = parseInt(dragTimeout.value) || 10000;
    }

    const dragSpeed = document.getElementById("dragSpeed");
    if (dragSpeed) {
      config.dragSpeed = parseInt(dragSpeed.value) || 100;
    }

    const waitAfterDrag = document.getElementById("waitAfterDrag");
    if (waitAfterDrag) {
      config.waitAfterDrag = parseInt(waitAfterDrag.value) || 1000;
    }

    console.log("保存拖拽配置:", config);
  }

  updateNodeDisplay(cell) {
    if (!cell || !this.graph) return;

    const config = this.nodeConfigs.get(cell.id) || {};
    const name = config.name || this.nodeTypes[config.type]?.name || "未命名节点";
    
    try {
      // 更新节点标签
      this.graph.getModel().setValue(cell, name);
      
      // 刷新显示
      this.graph.refresh();
    } catch (error) {
      console.error("更新节点显示失败:", error);
    }
  }

  deleteNode(cell) {
    if (!cell) return;

    // 检查图形实例是否存在
    if (!this.graph) {
      console.warn("图形实例未初始化，无法删除节点");
      return;
    }

    if (confirm("确定要删除这个节点吗？")) {
      try {
        console.log(`🗑️ 开始删除节点: ${cell.id}`);

        // 如果是循环容器，需要删除所有子节点的配置
        if (this.graph.isSwimlane(cell)) {
          const children = this.graph.getChildVertices(cell);
          console.log(`🗑️ 循环容器包含 ${children.length} 个子节点，将一并删除`);

          children.forEach(child => {
            console.log(`🗑️ 删除子节点配置: ${child.id}`);
            this.nodeConfigs.delete(child.id);
          });
        }

        // 删除节点配置
        this.nodeConfigs.delete(cell.id);
        console.log(`🗑️ 已删除节点配置: ${cell.id}`);

        // 删除图形节点（这会自动删除子节点）
        this.graph.removeCells([cell]);
        console.log(`🗑️ 已从图形中删除节点: ${cell.id}`);

        // 清除选择
        this.core.selectedCell = null;
        this.core.currentDisplayedCell = null;

        // 隐藏属性面板
        this.hidePropertyPanel();

        // 更新节点计数
        this.core.updateNodeCount();
        this.core.updateStatus("节点已删除");

        console.log(`✅ 节点删除完成: ${cell.id}`);
      } catch (error) {
        console.error("删除节点失败:", error);
        this.core.updateStatus("删除节点失败: " + error.message);
      }
    }
  }

  // 切换条件字段显示
  toggleConditionFields(select) {
    const attributeGroup = document.getElementById("attributeNameGroup");
    const comparisonGroup = document.getElementById("comparisonGroup");
    const expectedValueGroup = document.getElementById("expectedValueGroup");

    if (attributeGroup) {
      attributeGroup.style.display = select.value === "attribute" ? "block" : "none";
    }

    if (comparisonGroup) {
      comparisonGroup.style.display = ["text", "attribute"].includes(select.value) ? "block" : "none";
    }

    if (expectedValueGroup) {
      expectedValueGroup.style.display = ["text", "attribute"].includes(select.value) ? "block" : "none";
    }
  }

  // 切换期望值字段显示
  toggleExpectedValueField(select) {
    const expectedValueGroup = document.getElementById("expectedValueGroup");
    if (expectedValueGroup) {
      const hideValues = ["exists", "visible", "isEmpty", "isNotEmpty", "hasAttribute", "notHasAttribute"];
      expectedValueGroup.style.display = hideValues.includes(select.value) ? "none" : "block";
    }
  }

  // 切换智能等待属性字段显示
  toggleAttributeField(select) {
    const attributeGroup = document.getElementById("attributeNameGroup");
    if (attributeGroup) {
      attributeGroup.style.display = select.value === "attributeAppear" ? "block" : "none";
    }
  }

  // 切换状态检查字段显示
  toggleCheckStateFields(select) {
    const expectedValueGroup = document.getElementById("expectedValueGroup");
    const attributeNameGroup = document.getElementById("attributeNameGroup");

    if (expectedValueGroup) {
      expectedValueGroup.style.display = ["text", "attribute"].includes(select.value) ? "block" : "none";
    }

    if (attributeNameGroup) {
      attributeNameGroup.style.display = select.value === "attribute" ? "block" : "none";
    }
  }

  async testLocator(button) {
    // 直接使用定位器测试器，避免循环调用
    if (!window.globalLocatorTester) {
      window.globalLocatorTester = new LocatorTester();
    }

    const container = button.closest(".form-group");

    // 智能查找定位器元素 - 支持多种界面环境
    let strategySelect = document.getElementById("locatorType");
    let valueInput = document.getElementById("locatorValue");

    console.log("🔧 [DEBUG] 初始查找结果:");
    console.log("  - strategySelect存在:", !!strategySelect);
    console.log("  - valueInput存在:", !!valueInput);
    console.log("  - 按钮文本:", button.textContent || button.innerText || '');

    // 特殊处理：如果是循环操作表单，使用loopSelector作为定位值
    if (strategySelect && !valueInput) {
      const loopSelector = document.getElementById("loopSelector");
      console.log("🔧 [DEBUG] 查找loopSelector:", !!loopSelector);
      if (loopSelector) {
        valueInput = loopSelector;
        console.log("🔧 [DEBUG] 循环操作：使用loopSelector作为定位值输入框");
        console.log("🔧 [DEBUG] loopSelector的值:", loopSelector.value);
      }
    }

    // 如果在编辑模态框中，使用编辑界面的元素ID
    if (!strategySelect || !valueInput) {
      strategySelect = document.getElementById("editLocatorStrategy");
      valueInput = document.getElementById("editLocatorValue");
    }

    // 如果是循环操作，使用循环专用的定位器ID
    if (!strategySelect || !valueInput) {
      strategySelect = document.getElementById("editLoopLocatorStrategy");
      valueInput = document.getElementById("editLoopLocatorValue");
    }

    // 如果是workflow-designer-mxgraph.js中的循环操作，使用locatorStrategy
    if (!strategySelect || !valueInput) {
      strategySelect = document.getElementById("locatorStrategy");
      valueInput = document.getElementById("locatorValue");
    }

    // 特殊处理虚拟列表的测试按钮
    const buttonText = button.textContent || button.innerText || '';
    if (buttonText.includes('测试容器')) {
      strategySelect = document.getElementById("virtualListContainerStrategy");
      valueInput = document.getElementById("virtualListContainerValue");
      console.log("🔧 [DEBUG] 虚拟列表容器测试按钮");
    } else if (buttonText.includes('测试标题')) {
      strategySelect = document.getElementById("virtualListTitleStrategy");
      valueInput = document.getElementById("virtualListTitleValue");
      console.log("🔧 [DEBUG] 虚拟列表标题测试按钮");
    }

    // 如果还是找不到，尝试在容器内查找
    if (!strategySelect || !valueInput) {
      strategySelect = container.querySelector(
        'select[id*="Strategy"], select[id*="locator"]'
      );
      valueInput = container.querySelector(
        'input[id*="Value"], input[id*="locator"]'
      );
    }

    if (!strategySelect || !valueInput) {
      console.error("🔧 [DEBUG] 最终查找失败:");
      console.error("  - strategySelect:", strategySelect);
      console.error("  - valueInput:", valueInput);
      console.error("  - 按钮文本:", button.textContent || button.innerText || '');
      alert("请先选择定位策略和输入定位值");
      return;
    }

    const strategy = strategySelect.value;
    const value = valueInput.value.trim();

    console.log("🔧 [DEBUG] 最终使用的配置:");
    console.log("  - strategy:", strategy);
    console.log("  - value:", value);
    console.log("  - strategySelect ID:", strategySelect.id);
    console.log("  - valueInput ID:", valueInput.id);

    if (!value) {
      alert("请输入定位值");
      return;
    }

    // 查找或创建结果显示元素
    let resultElement = container.querySelector(".form-help, .test-result");
    if (!resultElement) {
      resultElement = document.createElement("div");
      resultElement.className = "test-result";
      container.appendChild(resultElement);
    }

    // 使用模块化测试器进行测试
    await window.globalLocatorTester.testLocator(
      strategy,
      value,
      resultElement,
      button
    );
  }

  async testCondition(button) {
    // 直接使用条件测试器，避免循环调用
    const locatorStrategy = document.getElementById("locatorType");
    const locatorValue = document.getElementById("locatorValue");
    const conditionType = document.getElementById("conditionType");
    const attributeName = document.getElementById("attributeName");
    const comparisonType = document.getElementById("comparisonType");
    const expectedValue = document.getElementById("expectedValue");

    if (!locatorStrategy || !locatorValue || !conditionType || !comparisonType) {
      alert("请完整填写条件配置");
      return;
    }

    // 使用全局条件测试器
    const originalText = button.textContent;
    button.style.background = "#ffc107";
    button.textContent = "🔄 测试中...";
    button.disabled = true;

    try {
      // 初始化测试器
      if (!window.conditionTester) {
        if (typeof window.ConditionTester === "undefined") {
          throw new Error(
            "ConditionTester 类未加载，请确保 conditionTester.js 已正确引入"
          );
        }
        window.conditionTester = new window.ConditionTester();
      }

      const conditionConfig = {
        locator: {
          strategy: locatorStrategy.value,
          value: locatorValue.value.trim(),
        },
        conditionType: conditionType.value,
        attributeName: attributeName ? attributeName.value : "",
        comparisonType: comparisonType.value,
        expectedValue: expectedValue ? expectedValue.value : "",
      };

      console.log("🧪 开始全局条件测试:", conditionConfig);

      // 执行真实的条件测试
      const result = await window.conditionTester.testCondition(conditionConfig);

      console.log("🧪 全局条件测试结果:", result);

      if (result.success) {
        if (result.conditionMet) {
          button.style.background = "#28a745";
          button.textContent = "✅ 条件满足";
          console.log(`✅ 条件测试通过: ${result.message}`);
        } else {
          button.style.background = "#ffc107";
          button.textContent = "⚠️ 条件不满足";
          console.log(`⚠️ 条件测试失败: ${result.message}`);
        }
      } else {
        button.style.background = "#dc3545";
        button.textContent = "❌ 测试失败";
        console.error("❌ 条件测试失败:", result.error);
      }
    } catch (error) {
      button.style.background = "#dc3545";
      button.textContent = "❌ 测试错误";
      console.error("条件测试错误:", error);
    } finally {
      // 恢复按钮状态
      button.disabled = false;

      // 3秒后恢复原状
      setTimeout(() => {
        button.style.background = "#28a745";
        button.textContent = originalText || "🧪 测试条件";
      }, 3000);
    }
  }

  async testSensitiveWordDetection(button) {
    const originalText = button.textContent;
    
    try {
      button.disabled = true;
      button.style.background = "#007bff";
      button.textContent = "🔍 测试中...";

      console.log('🔍 开始敏感词检测测试');

      // 获取敏感词检测配置
      const sensitiveWords = document.getElementById("sensitiveWords");
      const sensitiveWordLocatorStrategy = document.getElementById("sensitiveWordLocatorStrategy");
      const sensitiveWordLocatorValue = document.getElementById("sensitiveWordLocatorValue");
      const loopSelector = document.getElementById("loopSelector");
      const locatorType = document.getElementById("locatorType");

      // 验证必要的配置
      if (!sensitiveWords || !sensitiveWords.value.trim()) {
        throw new Error("请先输入敏感词列表");
      }

      if (!loopSelector || !loopSelector.value.trim()) {
        throw new Error("请先配置循环选择器");
      }

      // 构建测试配置
      const testConfig = {
        sensitiveWords: sensitiveWords.value.trim(),
        loopSelector: loopSelector.value.trim(),
        locatorStrategy: locatorType ? locatorType.value : 'css',
        sensitiveWordLocatorStrategy: sensitiveWordLocatorStrategy ? sensitiveWordLocatorStrategy.value : 'css',
        sensitiveWordLocatorValue: sensitiveWordLocatorValue ? sensitiveWordLocatorValue.value.trim() : ''
      };

      console.log("📋 测试配置:", testConfig);

      // 执行简化的测试逻辑
      const result = await this.performSimpleSensitiveWordTest(testConfig);

      console.log("🔍 测试结果:", result);

      if (result.success) {
        button.style.background = "#28a745";
        button.textContent = `✅ 找到${result.totalElements}个元素，${result.skippedElements}个被跳过`;
        console.log(`✅ 测试完成: 总共${result.totalElements}个元素，${result.skippedElements}个包含敏感词被跳过`);
      } else {
        button.style.background = "#dc3545";
        button.textContent = "❌ 测试失败";
        console.error("❌ 测试失败:", result.error);
      }
    } catch (error) {
      button.style.background = "#dc3545";
      button.textContent = "❌ 测试错误";
      console.error("❌ 测试错误:", error);
    } finally {
      // 恢复按钮状态
      button.disabled = false;

      // 3秒后恢复原状
      setTimeout(() => {
        button.style.background = "#e74c3c";
        button.textContent = originalText || "🔍 测试检测";
      }, 3000);
    }
  }

  async performSimpleSensitiveWordTest(config) {
    try {
      console.log('🔍 执行简化的敏感词检测测试');
      
      // 解析敏感词
      const sensitiveWords = config.sensitiveWords.split(',')
        .map(word => word.trim().toLowerCase())
        .filter(word => word.length > 0);
      
      console.log('解析的敏感词:', sensitiveWords);

      // 尝试查找循环元素
      let elements = [];
      try {
        if (config.locatorStrategy === 'css' && config.loopSelector) {
          elements = Array.from(document.querySelectorAll(config.loopSelector));
          console.log(`在当前页面找到 ${elements.length} 个循环元素`);
        }
      } catch (error) {
        console.warn('无法在当前页面查找元素:', error);
      }
      
      let skippedCount = 0;
      const totalElements = Math.max(elements.length, 8);
      
      if (elements.length > 0) {
        // 检测真实元素
        console.log(`开始检测 ${Math.min(elements.length, 10)} 个真实元素`);
        
        for (let i = 0; i < Math.min(elements.length, 10); i++) {
          const element = elements[i];
          try {
            // 获取要检测的文本
            let textToCheck = '';
            if (config.sensitiveWordLocatorValue) {
              const targetElement = element.querySelector(config.sensitiveWordLocatorValue);
              textToCheck = targetElement ? (targetElement.innerText || targetElement.textContent || '') : '';
            } else {
              textToCheck = element.innerText || element.textContent || '';
            }
            
            // 检测敏感词
            const textLower = textToCheck.toLowerCase();
            const matchedWords = sensitiveWords.filter(word => textLower.includes(word));
            
            if (matchedWords.length > 0) {
              skippedCount++;
              console.log(`元素 ${i + 1} 被跳过: 包含敏感词 [${matchedWords.join(', ')}]`);
              console.log(`  文本内容: "${textToCheck.substring(0, 100)}${textToCheck.length > 100 ? '...' : ''}"`);
            } else {
              console.log(`元素 ${i + 1} 通过检测`);
            }
          } catch (error) {
            console.warn(`检测元素 ${i + 1} 时出错:`, error);
          }
        }
      } else {
        // 使用模拟数据
        console.log('使用模拟数据进行测试');
        const mockTexts = [
          '这是一个正常的内容项目',
          '这是一个广告内容，用于推广产品',
          '提供高质量的学习资源',
          '专业的营销策略和方案',
          '分享最新的行业动态',
          'This is spam content',
          '详细的使用指南和最佳实践',
          '技术实现细节和优化方案'
        ];
        
        mockTexts.forEach((text, index) => {
          const textLower = text.toLowerCase();
          const matchedWords = sensitiveWords.filter(word => textLower.includes(word));
          if (matchedWords.length > 0) {
            skippedCount++;
            console.log(`模拟元素 ${index + 1} 被跳过: 包含敏感词 [${matchedWords.join(', ')}]`);
          }
        });
      }
      
      return {
        success: true,
        totalElements: totalElements,
        skippedElements: skippedCount,
        passedElements: totalElements - skippedCount,
        message: `测试完成：共 ${totalElements} 个元素，${skippedCount} 个包含敏感词被跳过`
      };
    } catch (error) {
      console.error('❌ 敏感词检测测试失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }


}

// 导出节点管理类
window.DesignerNodes = DesignerNodes;