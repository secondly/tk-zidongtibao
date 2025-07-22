/**
 * 基于mxGraph的工作流设计器 - 模块化版本
 * 支持循环操作带子操作、文本自动换行等功能
 *
 * 依赖的模块文件（通过HTML script标签加载）：
 * - utils/mxGraphConfig.js - mxGraph配置和节点样式
 * - utils/mxGraphOperations.js - 图形操作功能
 * - utils/workflowConverter.js - 工作流转换功能
 * - modules/designer/designer-core.js - 核心功能
 * - modules/designer/designer-nodes.js - 节点管理
 * - modules/designer/designer-workflow.js - 工作流管理
 */

// 注意：这个文件不使用ES6模块导入，避免CORS问题
// 所有功能都通过模块化类组合实现，确保在Chrome扩展环境中正常工作

class MxGraphWorkflowDesigner {
  constructor() {
    console.log("🔧 开始初始化 MxGraphWorkflowDesigner");

    // 检查依赖
    console.log("🔍 检查依赖:", {
      DesignerCore: typeof DesignerCore,
      DesignerNodes: typeof DesignerNodes,
      DesignerWorkflow: typeof DesignerWorkflow,
      DesignerUIManager: typeof DesignerUIManager,
      nodeTypes: typeof nodeTypes
    });

    // 初始化核心模块
    console.log("🔧 初始化核心模块");
    this.core = new DesignerCore();

    // 初始化节点管理模块
    console.log("🔧 初始化节点管理模块");
    this.nodes = new DesignerNodes(this.core);

    // 初始化工作流管理模块
    console.log("🔧 初始化工作流管理模块");
    this.workflow = new DesignerWorkflow(this.core);

    // 初始化UI管理模块
    console.log("🔧 初始化UI管理模块");
    this.ui = new DesignerUIManager(this);

    // 设置模块间的引用
    console.log("🔧 设置模块间引用");
    this.setupModuleReferences();

    // 代理核心属性到主类
    console.log("🔧 设置属性代理");
    this.setupPropertyProxies();

    console.log("✅ MxGraphWorkflowDesigner 构造完成");

    // 验证模块状态
    console.log("🔍 模块状态验证:", {
      core: !!this.core,
      nodes: !!this.nodes,
      workflow: !!this.workflow,
      coreGraph: !!this.core.graph,
      windowRefs: {
        designerNodes: !!window.designerNodes,
        designerWorkflow: !!window.designerWorkflow,
        workflowDesigner: !!window.workflowDesigner
      }
    });
  }

  setupModuleReferences() {
    // 设置核心模块对其他模块的引用
    window.designerNodes = this.nodes;
    window.designerWorkflow = this.workflow;

    // 设置全局引用，供其他脚本使用
    window.workflowDesigner = this;

    console.log("✅ 模块间引用设置完成");
  }

  setupPropertyProxies() {
    // 代理核心属性，保持向后兼容性
    Object.defineProperty(this, 'graph', {
      get: () => this.core.graph,
      set: (value) => { this.core.graph = value; }
    });

    Object.defineProperty(this, 'nodeConfigs', {
      get: () => this.core.nodeConfigs,
      set: (value) => { this.core.nodeConfigs = value; }
    });

    Object.defineProperty(this, 'selectedCell', {
      get: () => this.core.selectedCell,
      set: (value) => { this.core.selectedCell = value; }
    });

    Object.defineProperty(this, 'currentDisplayedCell', {
      get: () => this.core.currentDisplayedCell,
      set: (value) => { this.core.currentDisplayedCell = value; }
    });

    Object.defineProperty(this, 'executionState', {
      get: () => this.core.executionState,
      set: (value) => { this.core.executionState = value; }
    });

    Object.defineProperty(this, 'nodeTypes', {
      get: () => this.core.nodeTypes,
      set: (value) => { this.core.nodeTypes = value; }
    });

    Object.defineProperty(this, 'editMode', {
      get: () => this.core.editMode,
      set: (value) => { this.core.editMode = value; }
    });

    Object.defineProperty(this, 'originalWorkflow', {
      get: () => this.core.originalWorkflow,
      set: (value) => { this.core.originalWorkflow = value; }
    });
  }

