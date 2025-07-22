/**
 * 内容脚本自动化执行模块
 * 负责工作流执行、步骤处理、循环控制等自动化功能
 */

/**
 * 执行通用自动化工作流
 * @param {object} workflow - 工作流配置
 * @returns {Promise<object>} - 执行结果
 */
async function executeUniversalWorkflow(workflow) {
  try {
    console.log('🚀 开始执行通用自动化工作流:', workflow.name);

    // 尝试加载引擎，如果失败则使用简化执行
    let useAdvancedEngine = false;
    try {
      await loadUniversalAutomationEngine();
      useAdvancedEngine = true;
      console.log('✅ 使用高级自动化引擎');
    } catch (error) {
      console.log('⚠️ 引擎加载失败，使用简化执行模式:', error.message);
      useAdvancedEngine = false;
    }

    if (useAdvancedEngine && window.UniversalAutomationEngine) {
      // 使用高级引擎
      if (!window.automationEngine) {
        window.automationEngine = new window.UniversalAutomationEngine();

        // 设置进度回调
        window.automationEngine.onProgress = (progress) => {
          console.log('📊 执行进度更新:', progress);
          chrome.runtime.sendMessage({
            action: 'executionProgress',
            data: progress
          });
        };

        // 设置完成回调
        window.automationEngine.onComplete = (stats) => {
          console.log('✅ 执行完成:', stats);
          chrome.runtime.sendMessage({
            action: 'executionComplete',
            data: stats
          });
        };

        // 设置错误回调
        window.automationEngine.onError = (error) => {
          console.error('❌ 执行错误:', error);
          chrome.runtime.sendMessage({
            action: 'executionError',
            data: { error: error.message }
          });
        };
      }

      // 执行工作流
      const result = await window.automationEngine.execute(workflow);
      console.log('✅ 工作流执行完成');
      return { success: true, result };
    } else {
      // 使用简化执行模式
      console.log('🔄 使用简化执行模式');
      return await executeSimplifiedWorkflow(workflow);
    }

  } catch (error) {
    console.error('❌ 通用工作流执行失败:', error);
    throw error;
  }
}

/**
 * 简化执行模式 - 当高级引擎加载失败时使用
 */
