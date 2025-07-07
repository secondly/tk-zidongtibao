/**
 * UI管理器模块
 * 负责界面元素的创建、更新和事件处理
 */

class UIManager {
  constructor(stepManager) {
    this.stepManager = stepManager;
    this.elements = {};
    this.isExecuting = false;
    
    this.initializeElements();
    this.bindEvents();
    this.setupStepManagerListeners();
  }

  /**
   * 初始化DOM元素引用
   */
  initializeElements() {
    this.elements = {
      stepsContainer: document.getElementById("steps-container"),
      addStepButton: document.getElementById("addStep"),
      clearStepsButton: document.getElementById("clearSteps"),
      startButton: document.getElementById("startAction"),
      stopButton: document.getElementById("stopAction"),
      statusElement: document.getElementById("status"),
      debugInfoElement: document.getElementById("debugInfo"),
      operationLogElement: document.getElementById("operationLog"),
      clearLogButton: document.getElementById("clearLog"),
      exportConfigButton: document.getElementById("exportConfig"),
      importConfigButton: document.getElementById("importConfig"),
      importFileInput: document.getElementById("importFileInput"),
    };

    // 验证所有必需的元素都存在
    for (const [key, element] of Object.entries(this.elements)) {
      if (!element) {
        throw new window.AutomationUtils.AutomationError(
          `找不到必需的DOM元素: ${key}`,
          window.AutomationUtils.ErrorTypes.VALIDATION
        );
      }
    }
  }

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // 按钮事件
    this.elements.addStepButton.addEventListener("click", () => {
      this.stepManager.addStep();
    });

    this.elements.clearStepsButton.addEventListener("click", () => {
      this.stepManager.clearSteps();
    });

    this.elements.startButton.addEventListener("click", () => {
      this.executeSteps();
    });

    this.elements.stopButton.addEventListener("click", () => {
      this.stopExecution();
    });

    this.elements.clearLogButton.addEventListener("click", () => {
      this.clearLog();
    });

    this.elements.exportConfigButton.addEventListener("click", () => {
      this.exportConfig();
    });

    this.elements.importConfigButton.addEventListener("click", () => {
      this.elements.importFileInput.click();
    });

    this.elements.importFileInput.addEventListener("change", (event) => {
      this.importConfig(event);
    });

    // 日志切换按钮事件
    const toggleLogButton = document.getElementById("toggleLog");
    if (toggleLogButton) {
      toggleLogButton.addEventListener("click", () => {
        this.toggleLogPanel();
      });
    }

