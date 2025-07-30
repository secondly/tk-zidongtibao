/**
 * 内容脚本模块化主文件
 * 负责加载和初始化各个功能模块
 */

console.log("🚀 开始加载模块化内容脚本...");
console.log("🔍 环境检查:");
console.log("  - typeof chrome:", typeof chrome);
console.log("  - chrome.runtime:", !!chrome?.runtime);
console.log("  - chrome.runtime.getURL:", !!chrome?.runtime?.getURL);

// 动态加载模块的函数
function loadModule(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(src);
    script.onload = () => {
      console.log(`✅ 模块加载成功: ${src}`);
      resolve();
    };
    script.onerror = (error) => {
      console.error(`❌ 模块加载失败: ${src}`, error);
      reject(error);
    };
    document.documentElement.appendChild(script);
  });
}

// 按顺序加载所有模块
async function initializeModules() {
  try {
    // 检查是否已经初始化过
    if (window.contentModulesInitialized) {
      console.log("📦 模块已经初始化过，跳过重复加载");
      return;
    }

    console.log("📦 开始加载内容脚本模块...");
    console.log("🔍 当前环境检查:");
    console.log("  - document.readyState:", document.readyState);
    console.log("  - window.location.href:", window.location.href);
    console.log("  - chrome.runtime.getURL可用:", typeof chrome.runtime.getURL === 'function');

    // 1. 首先加载核心模块（提供基础功能）
    if (!window.ContentCore) {
      await loadModule("modules/content/content-core.js");
      console.log("🔧 核心模块加载完成");
    } else {
      console.log("🔧 核心模块已存在，跳过加载");
    }

    // 2. 加载敏感词检测模块
    if (!window.SensitiveWordDetector) {
      await loadModule("modules/content/sensitive-word-detector.js");
      console.log("🔍 敏感词检测模块加载完成");
    } else {
      console.log("🔍 敏感词检测模块已存在，跳过加载");
    }

    // 3. 然后加载自动化模块（依赖核心模块和敏感词检测模块）
    if (!window.ContentAutomation) {
      await loadModule("modules/content/content-automation.js");
      console.log("🤖 自动化模块加载完成");
    } else {
      console.log("🤖 自动化模块已存在，跳过加载");
    }

    // 4. 加载浮层控制面板模块
    if (!window.FloatingControlPanel) {
      await loadModule("modules/content/floating-control-panel.js");
      console.log("🎛️ 浮层控制面板模块加载完成");
    } else {
      console.log("🎛️ 浮层控制面板模块已存在，跳过加载");
    }

    console.log("🎉 所有内容脚本模块加载完成！");

    // 验证关键模块是否正确加载
    console.log("🔍 模块加载验证:");
    console.log("  - ContentCore:", !!window.ContentCore);
    console.log("  - ContentAutomation:", !!window.ContentAutomation);
    console.log("  - executeUniversalWorkflow:", !!window.ContentAutomation?.executeUniversalWorkflow);
    console.log("  - FloatingControlPanel:", !!window.FloatingControlPanel);

    // 标记模块已初始化
    window.contentModulesInitialized = true;

    // 发送模块加载完成的消息
    chrome.runtime
      .sendMessage({
        action: "modulesLoaded",
        data: {
          timestamp: Date.now(),
          modules: [
            "content-core",
            "sensitive-word-detector",
            "content-automation",
            "floating-control-panel",
          ],
        },
      })
      .catch((err) => {
        console.warn("发送模块加载消息失败:", err);
      });
  } catch (error) {
    console.error("❌ 模块加载失败:", error);

    // 如果模块加载失败，尝试回退到原始文件
    console.log("🔄 尝试回退到原始内容脚本...");
    try {
      await loadModule("content/content.js");
      console.log("✅ 原始内容脚本加载成功");
    } catch (fallbackError) {
      console.error("❌ 原始内容脚本也加载失败:", fallbackError);
    }
  }
}