async function executeSimplifiedWorkflow(workflow) {
  console.log('🔄 开始简化执行模式');

  let completedSteps = 0;
  const totalSteps = workflow.steps.length;

  // 创建简化模式的执行控制对象
  window.simplifiedExecutionControl = {
    isPaused: false,
    pausePromise: null,
    pauseResolve: null,

    pause() {
      console.log('🔧 [DEBUG] 简化模式 pause() 被调用');
      this.isPaused = true;
      console.log('🔧 [DEBUG] 简化模式暂停状态设置为:', this.isPaused);
      console.log('⏸️ 简化模式执行已暂停');

      // 发送暂停确认消息
      chrome.runtime.sendMessage({
        action: 'executionPaused',
        data: { isPaused: true }
      }).catch(err => console.error('发送暂停消息失败:', err));
    },

    resume() {
      console.log('🔧 [DEBUG] 简化模式 resume() 被调用');
      this.isPaused = false;
      console.log('🔧 [DEBUG] 简化模式暂停状态设置为:', this.isPaused);
      console.log('▶️ 简化模式继续执行');

      if (this.pauseResolve) {
        this.pauseResolve();
        this.pauseResolve = null;
        this.pausePromise = null;
      }

      // 发送继续确认消息
      chrome.runtime.sendMessage({
        action: 'executionResumed',
        data: { isPaused: false }
      }).catch(err => console.error('发送继续消息失败:', err));
    },

    async checkPause() {
      console.log('🔧 [DEBUG] checkPause 被调用，当前暂停状态:', this.isPaused);
      if (this.isPaused) {
        console.log('🔧 [DEBUG] 检测到暂停状态，开始等待...');
        if (!this.pausePromise) {
          console.log('🔧 [DEBUG] 创建新的暂停Promise');
          this.pausePromise = new Promise(resolve => {
            this.pauseResolve = resolve;
          });
        }
        console.log('🔧 [DEBUG] 等待暂停Promise解决...');
        await this.pausePromise;
        console.log('🔧 [DEBUG] 暂停Promise已解决，继续执行');
      }
    }
  };

  // 暂停检查函数
  const checkPause = () => window.simplifiedExecutionControl.checkPause();

  // 发送初始进度
  chrome.runtime.sendMessage({
    action: 'executionProgress',
    data: {
      isRunning: true,
      isPaused: false,
      startTime: Date.now(),
      totalSteps: totalSteps,
      completedSteps: 0,
      currentOperation: '开始执行工作流...'
    }
  });

  try {
    // 设置整体执行超时（5分钟）
    const executionTimeout = setTimeout(() => {
      throw new Error('工作流执行超时（5分钟）');
    }, 5 * 60 * 1000);

    for (let i = 0; i < workflow.steps.length; i++) {
      console.log(`🔧 [DEBUG] 准备执行步骤 ${i + 1}/${totalSteps}`);
      // 检查是否需要暂停
      await checkPause();
      console.log(`🔧 [DEBUG] 暂停检查完成，继续执行步骤 ${i + 1}`);

      const step = workflow.steps[i];
      console.log(`🎯 执行步骤 ${i + 1}/${totalSteps}: ${step.name} (${step.type})`);

      // 更新进度
      chrome.runtime.sendMessage({
        action: 'executionProgress',
        data: {
          completedSteps: i,
          currentOperation: `执行步骤: ${step.name || step.type}`
        }
      });

      // 为每个步骤设置超时
      const stepTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`步骤执行超时: ${step.name || step.type}`)), 30000);
      });

      const stepExecution = (async () => {
        switch (step.type) {
          case 'click':
            await executeClickStep(step);
            break;
          case 'input':
            await executeInputStep(step);
            break;
          case 'wait':
            await executeWaitStep(step);
            break;
          case 'smartWait':
            await executeSmartWaitStep(step);
            break;
          case 'loop':
            await executeLoopStep(step);
            break;
          case 'condition':
            await executeConditionStep(step);
            break;
          default:
            console.log(`⚠️ 跳过不支持的步骤类型: ${step.type}`);
        }
      })();

      // 等待步骤完成或超时
      await Promise.race([stepExecution, stepTimeout]);

      completedSteps++;

      // 更新完成进度
      chrome.runtime.sendMessage({
        action: 'executionProgress',
        data: {
          completedSteps: completedSteps
        }
      });

      // 步骤间等待（支持暂停）
      console.log('🔧 [DEBUG] 步骤间等待开始');
      const waitDuration = 200;
      const waitStartTime = Date.now();
      while (Date.now() - waitStartTime < waitDuration) {
        // 在等待期间检查暂停状态
        await checkPause();
        await new Promise(resolve => setTimeout(resolve, Math.min(50, waitDuration - (Date.now() - waitStartTime))));
      }
    }

    // 清除超时
    clearTimeout(executionTimeout);
    console.log('🔧 [DEBUG] 所有步骤执行完成');

    // 发送完成消息
    chrome.runtime.sendMessage({
      action: 'executionComplete',
      data: {
        successCount: completedSteps,
        errorCount: 0,
        totalSteps: totalSteps
      }
    });

    console.log('✅ 简化模式工作流执行完成');
    return { success: true, message: '工作流执行完成' };

  } catch (error) {
    console.error('❌ 简化模式执行失败:', error);

    // 发送错误消息
    chrome.runtime.sendMessage({
      action: 'executionError',
      data: { error: error.message }
    });

    throw error;
  } finally {
    // 清理简化执行控制对象
    window.simplifiedExecutionControl = null;
    console.log('🧹 简化模式执行控制已清理');
  }
}

/**
 * 动态加载通用自动化引擎
 */
async function loadUniversalAutomationEngine() {
  return new Promise((resolve, reject) => {
    console.log('🔄 开始加载通用自动化引擎...');

    // 检查是否已经加载
    if (window.UniversalAutomationEngine && typeof window.UniversalAutomationEngine === 'function') {
      console.log('✅ 通用自动化引擎已存在');
      resolve();
      return;
    }

    // 设置加载超时 - 3秒超时
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ 引擎加载超时，将使用简化执行模式');
      reject(new Error('引擎加载超时'));
    }, 3000);

    // 清理所有旧的脚本和全局变量
    const oldScripts = document.querySelectorAll('script[data-automation-engine="true"]');
    oldScripts.forEach(script => {
      console.log('🗑️ 移除旧的引擎脚本');
      script.remove();
    });

    // 清理全局变量，避免重复声明错误
    if (typeof window.UniversalAutomationEngine !== 'undefined') {
      console.log('🗑️ 清理旧的引擎全局变量');
      delete window.UniversalAutomationEngine;
    }
    if (typeof window.automationEngine !== 'undefined') {
      console.log('🗑️ 清理旧的引擎实例');
      delete window.automationEngine;
    }

    // 创建脚本标签注入到页面
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('universal-automation-engine.js');
    script.setAttribute('data-automation-engine', 'true');

    // 监听脚本加载事件
    script.onload = () => {
      console.log('📜 引擎脚本文件加载完成');
      // 给一点时间让脚本执行
      setTimeout(() => {
        if (window.UniversalAutomationEngine && typeof window.UniversalAutomationEngine === 'function') {
          console.log('✅ 引擎加载成功');
          clearTimeout(timeoutId);
          resolve();
        } else {
          console.error('❌ 引擎脚本加载后仍不可用');
          clearTimeout(timeoutId);
          reject(new Error('引擎脚本加载后不可用'));
        }
      }, 200);
    };

    script.onerror = (error) => {
      console.error('❌ 引擎脚本加载失败:', error);
      clearTimeout(timeoutId);
      reject(new Error('引擎脚本加载失败'));
    };

    // 注入到页面而不是content script上下文
    document.documentElement.appendChild(script);
  });
}