  // 初始化方法 - 代理到核心模块
  async init() {
    try {
      console.log("🚀 开始初始化工作流设计器");

      // 初始化核心模块
      await this.core.init();

      console.log("✅ 工作流设计器初始化完成");

      // 验证初始化后的状态
      console.log("🔍 初始化后状态验证:", {
        coreGraph: !!this.core.graph,
        nodeConfigs: !!this.core.nodeConfigs,
        selectedCell: this.core.selectedCell,
        graphContainer: !!document.getElementById("graphContainer")
      });

      return true;
    } catch (error) {
      console.error("❌ 工作流设计器初始化失败:", error);

      // 显示错误信息到页面
      const container = document.getElementById("graphContainer");
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; padding: 50px; color: #e74c3c;">
            <h3>初始化失败</h3>
            <p>${error.message}</p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              请检查浏览器控制台获取详细错误信息
            </p>
          </div>
        `;
      }

      throw error;
    }
  }

  // 核心功能方法代理
  updateStatus(message) {
    return this.core.updateStatus(message);
  }

  updateNodeCount() {
    return this.core.updateNodeCount();
  }

  clearCanvas() {
    return this.core.clearCanvas();
  }

  onSelectionChange() {
    return this.core.onSelectionChange();
  }

  showLoopTypeDialog() {
    return this.core.showLoopTypeDialog();
  }

  // 节点管理方法代理
  async addNodeToCanvas(nodeType, x, y, parentContainer) {
    return await this.nodes.addNodeToCanvas(nodeType, x, y, parentContainer);
  }

  showPropertyPanel(cell) {
    return this.nodes.showPropertyPanel(cell);
  }

  hidePropertyPanel() {
    return this.nodes.hidePropertyPanel();
  }

  generatePropertyForm(cell, config) {
    return this.nodes.generatePropertyForm(cell, config);
  }

  bindPropertyFormEvents(cell) {
    return this.nodes.bindPropertyFormEvents(cell);
  }

  saveNodeConfig(cell) {
    return this.nodes.saveNodeConfig(cell);
  }

  updateNodeDisplay(cell) {
    return this.nodes.updateNodeDisplay(cell);
  }

  deleteNode(cell) {
    return this.nodes.deleteNode(cell);
  }

  async testLocator(button) {
    return await this.nodes.testLocator(button);
  }

  async testCondition(button) {
    return await this.nodes.testCondition(button);
  }

  toggleAttributeField(selectElement) {
    return this.nodes.toggleAttributeField(selectElement);
  }

  // 工作流管理方法代理
  exportWorkflowData() {
    return this.workflow.exportWorkflowData();
  }

  importWorkflowData(data) {
    return this.workflow.importWorkflowData(data);
  }

  async saveWorkflowWithDialog() {
    return await this.workflow.saveWorkflowWithDialog();
  }

  saveWorkflow() {
    return this.workflow.saveWorkflow();
  }

  loadWorkflow() {
    return this.workflow.loadWorkflow();
  }

  loadWorkflowFromFile() {
    return this.workflow.loadWorkflowFromFile();
  }

  exportData() {
    return this.workflow.exportData();
  }

  loadWorkflowFromStorage() {
    return this.workflow.loadWorkflowFromStorage();
  }

  saveWorkflowToStorage() {
    return this.workflow.saveWorkflowToStorage();
  }

  updateExecutionStatus(text, progress) {
    return this.workflow.updateExecutionStatus(text, progress);
  }

  updateExecutionUI() {
    return this.workflow.updateExecutionUI();
  }

  resumeWorkflow() {
    return this.workflow.resumeWorkflow();
  }

  stopWorkflow() {
    return this.workflow.stopWorkflow();
  }

  // 向后兼容性方法
  waitForMxGraph() {
    return this.core.waitForMxGraph();
  }

  initMxGraph() {
    return this.core.initMxGraph();
  }

  setupStyles() {
    return this.core.setupStyles();
  }

  initEventListeners() {
    return this.core.initEventListeners();
  }

  setupResizeListener() {
    return this.core.setupResizeListener();
  }

  setupMouseWheelZoom() {
    return this.core.setupMouseWheelZoom();
  }

  setupContextMenu() {
    return this.core.setupContextMenu();
  }

  validateConnection(source, target) {
    return this.core.validateConnection(source, target);
  }

  scaleSelection(factor) {
    return this.core.scaleSelection(factor);
  }

  // 导出数据回退方法
  exportDataFallback() {
    return this.workflow.exportDataFallback();
  }
}

// 全局函数：测试条件 - 使用真实页面测试
async function testCondition(button) {
  // 如果有工作流设计器实例，使用其方法
  if (
    window.workflowDesigner &&
    typeof window.workflowDesigner.testCondition === "function"
  ) {
    await window.workflowDesigner.testCondition(button);
    return;
  }

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

// 全局函数：测试定位器 - 使用模块化测试器
async function testLocator(button) {
  // 如果有工作流设计器实例，使用其方法
  if (
    window.workflowDesigner &&
    typeof window.workflowDesigner.testLocator === "function"
  ) {
    await window.workflowDesigner.testLocator(button);
    return;
  }

  // 使用全局定位器测试器
  if (!window.globalLocatorTester) {
    window.globalLocatorTester = new LocatorTester();
  }

  const container = button.closest(".form-group");

  // 智能查找定位器元素 - 支持多种界面环境
  let strategySelect = document.getElementById("locatorType");
  let valueInput = document.getElementById("locatorValue");

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
    alert("请先选择定位策略和输入定位值");
    return;
  }

  const strategy = strategySelect.value;
  const value = valueInput.value.trim();

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

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", async () => {
  // 确保mxGraph库已加载
  if (typeof mxGraph !== "undefined") {
    console.log("mxGraph库已加载，开始初始化模块化工作流设计器");
    window.workflowDesigner = new MxGraphWorkflowDesigner();
    await window.workflowDesigner.init();
  } else {
    console.log("等待mxGraph库加载...");
    // 如果mxGraph还没加载，等待一下再试
    const checkMxGraph = async () => {
      if (typeof mxGraph !== "undefined") {
        console.log("mxGraph库加载完成，初始化模块化工作流设计器");
        window.workflowDesigner = new MxGraphWorkflowDesigner();
        await window.workflowDesigner.init();
      } else {
        console.log("mxGraph库仍在加载中，继续等待...");
        setTimeout(checkMxGraph, 100);
      }
    };
    setTimeout(checkMxGraph, 100);
  }
});