// 检查是否在正确的环境中运行
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
  console.log("🚀 Chrome扩展环境检测通过，开始初始化模块...");
  // 立即开始初始化
  initializeModules().catch(error => {
    console.error("❌ 模块初始化失败:", error);
  });
} else {
  console.error("❌ Chrome 扩展环境不可用");
  console.error("  - chrome:", typeof chrome);
  console.error("  - chrome.runtime:", typeof chrome?.runtime);
  console.error("  - chrome.runtime.getURL:", typeof chrome?.runtime?.getURL);
}

// 导出初始化函数供外部调用
window.initializeContentModules = initializeModules;

console.log("📋 模块化内容脚本主文件已加载");

// 强制初始化模块（防止自动初始化失败）
setTimeout(() => {
  if (!window.contentModulesInitialized) {
    console.log("⚠️ 检测到模块未初始化，强制启动初始化...");
    initializeModules().catch(error => {
      console.error("❌ 强制初始化失败:", error);
    });
  } else {
    console.log("✅ 模块已初始化，跳过强制初始化");
  }
}, 1000);

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`Content script收到消息:`, message);

  if (message.type === 'sendToLocalStorage') {
    const { key, value } = message.data;
    localStorage.setItem(key, value);
    console.log(`✅ 已保存到localStorage: ${key}`);
    sendResponse({success: true});
    return true;
  }

  // 处理工作流执行请求
  if (message.action === 'executeWorkflow') {
    console.log(`🚀 收到工作流执行请求:`, message.data);

    // 确保模块已初始化
    ensureModulesLoaded()
      .then(() => {
        // 使用ContentCore的完整执行逻辑
        if (window.ContentCore && window.ContentCore.handleMessage) {
          console.log(`✅ 使用ContentCore处理工作流执行`);
          window.ContentCore.handleMessage(message, sender, sendResponse);
        } else {
          throw new Error('ContentCore模块未正确加载');
        }
      })
      .catch(error => {
        console.error(`❌ 工作流执行失败:`, error);
        sendResponse({ success: false, error: error.message });

        // 发送错误状态到浮层
        sendStatusToFloatingPanel({
          isRunning: false,
          isPaused: false,
          message: '执行失败: ' + error.message
        });
      });

    return true; // 保持消息通道开放
  }

  // 转发执行状态更新到浮层控制面板
  if (message.action === 'executionStatusUpdate' || message.action === 'executionProgress') {
    const event = new CustomEvent('automationStatusUpdate', {
      detail: {
        action: message.action,
        data: message.data || message
      }
    });
    document.dispatchEvent(event);
    console.log(`📡 转发状态更新到浮层: ${message.action}`);
  }

  return true; // 保持消息通道开放
});

// 监听来自浮层控制面板的 postMessage
window.addEventListener('message', (event) => {
  // 确保消息来源是当前窗口
  if (event.source !== window) return;

  // 检查消息类型
  if (event.data.type === 'TO_BACKGROUND_SCRIPT') {
    const { payload } = event.data;
    console.log(`📡 Content script收到浮层消息，转发到background:`, payload);

    // 转发到 background script
    chrome.runtime.sendMessage({
      action: 'forwardToContentScript',
      targetAction: payload.action,
      targetData: payload.data
    }).then(response => {
      console.log(`✅ 消息转发成功:`, response);
    }).catch(error => {
      console.error(`❌ 消息转发失败:`, error);
    });
  }
});

// 处理工作流执行
async function handleWorkflowExecution(workflowData) {
  console.log('🚀 开始执行工作流:', workflowData);

  try {
    // 发送状态更新到浮层
    sendStatusToFloatingPanel({
      isRunning: true,
      isPaused: false,
      message: '正在准备执行...'
    });

    // 检查模块是否已经加载
    if (window.ContentAutomation && window.ContentAutomation.executeUniversalWorkflow) {
      console.log('✅ 模块已加载，直接执行');
    } else {
      console.log('⏳ 模块未加载，等待加载完成...');
      sendStatusToFloatingPanel({
        isRunning: true,
        isPaused: false,
        message: '等待模块加载...'
      });

      // 等待模块加载完成
      await waitForModules();
    }

    // 更新状态为执行中
    sendStatusToFloatingPanel({
      isRunning: true,
      isPaused: false,
      message: '工作流执行中...'
    });

    // 调用自动化执行模块
    if (window.ContentAutomation && window.ContentAutomation.executeUniversalWorkflow) {
      const result = await window.ContentAutomation.executeUniversalWorkflow(workflowData);

      // 发送成功状态
      sendStatusToFloatingPanel({
        isRunning: false,
        isPaused: false,
        message: '执行完成'
      });

      console.log('✅ 工作流执行成功:', result);
    } else {
      throw new Error('自动化执行模块未加载');
    }
  } catch (error) {
    console.error('❌ 工作流执行失败:', error);

    // 发送错误状态
    sendStatusToFloatingPanel({
      isRunning: false,
      isPaused: false,
      message: '执行失败: ' + error.message
    });
  }
}