// 简单的步骤执行函数
async function executeClickStep(step) {
  console.log('🔧 [DEBUG] executeClickStep 开始执行');

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  if (!step.locator) {
    throw new Error('缺少定位器');
  }

  console.log('🔧 [DEBUG] 查找元素:', step.locator);
  console.log('🔧 [DEBUG] 定位策略:', step.locator.strategy);
  console.log('🔧 [DEBUG] 定位值:', step.locator.value);

  // 检查定位器的完整性
  if (!step.locator.strategy) {
    // 尝试从旧格式转换
    if (step.locator.type) {
      console.log('🔄 检测到旧格式定位器，进行转换');
      step.locator.strategy = step.locator.type;
    } else {
      throw new Error('定位器缺少策略(strategy)字段');
    }
  }

  if (!step.locator.value) {
    throw new Error('定位器缺少值(value)字段');
  }

  const element = await window.ContentCore.findElementByStrategy(step.locator.strategy, step.locator.value);
  if (!element) {
    throw new Error(`找不到元素: ${step.locator.strategy}=${step.locator.value}`);
  }

  console.log('🔧 [DEBUG] 找到目标元素，准备执行点击操作');
  console.log('🔧 [DEBUG] 元素信息:', {
    tagName: element.tagName,
    id: element.id,
    className: element.className,
    textContent: element.textContent?.substring(0, 50) + '...'
  });

  // 滚动到元素位置
  console.log('🔧 [DEBUG] 滚动到目标元素');
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });

  // 等待滚动完成
  await new Promise(resolve => setTimeout(resolve, 500));

  // 高亮显示元素
  console.log('🔧 [DEBUG] 高亮显示目标元素');
  window.ContentCore.highlightElement(element, 'click');

  // 设置自动清除高亮
  setTimeout(() => {
    window.ContentCore.clearElementHighlight(element);
  }, 2000);

  // 检查元素是否可见和可点击
  const rect = element.getBoundingClientRect();
  const isVisible = rect.width > 0 && rect.height > 0 &&
    rect.top >= 0 && rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth;

  console.log('🔧 [DEBUG] 元素可见性检查:', {
    isVisible,
    rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left }
  });

  // 执行点击
  console.log('🔧 [DEBUG] 执行点击操作');
  element.click();

  // 等待点击效果
  await new Promise(resolve => setTimeout(resolve, 200));

  console.log(`✅ 点击元素完成: ${step.locator.value}`);
}

async function executeInputStep(step) {
  console.log('🔧 [DEBUG] executeInputStep 开始执行');

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  const text = step.text || step.inputText || '';

  if (!step.locator) {
    throw new Error('缺少定位器');
  }

  console.log('🔧 [DEBUG] 查找输入元素:', step.locator);

  // 检查定位器的完整性
  if (!step.locator.strategy) {
    // 尝试从旧格式转换
    if (step.locator.type) {
      console.log('🔄 检测到旧格式定位器，进行转换');
      step.locator.strategy = step.locator.type;
    } else {
      throw new Error('定位器缺少策略(strategy)字段');
    }
  }

  if (!step.locator.value) {
    throw new Error('定位器缺少值(value)字段');
  }

  const element = await window.ContentCore.findElementByStrategy(step.locator.strategy, step.locator.value);
  if (!element) {
    throw new Error(`找不到元素: ${step.locator.strategy}=${step.locator.value}`);
  }

  console.log('🔧 [DEBUG] 找到输入元素，准备输入文本:', text);
  console.log('🔧 [DEBUG] 输入元素信息:', {
    tagName: element.tagName,
    type: element.type,
    id: element.id,
    className: element.className
  });

  // 滚动到元素位置
  console.log('🔧 [DEBUG] 滚动到输入元素');
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });

  // 等待滚动完成
  await new Promise(resolve => setTimeout(resolve, 300));

  // 高亮显示元素
  console.log('🔧 [DEBUG] 高亮显示输入元素');
  window.ContentCore.highlightElement(element, 'input');

  // 设置自动清除高亮
  setTimeout(() => {
    window.ContentCore.clearElementHighlight(element);
  }, 2000);

  // 聚焦元素
  element.focus();

  // 清空现有内容（如果需要）
  if (step.clearFirst !== false) {
    element.value = '';
  }

  // 输入文本
  console.log('🔧 [DEBUG] 执行文本输入');
  element.value = text;

  // 触发输入事件
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));

  // 等待输入效果
  await new Promise(resolve => setTimeout(resolve, 200));

  console.log(`✅ 输入文本完成: "${text}"`);
}

