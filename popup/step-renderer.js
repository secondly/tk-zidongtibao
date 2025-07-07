/**
 * 步骤渲染器模块
 * 负责步骤UI的创建、渲染和事件绑定
 */

class StepRenderer {
  constructor(stepManager, uiManager) {
    this.stepManager = stepManager;
    this.uiManager = uiManager;
    this.stepsContainer = document.getElementById("steps-container");
  }

  /**
   * 创建步骤项HTML模板
   * @param {number} stepIndex - 步骤索引
   * @returns {string} HTML字符串
   */
  createStepItemHTML(stepIndex) {
    return `
      <div class="step-item" data-step-index="${stepIndex}">
        <div class="step-header">
          <span class="step-number">步骤 ${stepIndex + 1}</span>
          <div class="step-actions">
            <button class="duplicate-step" title="复制步骤">📋</button>
            <button class="delete-step" title="删除步骤">×</button>
          </div>
        </div>
        <div class="step-content">
          <div class="step-row">
            <div class="form-group compact locator-group">
              <label>定位方式:</label>
              <select class="locator-strategy">
                <option value="id">ID选择器</option>
                <option value="class">Class选择器</option>
                <option value="css">CSS选择器</option>
                <option value="jspath">JS路径</option>
                <option value="xpath">XPath表达式</option>
                <option value="text">精确文本</option>
                <option value="contains">包含文本</option>
                <option value="outerhtml">外部HTML</option>
                <option value="all">所有匹配元素</option>
              </select>
            </div>
            <div class="form-group compact locator-group">
              <label>定位值:</label>
              <input type="text" class="locator-value" placeholder="输入选择器值...">
            </div>
            <div class="form-group compact">
              <label>操作:</label>
              <select class="action-type">
                <option value="click">点击元素</option>
                <option value="input">输入文本</option>
                <option value="waitfor">等待元素出现</option>
                <option value="loop">循环操作</option>
                <option value="wait">等待时间</option>
              </select>
            </div>
            <div class="form-group compact input-text-container" style="display: none;">
              <label>输入内容:</label>
              <input type="text" class="input-text-value" placeholder="要输入的文本...">
            </div>
            <div class="form-group compact wait-time-container" style="display: none;">
              <label>等待毫秒数:</label>
              <input type="number" class="wait-time-value" min="1" max="60" value="3" placeholder="等待毫秒数...">
            </div>
            <div class="form-group compact test-button-container">
              <button class="button test-button" title="测试元素">测试</button>
            </div>
          </div>
          <div class="loop-container" style="display: none;">
            <div class="loop-header">
              <span>循环后执行以下步骤:</span>
              <button class="add-loop-step" title="添加循环内步骤">+ 添加循环步骤</button>
            </div>
            <div class="loop-execution-range">
              <div class="form-group compact">
                <label>起始索引:</label>
                <input type="number" class="loop-start-index" min="0" value="0" placeholder="起始索引..." title="从第几个元素开始执行（0表示第一个元素）">
              </div>
              <div class="form-group compact">
                <label>结束索引:</label>
                <input type="number" class="loop-end-index" min="-1" value="-1" placeholder="结束索引..." title="执行到第几个元素（-1表示执行到最后一个）">
              </div>
              <div class="form-group">
                <label>跳过索引:</label>
                <input type="text" class="loop-skip-indices" placeholder="如: 2,5,8..." title="需要跳过的元素索引，用逗号分隔">
              </div>
            </div>
            <div class="loop-steps">
              <!-- 循环内的步骤将在这里 -->
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 创建循环内步骤HTML模板
   * @param {number} stepIndex - 主步骤索引
   * @param {number} loopStepIndex - 循环内步骤索引
   * @returns {string} HTML字符串
   */
  createLoopStepHTML(stepIndex, loopStepIndex) {
    return `
      <div class="loop-step-item" data-loop-step-index="${loopStepIndex}">
        <div class="loop-step-header">
          <span class="loop-step-number">循环步骤 ${loopStepIndex + 1}</span>
          <button class="delete-loop-step" title="删除循环步骤">×</button>
        </div>
        <div class="loop-step-content">
          <div class="step-row">
            <div class="form-group compact">
              <label>定位方式:</label>
              <select class="loop-locator-strategy">
                <option value="id">ID选择器</option>
                <option value="class">Class选择器</option>
                <option value="css">CSS选择器</option>
                <option value="jspath">JS路径</option>
                <option value="xpath">XPath表达式</option>
                <option value="text">精确文本</option>
                <option value="contains">包含文本</option>
                <option value="outerhtml">外部HTML</option>
              </select>
            </div>
            <div class="form-group compact">
              <label>定位值:</label>
              <input type="text" class="loop-locator-value" placeholder="输入选择器值...">
            </div>
            <div class="form-group compact">
              <label>操作:</label>
              <select class="loop-action-type">
                <option value="click">点击元素</option>
                <option value="input">输入文本</option>
                <option value="waitfor">等待元素出现</option>
                <option value="wait">等待时间</option>
              </select>
            </div>
            <div class="form-group compact loop-input-text-container" style="display: none;">
              <label>输入内容:</label>
              <input type="text" class="loop-input-text-value" placeholder="要输入的文本...">
            </div>
            <div class="form-group compact loop-test-button-container">
              <button class="test-button loop-test-button" title="测试元素">测试</button>
            </div>
            <div class="form-group compact loop-wait-time-container" style="display: none;">
              <label>等待毫秒数:</label>
              <input type="number" class="loop-wait-time-value" min="1" max="60" value="3" placeholder="等待毫秒数...">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染单个步骤
   * @param {number} stepIndex - 步骤索引
   */
  renderStep(stepIndex) {
    const step = this.stepManager.getSteps()[stepIndex];
    if (!step) return;

    const stepHTML = this.createStepItemHTML(stepIndex);
    const stepContainer = document.createElement("div");
    stepContainer.innerHTML = stepHTML;
    const stepElement = stepContainer.firstElementChild;
    
    this.stepsContainer.appendChild(stepElement);
    this.populateStepData(stepElement, step, stepIndex);
    this.bindStepEvents(stepElement, stepIndex);

    // 如果是outerHTML策略，应用特殊样式
    if (step.locator.strategy === "outerhtml") {
      this.uiManager.eventHandler.adjustInputForStrategy(stepElement, "outerhtml");
    }
  }

  /**
   * 渲染循环步骤
   * @param {number} stepIndex - 主步骤索引
   * @param {number} loopStepIndex - 循环步骤索引
   */
  renderLoopStep(stepIndex, loopStepIndex) {
    const steps = this.stepManager.getSteps();
    const loopStep = steps[stepIndex]?.loopSteps?.[loopStepIndex];
    if (!loopStep) return;

    const stepItem = this.stepsContainer.querySelector(
      `.step-item[data-step-index="${stepIndex}"]`
    );
    if (!stepItem) return;

    const loopStepsContainer = stepItem.querySelector(".loop-steps");
    const loopStepHTML = this.createLoopStepHTML(stepIndex, loopStepIndex);
    const loopStepContainer = document.createElement("div");
    loopStepContainer.innerHTML = loopStepHTML;
    const loopStepElement = loopStepContainer.firstElementChild;
    
    loopStepsContainer.appendChild(loopStepElement);
    this.populateLoopStepData(loopStepElement, loopStep);
    this.bindLoopStepEvents(loopStepElement, stepIndex, loopStepIndex);

    // 如果是outerHTML策略，应用特殊样式
    if (loopStep.locator.strategy === "outerhtml") {
      this.uiManager.eventHandler.adjustLoopInputForStrategy(loopStepElement, "outerhtml");
    }
  }

  /**
   * 填充步骤数据到UI元素
   * @param {HTMLElement} stepElement - 步骤DOM元素
   * @param {object} step - 步骤数据
   * @param {number} stepIndex - 步骤索引
   */
  populateStepData(stepElement, step, stepIndex) {
    // 设置操作类型
    stepElement.querySelector(".action-type").value = step.action || "click";

    // 只有需要定位的操作才设置定位策略和值
    if (step.action !== "wait" && step.action !== "loop") {
      stepElement.querySelector(".locator-strategy").value = step.locator.strategy || "id";
      stepElement.querySelector(".locator-value").value = step.locator.value || "";
    }

    // 根据操作类型显示相应的容器
    this.updateStepVisibility(stepElement, step);
    
    // 设置具体的值
    if (step.action === "input") {
      stepElement.querySelector(".input-text-value").value = step.inputText || "";
    } else if (step.action === "wait") {
      stepElement.querySelector(".wait-time-value").value = step.waitTime || 30000;
    } else if (step.action === "loop") {
      this.populateLoopData(stepElement, step);
    }
  }

  /**
   * 填充循环数据
   * @param {HTMLElement} stepElement - 步骤DOM元素
   * @param {object} step - 步骤数据
   */
  populateLoopData(stepElement, step) {
    stepElement.querySelector(".loop-start-index").value = step.startIndex !== undefined ? step.startIndex : 0;
    stepElement.querySelector(".loop-end-index").value = step.endIndex !== undefined ? step.endIndex : -1;
    
    if (step.skipIndices && Array.isArray(step.skipIndices) && step.skipIndices.length > 0) {
      stepElement.querySelector(".loop-skip-indices").value = step.skipIndices.join(",");
    }
  }

  /**
   * 填充循环步骤数据到UI元素
   * @param {HTMLElement} loopStepElement - 循环步骤DOM元素
   * @param {object} loopStep - 循环步骤数据
   */
  populateLoopStepData(loopStepElement, loopStep) {
    loopStepElement.querySelector(".loop-locator-strategy").value = loopStep.locator.strategy || "id";
    loopStepElement.querySelector(".loop-locator-value").value = loopStep.locator.value || "";
    loopStepElement.querySelector(".loop-action-type").value = loopStep.action || "click";
    
    this.updateLoopStepVisibility(loopStepElement, loopStep);
    
    if (loopStep.action === "input") {
      loopStepElement.querySelector(".loop-input-text-value").value = loopStep.inputText || "";
    } else if (loopStep.action === "wait") {
      loopStepElement.querySelector(".loop-wait-time-value").value = loopStep.waitTime || 30000;
    }
  }

  /**
   * 更新步骤容器的可见性
   * @param {HTMLElement} stepElement - 步骤DOM元素
   * @param {object} step - 步骤数据
   */
  updateStepVisibility(stepElement, step) {
    const inputTextContainer = stepElement.querySelector(".input-text-container");
    const loopContainer = stepElement.querySelector(".loop-container");
    const waitTimeContainer = stepElement.querySelector(".wait-time-container");
    const testButtonContainer = stepElement.querySelector(".test-button-container");
    const locatorGroups = stepElement.querySelectorAll(".locator-group");

    // 隐藏所有容器
    inputTextContainer.style.display = "none";
    loopContainer.style.display = "none";
    waitTimeContainer.style.display = "none";

    // 根据操作类型显示相应容器和定位字段
    switch (step.action) {
      case "input":
        inputTextContainer.style.display = "block";
        locatorGroups.forEach(group => group.style.display = "block");
        testButtonContainer.style.display = "block";
        break;
      case "waitfor":
        waitTimeContainer.style.display = "block";
        locatorGroups.forEach(group => group.style.display = "block");
        testButtonContainer.style.display = "block";
        break;
      case "loop":
        loopContainer.style.display = "block";
        locatorGroups.forEach(group => group.style.display = "none");
        testButtonContainer.style.display = "none";
        break;
      case "wait":
        waitTimeContainer.style.display = "block";
        locatorGroups.forEach(group => group.style.display = "none");
        testButtonContainer.style.display = "none";
        break;
      default:
        // 其他操作（点击等）显示定位字段和测试按钮
        locatorGroups.forEach(group => group.style.display = "block");
        testButtonContainer.style.display = "block";
        break;
    }
  }

  /**
   * 更新循环步骤容器的可见性
   * @param {HTMLElement} loopStepElement - 循环步骤DOM元素
   * @param {object} loopStep - 循环步骤数据
   */
  updateLoopStepVisibility(loopStepElement, loopStep) {
    const loopInputContainer = loopStepElement.querySelector(".loop-input-text-container");
    const loopWaitContainer = loopStepElement.querySelector(".loop-wait-time-container");
    const loopTestButtonContainer = loopStepElement.querySelector(".loop-test-button-container");

    loopInputContainer.style.display = "none";
    loopWaitContainer.style.display = "none";

    switch (loopStep.action) {
      case "input":
        loopInputContainer.style.display = "block";
        loopTestButtonContainer.style.display = "block";
        break;
      case "waitfor":
        loopWaitContainer.style.display = "block";
        loopTestButtonContainer.style.display = "block";
        break;
      case "wait":
        loopWaitContainer.style.display = "block";
        loopTestButtonContainer.style.display = "none";
        break;
      default:
        // 其他操作（点击等）显示测试按钮
        loopTestButtonContainer.style.display = "block";
        break;
    }
  }

  /**
   * 刷新所有步骤UI
   */
  refreshStepsUI() {
    this.stepsContainer.innerHTML = "";
    const steps = this.stepManager.getSteps();
    
    steps.forEach((step, index) => {
      this.renderStep(index);
      
      // 渲染循环步骤
      if (step.action === "loop" && step.loopSteps) {
        step.loopSteps.forEach((loopStep, loopIndex) => {
          this.renderLoopStep(index, loopIndex);
        });
      }
    });
  }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
  window.StepRenderer = StepRenderer;
}
