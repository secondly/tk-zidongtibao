/**
 * 工作流设计器节点管理模块
 * 负责节点创建、删除、配置和属性面板管理
 */

/**
 * 节点管理器
 */
class DesignerNodeManager {
  constructor(designer) {
    this.designer = designer;
    this.graph = designer.graph;
  }

  /**
   * 添加节点到画布
   */
  async addNodeToCanvas(nodeType, x = 100, y = 100, parentContainer = null) {
    const config = this.designer.nodeTypes[nodeType];
    if (!config) return;

    // 对于循环节点，需要特殊处理
    if (nodeType === "loop") {
      const loopType = await this.designer.uiManager.showLoopTypeDialog();
      if (!loopType) return; // 用户取消

      if (loopType === "container") {
        return this.createLoopContainer(x, y);
      } else {
        return this.createLoopNode(loopType, x, y, parentContainer);
      }
    }

    return this.createNode(nodeType, x, y, parentContainer);
  }

  /**
   * 创建普通节点
   */
  createNode(nodeType, x, y, parentContainer = null) {
    const config = this.designer.nodeTypes[nodeType];
    if (!config) return null;

    const parent = parentContainer || this.graph.getDefaultParent();

    // 节点尺寸
    let width = 100;
    let height = 60;

    // 根据节点类型调整尺寸
    if (nodeType === "condition") {
      width = 120;
      height = 80;
    }

    // 创建节点
    const cell = this.graph.insertVertex(
      parent,
      null,
      config.name,
      x,
      y,
      width,
      height,
      nodeType
    );

    // 生成唯一ID
    const nodeId = `${nodeType}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    cell.id = nodeId;

    // 初始化节点配置
    const nodeConfig = {
      id: nodeId,
      type: nodeType,
      name: config.name,
      locator: { strategy: "css", value: "" },
      inputText: "",
      waitTime: 1000,
      timeout: 10000,
      delay: 0,
      x: x,
      y: y,
      width: width,
      height: height,
    };

    // 为不同类型的节点添加特定配置
    switch (nodeType) {
      case "condition":
        nodeConfig.conditionType = "attribute";
        nodeConfig.comparisonType = "equals";
        nodeConfig.expectedValue = "";
        nodeConfig.attributeName = "";
        break;
      case "loop":
        nodeConfig.loopType = "element";
        nodeConfig.maxIterations = 10;
        nodeConfig.elementSelector = "";
        nodeConfig.startIndex = 0;
        nodeConfig.endIndex = -1;
        nodeConfig.operationType = "click";
        nodeConfig.operationDelay = 1000;
        break;
      case "extract":
        nodeConfig.extractType = "text";
        nodeConfig.variableName = "";
        break;
    }

    // 保存节点配置
    this.designer.nodeConfigs.set(nodeId, nodeConfig);
    cell.nodeData = nodeConfig;

    // 更新节点计数
    this.designer.updateNodeCount();

    console.log(`✅ 创建节点: ${nodeType} (${nodeId})`);
    return cell;
  }

  /**
   * 创建循环容器
   */
  createLoopContainer(x, y) {
    const parent = this.graph.getDefaultParent();

    // 创建循环容器（swimlane）
    const container = this.graph.insertVertex(
      parent,
      null,
      "循环操作",
      x,
      y,
      200,
      150,
      "loopContainer"
    );

    // 生成唯一ID
    const containerId = `loop_container_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    container.id = containerId;

    // 初始化容器配置
    const containerConfig = {
      id: containerId,
      type: "loop",
      loopType: "container",
      name: "循环操作",
      locator: { strategy: "css", value: "" },
      maxIterations: 10,
      elementSelector: "",
      subOperations: [],
      x: x,
      y: y,
      width: 200,
      height: 150,
    };

    // 保存配置
    this.designer.nodeConfigs.set(containerId, containerConfig);
    container.nodeData = containerConfig;

    // 更新节点计数
    this.designer.updateNodeCount();

    console.log(`✅ 创建循环容器: ${containerId}`);
    return container;
  }