async function executeWaitStep(step) {
  console.log('🔧 [DEBUG] executeWaitStep 开始执行');

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  const duration = step.duration || step.waitTime || 1000;
  console.log(`⏳ 等待 ${duration}ms`);

  // 在等待过程中也要支持暂停
  const startTime = Date.now();
  while (Date.now() - startTime < duration) {
    // 每100ms检查一次暂停状态
    if (window.simplifiedExecutionControl) {
      await window.simplifiedExecutionControl.checkPause();
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(100, duration - (Date.now() - startTime))));
  }

  console.log(`✅ 等待完成`);
}

async function executeSmartWaitStep(step) {
  console.log('🔧 [DEBUG] executeSmartWaitStep 开始执行');

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  if (!step.locator) {
    throw new Error('智能等待缺少定位器');
  }

  console.log('🔧 [DEBUG] 智能等待定位器:', step.locator);

  // 检查定位器的完整性
  if (!step.locator.strategy) {
    // 尝试从旧格式转换
    if (step.locator.type) {
      console.log('🔄 检测到旧格式智能等待定位器，进行转换');
      step.locator.strategy = step.locator.type;
    } else {
      throw new Error('智能等待定位器缺少策略(strategy)字段');
    }
  }

  if (!step.locator.value) {
    throw new Error('智能等待定位器缺少值(value)字段');
  }

  const timeout = step.timeout || 30000;
  const checkInterval = step.checkInterval || 500;

  console.log(`🔍 智能等待元素出现: ${step.locator.strategy}=${step.locator.value}, 超时: ${timeout}ms`);

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    // 检查暂停状态
    if (window.simplifiedExecutionControl) {
      await window.simplifiedExecutionControl.checkPause();
    }

    try {
      const element = await window.ContentCore.findElementByStrategy(step.locator.strategy, step.locator.value);
      if (element) {
        console.log(`✅ 智能等待成功: 元素已出现`);
        return;
      }
    } catch (error) {
      // 如果是暂停导致的错误，重新抛出
      if (error.message === '查找已暂停') {
        throw error;
      }
      // 其他错误继续等待
    }

    // 使用异步等待避免阻塞主线程
    await new Promise(resolve => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => setTimeout(resolve, checkInterval));
      } else {
        setTimeout(resolve, checkInterval);
      }
    });
  }

  throw new Error(`智能等待超时: 元素未在 ${timeout}ms 内出现`);
}

