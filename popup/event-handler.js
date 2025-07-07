class EventHandler {
  constructor(stepManager, uiManager, stepRenderer) {
    this.stepManager = stepManager;
    this.uiManager = uiManager;
    this.stepRenderer = stepRenderer;
  }

  bindStepEvents(stepElement, stepIndex) {
    stepElement.querySelector(".delete-step").addEventListener("click", () => {
      this.stepManager.removeStep(stepIndex);
    });

    stepElement.querySelector(".duplicate-step").addEventListener("click", () => {
      this.stepManager.duplicateStep(stepIndex);
    });

    stepElement.querySelector(".locator-strategy").addEventListener("change", (e) => {
      const strategy = e.target.value;
      this.stepManager.updateStep(stepIndex, {
        locator: { ...this.stepManager.getSteps()[stepIndex].locator, strategy: strategy }
      });
      this.adjustInputForStrategy(stepElement, strategy);
    });

    stepElement.querySelector(".locator-value").addEventListener("input", (e) => {
      this.stepManager.updateStep(stepIndex, {
        locator: { ...this.stepManager.getSteps()[stepIndex].locator, value: e.target.value }
      });
    });

    stepElement.querySelector(".action-type").addEventListener("change", (e) => {
      const newAction = e.target.value;
      this.stepManager.updateStep(stepIndex, { action: newAction });

      // 更新UI显示
      const step = this.stepManager.getSteps()[stepIndex];
      this.stepRenderer.updateStepVisibility(stepElement, step);
    });

    const inputTextElement = stepElement.querySelector(".input-text-value");
    if (inputTextElement) {
      inputTextElement.addEventListener("input", (e) => {
        this.stepManager.updateStep(stepIndex, { inputText: e.target.value });
      });
    }

    const waitTimeElement = stepElement.querySelector(".wait-time-value");
    if (waitTimeElement) {
      waitTimeElement.addEventListener("input", (e) => {
        this.stepManager.updateStep(stepIndex, { waitTime: parseInt(e.target.value) || 1 });
      });
    }

    stepElement.querySelector(".test-button").addEventListener("click", () => {
      this.testElementLocator(stepIndex);
    });

    const addLoopStepBtn = stepElement.querySelector(".add-loop-step");
    if (addLoopStepBtn) {
      addLoopStepBtn.addEventListener("click", () => {
        this.stepManager.addLoopStep(stepIndex);
      });
    }

    const skipIndicesInput = stepElement.querySelector(".skip-indices");
    if (skipIndicesInput) {
      let skipIndicesTimeout;
      const updateSkipIndices = () => {
        clearTimeout(skipIndicesTimeout);
        skipIndicesTimeout = setTimeout(() => {
          try {
            const value = skipIndicesInput.value.trim();
            let skipIndices = [];
            if (value) {
              skipIndices = value.split(',')
                .map(idx => parseInt(idx.trim()))
                .filter(idx => !isNaN(idx) && idx >= 0);
            }
            this.stepManager.updateStep(stepIndex, { skipIndices });
          } catch (error) {
            window.AutomationUtils.ErrorHandler.logError(error, 'updateSkipIndices');
            this.stepManager.updateStep(stepIndex, { skipIndices: [] });
          }
        }, 500);
      };
      skipIndicesInput.addEventListener("input", (e) => {
        updateSkipIndices();
      });
    }
  }

  bindLoopStepEvents(loopStepElement, stepIndex, loopStepIndex) {
    loopStepElement.querySelector(".delete-loop-step").addEventListener("click", () => {
      this.stepManager.removeLoopStep(stepIndex, loopStepIndex);
    });

    loopStepElement.querySelector(".loop-locator-strategy").addEventListener("change", (e) => {
      const strategy = e.target.value;
      const steps = this.stepManager.getSteps();
      const currentLoopStep = steps[stepIndex].loopSteps[loopStepIndex];
      this.stepManager.updateLoopStep(stepIndex, loopStepIndex, {
        locator: { ...currentLoopStep.locator, strategy: strategy }
      });
      this.adjustLoopInputForStrategy(loopStepElement, strategy);
    });

    loopStepElement.querySelector(".loop-locator-value").addEventListener("input", (e) => {
      const steps = this.stepManager.getSteps();
      const currentLoopStep = steps[stepIndex].loopSteps[loopStepIndex];
      this.stepManager.updateLoopStep(stepIndex, loopStepIndex, {
        locator: { ...currentLoopStep.locator, value: e.target.value }
      });
    });

    loopStepElement.querySelector(".loop-action-type").addEventListener("change", (e) => {
      const newAction = e.target.value;
      this.stepManager.updateLoopStep(stepIndex, loopStepIndex, { action: newAction });

      // 更新UI显示
      const steps = this.stepManager.getSteps();
      const loopStep = steps[stepIndex].loopSteps[loopStepIndex];
      this.stepRenderer.updateLoopStepVisibility(loopStepElement, loopStep);
    });

    const loopInputTextElement = loopStepElement.querySelector(".loop-input-text-value");
    if (loopInputTextElement) {
      loopInputTextElement.addEventListener("input", (e) => {
        this.stepManager.updateLoopStep(stepIndex, loopStepIndex, { inputText: e.target.value });
      });
    }

    loopStepElement.querySelector(".loop-test-button").addEventListener("click", () => {
      this.testLoopStepElementLocator(stepIndex, loopStepIndex);
    });
  }

  async testElementLocator(stepIndex) {
    const steps = this.stepManager.getSteps();
    const step = steps[stepIndex];

    if (step.action === 'wait' || step.action === 'loop') {
      this.uiManager.addLogEntry(
        `步骤 ${stepIndex + 1} 是${step.action === 'wait' ? '等待' : '循环'}操作，不需要测试定位`,
        "info"
      );
      return;
    }

    if (!step.locator.value) {
      this.uiManager.addLogEntry(`步骤 ${stepIndex + 1} 的定位值不能为空！`, "error");
      return;
    }

    this.uiManager.addLogEntry(`正在测试步骤 ${stepIndex + 1} 的元素定位...`, "info");

    try {
      // 检查Chrome API是否可用
      if (!chrome || !chrome.tabs) {
        this.uiManager.addLogEntry("Chrome tabs API不可用，无法测试元素定位", "error");
        return;
      }

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new window.AutomationUtils.AutomationError("未找到活动标签页", window.AutomationUtils.ErrorTypes.COMMUNICATION);
      }

      const tabId = tabs[0].id;
      const tabUrl = tabs[0].url;

      // 检查是否为受限页面
      if (this.isRestrictedUrl(tabUrl)) {
        this.uiManager.addLogEntry(
          `无法在此页面使用扩展功能: ${tabUrl}`,
          "error"
        );
        this.uiManager.addLogEntry(
          "请在普通网页上使用此功能（如 http:// 或 https:// 页面）",
          "info"
        );
        return;
      }

      this.uiManager.addLogEntry("正在准备测试环境...", "info");

      // 检查scripting API是否可用
      if (chrome.scripting) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["/content/content.js"],
          });
          this.uiManager.addLogEntry("Content script注入成功", "info");
        } catch (injectionError) {
          console.warn('脚本注入失败:', injectionError);
          this.uiManager.addLogEntry("脚本注入失败，可能脚本已存在", "warning");
        }
      } else {
        this.uiManager.addLogEntry("Chrome scripting API不可用", "warning");
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const pingResponse = await this.sendMessageToTabWithTimeout(tabId, {
        action: "ping"
      }, 3000);

      if (!pingResponse || !pingResponse.success) {
        this.uiManager.addLogEntry("无法与页面建立连接，请确保在网页上使用此功能", "error");
        return;
      }

      this.uiManager.addLogEntry("与页面连接成功", "success");

      const response = await this.sendMessageToTabWithTimeout(tabId, {
        action: "testElementLocator",
        locator: step.locator,
      }, 5000);

      if (response && response.success) {
        this.uiManager.addLogEntry(
          `步骤 ${stepIndex + 1} 成功找到 ${response.count} 个元素，已在页面上标记`,
          "success"
        );

        if (step.locator.strategy === "outerhtml") {
          this.uiManager.addLogEntry(
            `outerHTML匹配详情: 找到的元素标签为 ${response.elementInfo || "未知"}`,
            "info"
          );
        }
      } else {
        this.uiManager.addLogEntry(
          `步骤 ${stepIndex + 1} 未找到匹配元素: ${response?.error || "未知错误"}`,
          "error"
        );

        if (step.locator.strategy === "outerhtml") {
          this.uiManager.addLogEntry(
            `outerHTML调试提示: 请确保HTML代码完整，包含开始和结束标签`,
            "warning"
          );
          this.uiManager.addLogEntry(
            `建议: 在浏览器开发者工具中右键元素选择"Copy outerHTML"`,
            "info"
          );
        } else if (step.locator.strategy === "jspath") {
          this.uiManager.addLogEntry(
            `JS路径调试提示: 请确保JS路径格式正确，如 document.querySelector("#btn2")`,
            "warning"
          );
          this.uiManager.addLogEntry(
            `建议: 在浏览器开发者工具中右键元素选择"Copy" → "Copy JS path"`,
            "info"
          );
        }
      }
    } catch (error) {
      window.AutomationUtils.ErrorHandler.logError(error, 'testElementLocator');
      this.uiManager.addLogEntry(
        `测试功能出错: ${window.AutomationUtils.ErrorHandler.getErrorMessage(error)}`,
        "error"
      );
    }
  }

  async testLoopStepElementLocator(stepIndex, loopStepIndex) {
    const steps = this.stepManager.getSteps();
    const loopStep = steps[stepIndex].loopSteps[loopStepIndex];

    if (!loopStep.locator.value) {
      this.uiManager.addLogEntry(
        `步骤 ${stepIndex + 1} 中的循环步骤 ${loopStepIndex + 1} 的定位值不能为空！`,
        "error"
      );
      return;
    }

    this.uiManager.addLogEntry(
      `正在测试步骤 ${stepIndex + 1} 中的循环步骤 ${loopStepIndex + 1} 的元素定位...`,
      "info"
    );

    try {
      // 检查Chrome API是否可用
      if (!chrome || !chrome.tabs) {
        this.uiManager.addLogEntry("Chrome tabs API不可用，无法测试元素定位", "error");
        return;
      }

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new window.AutomationUtils.AutomationError("未找到活动标签页", window.AutomationUtils.ErrorTypes.COMMUNICATION);
      }

      const tabId = tabs[0].id;
      const tabUrl = tabs[0].url;

      // 检查是否为受限页面
      if (this.isRestrictedUrl(tabUrl)) {
        this.uiManager.addLogEntry(
          `无法在此页面使用扩展功能: ${tabUrl}`,
          "error"
        );
        this.uiManager.addLogEntry(
          "请在普通网页上使用此功能（如 http:// 或 https:// 页面）",
          "info"
        );
        return;
      }

      // 先测试连接
      const pingResponse = await this.sendMessageToTabWithTimeout(tabId, {
        action: "ping"
      }, 2000);

      if (!pingResponse || !pingResponse.success) {
        this.uiManager.addLogEntry("无法与页面建立连接，请确保在网页上使用此功能", "error");
        return;
      }

      const response = await this.sendMessageToTabWithTimeout(tabId, {
        action: "testElementLocator",
        locator: loopStep.locator,
      }, 5000);

      if (response && response.success) {
        this.uiManager.addLogEntry(
          `步骤 ${stepIndex + 1} 中的循环步骤 ${loopStepIndex + 1} 成功找到 ${response.count} 个元素，已在页面上标记`,
          "success"
        );
      } else {
        this.uiManager.addLogEntry(
          `步骤 ${stepIndex + 1} 中的循环步骤 ${loopStepIndex + 1} 未找到匹配元素: ${response?.error || "未知错误"}`,
          "error"
        );
      }
    } catch (error) {
      window.AutomationUtils.ErrorHandler.logError(error, 'testLoopStepElementLocator');
      this.uiManager.addLogEntry(
        `测试功能出错: ${window.AutomationUtils.ErrorHandler.getErrorMessage(error)}`,
        "error"
      );
    }
  }

  adjustInputForStrategy(stepElement, strategy) {
    const locatorValueInput = stepElement.querySelector(".locator-value");
    const isOuterHTML = strategy === "outerhtml";

    locatorValueInput.classList.remove("outerhtml-input");

    const existingHint = stepElement.querySelector(".outerhtml-hint");
    if (existingHint) {
      existingHint.remove();
    }

    if (isOuterHTML) {
      locatorValueInput.classList.add("outerhtml-input");
      locatorValueInput.placeholder = '例如：<a data-pos="menu" class="show-in-app">...</a>';
    } else {
      locatorValueInput.placeholder = "输入选择器值...";
    }
  }

  adjustLoopInputForStrategy(loopStepElement, strategy) {
    const locatorValueInput = loopStepElement.querySelector(".loop-locator-value");
    const isOuterHTML = strategy === "outerhtml";

    locatorValueInput.classList.remove("outerhtml-input");

    const existingHint = loopStepElement.querySelector(".outerhtml-hint");
    if (existingHint) {
      existingHint.remove();
    }

    if (isOuterHTML) {
      locatorValueInput.classList.add("outerhtml-input");
      locatorValueInput.placeholder = '例如：<a data-pos="menu" class="show-in-app">...</a>';
    } else {
      locatorValueInput.placeholder = "输入选择器值...";
    }
  }

  sendMessageToTabWithTimeout(tabId, message, timeout = 3000) {
    return new Promise((resolve) => {
      // 检查Chrome API是否可用
      if (!chrome || !chrome.tabs) {
        resolve({ success: false, error: "Chrome tabs API不可用" });
        return;
      }

      const timeoutId = setTimeout(() => {
        resolve({ success: false, error: "通信超时" });
      }, timeout);

      try {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          clearTimeout(timeoutId);

          if (chrome.runtime.lastError) {
            console.error("发送消息失败:", chrome.runtime.lastError.message);
            resolve({ success: false, error: chrome.runtime.lastError.message });
            return;
          }

          resolve(response || { success: false, error: "没有收到响应" });
        });
      } catch (error) {
        clearTimeout(timeoutId);
        console.error("发送消息异常:", error);
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * 检查URL是否为受限页面
   * @param {string} url - 页面URL
   * @returns {boolean} 是否为受限页面
   */
  isRestrictedUrl(url) {
    if (!url) return true;

    const restrictedProtocols = [
      'chrome://',
      'chrome-extension://',
      'moz-extension://',
      'edge://',
      'about:'
    ];

    return restrictedProtocols.some(protocol => url.startsWith(protocol));
  }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
  window.EventHandler = EventHandler;
}

if (typeof window !== 'undefined') {
  window.EventHandler = EventHandler;
}
