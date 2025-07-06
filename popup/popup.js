document.addEventListener("DOMContentLoaded", function () {
  // 初始化变量
  const stepsContainer = document.getElementById("steps-container");
  const addStepButton = document.getElementById("addStep");
  const clearStepsButton = document.getElementById("clearSteps");
  const startButton = document.getElementById("startAction");
  const stopButton = document.getElementById("stopAction");
  const statusElement = document.getElementById("status");
  const debugInfoElement = document.getElementById("debugInfo");
  const operationLogElement = document.getElementById("operationLog");
  const clearLogButton = document.getElementById("clearLog");

  // 导出/导入按钮
  const exportConfigButton = document.getElementById("exportConfig");
  const importConfigButton = document.getElementById("importConfig");
  const importFileInput = document.getElementById("importFileInput");

  // 存储所有步骤配置
  let steps = [];

  // 添加步骤按钮事件
  addStepButton.addEventListener("click", function () {
    addStep();
    saveSteps(); // 保存步骤配置
  });

  // 清除所有步骤按钮事件
  clearStepsButton.addEventListener("click", function () {
    clearSteps();
  });

  // 执行操作按钮事件
  startButton.addEventListener("click", function () {
    executeSteps();
  });

  // 停止操作按钮事件
  stopButton.addEventListener("click", function () {
    stopExecution();
  });

  // 清除日志按钮事件
  clearLogButton.addEventListener("click", function () {
    clearLog();
  });

  // 导出配置按钮事件
  exportConfigButton.addEventListener("click", function () {
    exportConfig();
  });

  // 导入配置按钮事件
  importConfigButton.addEventListener("click", function () {
    importFileInput.click();
  });

  // 文件选择事件
  importFileInput.addEventListener("change", function (event) {
    importConfig(event);
  });

  // 加载保存的步骤
  loadSteps();

  // 监听来自背景脚本的消息
  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    sendResponse
  ) {
    if (request.action === "executionProgress") {
      // 更新执行进度
      updateProgress(request);
    } else if (request.action === "executionResult") {
      // 处理执行结果
      handleExecutionResult(request.result);
    } else if (request.action === "executionStarted") {
      // 处理执行开始
      startButton.disabled = true;
      stopButton.disabled = false;
      addLogEntry("开始执行自动化操作", "info");
    } else if (request.action === "executionStopped") {
      // 处理执行停止
      startButton.disabled = false;
      stopButton.disabled = true;
      setStatus("自动化操作已停止", "success");
      addLogEntry("自动化操作已停止", "info");
    }
  });

  /**
   * 更新执行进度
   * @param {object} progressData - 进度数据
   */
  function updateProgress(progressData) {
    let message = "";

    if (progressData.currentStep !== undefined) {
      message = `正在执行步骤 ${progressData.currentStep + 1}: ${
        progressData.message || ""
      }`;
    } else {
      message = progressData.message || "正在执行...";
    }

    // 为loading状态添加动态指示器
    setStatus(message, "loading");

    // 添加带动画的日志条目
    if (progressData.retry) {
      addLogEntry(message, "warning"); // 重试操作使用警告样式
    } else {
      addLogEntry(message, "info", true); // 添加动态指示器
    }
  }

  /**
   * 处理执行结果
   * @param {object} result - 执行结果
   */
  function handleExecutionResult(result) {
    startButton.disabled = false;
    stopButton.disabled = true;

    if (result.success) {
      const message = "所有操作成功完成！";
      setStatus(message, "success");
      addLogEntry(message, "success");
    } else if (result.currentStep !== undefined) {
      const message = `执行步骤 ${result.currentStep + 1} 时出错: ${
        result.error || "未知错误"
      }`;
      setStatus(message, "error");
      addLogEntry(message, "error");
    } else {
      const message = "操作失败: " + (result.error || "未知错误");
      setStatus(message, "error");
      addLogEntry(message, "error");
    }
  }

  /**
   * 导出配置到JSON文件
   */
  function exportConfig() {
    try {
      if (steps.length === 0) {
        addLogEntry("没有可导出的配置", "error");
        return;
      }

      // 创建配置对象，包含元数据
      const config = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        steps: steps,
      };

      // 转换为JSON
      const jsonString = JSON.stringify(config, null, 2);

      // 检查文件大小
      const sizeInKB = new Blob([jsonString]).size / 1024;
      if (sizeInKB > 5000) {
        // 5MB限制
        addLogEntry(
          `配置文件过大 (${sizeInKB.toFixed(2)}KB)，请减少步骤数量`,
          "error"
        );
        return;
      }

      // 创建下载链接
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `automation-config-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();

      // 清理
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      addLogEntry("配置已成功导出", "success");
    } catch (error) {
      console.error("导出配置出错:", error);
      addLogEntry(`导出配置失败: ${error.message}`, "error");
    }
  }

  /**
   * 从JSON文件导入配置
   */
  function importConfig(event) {
    try {
      const file = event.target.files[0];
      if (!file) return;

      // 检查文件类型
      if (file.type !== "application/json" && !file.name.endsWith(".json")) {
        addLogEntry("请选择正确的JSON文件", "error");
        importFileInput.value = "";
        return;
      }

      // 检查文件大小
      if (file.size > 5 * 1024 * 1024) {
        // 5MB限制
        addLogEntry(
          `文件过大，最大支持5MB，当前文件大小: ${(
            file.size /
            1024 /
            1024
          ).toFixed(2)}MB`,
          "error"
        );
        importFileInput.value = "";
        return;
      }

      addLogEntry("正在读取配置文件...", "info");
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const config = JSON.parse(e.target.result);

          // 验证导入的数据
          if (!config.steps || !Array.isArray(config.steps)) {
            throw new Error("无效的配置文件格式");
          }

          if (config.steps.length === 0) {
            throw new Error("配置文件不包含任何步骤");
          }

          // 更新steps数组
          steps = config.steps;

          // 刷新UI
          refreshStepsUI();

          // 保存到本地存储
          saveSteps();

          setStatus("配置已成功导入", "success");
          addLogEntry(`已导入配置，包含 ${steps.length} 个步骤`, "success");
        } catch (parseError) {
          setStatus("导入配置失败", "error");
          addLogEntry(`导入配置失败: ${parseError.message}`, "error");
          console.error("解析JSON时出错:", parseError);
        }

        // 重置文件输入，以允许重新选择同一文件
        importFileInput.value = "";
      };

      reader.onerror = function (readError) {
        addLogEntry(
          `读取文件时出错: ${readError.message || "未知错误"}`,
          "error"
        );
        importFileInput.value = "";
        console.error("读取文件时出错:", readError);
      };

      reader.readAsText(file);
    } catch (error) {
      addLogEntry(`导入过程出错: ${error.message}`, "error");
      importFileInput.value = "";
      console.error("导入过程出错:", error);
    }
  }

  /**
   * 步骤项HTML模板函数
   * @param {number} stepIndex - 步骤索引
   * @returns {string} - HTML字符串
   */
  function createStepItemHTML(stepIndex) {
    return `
      <div class="step-item" data-step-index="${stepIndex}">
        <div class="step-header">
          <span class="step-number">步骤 ${stepIndex + 1}</span>
          <button class="delete-step" title="删除步骤">×</button>
        </div>
        <div class="step-content">
          <div class="step-row">
            <div class="form-group compact">
              <label>定位方式:</label>
              <select class="locator-strategy">
                <option value="id">ID选择器</option>
                <option value="class">Class选择器</option>
                <option value="css">CSS选择器</option>
                <option value="xpath">XPath表达式</option>
                <option value="text">精确文本</option>
                <option value="contains">包含文本</option>
                <option value="all">所有匹配元素</option>
              </select>
            </div>
            <div class="form-group compact">
              <label>定位值:</label>
              <input type="text" class="locator-value" placeholder="输入选择器值...">
            </div>
            <div class="form-group compact">
              <label>操作:</label>
              <select class="action-type">
                <option value="click">点击元素</option>
                <option value="input">输入文本</option>
                <option value="loop">循环操作</option>
                <option value="wait">等待时间</option>
              </select>
            </div>
            <div class="form-group compact">
              <button class="button test-button" title="测试元素">测试</button>
            </div>
            <div class="form-group compact input-text-container" style="display: none;">
              <label>输入内容:</label>
              <input type="text" class="input-text-value" placeholder="要输入的文本...">
            </div>
            <div class="form-group compact wait-time-container" style="display: none;">
              <label>等待秒数:</label>
              <input type="number" class="wait-time-value" min="1" max="60" value="3" placeholder="等待秒数...">
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
   * 循环内步骤HTML模板
   * @param {number} stepIndex - 主步骤索引
   * @param {number} loopStepIndex - 循环内步骤索引
   * @returns {string} - HTML字符串
   */
  function createLoopStepHTML(stepIndex, loopStepIndex) {
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
                <option value="xpath">XPath表达式</option>
                <option value="text">精确文本</option>
                <option value="contains">包含文本</option>
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
                <option value="wait">等待时间</option>
              </select>
            </div>
            <div class="form-group compact">
              <button class="test-button loop-test-button" title="测试元素">测试</button>
            </div>
            <div class="form-group compact loop-input-text-container" style="display: none;">
              <label>输入内容:</label>
              <input type="text" class="loop-input-text-value" placeholder="要输入的文本...">
            </div>
            <div class="form-group compact loop-wait-time-container" style="display: none;">
              <label>等待秒数:</label>
              <input type="number" class="loop-wait-time-value" min="1" max="60" value="3" placeholder="等待秒数...">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 添加一个步骤的函数
  function addStep() {
    const stepIndex = steps.length;
    steps.push({
      locator: {
        strategy: "id",
        value: "",
      },
      action: "click",
      inputText: "",
      waitTime: 3, // 默认等待3秒
      loopSteps: [], // 用于存储循环内的子步骤
      startIndex: 0, // 循环起始索引，默认为0
      endIndex: -1, // 循环结束索引，默认为-1（执行到最后）
      skipIndices: [], // 需要跳过的索引数组
    });

    // 创建步骤DOM元素
    const stepHTML = createStepItemHTML(stepIndex);
    const stepContainer = document.createElement("div");
    stepContainer.innerHTML = stepHTML;
    stepsContainer.appendChild(stepContainer.firstElementChild);

    // 绑定事件
    bindStepEvents(stepIndex);

    // 记录添加步骤的日志
    addLogEntry(`添加了步骤 ${stepIndex + 1}`, "info");
  }

  // 添加循环内步骤的函数
  function addLoopStep(stepIndex) {
    if (!steps[stepIndex].loopSteps) {
      steps[stepIndex].loopSteps = [];
    }

    const loopStepIndex = steps[stepIndex].loopSteps.length;
    steps[stepIndex].loopSteps.push({
      locator: {
        strategy: "id",
        value: "",
      },
      action: "click",
      inputText: "",
      waitTime: 3, // 默认等待3秒
    });

    // 创建循环步骤DOM元素
    const loopStepHTML = createLoopStepHTML(stepIndex, loopStepIndex);
    const stepItem = document.querySelector(
      `.step-item[data-step-index="${stepIndex}"]`
    );
    const loopStepsContainer = stepItem.querySelector(".loop-steps");

    const loopStepContainer = document.createElement("div");
    loopStepContainer.innerHTML = loopStepHTML;
    loopStepsContainer.appendChild(loopStepContainer.firstElementChild);

    // 绑定循环步骤事件
    bindLoopStepEvents(stepIndex, loopStepIndex);

    saveSteps(); // 保存步骤配置

    // 记录添加循环步骤的日志
    addLogEntry(
      `在步骤 ${stepIndex + 1} 中添加了循环步骤 ${loopStepIndex + 1}`,
      "info"
    );
  }

  // 绑定步骤项的事件
  function bindStepEvents(stepIndex) {
    const stepItem = document.querySelector(
      `.step-item[data-step-index="${stepIndex}"]`
    );

    // 删除按钮事件
    stepItem
      .querySelector(".delete-step")
      .addEventListener("click", function () {
        removeStep(stepIndex);
      });

    // 定位策略变更事件
    stepItem
      .querySelector(".locator-strategy")
      .addEventListener("change", function (e) {
        steps[stepIndex].locator.strategy = e.target.value;
        saveSteps(); // 保存步骤配置
      });

    // 定位值变更事件
    stepItem
      .querySelector(".locator-value")
      .addEventListener("input", function (e) {
        steps[stepIndex].locator.value = e.target.value;
        saveSteps(); // 保存步骤配置
      });

    // 测试按钮事件
    stepItem
      .querySelector(".test-button")
      .addEventListener("click", function () {
        testElementLocator(stepIndex);
      });

    // 操作类型变更事件
    const actionTypeSelect = stepItem.querySelector(".action-type");
    const inputTextContainer = stepItem.querySelector(".input-text-container");
    const loopContainer = stepItem.querySelector(".loop-container");
    const waitTimeContainer = stepItem.querySelector(".wait-time-container");
    const waitTimeValue = stepItem.querySelector(".wait-time-value");

    actionTypeSelect.addEventListener("change", function (e) {
      const actionType = e.target.value;
      steps[stepIndex].action = actionType;

      // 显示或隐藏相应的输入容器
      if (actionType === "input") {
        inputTextContainer.style.display = "block";
        loopContainer.style.display = "none";
        waitTimeContainer.style.display = "none";
      } else if (actionType === "loop") {
        inputTextContainer.style.display = "none";
        loopContainer.style.display = "block";
        waitTimeContainer.style.display = "none";

        // 如果是首次选择循环操作，添加"添加循环步骤"按钮的事件监听
        const addLoopStepButton = stepItem.querySelector(".add-loop-step");
        if (!addLoopStepButton.hasAttribute("data-initialized")) {
          addLoopStepButton.setAttribute("data-initialized", "true");
          addLoopStepButton.addEventListener("click", function () {
            addLoopStep(stepIndex);
          });
        }

        // 绑定循环范围控制事件
        bindLoopRangeEvents(stepIndex, stepItem);
      } else if (actionType === "wait") {
        inputTextContainer.style.display = "none";
        loopContainer.style.display = "none";
        waitTimeContainer.style.display = "block";
      } else {
        inputTextContainer.style.display = "none";
        loopContainer.style.display = "none";
        waitTimeContainer.style.display = "none";
      }

      saveSteps(); // 保存步骤配置
    });

    // 输入文本值变更事件
    stepItem
      .querySelector(".input-text-value")
      .addEventListener("input", function (e) {
        steps[stepIndex].inputText = e.target.value;
        saveSteps(); // 保存步骤配置
      });

    // 等待时间值变更事件
    stepItem
      .querySelector(".wait-time-value")
      .addEventListener("input", function (e) {
        steps[stepIndex].waitTime = parseInt(e.target.value, 10) || 3;
        saveSteps(); // 保存步骤配置
      });

    // 如果当前步骤是循环操作，绑定循环范围控制事件
    if (steps[stepIndex].action === "loop") {
      bindLoopRangeEvents(stepIndex, stepItem);
    }
  }

  // 绑定循环范围控制的事件
  function bindLoopRangeEvents(stepIndex, stepItem) {
    // 起始索引变更事件
    stepItem
      .querySelector(".loop-start-index")
      .addEventListener("input", function (e) {
        const value = parseInt(e.target.value, 10);
        // 确保值有效（大于或等于0）
        steps[stepIndex].startIndex = isNaN(value) || value < 0 ? 0 : value;
        saveSteps(); // 保存步骤配置
      });

    // 结束索引变更事件
    stepItem
      .querySelector(".loop-end-index")
      .addEventListener("input", function (e) {
        const value = parseInt(e.target.value, 10);
        // -1表示执行到最后，或者必须大于等于起始索引
        steps[stepIndex].endIndex = isNaN(value) ? -1 : value;
        saveSteps(); // 保存步骤配置
      });

    // 跳过索引变更事件
    stepItem
      .querySelector(".loop-skip-indices")
      .addEventListener("input", function (e) {
        try {
          // 解析逗号分隔的索引列表
          const input = e.target.value.trim();

          if (input === "") {
            steps[stepIndex].skipIndices = [];
          } else {
            // 分割、转换为数字并过滤无效值
            const indices = input
              .split(",")
              .map((idx) => parseInt(idx.trim(), 10))
              .filter((idx) => !isNaN(idx) && idx >= 0);

            steps[stepIndex].skipIndices = indices;
          }

          saveSteps(); // 保存步骤配置
        } catch (error) {
          console.error("解析跳过索引时出错:", error);
          // 出错时设置为空数组
          steps[stepIndex].skipIndices = [];
        }
      });
  }

  // 绑定循环内步骤的事件
  function bindLoopStepEvents(stepIndex, loopStepIndex) {
    const stepItem = document.querySelector(
      `.step-item[data-step-index="${stepIndex}"]`
    );
    const loopStepItem = stepItem.querySelector(
      `.loop-step-item[data-loop-step-index="${loopStepIndex}"]`
    );

    // 删除循环步骤按钮事件
    loopStepItem
      .querySelector(".delete-loop-step")
      .addEventListener("click", function () {
        removeLoopStep(stepIndex, loopStepIndex);
      });

    // 循环步骤定位策略变更事件
    loopStepItem
      .querySelector(".loop-locator-strategy")
      .addEventListener("change", function (e) {
        steps[stepIndex].loopSteps[loopStepIndex].locator.strategy =
          e.target.value;
        saveSteps(); // 保存步骤配置
      });

    // 循环步骤定位值变更事件
    loopStepItem
      .querySelector(".loop-locator-value")
      .addEventListener("input", function (e) {
        steps[stepIndex].loopSteps[loopStepIndex].locator.value =
          e.target.value;
        saveSteps(); // 保存步骤配置
      });

    // 循环步骤测试按钮事件
    loopStepItem
      .querySelector(".loop-test-button")
      .addEventListener("click", function () {
        testLoopStepElementLocator(stepIndex, loopStepIndex);
      });

    // 循环步骤操作类型变更事件
    const loopActionTypeSelect =
      loopStepItem.querySelector(".loop-action-type");
    const loopInputTextContainer = loopStepItem.querySelector(
      ".loop-input-text-container"
    );
    const loopWaitTimeContainer = loopStepItem.querySelector(
      ".loop-wait-time-container"
    );
    const loopWaitTimeValue = loopStepItem.querySelector(
      ".loop-wait-time-value"
    );

    loopActionTypeSelect.addEventListener("change", function (e) {
      const actionType = e.target.value;
      steps[stepIndex].loopSteps[loopStepIndex].action = actionType;

      // 显示或隐藏相应的输入容器
      if (actionType === "input") {
        loopInputTextContainer.style.display = "block";
        loopWaitTimeContainer.style.display = "none";
      } else if (actionType === "wait") {
        loopInputTextContainer.style.display = "none";
        loopWaitTimeContainer.style.display = "block";
      } else {
        loopInputTextContainer.style.display = "none";
        loopWaitTimeContainer.style.display = "none";
      }

      saveSteps(); // 保存步骤配置
    });

    // 循环步骤输入文本值变更事件
    loopStepItem
      .querySelector(".loop-input-text-value")
      .addEventListener("input", function (e) {
        steps[stepIndex].loopSteps[loopStepIndex].inputText = e.target.value;
        saveSteps(); // 保存步骤配置
      });

    // 循环步骤等待时间值变更事件
    loopStepItem
      .querySelector(".loop-wait-time-value")
      .addEventListener("input", function (e) {
        steps[stepIndex].loopSteps[loopStepIndex].waitTime =
          parseInt(e.target.value, 10) || 3;
        saveSteps(); // 保存步骤配置
      });
  }

  // 删除循环步骤的函数
  function removeLoopStep(stepIndex, loopStepIndex) {
    steps[stepIndex].loopSteps.splice(loopStepIndex, 1);
    refreshStepsUI();
    saveSteps(); // 保存步骤配置
    addLogEntry(
      `删除了步骤 ${stepIndex + 1} 中的循环步骤 ${loopStepIndex + 1}`,
      "info"
    );
  }

  // 删除步骤的函数
  function removeStep(index) {
    steps.splice(index, 1);
    refreshStepsUI();
    saveSteps(); // 保存步骤配置
    addLogEntry(`删除了步骤 ${index + 1}`, "info");
  }

  // 清除所有步骤
  function clearSteps() {
    steps = [];
    refreshStepsUI();
    saveSteps(); // 保存步骤配置
    setStatus("已清除所有步骤", "");
    addLogEntry("已清除所有步骤", "info");
  }

  // 刷新所有步骤UI
  function refreshStepsUI() {
    console.log("刷新步骤UI:", steps);
    stepsContainer.innerHTML = "";

    steps.forEach((step, index) => {
      const stepHTML = createStepItemHTML(index);
      const stepContainer = document.createElement("div");
      stepContainer.innerHTML = stepHTML;
      stepsContainer.appendChild(stepContainer.firstElementChild);

      const stepItem = stepsContainer.querySelector(
        `.step-item[data-step-index="${index}"]`
      );

      // 设置定位策略
      stepItem.querySelector(".locator-strategy").value =
        step.locator.strategy || "id";

      // 设置定位值
      stepItem.querySelector(".locator-value").value = step.locator.value || "";

      // 设置操作类型
      stepItem.querySelector(".action-type").value = step.action || "click";

      // 根据操作类型显示/隐藏相应容器
      const inputTextContainer = stepItem.querySelector(
        ".input-text-container"
      );
      const loopContainer = stepItem.querySelector(".loop-container");
      const waitTimeContainer = stepItem.querySelector(".wait-time-container");
      const waitTimeValue = stepItem.querySelector(".wait-time-value");

      if (step.action === "input") {
        inputTextContainer.style.display = "block";
        loopContainer.style.display = "none";
        waitTimeContainer.style.display = "none";

        // 设置输入文本
        stepItem.querySelector(".input-text-value").value =
          step.inputText || "";
      } else if (step.action === "loop") {
        inputTextContainer.style.display = "none";
        loopContainer.style.display = "block";
        waitTimeContainer.style.display = "none";

        // 设置循环范围控制值（兼容旧配置）
        stepItem.querySelector(".loop-start-index").value =
          step.startIndex !== undefined ? step.startIndex : 0;

        stepItem.querySelector(".loop-end-index").value =
          step.endIndex !== undefined ? step.endIndex : -1;

        if (
          step.skipIndices &&
          Array.isArray(step.skipIndices) &&
          step.skipIndices.length > 0
        ) {
          stepItem.querySelector(".loop-skip-indices").value =
            step.skipIndices.join(",");
        } else {
          stepItem.querySelector(".loop-skip-indices").value = "";
        }

        // 清空循环步骤容器
        const loopStepsContainer = stepItem.querySelector(".loop-steps");
        loopStepsContainer.innerHTML = "";

        // 添加循环步骤
        if (step.loopSteps && step.loopSteps.length > 0) {
          step.loopSteps.forEach((loopStep, loopStepIndex) => {
            const loopStepHTML = createLoopStepHTML(index, loopStepIndex);
            const loopStepContainer = document.createElement("div");
            loopStepContainer.innerHTML = loopStepHTML;
            loopStepsContainer.appendChild(loopStepContainer.firstElementChild);

            // 更新循环步骤UI值
            const loopStepItem = loopStepsContainer.querySelector(
              `.loop-step-item[data-loop-step-index="${loopStepIndex}"]`
            );

            loopStepItem.querySelector(".loop-locator-strategy").value =
              loopStep.locator.strategy;
            loopStepItem.querySelector(".loop-locator-value").value =
              loopStep.locator.value;

            const loopActionSelect =
              loopStepItem.querySelector(".loop-action-type");
            loopActionSelect.value = loopStep.action;

            const loopInputContainer = loopStepItem.querySelector(
              ".loop-input-text-container"
            );
            const loopInputValue = loopStepItem.querySelector(
              ".loop-input-text-value"
            );
            const loopWaitTimeContainer = loopStepItem.querySelector(
              ".loop-wait-time-container"
            );
            const loopWaitTimeValue = loopStepItem.querySelector(
              ".loop-wait-time-value"
            );

            if (loopStep.action === "input") {
              loopInputContainer.style.display = "block";
              loopWaitTimeContainer.style.display = "none";
              loopInputValue.value = loopStep.inputText || "";
            } else if (loopStep.action === "wait") {
              loopInputContainer.style.display = "none";
              loopWaitTimeContainer.style.display = "block";
              loopWaitTimeValue.value = loopStep.waitTime || 3;
            } else {
              loopInputContainer.style.display = "none";
              loopWaitTimeContainer.style.display = "none";
            }

            // 绑定循环步骤事件
            bindLoopStepEvents(index, loopStepIndex);
          });
        }
      } else if (step.action === "wait") {
        inputTextContainer.style.display = "none";
        loopContainer.style.display = "none";
        waitTimeContainer.style.display = "block";
        waitTimeValue.value = step.waitTime || 3;
      } else {
        inputTextContainer.style.display = "none";
        loopContainer.style.display = "none";
        waitTimeContainer.style.display = "none";
      }

      // 重新绑定事件
      bindStepEvents(index);
    });
  }

  // 保存步骤配置到本地存储
  function saveSteps() {
    chrome.storage.local.set({ savedSteps: steps }, function () {
      console.log("步骤配置已保存");
    });
  }

  // 从本地存储加载步骤配置
  function loadSteps() {
    chrome.storage.local.get("savedSteps", function (result) {
      if (
        result.savedSteps &&
        Array.isArray(result.savedSteps) &&
        result.savedSteps.length > 0
      ) {
        steps = result.savedSteps;
        refreshStepsUI();
        setStatus("已加载保存的配置", "");
        addLogEntry("已加载保存的配置", "info");
        console.log("步骤配置已加载:", steps);
      } else {
        // 添加初始步骤
        addStep();
      }
    });
  }

  // 执行配置的步骤
  function executeSteps() {
    try {
      if (steps.length === 0) {
        setStatus("请先添加操作步骤！", "error");
        addLogEntry("请先添加操作步骤！", "error");
        return;
      }

      // 验证步骤配置
      for (let i = 0; i < steps.length; i++) {
        if (steps[i].action !== "wait" && !steps[i].locator.value) {
          setStatus(`步骤 ${i + 1} 的定位值不能为空！`, "error");
          addLogEntry(`步骤 ${i + 1} 的定位值不能为空！`, "error");
          return;
        }

        // 检查输入文本操作是否有输入值
        if (steps[i].action === "input" && !steps[i].inputText) {
          setStatus(`步骤 ${i + 1} 的输入内容不能为空！`, "error");
          addLogEntry(`步骤 ${i + 1} 的输入内容不能为空！`, "error");
          return;
        }

        // 检查等待时间是否有效
        if (steps[i].action === "wait") {
          const waitTime = steps[i].waitTime;
          if (!waitTime || waitTime < 1 || waitTime > 60) {
            setStatus(`步骤 ${i + 1} 的等待时间必须在1-60秒之间！`, "error");
            addLogEntry(`步骤 ${i + 1} 的等待时间必须在1-60秒之间！`, "error");
            return;
          }
        }

        // 检查循环操作是否有子步骤
        if (steps[i].action === "loop") {
          if (!steps[i].loopSteps || steps[i].loopSteps.length === 0) {
            setStatus(
              `步骤 ${i + 1} 的循环操作中需要至少添加一个步骤！`,
              "error"
            );
            addLogEntry(
              `步骤 ${i + 1} 的循环操作中需要至少添加一个步骤！`,
              "error"
            );
            return;
          }

          // 验证循环步骤配置
          for (let j = 0; j < steps[i].loopSteps.length; j++) {
            const loopStep = steps[i].loopSteps[j];
            if (loopStep.action !== "wait" && !loopStep.locator.value) {
              setStatus(
                `步骤 ${i + 1} 中的循环步骤 ${j + 1} 的定位值不能为空！`,
                "error"
              );
              addLogEntry(
                `步骤 ${i + 1} 中的循环步骤 ${j + 1} 的定位值不能为空！`,
                "error"
              );
              return;
            }

            // 检查循环内输入文本操作是否有输入值
            if (loopStep.action === "input" && !loopStep.inputText) {
              setStatus(
                `步骤 ${i + 1} 中的循环步骤 ${j + 1} 的输入内容不能为空！`,
                "error"
              );
              addLogEntry(
                `步骤 ${i + 1} 中的循环步骤 ${j + 1} 的输入内容不能为空！`,
                "error"
              );
              return;
            }
          }
        }
      }

      // 显示加载状态
      setStatus("正在准备执行操作...", "loading");
      addLogEntry("正在准备执行操作...", "info");

      // 更新按钮状态
      startButton.disabled = true;
      stopButton.disabled = false;

      // 发送消息到后台脚本
      chrome.runtime.sendMessage(
        {
          action: "executeSteps",
          steps: steps,
        },
        function (response) {
          if (chrome.runtime.lastError) {
            console.error("执行请求出错:", chrome.runtime.lastError);
            setStatus("执行请求出错，请重试", "error");
            addLogEntry(
              `执行请求出错: ${chrome.runtime.lastError.message}`,
              "error"
            );
            startButton.disabled = false;
            stopButton.disabled = true;
            return;
          }

          if (response && response.received) {
            console.log("后台脚本已接收请求:", response);
            // 不做任何操作，等待通过消息事件接收结果
          } else {
            console.error("后台脚本未确认接收请求:", response);
            setStatus("通信错误: 无法与后台脚本建立连接", "error");
            addLogEntry("通信错误: 无法与后台脚本建立连接", "error");
            startButton.disabled = false;
            stopButton.disabled = true;
          }
        }
      );
    } catch (error) {
      console.error("执行操作过程出错:", error);
      setStatus(`执行操作出错: ${error.message}`, "error");
      addLogEntry(`执行操作出错: ${error.message}`, "error");

      // 确保UI状态被重置
      startButton.disabled = false;
      stopButton.disabled = true;
    }
  }

  // 停止执行
  function stopExecution() {
    try {
      setStatus("正在停止操作...", "loading");
      addLogEntry("正在尝试停止操作...", "info");

      chrome.runtime.sendMessage(
        { action: "stopExecution" },
        function (response) {
          if (chrome.runtime.lastError) {
            console.error("停止操作请求出错:", chrome.runtime.lastError);
            setStatus("停止操作请求出错，但UI已重置", "error");
            addLogEntry(
              `停止操作请求出错: ${chrome.runtime.lastError.message}`,
              "error"
            );

            // 重置UI状态
            startButton.disabled = false;
            stopButton.disabled = true;
            return;
          }

          if (response && response.stopped) {
            setStatus("操作已停止", "success");
            addLogEntry("操作已手动停止", "info");
            startButton.disabled = false;
            stopButton.disabled = true;
          } else {
            setStatus("停止操作请求未确认", "warning");
            addLogEntry("停止操作可能未成功", "warning");

            // 重置UI状态
            startButton.disabled = false;
            stopButton.disabled = true;
          }
        }
      );
    } catch (error) {
      console.error("停止操作过程出错:", error);
      addLogEntry(`停止操作过程出错: ${error.message}`, "error");

      // 确保UI状态被重置
      startButton.disabled = false;
      stopButton.disabled = true;
      setStatus("停止操作失败", "error");
    }
  }

  // 测试元素定位
  async function testElementLocator(stepIndex) {
    const step = steps[stepIndex];

    if (!step.locator.value) {
      addLogEntry(`步骤 ${stepIndex + 1} 的定位值不能为空！`, "error");
      return;
    }

    addLogEntry(`正在测试步骤 ${stepIndex + 1} 的元素定位...`, "info");

    try {
      // 获取当前标签页
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs.length === 0) {
        addLogEntry("未找到活动标签页", "error");
        return;
      }

      const tabId = tabs[0].id;

      // 简化注入流程，直接注入content script
      addLogEntry("正在准备测试环境...", "info");

      try {
        // 直接注入content script，忽略可能的错误（如果已经注入）
        await chrome.scripting
          .executeScript({
            target: { tabId: tabId },
            files: ["/content/content.js"],
          })
          .catch(() => {
            // 忽略可能的错误，如脚本已经存在
            console.log("Content script可能已经注入");
          });

        // 等待脚本加载，但时间较短
        await new Promise((resolve) => setTimeout(resolve, 200));

        // 发送测试请求，使用简化的通信函数
        const response = await sendMessageToTabWithTimeout(
          tabId,
          {
            action: "testElementLocator",
            locator: step.locator,
          },
          5000 // 减少超时时间
        );

        if (response && response.success) {
          addLogEntry(
            `步骤 ${stepIndex + 1} 成功找到 ${
              response.count
            } 个元素，已在页面上标记`,
            "success"
          );
        } else {
          addLogEntry(
            `步骤 ${stepIndex + 1} 未找到匹配元素: ${
              response?.error || "未知错误"
            }`,
            "error"
          );
        }
      } catch (error) {
        // 简化错误处理
        addLogEntry(
          `测试过程中出错，但不影响其他功能: ${error.message}`,
          "error"
        );
      }
    } catch (error) {
      // 简化错误处理
      addLogEntry(`测试功能暂时不可用: ${error.message}`, "error");
    }
  }

  // 测试循环步骤元素定位
  async function testLoopStepElementLocator(stepIndex, loopStepIndex) {
    const loopStep = steps[stepIndex].loopSteps[loopStepIndex];

    if (!loopStep.locator.value) {
      addLogEntry(
        `步骤 ${stepIndex + 1} 中的循环步骤 ${
          loopStepIndex + 1
        } 的定位值不能为空！`,
        "error"
      );
      return;
    }

    addLogEntry(
      `正在测试步骤 ${stepIndex + 1} 中的循环步骤 ${
        loopStepIndex + 1
      } 的元素定位...`,
      "info"
    );

    try {
      // 获取当前标签页
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs.length === 0) {
        addLogEntry("未找到活动标签页", "error");
        return;
      }

      const tabId = tabs[0].id;

      // 简化注入流程，直接注入content script
      addLogEntry("正在准备测试环境...", "info");

      try {
        // 直接注入content script，忽略可能的错误（如果已经注入）
        await chrome.scripting
          .executeScript({
            target: { tabId: tabId },
            files: ["/content/content.js"],
          })
          .catch(() => {
            // 忽略可能的错误，如脚本已经存在
            console.log("Content script可能已经注入");
          });

        // 等待脚本加载，但时间较短
        await new Promise((resolve) => setTimeout(resolve, 200));

        // 发送测试请求，使用简化的通信函数
        const response = await sendMessageToTabWithTimeout(
          tabId,
          {
            action: "testElementLocator",
            locator: loopStep.locator,
          },
          5000 // 减少超时时间
        );

        if (response && response.success) {
          addLogEntry(
            `步骤 ${stepIndex + 1} 中的循环步骤 ${loopStepIndex + 1} 成功找到 ${
              response.count
            } 个元素，已在页面上标记`,
            "success"
          );
        } else {
          addLogEntry(
            `步骤 ${stepIndex + 1} 中的循环步骤 ${
              loopStepIndex + 1
            } 未找到匹配元素: ${response?.error || "未知错误"}`,
            "error"
          );
        }
      } catch (error) {
        // 简化错误处理
        addLogEntry(
          `测试过程中出错，但不影响其他功能: ${error.message}`,
          "error"
        );
      }
    } catch (error) {
      // 简化错误处理
      addLogEntry(`测试功能暂时不可用: ${error.message}`, "error");
    }
  }

  // 发送消息到标签页(带超时)
  function sendMessageToTabWithTimeout(tabId, message, timeout = 3000) {
    return new Promise((resolve, reject) => {
      try {
        // 简化消息，不再添加复杂的元数据
        console.log("发送消息:", message);

        // 设置更短的超时时间
        const timeoutId = setTimeout(() => {
          console.warn("消息发送超时");
          // 返回一个默认响应，避免卡死
          resolve({ success: false, error: "通信超时，但操作将继续" });
        }, timeout);

        chrome.tabs.sendMessage(tabId, message, (response) => {
          clearTimeout(timeoutId);

          // 处理没有响应的情况
          if (!response) {
            console.warn("没有收到响应，但操作将继续");
            resolve({ success: false, error: "没有收到响应，但操作将继续" });
            return;
          }

          // 检查运行时错误，但不再抛出异常
          if (chrome.runtime.lastError) {
            console.warn("消息发送错误:", chrome.runtime.lastError);
            resolve({
              success: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }

          // 正常响应
          resolve(response);
        });
      } catch (error) {
        console.error("消息发送异常:", error);
        // 返回错误响应，但不抛出异常，以防止页面卡死
        resolve({ success: false, error: error.message });
      }
    });
  }

  // 清除日志
  function clearLog() {
    operationLogElement.innerHTML = "";
    addLogEntry("日志已清除", "info");
  }

  // 添加日志条目
  function addLogEntry(message, type = "info", animated = false) {
    const now = new Date();
    const time = now.toLocaleTimeString();
    const logEntry = document.createElement("div");
    logEntry.className = `log-entry log-${type}`;
    logEntry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
    operationLogElement.prepend(logEntry);

    if (animated) {
      logEntry.classList.add("animated");
      setTimeout(() => {
        logEntry.classList.remove("animated");
      }, 1000);
    }
  }

  // 设置状态信息的辅助函数
  function setStatus(message, type) {
    statusElement.textContent = message;
    statusElement.className = "status " + (type || "");

    // 为loading状态添加动态指示效果
    if (type === "loading") {
      // 移除旧的loading指示器（如果存在）
      const oldIndicator = statusElement.querySelector(".loading-indicator");
      if (oldIndicator) {
        oldIndicator.remove();
      }

      // 添加新的loading指示器
      const loadingIndicator = document.createElement("span");
      loadingIndicator.className = "loading-indicator loading-dots";
      statusElement.appendChild(loadingIndicator);
    }
  }

  // 设置调试信息的辅助函数
  function setDebugInfo(message) {
    if (message) {
      debugInfoElement.textContent = message;
      debugInfoElement.style.display = "block";
    } else {
      debugInfoElement.style.display = "none";
    }
  }
});