// 执行条件判断步骤
async function executeConditionStep(step) {
  console.log(`🧪 执行条件判断步骤:`, step);

  const locator = step.locator;
  if (!locator) {
    throw new Error('条件判断步骤缺少定位器配置');
  }

  console.log('🔧 [DEBUG] 条件判断定位器:', locator);

  // 检查定位器的完整性
  if (!locator.strategy) {
    // 尝试从旧格式转换
    if (locator.type) {
      console.log('🔄 检测到旧格式条件定位器，进行转换');
      locator.strategy = locator.type;
    } else {
      throw new Error('条件判断定位器缺少策略(strategy)字段');
    }
  }

  if (!locator.value) {
    throw new Error('条件判断定位器缺少值(value)字段');
  }

  // 查找元素
  const element = findSingleElement(locator.strategy, locator.value);
  if (!element) {
    throw new Error(`条件判断失败: 找不到元素 (${locator.strategy}: ${locator.value})`);
  }

  // 高亮元素
  window.ContentCore.highlightElement(element, 'processing');

  // 执行条件判断
  let conditionResult = false;
  let actualValue = '';
  const expectedValue = step.expectedValue || '';
  const attributeName = step.attributeName || '';

  try {
    // 获取实际值
    switch (step.conditionType) {
      case 'attribute':
        actualValue = element.getAttribute(attributeName) || '';
        break;
      case 'text':
        actualValue = element.textContent || '';
        break;
      case 'class':
        actualValue = element.className || '';
        break;
      case 'style':
        actualValue = getComputedStyle(element)[attributeName] || '';
        break;
      case 'value':
        actualValue = element.value || '';
        break;
      case 'exists':
        conditionResult = true; // 元素已找到
        break;
      case 'visible':
        conditionResult = element.offsetParent !== null;
        break;
    }

    // 执行比较
    if (step.conditionType !== 'exists' && step.conditionType !== 'visible') {
      switch (step.comparisonType) {
        case 'equals':
          conditionResult = actualValue === expectedValue;
          break;
        case 'notEquals':
          conditionResult = actualValue !== expectedValue;
          break;
        case 'contains':
          conditionResult = actualValue.includes(expectedValue);
          break;
        case 'notContains':
          conditionResult = !actualValue.includes(expectedValue);
          break;
        case 'startsWith':
          conditionResult = actualValue.startsWith(expectedValue);
          break;
        case 'endsWith':
          conditionResult = actualValue.endsWith(expectedValue);
          break;
        case 'isEmpty':
          conditionResult = actualValue === '';
          break;
        case 'isNotEmpty':
          conditionResult = actualValue !== '';
          break;
        case 'hasAttribute':
          conditionResult = element.hasAttribute(attributeName);
          break;
        case 'notHasAttribute':
          conditionResult = !element.hasAttribute(attributeName);
          break;
      }
    }

    // 显示结果
    if (conditionResult) {
      window.ContentCore.highlightElement(element, 'success');
      console.log(`✅ 条件判断通过: ${step.conditionType} ${step.comparisonType} "${expectedValue}" (实际值: "${actualValue}")`);
    } else {
      window.ContentCore.highlightElement(element, 'error');
      console.log(`❌ 条件判断失败: ${step.conditionType} ${step.comparisonType} "${expectedValue}" (实际值: "${actualValue}")`);
      throw new Error(`条件判断失败: 期望 ${step.conditionType} ${step.comparisonType} "${expectedValue}"，实际值为 "${actualValue}"`);
    }

    // 等待一下让用户看到结果
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    window.ContentCore.highlightElement(element, 'error');
    throw error;
  }
}

async function executeLoopStep(step) {
  if (!step.locator) {
    throw new Error('缺少循环定位器');
  }

  console.log('🔧 [DEBUG] 循环步骤定位器:', step.locator);

  // 检查定位器的完整性
  if (!step.locator.strategy) {
    // 尝试从旧格式转换
    if (step.locator.type) {
      console.log('🔄 检测到旧格式循环定位器，进行转换');
      step.locator.strategy = step.locator.type;
    } else {
      throw new Error('循环定位器缺少策略(strategy)字段');
    }
  }

  if (!step.locator.value) {
    throw new Error('循环定位器缺少值(value)字段');
  }

  const elements = await window.ContentCore.findElementsByStrategy(step.locator.strategy, step.locator.value);
  if (elements.length === 0) {
    throw new Error(`找不到循环元素: ${step.locator.strategy}=${step.locator.value}`);
  }

  const startIndex = step.startIndex || 0;
  const endIndex = step.endIndex === -1 ? elements.length - 1 : (step.endIndex || elements.length - 1);
  const actualEndIndex = Math.min(endIndex, elements.length - 1);

  console.log(`🔄 开始执行${step.loopType === 'simpleLoop' ? '简单' : '父级'}循环: ${elements.length} 个元素，范围 ${startIndex}-${actualEndIndex}`);

  for (let i = startIndex; i <= actualEndIndex; i++) {
    console.log(`🔧 [DEBUG] 循环第 ${i + 1} 个元素前检查暂停状态`);

    // 在每个循环迭代前检查暂停状态
    if (window.simplifiedExecutionControl) {
      await window.simplifiedExecutionControl.checkPause();
    }

    const element = elements[i];
    console.log(`🎯 处理第 ${i + 1}/${elements.length} 个元素`);

    // 记录当前页面滚动位置
    const scrollBefore = {
      x: window.pageXOffset || document.documentElement.scrollLeft,
      y: window.pageYOffset || document.documentElement.scrollTop
    };
    console.log('🔧 [DEBUG] 操作前页面滚动位置:', scrollBefore);

    try {
      if (step.loopType === 'simpleLoop') {
        // 简单循环：执行单一操作
        await executeSimpleLoopAction(element, step);
      } else {
        // 父级循环：点击后执行子操作
        await executeParentLoopAction(element, step);
      }

      // 记录操作后的滚动位置
      const scrollAfter = {
        x: window.pageXOffset || document.documentElement.scrollLeft,
        y: window.pageYOffset || document.documentElement.scrollTop
      };
      console.log('🔧 [DEBUG] 操作后页面滚动位置:', scrollAfter);

      if (scrollBefore.y !== scrollAfter.y || scrollBefore.x !== scrollAfter.x) {
        console.log('✅ 页面滚动已发生，滚动距离:', {
          deltaX: scrollAfter.x - scrollBefore.x,
          deltaY: scrollAfter.y - scrollBefore.y
        });
      }

      // 循环间隔（支持暂停）
      if (step.loopDelay) {
        console.log(`🔧 [DEBUG] 循环延迟开始: ${step.loopDelay}ms`);
        const delayStartTime = Date.now();
        while (Date.now() - delayStartTime < step.loopDelay) {
          // 在延迟期间检查暂停状态
          if (window.simplifiedExecutionControl) {
            await window.simplifiedExecutionControl.checkPause();
          }
          await new Promise(resolve => setTimeout(resolve, Math.min(100, step.loopDelay - (Date.now() - delayStartTime))));
        }
        console.log(`🔧 [DEBUG] 循环延迟完成`);
      }

    } catch (error) {
      console.error(`❌ 第 ${i + 1} 个元素处理失败:`, error);
      if (step.errorHandling === 'stop') {
        throw error;
      }
    }
  }

  console.log(`✅ 循环执行完成`);
}