// 处理暂停执行
function handlePauseExecution() {
  console.log('⏸️ 暂停执行');

  if (window.simplifiedExecutionControl && window.simplifiedExecutionControl.pause) {
    window.simplifiedExecutionControl.pause();
    sendStatusToFloatingPanel({
      isRunning: true,
      isPaused: true,
      message: '执行已暂停'
    });
  } else {
    console.warn('⚠️ 暂停功能不可用');
  }
}

// 处理恢复执行
function handleResumeExecution() {
  console.log('▶️ 恢复执行');

  if (window.simplifiedExecutionControl && window.simplifiedExecutionControl.resume) {
    window.simplifiedExecutionControl.resume();
    sendStatusToFloatingPanel({
      isRunning: true,
      isPaused: false,
      message: '执行已恢复'
    });
  } else {
    console.warn('⚠️ 恢复功能不可用');
  }
}

// 处理停止执行
function handleStopExecution() {
  console.log('⏹️ 停止执行');

  if (window.simplifiedExecutionControl) {
    window.simplifiedExecutionControl.isStopped = true;
    window.simplifiedExecutionControl.isPaused = false;
    sendStatusToFloatingPanel({
      isRunning: false,
      isPaused: false,
      message: '执行已停止'
    });
  } else {
    console.warn('⚠️ 停止功能不可用');
  }
}

// 发送状态更新到浮层
function sendStatusToFloatingPanel(statusData) {
  const message = {
    type: 'FROM_CONTENT_SCRIPT',
    action: 'executionStatusUpdate',
    data: statusData,
    timestamp: Date.now()
  };

  window.postMessage(message, '*');
  console.log('📤 发送状态更新到浮层:', statusData);
}

// 确保模块已加载，如果没有则强制初始化
async function ensureModulesLoaded() {
  console.log('🔍 检查模块加载状态...');

  // 如果模块已经加载，直接返回
  if (window.ContentCore && window.ContentAutomation && window.ContentAutomation.executeUniversalWorkflow) {
    console.log('✅ 模块已加载，直接使用');
    return;
  }

  // 如果模块未加载，强制初始化
  console.log('⚠️ 模块未加载，强制初始化...');

  if (!window.contentModulesInitialized) {
    await initializeModules();
  }

  // 等待模块加载完成
  await waitForModules(15000); // 增加等待时间到15秒
}

// 等待模块加载完成
function waitForModules(maxWait = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let checkCount = 0;

    const checkModules = () => {
      checkCount++;
      const elapsed = Date.now() - startTime;

      console.log(`🔍 检查模块加载状态 (第${checkCount}次, 已等待${elapsed}ms):`);
      console.log('  - window.ContentAutomation:', !!window.ContentAutomation);
      console.log('  - executeUniversalWorkflow:', !!window.ContentAutomation?.executeUniversalWorkflow);
      console.log('  - window.ContentCore:', !!window.ContentCore);
      console.log('  - window.SensitiveWordDetector:', !!window.SensitiveWordDetector);

      if (window.ContentAutomation && window.ContentAutomation.executeUniversalWorkflow) {
        console.log('✅ 模块加载完成');
        resolve();
      } else if (elapsed > maxWait) {
        console.error('❌ 模块加载超时，当前状态:');
        console.error('  - ContentAutomation:', window.ContentAutomation);
        console.error('  - executeUniversalWorkflow:', window.ContentAutomation?.executeUniversalWorkflow);
        reject(new Error('模块加载超时'));
      } else {
        setTimeout(checkModules, 200);
      }
    };

    checkModules();
  });
}



