/**
 * 内容脚本模块化主文件
 * 负责加载和初始化各个功能模块
 */

console.log('🚀 开始加载模块化内容脚本...');

// 动态加载模块的函数
function loadModule(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
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
    console.log('📦 开始加载内容脚本模块...');
    
    // 1. 首先加载核心模块（提供基础功能）
    await loadModule('modules/content/content-core.js');
    console.log('🔧 核心模块加载完成');
    
    // 2. 然后加载自动化模块（依赖核心模块）
    await loadModule('modules/content/content-automation.js');
    console.log('🤖 自动化模块加载完成');
    
    console.log('🎉 所有内容脚本模块加载完成！');
    
    // 发送模块加载完成的消息
    chrome.runtime.sendMessage({
      action: 'modulesLoaded',
      data: {
        timestamp: Date.now(),
        modules: ['content-core', 'content-automation']
      }
    }).catch(err => {
      console.warn('发送模块加载消息失败:', err);
    });
    
  } catch (error) {
    console.error('❌ 模块加载失败:', error);
    
    // 如果模块加载失败，尝试回退到原始文件
    console.log('🔄 尝试回退到原始内容脚本...');
    try {
      await loadModule('content/content.js');
      console.log('✅ 原始内容脚本加载成功');
    } catch (fallbackError) {
      console.error('❌ 原始内容脚本也加载失败:', fallbackError);
    }
  }
}

// 检查是否在正确的环境中运行
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
  // 立即开始初始化
  initializeModules();
} else {
  console.error('❌ Chrome 扩展环境不可用');
}

// 导出初始化函数供外部调用
window.initializeContentModules = initializeModules;

console.log('📋 模块化内容脚本主文件已加载');