async function executeSimpleLoopAction(element, step) {
  console.log('🔧 [DEBUG] executeSimpleLoopAction 开始执行');

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  const actionType = step.actionType || 'click';
  console.log(`🔧 执行简单操作: ${actionType}`);

  switch (actionType) {
    case 'click':
      console.log(`🔧 [DEBUG] 准备点击循环元素`);
      console.log('🔧 [DEBUG] 循环元素信息:', {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        textContent: element.textContent?.substring(0, 50) + '...'
      });

      // 滚动到元素位置
      console.log('🔧 [DEBUG] 滚动到循环目标元素');
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });

      // 等待滚动完成
      await new Promise(resolve => setTimeout(resolve, 300));

      // 高亮显示元素
      console.log('🔧 [DEBUG] 高亮显示循环目标元素');
      window.ContentCore.highlightElement(element, 'loop');

      // 设置自动清除高亮
      setTimeout(() => {
        window.ContentCore.clearElementHighlight(element);
      }, 1500);

      // 检查元素可见性
      const rect = element.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      console.log('🔧 [DEBUG] 循环元素可见性:', {
        isVisible,
        rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left }
      });

      // 执行点击
      console.log('🔧 [DEBUG] 执行循环元素点击');
      element.click();

      // 等待点击效果
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log(`👆 循环点击元素完成`);
      break;
    case 'input':
      const inputText = step.inputText || '';
      element.value = inputText;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`⌨️ 输入文本: "${inputText}"`);
      break;
    case 'check':
      if (!element.checked) {
        element.checked = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`☑️ 勾选复选框`);
      }
      break;
    case 'uncheck':
      if (element.checked) {
        element.checked = false;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`☐ 取消勾选复选框`);
      }
      break;
    default:
      throw new Error(`不支持的简单循环操作类型: ${actionType}`);
  }

  // 操作后等待（支持暂停）
  if (step.actionDelay) {
    console.log(`🔧 [DEBUG] 操作后延迟开始: ${step.actionDelay}ms`);
    const delayStartTime = Date.now();
    while (Date.now() - delayStartTime < step.actionDelay) {
      // 在延迟期间检查暂停状态
      if (window.simplifiedExecutionControl) {
        await window.simplifiedExecutionControl.checkPause();
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(100, step.actionDelay - (Date.now() - delayStartTime))));
    }
    console.log(`🔧 [DEBUG] 操作后延迟完成`);
  }
}

async function executeParentLoopAction(element, step) {
  console.log('🔧 [DEBUG] executeParentLoopAction 开始执行');

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  console.log(`🎯 开始处理父级元素`);

  // 1. 点击父级元素
  console.log(`🔧 [DEBUG] 准备点击父级元素`);
  element.click();
  console.log(`👆 已点击父级元素`);

  // 2. 等待页面响应
  if (step.waitAfterClick) {
    console.log(`⏳ 等待页面响应 ${step.waitAfterClick}ms`);
    await new Promise(resolve => setTimeout(resolve, step.waitAfterClick));
  }

  // 3. 执行子操作序列
  if (step.subOperations && step.subOperations.length > 0) {
    console.log(`🔧 开始执行 ${step.subOperations.length} 个子操作`);

    for (let i = 0; i < step.subOperations.length; i++) {
      const subOp = step.subOperations[i];
      console.log(`🎯 执行子操作 ${i + 1}: ${subOp.type} - ${subOp.locator?.value || subOp.locator}`);

      try {
        // 传递父级元素上下文给子操作
        await executeSubOperation(subOp, element);
      } catch (error) {
        console.error(`❌ 子操作 ${i + 1} 失败:`, error);
        if (step.errorHandling === 'stop') {
          throw error;
        }
      }

      // 子操作间等待
      if (subOp.delay) {
        await new Promise(resolve => setTimeout(resolve, subOp.delay));
      }
    }

    console.log(`✅ 所有子操作执行完成`);
  }
}