  /**
   * 创建循环节点
   */
  createLoopNode(loopType, x, y, parentContainer) {
    const nodeConfig = {
      type: "loop",
      loopType: loopType,
      name: loopType === "element" ? "元素循环" : "次数循环",
    };

    return this.createNode("loop", x, y, parentContainer);
  }

  /**
   * 删除节点
   */
  deleteNode(cell) {
    if (!cell || !cell.isVertex()) return;

    try {
      // 如果是循环容器，需要删除所有子节点的配置
      if (this.graph.isSwimlane(cell)) {
        const children = this.graph.getChildVertices(cell);
        children.forEach((child) => {
          if (child.id && this.designer.nodeConfigs.has(child.id)) {
            this.designer.nodeConfigs.delete(child.id);
            console.log(`🗑️ 删除子节点配置: ${child.id}`);
          }
        });
      }

      // 删除节点配置
      if (cell.id && this.designer.nodeConfigs.has(cell.id)) {
        this.designer.nodeConfigs.delete(cell.id);
        console.log(`🗑️ 删除节点配置: ${cell.id}`);
      }

      // 删除图形节点
      this.graph.removeCells([cell]);

      // 清除选择
      if (this.designer.selectedCell === cell) {
        this.designer.selectedCell = null;
        this.designer.uiManager.hidePropertyPanel();
      }

      // 更新节点计数
      this.designer.updateNodeCount();

      console.log(`✅ 删除节点完成`);
    } catch (error) {
      console.error("删除节点失败:", error);
    }
  }