    // 监听来自背景脚本的消息
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request) => {
        this.handleRuntimeMessage(request);
      });
    } else {
      console.warn('Chrome runtime API不可用，可能在非扩展环境中运行');
    }
  }

  /**
   * 设置步骤管理器监听器
   */
  setupStepManagerListeners() {
    this.stepManager.addListener((event, data) => {
      switch (event) {
        case 'stepAdded':
          this.renderStep(data.index);
          this.saveSteps();
          this.addLogEntry(`添加了步骤 ${data.index + 1}`, "info");
          break;
        case 'stepRemoved':
          this.refreshStepsUI();
          this.saveSteps();
          this.addLogEntry(`删除了步骤 ${data.index + 1}`, "info");
          break;
        case 'stepUpdated':
          this.saveSteps();
          break;
        case 'loopStepAdded':
          this.renderLoopStep(data.stepIndex, data.loopIndex);
          this.saveSteps();
          this.addLogEntry(
            `在步骤 ${data.stepIndex + 1} 中添加了循环步骤 ${data.loopIndex + 1}`,
            "info"
          );
          break;
        case 'loopStepRemoved':
          this.refreshStepsUI();
          this.saveSteps();
          this.addLogEntry(
            `删除了步骤 ${data.stepIndex + 1} 中的循环步骤 ${data.loopIndex + 1}`,
            "info"
          );
          break;
        case 'loopStepUpdated':
          this.saveSteps();
          break;
        case 'stepsCleared':
          this.refreshStepsUI();
          this.saveSteps();
          this.setStatus("已清除所有步骤", "");
          this.addLogEntry("已清除所有步骤", "info");
          break;
        case 'stepsReplaced':
          this.refreshStepsUI();
          this.saveSteps();
          break;
      }
    });
  }

  /**
   * 处理来自背景脚本的消息
   */
  handleRuntimeMessage(request) {
    try {
      switch (request.action) {
        case "executionProgress":
          this.updateProgress(request);
          break;
        case "executionResult":
          this.handleExecutionResult(request.result);
          break;
        case "executionStarted":
          this.setExecutionState(true);
          this.addLogEntry("开始执行自动化操作", "info");
          break;
        case "executionStopped":
          this.setExecutionState(false);
          this.setStatus("自动化操作已停止", "success");
          this.addLogEntry("自动化操作已停止", "info");
          break;
      }
    } catch (error) {
      window.AutomationUtils.ErrorHandler.logError(error, 'handleRuntimeMessage');
      this.addLogEntry(
        `处理消息时出错: ${window.AutomationUtils.ErrorHandler.getErrorMessage(error)}`,
        "error"
      );
    }
  }

  /**
   * 设置执行状态
   * @param {boolean} isExecuting - 是否正在执行
   */
  setExecutionState(isExecuting) {
    this.isExecuting = isExecuting;
    this.elements.startButton.disabled = isExecuting;
    this.elements.stopButton.disabled = !isExecuting;
  }

  /**
   * 更新执行进度
   * @param {object} progressData - 进度数据
   */
  updateProgress(progressData) {
    let message = "";

    if (progressData.currentStep !== undefined) {
      message = `正在执行步骤 ${progressData.currentStep + 1}: ${
        progressData.message || ""
      }`;
    } else {
      message = progressData.message || "正在执行...";
    }

    this.setStatus(message, "loading");

    if (progressData.retry) {
      this.addLogEntry(message, "warning");
    } else {
      this.addLogEntry(message, "info", true);
    }
  }

  /**
   * 处理执行结果
   * @param {object} result - 执行结果
   */
  handleExecutionResult(result) {
    this.setExecutionState(false);

    if (result.success) {
      const message = "所有操作成功完成！";
      this.setStatus(message, "success");
      this.addLogEntry(message, "success");
    } else if (result.currentStep !== undefined) {
      const message = `执行步骤 ${result.currentStep + 1} 时出错: ${
        result.error || "未知错误"
      }`;
      this.setStatus(message, "error");
      this.addLogEntry(message, "error");
    } else {
      const message = "操作失败: " + (result.error || "未知错误");
      this.setStatus(message, "error");
      this.addLogEntry(message, "error");
    }
  }

  /**
   * 执行步骤
   */
  async executeSteps() {
    try {
      // 验证步骤
      this.stepManager.validateAllSteps();

      this.setStatus("正在准备执行操作...", "loading");
      this.addLogEntry("正在准备执行操作...", "info");
      this.setExecutionState(true);

      // 发送消息到后台脚本
      const response = await this.sendMessageToBackground({
        action: "executeSteps",
        steps: this.stepManager.getSteps(),
      });

      if (!response || !response.received) {
        throw new window.AutomationUtils.AutomationError(
          "无法与后台脚本建立连接",
          window.AutomationUtils.ErrorTypes.COMMUNICATION
        );
      }
    } catch (error) {
      window.AutomationUtils.ErrorHandler.logError(error, 'executeSteps');
      const message = window.AutomationUtils.ErrorHandler.getErrorMessage(error);
      this.setStatus(message, "error");
      this.addLogEntry(message, "error");
      this.setExecutionState(false);
    }
  }

  /**
   * 停止执行
   */
  async stopExecution() {
    try {
      this.setStatus("正在停止操作...", "loading");
      this.addLogEntry("正在尝试停止操作...", "info");

      const response = await this.sendMessageToBackground({
        action: "stopExecution"
      });

      if (response && response.stopped) {
        this.setStatus("操作已停止", "success");
        this.addLogEntry("操作已手动停止", "info");
      } else {
        this.setStatus("停止操作请求未确认", "warning");
        this.addLogEntry("停止操作可能未成功", "warning");
      }
      
      this.setExecutionState(false);
    } catch (error) {
      window.AutomationUtils.ErrorHandler.logError(error, 'stopExecution');
      this.addLogEntry(
        `停止操作过程出错: ${window.AutomationUtils.ErrorHandler.getErrorMessage(error)}`,
        "error"
      );
      this.setExecutionState(false);
      this.setStatus("停止操作失败", "error");
    }
  }

  /**
   * 向后台脚本发送消息
   * @param {object} message - 消息对象
   * @returns {Promise} 响应Promise
   */
  sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      if (!chrome || !chrome.runtime) {
        reject(new window.AutomationUtils.AutomationError(
          'Chrome runtime API不可用',
          window.AutomationUtils.ErrorTypes.COMMUNICATION
        ));
        return;
      }

      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new window.AutomationUtils.AutomationError(
            chrome.runtime.lastError.message,
            window.AutomationUtils.ErrorTypes.COMMUNICATION
          ));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * 设置状态信息
   * @param {string} message - 状态消息
   * @param {string} type - 状态类型
   */
  setStatus(message, type) {
    this.elements.statusElement.textContent = message;
    this.elements.statusElement.className = "status " + (type || "");

    if (type === "loading") {
      const oldIndicator = this.elements.statusElement.querySelector(".loading-indicator");
      if (oldIndicator) {
        oldIndicator.remove();
      }

      const loadingIndicator = document.createElement("span");
      loadingIndicator.className = "loading-indicator loading-dots";
      this.elements.statusElement.appendChild(loadingIndicator);
    }
  }

  /**
   * 添加日志条目
   * @param {string} message - 日志消息
   * @param {string} type - 日志类型
   * @param {boolean} animated - 是否显示动画
   */
  addLogEntry(message, type = "info", animated = false) {
    const time = Utils.formatTime();
    const logEntry = document.createElement("div");

    // 检查是否为循环操作相关的日志，并应用特殊样式
    let logClass = `log-entry log-${type}`;
    if (message.includes('🔄 循环操作')) {
      logClass += ' log-loop';
    } else if (message.includes('🎯') || message.includes('👆')) {
      logClass += ' log-loop-element';
    } else if (message.includes('🔸')) {
      logClass += ' log-loop-substep';
    } else if (message.includes('🎉') && message.includes('循环操作')) {
      logClass += ' log-loop-complete';
    }

    logEntry.className = logClass;

    // 清理消息内容，防止XSS
    const cleanMessage = Validator.sanitizeInput(message);
    logEntry.innerHTML = `<span class="log-time">[${time}]</span> ${cleanMessage}`;

    this.elements.operationLogElement.prepend(logEntry);

    if (animated) {
      logEntry.classList.add("animated");
      setTimeout(() => {
        logEntry.classList.remove("animated");
      }, 1000);
    }

    // 限制日志条目数量，避免内存泄漏
    const maxLogEntries = 100;
    const logEntries = this.elements.operationLogElement.children;
    if (logEntries.length > maxLogEntries) {
      for (let i = logEntries.length - 1; i >= maxLogEntries; i--) {
        logEntries[i].remove();
      }
    }
  }

  /**
   * 清除日志
   */
  clearLog() {
    this.elements.operationLogElement.innerHTML = "";
    this.addLogEntry("日志已清除", "info");
  }

  /**
   * 导出配置
   */
  exportConfig() {
    try {
      const config = this.stepManager.exportConfig();

      if (this.stepManager.getStepCount() === 0) {
        this.addLogEntry("没有可导出的配置", "error");
        return;
      }

      const jsonString = JSON.stringify(config, null, 2);
      const sizeInKB = new Blob([jsonString]).size / 1024;

      if (sizeInKB > 5000) {
        this.addLogEntry(
          `配置文件过大 (${sizeInKB.toFixed(2)}KB)，请减少步骤数量`,
          "error"
        );
        return;
      }

      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `automation-config-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      this.addLogEntry("配置已成功导出", "success");
    } catch (error) {
      window.AutomationUtils.ErrorHandler.logError(error, 'exportConfig');
      this.addLogEntry(
        `导出配置失败: ${window.AutomationUtils.ErrorHandler.getErrorMessage(error)}`,
        "error"
      );
    }
  }

  /**
   * 导入配置
   */
  importConfig(event) {
    try {
      const file = event.target.files[0];
      if (!file) return;

      if (file.type !== "application/json" && !file.name.endsWith(".json")) {
        this.addLogEntry("请选择正确的JSON文件", "error");
        this.elements.importFileInput.value = "";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.addLogEntry(
          `文件过大，最大支持5MB，当前文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
          "error"
        );
        this.elements.importFileInput.value = "";
        return;
      }

      this.addLogEntry("正在读取配置文件...", "info");

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target.result);
          this.stepManager.importConfig(config);
          this.setStatus("配置已成功导入", "success");
          this.addLogEntry(`已导入配置，包含 ${config.steps.length} 个步骤`, "success");
        } catch (parseError) {
          window.AutomationUtils.ErrorHandler.logError(parseError, 'importConfig-parse');
          this.setStatus("导入配置失败", "error");
          this.addLogEntry(
            `导入配置失败: ${window.AutomationUtils.ErrorHandler.getErrorMessage(parseError)}`,
            "error"
          );
        }
        this.elements.importFileInput.value = "";
      };

      reader.onerror = (readError) => {
        window.AutomationUtils.ErrorHandler.logError(readError, 'importConfig-read');
        this.addLogEntry(
          `读取文件时出错: ${window.AutomationUtils.ErrorHandler.getErrorMessage(readError)}`,
          "error"
        );
        this.elements.importFileInput.value = "";
      };

      reader.readAsText(file);
    } catch (error) {
      window.AutomationUtils.ErrorHandler.logError(error, 'importConfig');
      this.addLogEntry(
        `导入过程出错: ${window.AutomationUtils.ErrorHandler.getErrorMessage(error)}`,
        "error"
      );
      this.elements.importFileInput.value = "";
    }
  }

  /**
   * 保存步骤到本地存储
   */
  saveSteps() {
    try {
      if (!chrome || !chrome.storage) {
        console.warn('Chrome storage API不可用，无法保存步骤');
        return;
      }

      chrome.storage.local.set({
        savedSteps: this.stepManager.getSteps()
      }, () => {
        if (chrome.runtime.lastError) {
          window.AutomationUtils.ErrorHandler.logError(
            new Error(chrome.runtime.lastError.message),
            'saveSteps'
          );
        }
      });
    } catch (error) {
      window.AutomationUtils.ErrorHandler.logError(error, 'saveSteps');
    }
  }

  /**
   * 从本地存储加载步骤
   */
  loadSteps() {
    try {
      if (!chrome || !chrome.storage) {
        console.warn('Chrome storage API不可用，添加默认步骤');
        this.stepManager.addStep(); // 添加默认步骤
        return;
      }

      chrome.storage.local.get("savedSteps", (result) => {
        if (chrome.runtime.lastError) {
          window.AutomationUtils.ErrorHandler.logError(
            new Error(chrome.runtime.lastError.message),
            'loadSteps'
          );
          this.stepManager.addStep(); // 添加默认步骤
          return;
        }

        if (result.savedSteps &&
            Array.isArray(result.savedSteps) &&
            result.savedSteps.length > 0) {
          this.stepManager.setSteps(result.savedSteps);
          // this.setStatus("已加载保存的配置", "");
          // this.addLogEntry("已加载保存的配置", "info");
        } else {
          this.stepManager.addStep(); // 添加默认步骤
        }
      });
    } catch (error) {
      window.AutomationUtils.ErrorHandler.logError(error, 'loadSteps');
      this.stepManager.addStep(); // 添加默认步骤
    }
  }

  /**
   * 渲染步骤（委托给stepRenderer）
   * @param {number} stepIndex - 步骤索引
   */
  renderStep(stepIndex) {
    if (this.stepRenderer) {
      this.stepRenderer.renderStep(stepIndex);
    }
  }

  /**
   * 渲染循环步骤（委托给stepRenderer）
   * @param {number} stepIndex - 主步骤索引
   * @param {number} loopStepIndex - 循环步骤索引
   */
  renderLoopStep(stepIndex, loopStepIndex) {
    if (this.stepRenderer) {
      this.stepRenderer.renderLoopStep(stepIndex, loopStepIndex);
    }
  }

  /**
   * 刷新步骤UI（委托给stepRenderer）
   */
  refreshStepsUI() {
    if (this.stepRenderer) {
      this.stepRenderer.refreshStepsUI();
    }
  }

  /**
   * 设置调试信息
   * @param {string} message - 调试信息
   */
  setDebugInfo(message) {
    if (this.elements.debugInfoElement) {
      this.elements.debugInfoElement.textContent = message || "";
    }
  }

  /**
   * 切换日志面板的显示/隐藏
   */
  toggleLogPanel() {
    const rightPanel = document.getElementById("rightPanel");
    const toggleButton = document.getElementById("toggleLog");
    const container = document.querySelector(".container");

    if (!rightPanel || !toggleButton || !container) return;

    const isHidden = rightPanel.style.display === "none";

    if (isHidden) {
      // 显示日志面板
      rightPanel.style.display = "block";
      container.classList.add("with-log");
      toggleButton.textContent = "关闭日志";
    } else {
      // 隐藏日志面板
      rightPanel.style.display = "none";
      container.classList.remove("with-log");
      toggleButton.textContent = "打开日志";
    }
  }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
  window.UIManager = UIManager;
}