async function executeSubOperation(operation, parentElement = null) {
  console.log(`🔍 执行子操作: ${operation.type}`, operation.locator);

  switch (operation.type) {
    case 'click':
      let clickElement;
      if (parentElement && operation.locator?.strategy === 'css') {
        // 只有CSS选择器才能在父级元素内查找
        clickElement = parentElement.querySelector(operation.locator.value);
        if (!clickElement) {
          // 如果在父级元素内找不到，尝试全局查找
          clickElement = await window.ContentCore.findElementByStrategy(operation.locator.strategy, operation.locator.value);
          console.log(`🔍 在父级元素内未找到，使用全局查找`);
        } else {
          console.log(`🔍 在父级元素内找到目标`);
        }
      } else {
        // 对于非CSS选择器或没有父级元素的情况，直接全局查找
        clickElement = await window.ContentCore.findElementByStrategy(operation.locator.strategy, operation.locator.value);
      }
      clickElement.click();
      console.log(`👆 子操作-点击: ${operation.locator.value}`);
      break;

    case 'input':
      let inputElement;
      if (parentElement && operation.locator?.strategy === 'css') {
        // 只有CSS选择器才能在父级元素内查找
        inputElement = parentElement.querySelector(operation.locator.value);
        if (!inputElement) {
          inputElement = await window.ContentCore.findElementByStrategy(operation.locator.strategy, operation.locator.value);
        }
      } else {
        inputElement = await window.ContentCore.findElementByStrategy(operation.locator.strategy, operation.locator.value);
      }
      inputElement.value = operation.text || '';
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`⌨️ 子操作-输入: "${operation.text}"`);
      break;

    case 'wait':
      const duration = operation.duration || 1000;
      console.log(`⏱️ 子操作-等待: ${duration}ms`);
      await new Promise(resolve => setTimeout(resolve, duration));
      break;

    case 'waitForElement':
      console.log(`🔍 子操作-等待元素: ${operation.locator.value}`);
      const timeout = operation.timeout || 30000;
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        try {
          const waitElement = await window.ContentCore.findElementByStrategy(operation.locator.strategy, operation.locator.value, 100);
          if (waitElement) {
            console.log(`✅ 元素已出现: ${operation.locator.value}`);
            break;
          }
        } catch (error) {
          // 继续等待
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      break;

    case 'check':
      let checkElement;
      if (parentElement && operation.locator?.strategy === 'css') {
        checkElement = parentElement.querySelector(operation.locator.value);
        if (!checkElement) {
          checkElement = await window.ContentCore.findElementByStrategy(operation.locator.strategy, operation.locator.value);
        }
      } else {
        checkElement = await window.ContentCore.findElementByStrategy(operation.locator.strategy, operation.locator.value);
      }
      if (!checkElement.checked) {
        checkElement.checked = true;
        checkElement.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`☑️ 子操作-勾选复选框`);
      }
      break;

    case 'select':
      let selectElement;
      if (parentElement && operation.locator?.strategy === 'css') {
        selectElement = parentElement.querySelector(operation.locator.value);
        if (!selectElement) {
          selectElement = await window.ContentCore.findElementByStrategy(operation.locator.strategy, operation.locator.value);
        }
      } else {
        selectElement = await window.ContentCore.findElementByStrategy(operation.locator.strategy, operation.locator.value);
      }
      selectElement.value = operation.value || '';
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`📋 子操作-选择选项: ${operation.value}`);
      break;

    case 'autoLoop':
      console.log(`🔁 子操作-自循环开始: ${operation.locator.value}`);
      await executeSubOperationAutoLoop(operation, parentElement);
      break;

    default:
      throw new Error(`不支持的子操作类型: ${operation.type}`);
  }
}