  /**
   * 选择变化处理
   */
  onSelectionChange() {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 1 && this.graph.getModel().isVertex(cells[0])) {
      this.designer.selectedCell = cells[0];
      this.designer.uiManager.showPropertyPanel(cells[0]);
    } else {
      this.designer.selectedCell = null;
      this.designer.uiManager.hidePropertyPanel();
    }
  }

  /**
   * 生成属性表单
   */
  generatePropertyForm(cell, config) {
    const nodeType = config.type || "unknown";
    const nodeConfig = this.designer.nodeTypes[nodeType] || {};

    let formHtml = `
            <div class="form-group">
                <label>节点类型</label>
                <input type="text" value="${
                  nodeConfig.name || nodeType
                }" readonly>
            </div>
            <div class="form-group">
                <label>节点名称</label>
                <input type="text" id="nodeName" value="${
                  config.name || ""
                }" placeholder="输入节点名称">
            </div>
        `;

    // 根据节点类型生成不同的表单
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
      case "condition":
        formHtml += this.generateConditionForm(config);
        break;
      case "loop":
        formHtml += this.generateLoopForm(config);
        break;
      case "extract":
        formHtml += this.generateExtractForm(config);
        break;
      case "checkState":
        formHtml += this.generateCheckStateForm(config);
        break;
    }

    // 通用配置
    formHtml += `
            <div class="form-group">
                <label>超时时间 (毫秒)</label>
                <input type="number" id="timeout" value="${
                  config.timeout || 10000
                }" min="1000" max="60000">
            </div>
            <div class="form-group">
                <label>延迟时间 (毫秒)</label>
                <input type="number" id="delay" value="${
                  config.delay || 0
                }" min="0" max="10000">
            </div>
        `;

    // 操作按钮
    formHtml += `
            <div class="form-actions">
                <button type="button" id="saveNodeConfig" class="btn btn-primary">保存配置</button>
                <button type="button" id="testLocator" class="btn btn-secondary">测试定位</button>
                <button type="button" id="deleteNode" class="btn btn-danger">删除节点</button>
            </div>
        `;

    return formHtml;
  }

  /**
   * 生成点击操作表单
   */
  generateClickForm(config) {
    return `
            <div class="form-group">
                <label>定位策略</label>
                <select id="locatorStrategy">
                    <option value="css" ${
                      config.locator?.strategy === "css" ? "selected" : ""
                    }>CSS选择器</option>
                    <option value="xpath" ${
                      config.locator?.strategy === "xpath" ? "selected" : ""
                    }>XPath</option>
                    <option value="id" ${
                      config.locator?.strategy === "id" ? "selected" : ""
                    }>ID</option>
                    <option value="class" ${
                      config.locator?.strategy === "class" ? "selected" : ""
                    }>Class</option>
                    <option value="text" ${
                      config.locator?.strategy === "text" ? "selected" : ""
                    }>文本内容</option>
                </select>
            </div>
            <div class="form-group">
                <label>定位值</label>
                <input type="text" id="locatorValue" value="${
                  config.locator?.value || ""
                }" placeholder="输入定位值">
            </div>
        `;
  }

  /**
   * 生成输入操作表单
   */
  generateInputForm(config) {
    return `
            <div class="form-group">
                <label>定位策略</label>
                <select id="locatorStrategy">
                    <option value="css" ${
                      config.locator?.strategy === "css" ? "selected" : ""
                    }>CSS选择器</option>
                    <option value="xpath" ${
                      config.locator?.strategy === "xpath" ? "selected" : ""
                    }>XPath</option>
                    <option value="id" ${
                      config.locator?.strategy === "id" ? "selected" : ""
                    }>ID</option>
                    <option value="class" ${
                      config.locator?.strategy === "class" ? "selected" : ""
                    }>Class</option>
                </select>
            </div>
            <div class="form-group">
                <label>定位值</label>
                <input type="text" id="locatorValue" value="${
                  config.locator?.value || ""
                }" placeholder="输入定位值">
            </div>
            <div class="form-group">
                <label>输入文本</label>
                <textarea id="inputText" placeholder="输入要填写的文本">${
                  config.inputText || ""
                }</textarea>
            </div>
        `;
  }

  /**
   * 生成等待操作表单
   */
  generateWaitForm(config) {
    return `
            <div class="form-group">
                <label>等待时间 (毫秒)</label>
                <input type="number" id="waitTime" value="${
                  config.waitTime || 1000
                }" min="100" max="30000">
            </div>
        `;
  }

  /**
   * 生成智能等待表单
   */
  generateSmartWaitForm(config) {
    return `
            <div class="form-group">
                <label>等待类型</label>
                <select id="waitType">
                    <option value="element" ${
                      config.waitType === "element" ? "selected" : ""
                    }>等待元素出现</option>
                    <option value="disappear" ${
                      config.waitType === "disappear" ? "selected" : ""
                    }>等待元素消失</option>
                    <option value="clickable" ${
                      config.waitType === "clickable" ? "selected" : ""
                    }>等待元素可点击</option>
                    <option value="visible" ${
                      config.waitType === "visible" ? "selected" : ""
                    }>等待元素可见</option>
                </select>
            </div>
            <div class="form-group">
                <label>定位策略</label>
                <select id="locatorStrategy">
                    <option value="css" ${
                      config.locator?.strategy === "css" ? "selected" : ""
                    }>CSS选择器</option>
                    <option value="xpath" ${
                      config.locator?.strategy === "xpath" ? "selected" : ""
                    }>XPath</option>
                    <option value="id" ${
                      config.locator?.strategy === "id" ? "selected" : ""
                    }>ID</option>
                    <option value="class" ${
                      config.locator?.strategy === "class" ? "selected" : ""
                    }>Class</option>
                </select>
            </div>
            <div class="form-group">
                <label>定位值</label>
                <input type="text" id="locatorValue" value="${
                  config.locator?.value || ""
                }" placeholder="输入定位值">
            </div>
        `;
  }

  /**
   * 生成条件判断表单
   */
  generateConditionForm(config) {
    return `
            <div class="form-group">
                <label>条件类型</label>
                <select id="conditionType">
                    <option value="element" ${
                      config.conditionType === "element" ? "selected" : ""
                    }>元素存在</option>
                    <option value="attribute" ${
                      config.conditionType === "attribute" ? "selected" : ""
                    }>属性值判断</option>
                    <option value="text" ${
                      config.conditionType === "text" ? "selected" : ""
                    }>文本内容判断</option>
                    <option value="url" ${
                      config.conditionType === "url" ? "selected" : ""
                    }>URL判断</option>
                </select>
            </div>
            <div class="form-group">
                <label>定位策略</label>
                <select id="locatorStrategy">
                    <option value="css" ${
                      config.locator?.strategy === "css" ? "selected" : ""
                    }>CSS选择器</option>
                    <option value="xpath" ${
                      config.locator?.strategy === "xpath" ? "selected" : ""
                    }>XPath</option>
                    <option value="id" ${
                      config.locator?.strategy === "id" ? "selected" : ""
                    }>ID</option>
                    <option value="class" ${
                      config.locator?.strategy === "class" ? "selected" : ""
                    }>Class</option>
                </select>
            </div>
            <div class="form-group">
                <label>定位值</label>
                <input type="text" id="locatorValue" value="${
                  config.locator?.value || ""
                }" placeholder="输入定位值">
            </div>
            <div class="form-group" id="attributeGroup" style="display: ${
              config.conditionType === "attribute" ? "block" : "none"
            }">
                <label>属性名称</label>
                <input type="text" id="attributeName" value="${
                  config.attributeName || ""
                }" placeholder="如: class, id, value">
            </div>
            <div class="form-group">
                <label>比较方式</label>
                <select id="comparisonType">
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
                    <option value="notEquals" ${
                      config.comparisonType === "notEquals" ? "selected" : ""
                    }>不等于</option>
                </select>
            </div>
            <div class="form-group">
                <label>期望值</label>
                <input type="text" id="expectedValue" value="${
                  config.expectedValue || ""
                }" placeholder="输入期望的值">
            </div>
        `;
  }

  /**
   * 生成循环操作表单
   */
  generateLoopForm(config) {
    let formHtml = `
            <div class="form-group">
                <label>循环类型</label>
                <select id="loopType" ${
                  config.loopType === "container" ? "disabled" : ""
                }>
                    <option value="element" ${
                      config.loopType === "element" ? "selected" : ""
                    }>元素循环</option>
                    <option value="count" ${
                      config.loopType === "count" ? "selected" : ""
                    }>次数循环</option>
                    <option value="container" ${
                      config.loopType === "container" ? "selected" : ""
                    }>循环容器</option>
                </select>
            </div>
        `;

    if (config.loopType === "element") {
      formHtml += `
                <div class="form-group">
                    <label>元素选择器</label>
                    <input type="text" id="elementSelector" value="${
                      config.elementSelector || ""
                    }" placeholder="输入元素列表的CSS选择器">
                </div>
            `;
    }

    formHtml += `
            <div class="form-group">
                <label>最大循环次数</label>
                <input type="number" id="maxIterations" value="${
                  config.maxIterations || 10
                }" min="1" max="1000">
            </div>
        `;

    return formHtml;
  }

  /**
   * 生成数据提取表单
   */
  generateExtractForm(config) {
    return `
            <div class="form-group">
                <label>提取类型</label>
                <select id="extractType">
                    <option value="text" ${
                      config.extractType === "text" ? "selected" : ""
                    }>文本内容</option>
                    <option value="attribute" ${
                      config.extractType === "attribute" ? "selected" : ""
                    }>属性值</option>
                    <option value="html" ${
                      config.extractType === "html" ? "selected" : ""
                    }>HTML内容</option>
                </select>
            </div>
            <div class="form-group">
                <label>定位策略</label>
                <select id="locatorStrategy">
                    <option value="css" ${
                      config.locator?.strategy === "css" ? "selected" : ""
                    }>CSS选择器</option>
                    <option value="xpath" ${
                      config.locator?.strategy === "xpath" ? "selected" : ""
                    }>XPath</option>
                    <option value="id" ${
                      config.locator?.strategy === "id" ? "selected" : ""
                    }>ID</option>
                    <option value="class" ${
                      config.locator?.strategy === "class" ? "selected" : ""
                    }>Class</option>
                </select>
            </div>
            <div class="form-group">
                <label>定位值</label>
                <input type="text" id="locatorValue" value="${
                  config.locator?.value || ""
                }" placeholder="输入定位值">
            </div>
            <div class="form-group" id="attributeGroup" style="display: ${
              config.extractType === "attribute" ? "block" : "none"
            }">
                <label>属性名称</label>
                <input type="text" id="attributeName" value="${
                  config.attributeName || ""
                }" placeholder="如: href, src, value">
            </div>
            <div class="form-group">
                <label>变量名称</label>
                <input type="text" id="variableName" value="${
                  config.variableName || ""
                }" placeholder="保存提取结果的变量名">
            </div>
        `;
  }

  /**
   * 生成节点检测表单
   */
  generateCheckStateForm(config) {
    return `
            <div class="form-group">
                <label>检测类型</label>
                <select id="checkType">
                    <option value="exists" ${
                      config.checkType === "exists" ? "selected" : ""
                    }>元素存在</option>
                    <option value="visible" ${
                      config.checkType === "visible" ? "selected" : ""
                    }>元素可见</option>
                    <option value="enabled" ${
                      config.checkType === "enabled" ? "selected" : ""
                    }>元素可用</option>
                    <option value="selected" ${
                      config.checkType === "selected" ? "selected" : ""
                    }>元素选中</option>
                </select>
            </div>
            <div class="form-group">
                <label>定位策略</label>
                <select id="locatorStrategy">
                    <option value="css" ${
                      config.locator?.strategy === "css" ? "selected" : ""
                    }>CSS选择器</option>
                    <option value="xpath" ${
                      config.locator?.strategy === "xpath" ? "selected" : ""
                    }>XPath</option>
                    <option value="id" ${
                      config.locator?.strategy === "id" ? "selected" : ""
                    }>ID</option>
                    <option value="class" ${
                      config.locator?.strategy === "class" ? "selected" : ""
                    }>Class</option>
                </select>
            </div>
            <div class="form-group">
                <label>定位值</label>
                <input type="text" id="locatorValue" value="${
                  config.locator?.value || ""
                }" placeholder="输入定位值">
            </div>
        `;
  }

  /**
   * 绑定属性表单事件
   */
  bindPropertyFormEvents(cell) {
    // 保存配置按钮
    const saveBtn = document.getElementById("saveNodeConfig");
    if (saveBtn) {
      saveBtn.onclick = () => this.saveNodeConfig(cell);
    }

    // 测试定位按钮
    const testBtn = document.getElementById("testLocator");
    if (testBtn) {
      testBtn.onclick = () => this.testLocator(cell);
    }

    // 删除节点按钮
    const deleteBtn = document.getElementById("deleteNode");
    if (deleteBtn) {
      deleteBtn.onclick = () => this.deleteNode(cell);
    }

    // 条件类型变化事件
    const conditionType = document.getElementById("conditionType");
    if (conditionType) {
      conditionType.onchange = () => {
        const attributeGroup = document.getElementById("attributeGroup");
        if (attributeGroup) {
          attributeGroup.style.display =
            conditionType.value === "attribute" ? "block" : "none";
        }
      };
    }

    // 提取类型变化事件
    const extractType = document.getElementById("extractType");
    if (extractType) {
      extractType.onchange = () => {
        const attributeGroup = document.getElementById("attributeGroup");
        if (attributeGroup) {
          attributeGroup.style.display =
            extractType.value === "attribute" ? "block" : "none";
        }
      };
    }
  }

  /**
   * 保存节点配置
   */
  saveNodeConfig(cell) {
    try {
      const config = this.designer.nodeConfigs.get(cell.id) || {};

      // 获取表单数据
      const formData = this.getFormData();

      // 更新配置
      Object.assign(config, formData);

      // 保存到nodeConfigs
      this.designer.nodeConfigs.set(cell.id, config);

      // 同步到cell.nodeData
      cell.nodeData = config;

      // 更新节点显示
      this.updateNodeDisplay(cell, config);

      this.designer.updateStatus("节点配置已保存");
      console.log(`✅ 保存节点配置: ${cell.id}`, config);
    } catch (error) {
      console.error("保存节点配置失败:", error);
      this.designer.updateStatus("保存配置失败: " + error.message);
    }
  }

  /**
   * 获取表单数据
   */
  getFormData() {
    const data = {};

    // 基础字段
    const nodeName = document.getElementById("nodeName");
    if (nodeName) data.name = nodeName.value;

    const timeout = document.getElementById("timeout");
    if (timeout) data.timeout = parseInt(timeout.value) || 10000;

    const delay = document.getElementById("delay");
    if (delay) data.delay = parseInt(delay.value) || 0;

    // 定位器
    const locatorStrategy = document.getElementById("locatorStrategy");
    const locatorValue = document.getElementById("locatorValue");
    if (locatorStrategy && locatorValue) {
      data.locator = {
        strategy: locatorStrategy.value,
        value: locatorValue.value,
      };
    }

    // 特定字段
    const inputText = document.getElementById("inputText");
    if (inputText) data.inputText = inputText.value;

    const waitTime = document.getElementById("waitTime");
    if (waitTime) data.waitTime = parseInt(waitTime.value) || 1000;

    const waitType = document.getElementById("waitType");
    if (waitType) data.waitType = waitType.value;

    // 条件判断相关
    const conditionType = document.getElementById("conditionType");
    if (conditionType) data.conditionType = conditionType.value;

    const comparisonType = document.getElementById("comparisonType");
    if (comparisonType) data.comparisonType = comparisonType.value;

    const expectedValue = document.getElementById("expectedValue");
    if (expectedValue) data.expectedValue = expectedValue.value;

    const attributeName = document.getElementById("attributeName");
    if (attributeName) data.attributeName = attributeName.value;

    // 循环相关
    const loopType = document.getElementById("loopType");
    if (loopType) data.loopType = loopType.value;

    const maxIterations = document.getElementById("maxIterations");
    if (maxIterations) data.maxIterations = parseInt(maxIterations.value) || 10;

    const elementSelector = document.getElementById("elementSelector");
    if (elementSelector) data.elementSelector = elementSelector.value;

    // 提取相关
    const extractType = document.getElementById("extractType");
    if (extractType) data.extractType = extractType.value;

    const variableName = document.getElementById("variableName");
    if (variableName) data.variableName = variableName.value;

    // 检测相关
    const checkType = document.getElementById("checkType");
    if (checkType) data.checkType = checkType.value;

    return data;
  }

  /**
   * 更新节点显示
   */
  updateNodeDisplay(cell, config) {
    // 更新节点标签
    const label =
      config.name || this.designer.nodeTypes[config.type]?.name || config.type;
    this.graph.cellLabelChanged(cell, label);

    // 刷新显示
    this.graph.refresh();
  }

  /**
   * 测试定位器
   */
  async testLocator(cell) {
    const config = this.designer.nodeConfigs.get(cell.id);
    if (!config || !config.locator) {
      this.designer.updateStatus("请先配置定位器");
      return;
    }

    try {
      // 这里可以调用测试工具
      if (typeof testLocator === "function") {
        const result = await testLocator(config.locator);
        this.designer.updateStatus(
          result.success ? "定位测试成功" : "定位测试失败: " + result.error
        );
      } else {
        this.designer.updateStatus("测试功能暂不可用");
      }
    } catch (error) {
      console.error("测试定位器失败:", error);
      this.designer.updateStatus("测试失败: " + error.message);
    }
  }
}

// 导出到全局作用域
if (typeof window !== "undefined") {
  window.DesignerNodeManager = DesignerNodeManager;
}
