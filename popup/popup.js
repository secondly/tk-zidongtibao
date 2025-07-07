/**
 * 主应用程序入口点
 * 使用模块化架构重构的网页自动操作助手
 */

document.addEventListener("DOMContentLoaded", function () {
  try {
    console.log('开始加载应用程序...');

    // 检查必需的模块是否已加载
    console.log('检查模块加载状态...');
    console.log('AutomationUtils:', typeof window.AutomationUtils);
    console.log('StepManager:', typeof window.StepManager);
    console.log('StepRenderer:', typeof window.StepRenderer);
    console.log('EventHandler:', typeof window.EventHandler);
    console.log('UIManager:', typeof window.UIManager);

    if (typeof window.AutomationUtils === 'undefined') {
      throw new Error('AutomationUtils模块未正确加载');
    }

    const requiredClasses = ['StepManager', 'StepRenderer', 'EventHandler', 'UIManager'];
    const missingClasses = requiredClasses.filter(className => typeof window[className] === 'undefined');

    if (missingClasses.length > 0) {
      throw new Error(`必需的类未正确加载: ${missingClasses.join(', ')}`);
    }

    console.log('所有模块已正确加载');

    // 初始化应用程序
    const app = new AutomationApp();
    app.initialize();

    // 将应用程序实例保存到全局作用域（用于调试）
    window.automationApp = app;

  } catch (error) {
    console.error('应用程序初始化失败:', error);

    // 显示错误信息给用户
    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.textContent = "应用程序加载失败，请刷新页面重试";
      statusElement.className = "status error";
    }
  }
});

/**
 * 主应用程序类
 */
class AutomationApp {
  constructor() {
    this.stepManager = null;
    this.uiManager = null;
    this.stepRenderer = null;
    this.eventHandler = null;
  }

  /**
   * 初始化应用程序
   */
  initialize() {
    try {
      // 创建核心组件实例
      this.stepManager = new window.StepManager();
      this.uiManager = new window.UIManager(this.stepManager);
      this.stepRenderer = new window.StepRenderer(this.stepManager, this.uiManager);
      this.eventHandler = new window.EventHandler(this.stepManager, this.uiManager, this.stepRenderer);

      // 将渲染器和事件处理器注入到UI管理器中
      this.uiManager.stepRenderer = this.stepRenderer;
      this.uiManager.eventHandler = this.eventHandler;

      // 将事件处理器的方法注入到渲染器中
      this.stepRenderer.bindStepEvents = this.eventHandler.bindStepEvents.bind(this.eventHandler);
      this.stepRenderer.bindLoopStepEvents = this.eventHandler.bindLoopStepEvents.bind(this.eventHandler);

      // 加载保存的步骤
      this.uiManager.loadSteps();

      // 设置全局错误处理
      this.setupGlobalErrorHandling();

      console.log('应用程序初始化成功');
    } catch (error) {
      AutomationUtils.ErrorHandler.logError(error, 'App.initialize');
      throw error;
    }
  }

  /**
   * 设置全局错误处理
   */
  setupGlobalErrorHandling() {
    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      window.AutomationUtils.ErrorHandler.logError(
        new Error(event.reason),
        'unhandledrejection'
      );

      if (this.uiManager) {
        this.uiManager.addLogEntry(
          `未处理的错误: ${window.AutomationUtils.ErrorHandler.getErrorMessage(event.reason)}`,
          "error"
        );
      }

      event.preventDefault();
    });

    // 捕获未处理的错误
    window.addEventListener('error', (event) => {
      window.AutomationUtils.ErrorHandler.logError(
        event.error || new Error(event.message),
        'globalError'
      );

      if (this.uiManager) {
        this.uiManager.addLogEntry(
          `全局错误: ${event.message}`,
          "error"
        );
      }
    });
  }

  /**
   * 获取应用程序实例（用于调试）
   */
  static getInstance() {
    return window.automationApp;
  }
}

// 将应用程序类保存到全局作用域
window.AutomationApp = AutomationApp;