// 执行子操作中的自循环
async function executeSubOperationAutoLoop(operation, parentElement = null) {
  console.log(`🔁 开始执行子操作自循环: ${operation.locator.value}`);

  // 查找所有匹配的元素
  let elements;
  if (parentElement && operation.locator?.strategy === 'css') {
    // 只有CSS选择器才能在父级元素内查找
    elements = Array.from(parentElement.querySelectorAll(operation.locator.value));
    if (elements.length === 0) {
      // 如果在父级元素内找不到，尝试全局查找
      elements = await window.ContentCore.findElementsByStrategy(operation.locator.strategy, operation.locator.value);
      console.log(`🔍 在父级元素内未找到，使用全局查找`);
    } else {
      console.log(`🔍 在父级元素内找到 ${elements.length} 个目标`);
    }
  } else {
    // 对于非CSS选择器或没有父级元素的情况，直接全局查找
    elements = await window.ContentCore.findElementsByStrategy(operation.locator.strategy, operation.locator.value);
  }

  if (elements.length === 0) {
    throw new Error(`自循环未找到匹配元素: ${operation.locator.value}`);
  }

  // 计算处理范围
  const startIndex = operation.startIndex || 0;
  const endIndex = operation.endIndex === -1 ? elements.length - 1 : (operation.endIndex || elements.length - 1);
  const actualEndIndex = Math.min(endIndex, elements.length - 1);

  console.log(`📊 自循环找到 ${elements.length} 个元素，处理范围: ${startIndex} - ${actualEndIndex}`);

  // 获取操作类型和配置
  const actionType = operation.actionType || 'click';
  const actionDelay = operation.actionDelay || 200;
  const errorHandling = operation.errorHandling || 'continue';

  // 依次处理每个元素
  let successCount = 0;
  let errorCount = 0;

  for (let i = startIndex; i <= actualEndIndex; i++) {
    console.log(`🎯 自循环处理第 ${i + 1}/${actualEndIndex + 1} 个元素`);

    try {
      const element = elements[i];

      // 添加绿色执行进度高亮
      window.ContentCore.highlightExecutionProgress(element);

      await executeAutoLoopAction(element, operation, actionType);
      successCount++;

      console.log(`✅ 第 ${i + 1} 个元素${actionType}操作完成`);

      // 操作间隔
      if (actionDelay > 0 && i < actualEndIndex) {
        await new Promise(resolve => setTimeout(resolve, actionDelay));
      }

      // 清除执行进度高亮
      window.ContentCore.clearExecutionProgress(element);

    } catch (error) {
      errorCount++;

      const element = elements[i];
      console.error(`❌ 第 ${i + 1} 个元素操作失败:`, error);

      // 清除执行进度高亮（即使失败也要清除）
      window.ContentCore.clearExecutionProgress(element);

      if (errorHandling === 'stop') {
        throw new Error(`自循环在第 ${i + 1} 个元素处停止: ${error.message}`);
      }
      // 继续处理下一个元素
    }
  }

  console.log(`🎉 自循环执行完成: 成功 ${successCount} 个，失败 ${errorCount} 个`);
}

// 执行自循环中的单个元素操作
async function executeAutoLoopAction(element, operation, actionType) {
  switch (actionType) {
    case 'click':
      element.click();
      break;

    case 'input':
      const inputText = operation.inputText || '';
      element.value = inputText;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      break;

    case 'check':
      if (element.type === 'checkbox' && !element.checked) {
        element.checked = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      break;

    case 'uncheck':
      if (element.type === 'checkbox' && element.checked) {
        element.checked = false;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      break;

    case 'hover':
      element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      break;

    case 'focus':
      element.focus();
      break;

    default:
      throw new Error(`不支持的自循环操作类型: ${actionType}`);
  }
}

// 查找单个元素（用于条件判断）
function findSingleElement(strategy, value) {
  try {
    switch (strategy) {
      case 'css':
        return document.querySelector(value);
      case 'xpath':
        const xpathResult = document.evaluate(
          value,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        return xpathResult.singleNodeValue;
      case 'id':
        return document.getElementById(value);
      case 'className':
        const elements = document.getElementsByClassName(value);
        return elements.length > 0 ? elements[0] : null;
      case 'text':
        return Array.from(document.querySelectorAll('*')).find(el =>
          el.textContent && el.textContent.trim() === value.trim()
        );
      case 'contains':
        return Array.from(document.querySelectorAll('*')).find(el =>
          el.textContent && el.textContent.includes(value)
        );
      case 'tagName':
        const tagElements = document.getElementsByTagName(value);
        return tagElements.length > 0 ? tagElements[0] : null;
      default:
        throw new Error(`不支持的定位策略: ${strategy}`);
    }
  } catch (error) {
    console.error(`查找元素失败 (${strategy}: ${value}):`, error);
    return null;
  }
}

// 导出自动化功能到全局作用域
window.ContentAutomation = {
  executeUniversalWorkflow,
  executeSimplifiedWorkflow,
  loadUniversalAutomationEngine,
  executeClickStep,
  executeInputStep,
  executeWaitStep,
  executeSmartWaitStep,
  executeConditionStep,
  executeLoopStep,
  executeSimpleLoopAction,
  executeParentLoopAction,
  executeSubOperation,
  executeSubOperationAutoLoop,
  executeAutoLoopAction,
  findSingleElement
};

console.log('✅ Content Automation 模块已加载');