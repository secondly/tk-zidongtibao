
// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("Content script收到消息:", request);

  // 处理ping请求，用于检测content script是否已加载
  if (request.action === "ping") {
    console.log("收到ping请求");
    sendResponse({ success: true, status: "ready", message: "Content script已加载" });
    return true;
  }

  // 处理重置引擎请求
  if (request.action === "resetEngine") {
    try {
      console.log("🔄 收到重置引擎请求");

      // 清除可能存在的引擎实例
      if (window.UniversalAutomationEngine) {
        // 移除旧的脚本标签
        const oldScripts = document.querySelectorAll('script[data-automation-engine="true"]');
        oldScripts.forEach(script => {
          script.remove();
          console.log("🗑️ 已移除旧的引擎脚本");
        });

        // 清除全局引用
        delete window.UniversalAutomationEngine;
        console.log("✅ 自动化引擎全局引用已清除");
      }

      sendResponse({ success: true, message: "引擎已重置" });
    } catch (error) {
      console.error("❌ 重置引擎失败:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // 处理通用自动化工作流执行
  if (request.action === "executeWorkflow") {
    console.log("🔧 [DEBUG] 收到工作流执行请求，工作流数据:", JSON.stringify(request.data, null, 2));

    // 验证工作流数据结构
    if (request.data && request.data.steps) {
      request.data.steps.forEach((step, index) => {
        console.log(`🔧 [DEBUG] 步骤 ${index + 1}:`, {
          type: step.type,
          name: step.name,
          locator: step.locator,
          hasLocator: !!step.locator,
          locatorStrategy: step.locator?.strategy || step.locator?.type,
          locatorValue: step.locator?.value
        });
      });
    }
    executeUniversalWorkflow(request.data)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        console.error("执行通用工作流失败:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === "performAction") {
    performAction(request.config)
      .then((result) => {
        sendResponse({ success: true, ...result });
      })
      .catch((error) => {
        console.error("执行操作失败:", error);
        sendResponse({ success: false, error: error.message });
      });

    // 返回true表示我们将异步发送响应
    return true;
  }

  if (request.action === "testElementLocator") {
    testElementLocator(request.locator)
      .then((result) => {
        sendResponse({ success: true, ...result });
      })
      .catch((error) => {
        console.error("测试元素定位失败:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  // 处理定位器测试请求
  if (request.action === "testLocator") {
    try {
      const result = testLocatorElements(request.locator);
      sendResponse({ success: true, count: result.count });
    } catch (error) {
      console.error("测试定位器失败:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // 处理条件测试请求
  if (request.action === "testCondition") {
    try {
      const result = testCondition(request.condition);
      sendResponse(result);
    } catch (error) {
      console.error("测试条件失败:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // 处理清除测试高亮请求
  if (request.action === "clearTestHighlights") {
    try {
      clearTestHighlights();
      sendResponse({ success: true });
    } catch (error) {
      console.error("清除测试高亮失败:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // 处理暂停执行请求
  if (request.action === "pauseExecution") {
    console.log('🔧 [DEBUG] Content script 收到暂停请求');
    console.log('🔧 [DEBUG] 当前引擎状态:', {
      hasAutomationEngine: !!window.automationEngine,
      hasSimplifiedControl: !!window.simplifiedExecutionControl,
      automationEngineRunning: window.automationEngine ? window.automationEngine.isRunning : false,
      automationEnginePaused: window.automationEngine ? window.automationEngine.isPaused : false,
      simplifiedControlPaused: window.simplifiedExecutionControl ? window.simplifiedExecutionControl.isPaused : false
    });

    try {
      if (window.automationEngine && window.automationEngine.isRunning) {
        console.log('🔧 [DEBUG] 使用高级引擎暂停（引擎正在运行）');
        // 高级引擎模式
        window.automationEngine.pause();
        console.log('🔧 [DEBUG] 高级引擎暂停调用完成');
        sendResponse({ success: true, mode: 'advanced' });
      } else if (window.simplifiedExecutionControl) {
        console.log('🔧 [DEBUG] 使用简化模式暂停');
        // 简化模式
        window.simplifiedExecutionControl.pause();
        console.log('🔧 [DEBUG] 简化模式暂停调用完成');
        sendResponse({ success: true, mode: 'simplified' });
      } else {
        console.log('❌ [DEBUG] 没有可用的执行引擎或引擎未运行');
        console.log('🔧 [DEBUG] 详细状态:', {
          hasEngine: !!window.automationEngine,
          engineRunning: window.automationEngine ? window.automationEngine.isRunning : 'N/A',
          hasSimplified: !!window.simplifiedExecutionControl
        });
        sendResponse({ success: false, error: "自动化引擎未初始化或未运行" });
      }
    } catch (error) {
      console.error("❌ 暂停执行失败:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // 处理继续执行请求
  if (request.action === "resumeExecution") {
    try {
      if (window.automationEngine) {
        // 高级引擎模式
        window.automationEngine.resume();
        sendResponse({ success: true });
      } else if (window.simplifiedExecutionControl) {
        // 简化模式
        window.simplifiedExecutionControl.resume();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "自动化引擎未初始化" });
      }
    } catch (error) {
      console.error("继续执行失败:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // 处理获取执行状态请求
  if (request.action === "getExecutionStatus") {
    try {
      let executionStatus = {
        isRunning: false,
        isPaused: false,
        currentStep: 0,
        totalSteps: 0,
        completedSteps: 0,
        startTime: null,
        currentOperation: null
      };

      if (window.automationEngine) {
        // 高级引擎模式
        executionStatus = {
          isRunning: window.automationEngine.isRunning,
          isPaused: window.automationEngine.isPaused,
          currentStep: window.automationEngine.executionStats?.currentStep || 0,
          totalSteps: window.automationEngine.executionStats?.totalSteps || 0,
          completedSteps: window.automationEngine.executionStats?.completedSteps || 0,
          startTime: window.automationEngine.executionStats?.startTime,
          currentOperation: window.automationEngine.executionStats?.currentOperation
        };
      } else if (window.simplifiedExecutionControl) {
        // 简化模式
        executionStatus = {
          isRunning: window.simplifiedExecutionControl.isRunning,
          isPaused: window.simplifiedExecutionControl.isPaused,
          currentStep: window.simplifiedExecutionControl.currentStep || 0,
          totalSteps: window.simplifiedExecutionControl.totalSteps || 0,
          completedSteps: window.simplifiedExecutionControl.completedSteps || 0,
          startTime: window.simplifiedExecutionControl.startTime,
          currentOperation: window.simplifiedExecutionControl.currentOperation
        };
      }

      console.log('🔧 [DEBUG] 返回执行状态:', executionStatus);
      sendResponse({ success: true, ...executionStatus });
    } catch (error) {
      console.error('获取执行状态失败:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // 处理停止执行请求
  if (request.action === "stopExecution") {
    try {
      if (window.automationEngine) {
        // 高级引擎模式
        window.automationEngine.stop();
        sendResponse({ success: true });
      } else if (window.simplifiedExecutionControl) {
        // 简化模式
        window.simplifiedExecutionControl.stop();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "没有找到执行控制器" });
      }
    } catch (error) {
      console.error('停止执行失败:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (request.action === "findAllElements") {
    findAllElements(request.locator)
      .then((result) => {
        sendResponse({ success: true, ...result });
      })
      .catch((error) => {
        console.error("查找所有元素失败:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  if (request.action === "performActionOnElementByIndex") {
    performActionOnElementByIndex(
      request.locator,
      request.index,
      request.actionType,
      request.inputText
    )
      .then((result) => {
        sendResponse({ success: true, ...result });
      })
      .catch((error) => {
        console.error("按索引操作元素失败:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }
});

/**
 * 测试元素定位并高亮显示
 * @param {object} locator - 元素定位配置
 * @returns {Promise<object>} - 执行结果
 */
async function testElementLocator(locator) {
  try {
    console.log(`测试定位元素:`, locator);

    // 查找元素
    const elements = await findElementsByStrategy(
      locator.strategy,
      locator.value
    );

    if (elements.length === 0) {
      throw new Error("未找到匹配元素");
    }

    // 移除之前的高亮
    removeHighlights();

    // 高亮显示找到的元素
    elements.forEach((element) => {
      highlightElement(element);
    });

    // 5秒后移除高亮
    setTimeout(removeHighlights, 5000);

    return {
      count: elements.length,
      message: `找到 ${elements.length} 个匹配元素并已高亮显示`,
    };
  } catch (error) {
    console.error("测试元素定位时出错:", error);
    throw error;
  }
}

/**
 * 高亮显示元素
 * @param {HTMLElement} element - 要高亮的元素
 */
function highlightElement(element) {
  // 保存原始样式
  const originalOutline = element.style.outline;
  const originalOutlineOffset = element.style.outlineOffset;
  const originalPosition = element.style.position;
  const originalZIndex = element.style.zIndex;

  // 设置高亮样式
  element.style.outline = "2px solid red";
  element.style.outlineOffset = "2px";

  // 确保元素在前面
  if (getComputedStyle(element).position === "static") {
    element.style.position = "relative";
  }
  element.style.zIndex = "10000";

  // 保存元素引用以便之后恢复
  element.setAttribute(
    "data-highlight-original",
    JSON.stringify({
      outline: originalOutline,
      outlineOffset: originalOutlineOffset,
      position: originalPosition,
      zIndex: originalZIndex,
    })
  );
}

/**
 * 移除所有高亮
 */
function removeHighlights() {
  const highlightedElements = document.querySelectorAll(
    "[data-highlight-original]"
  );

  highlightedElements.forEach((element) => {
    try {
      const original = JSON.parse(
        element.getAttribute("data-highlight-original")
      );

      // 恢复原始样式
      element.style.outline = original.outline;
      element.style.outlineOffset = original.outlineOffset;
      element.style.position = original.position;
      element.style.zIndex = original.zIndex;

      // 移除属性
      element.removeAttribute("data-highlight-original");
    } catch (error) {
      console.error("恢复元素样式时出错:", error);
    }
  });
}

/**
 * 查找所有匹配的元素
 * @param {object} locator - 元素定位配置
 * @returns {Promise<object>} - 执行结果，包含元素数量
 */
async function findAllElements(locator) {
  try {
    console.log(`查找所有匹配元素:`, locator);

    const elements = await findElementsByStrategy(
      locator.strategy,
      locator.value
    );

    console.log(`找到 ${elements.length} 个匹配元素`);

    // 返回元素数量和简要描述
    return {
      count: elements.length,
      message: `找到 ${elements.length} 个匹配元素`,
      elements: elements.map(elementToString),
    };
  } catch (error) {
    console.error("查找所有元素时出错:", error);
    throw error;
  }
}

/**
 * 根据索引对元素执行操作
 * @param {object} locator - 元素定位配置
 * @param {number} index - 元素索引
 * @param {string} actionType - 操作类型
 * @param {string} inputText - 输入文本（如果是输入操作）
 * @returns {Promise<object>} - 执行结果
 */
async function performActionOnElementByIndex(
  locator,
  index,
  actionType,
  inputText
) {
  try {
    console.log(`按索引 ${index} 操作元素:`, locator);

    const elements = await findElementsByStrategy(
      locator.strategy,
      locator.value
    );

    if (elements.length === 0) {
      throw new Error("未找到匹配元素");
    }

    if (index < 0 || index >= elements.length) {
      throw new Error(`索引 ${index} 超出范围 (0-${elements.length - 1})`);
    }

    const element = elements[index];
    console.log(`获取到索引 ${index} 的元素:`, elementToString(element));

    // 根据操作类型执行相应动作
    switch (actionType) {
      case "click":
        await clickElement(element);
        break;

      case "input":
        if (inputText === undefined) {
          throw new Error("输入操作需要提供输入文本");
        }
        await inputText(element, inputText);
        break;

      default:
        throw new Error(`不支持的操作类型: ${actionType}`);
    }

    return {
      message: `成功对索引 ${index} 的元素执行${actionType}操作`,
      element: elementToString(element),
    };
  } catch (error) {
    console.error("按索引操作元素时出错:", error);
    throw error;
  }
}

/**
 * 执行指定的页面操作
 * @param {object} config - 操作配置
 * @returns {Promise<object>} - 执行结果
 */
async function performAction(config) {
  try {
    // 等待操作不需要查找元素
    if (config.action === "wait") {
      const waitTime = config.waitTime || 3; // 默认3秒
      console.log(`执行等待操作: ${waitTime}秒`);

      // 返回一个Promise，在指定的时间后解析
      await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));

      return {
        message: `成功等待 ${waitTime} 秒`,
      };
    }

    // 对于其他操作，需要查找元素
    // 根据定位策略查找元素
    const element = await findElementByStrategy(
      config.locator.strategy,
      config.locator.value
    );

    // 根据操作类型执行相应动作
    switch (config.action) {
      case "click":
        await clickElement(element);
        break;

      case "input":
        await inputText(element, config.inputText);
        break;

      default:
        throw new Error(`不支持的操作类型: ${config.action}`);
    }

    return {
      message: "操作成功执行",
      element: elementToString(element),
    };
  } catch (error) {
    throw error;
  }
}

/**
 * 将元素转换为字符串表示，用于日志输出
 */
function elementToString(element) {
  if (!element) return "null";

  let str = element.tagName.toLowerCase();
  if (element.id) str += `#${element.id}`;
  if (element.className) str += `.${element.className.replace(/\s+/g, ".")}`;

  return str;
}

/**
 * 根据定位策略查找元素
 * @param {string} strategy - 定位策略
 * @param {string} value - 定位值
 * @returns {Promise<HTMLElement>} - 找到的元素
 */
async function findElementByStrategy(strategy, value, timeout = 5000) {
  console.log(`尝试使用${strategy}策略查找元素: ${value}`);

  switch (strategy) {
    case "id":
      return await findElement("id", value, timeout);

    case "css":
      return await findElement("css", value, timeout);

    case "xpath":
      return await findElementByXPath(value, timeout);

    case "text":
      return await findElementByText(value, ["*"], timeout);

    case "contains":
      return await findElementContainingText(value, ["*"], timeout);

    default:
      throw new Error(`不支持的定位策略: ${strategy}`);
  }
}

/**
 * 根据定位策略查找所有匹配元素
 * @param {string} strategy - 定位策略
 * @param {string} value - 定位值
 * @returns {Promise<HTMLElement[]>} - 找到的所有元素数组
 */
async function findElementsByStrategy(strategy, value, timeout = 5000) {
  console.log(`尝试使用${strategy}策略查找所有匹配元素: ${value}`);

  // 对于基本选择器，尝试立即查找而不使用轮询
  if (["id", "css", "xpath"].includes(strategy)) {
    try {
      // 对于基本的DOM选择器，直接尝试一次查询
      let elements = await performSingleElementSearch(strategy, value);

      // 如果找到了元素，立即返回结果
      if (elements.length > 0) {
        console.log(
          `使用${strategy}策略立即找到 ${elements.length} 个匹配元素`
        );
        return elements;
      }
    } catch (error) {
      console.warn(`立即查找元素失败:`, error);
      // 继续使用轮询方式作为备选方案
    }
  }

  // 使用异步轮询避免阻塞主线程
  return await performAsyncElementSearch(strategy, value, timeout);
}

/**
 * 异步元素搜索，避免阻塞主线程
 * @param {string} strategy - 定位策略
 * @param {string} value - 定位值
 * @param {number} timeout - 超时时间
 * @returns {Promise<HTMLElement[]>} - 找到的元素数组
 */
async function performAsyncElementSearch(strategy, value, timeout) {
  const startTime = Date.now();
  let elements = [];

  // 减少轮询频率，特别是对于文本查找
  const pollingInterval = strategy === "text" || strategy === "contains" ? 300 : 100;

  while (Date.now() - startTime < timeout) {
    // 检查暂停状态 - 如果暂停则立即停止搜索
    if (window.simplifiedExecutionControl && window.simplifiedExecutionControl.isPaused) {
      console.log('🔧 [DEBUG] 元素搜索检测到暂停状态，停止搜索');
      break;
    }

    // 检查高级引擎暂停状态
    if (window.automationEngine && window.automationEngine.isPaused) {
      console.log('🔧 [DEBUG] 元素搜索检测到高级引擎暂停状态，停止搜索');
      break;
    }

    try {
      elements = await performSingleElementSearch(strategy, value);

      // 如果找到了元素或已尝试超过一半时间，则返回结果
      if (elements.length > 0 || Date.now() - startTime > timeout / 2) {
        break;
      }
    } catch (error) {
      console.error(`查找元素时出错:`, error);
    }

    // 使用 requestAnimationFrame 或 setTimeout 让出主线程，避免阻塞
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => setTimeout(resolve, pollingInterval));
      } else {
        setTimeout(resolve, pollingInterval);
      }
    });
  }

  console.log(
    `在 ${Date.now() - startTime}ms 内找到 ${elements.length} 个匹配元素`
  );
  return elements;
}

/**
 * 执行单次元素查找（不带轮询）
 * @param {string} strategy - 查找策略
 * @param {string} value - 查找值
 * @returns {Promise<HTMLElement[]>} - 找到的元素列表
 */
async function performSingleElementSearch(strategy, value) {
  let elements = [];

  switch (strategy) {
    case "id":
      // ID是唯一的，但为了统一处理，仍使用数组
      const idElement = document.getElementById(value);
      elements = idElement ? [idElement] : [];
      break;

    case "css":
      elements = Array.from(document.querySelectorAll(value));
      break;

    case "xpath":
      const xpathResult = document.evaluate(
        value,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      elements = [];
      for (let i = 0; i < xpathResult.snapshotLength; i++) {
        elements.push(xpathResult.snapshotItem(i));
      }
      break;

    case "text":
      // 精确文本匹配，使用遍历方式避免XPath转义问题
      elements = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent && el.textContent.trim() === value.trim()
      );
      break;

    case "contains":
      // 包含文本匹配，使用遍历方式避免XPath转义问题
      elements = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent && el.textContent.includes(value)
      );
      break;

    default:
      throw new Error(`不支持的定位策略: ${strategy}`);
  }

  return elements;
}

/**
 * 转义XPath字符串中的特殊字符
 * @param {string} str - 输入字符串
 * @returns {string} - 转义后的字符串
 */
function escapeXPathString(str) {
  if (str.includes('"') && str.includes("'")) {
    // 处理同时包含单引号和双引号的情况
    let parts = str.split('"');
    return `concat("${parts.join('", \'"\', "')}")`;
  }

  // 使用不存在于字符串中的引号类型
  if (str.includes('"')) {
    return `'${str}'`;
  }

  return `"${str}"`;
}

/**
 * 根据不同的定位策略查找元素
 * @param {string} strategy - 定位策略：'id', 'css', 'xpath'等
 * @param {string} selector - 对应策略的选择器
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<HTMLElement>} - 找到的元素
 */
async function findElement(strategy, selector, timeout = 5000) {
  console.log(`尝试使用${strategy}策略查找元素: ${selector}`);
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // 检查暂停状态
    if (window.simplifiedExecutionControl && window.simplifiedExecutionControl.isPaused) {
      console.log('🔧 [DEBUG] findElement检测到暂停状态，停止查找');
      throw new Error('查找已暂停');
    }

    if (window.automationEngine && window.automationEngine.isPaused) {
      console.log('🔧 [DEBUG] findElement检测到高级引擎暂停状态，停止查找');
      throw new Error('查找已暂停');
    }

    let element = null;

    try {
      switch (strategy) {
        case "id":
          element = document.getElementById(selector);
          break;
        case "css":
          element = document.querySelector(selector);
          break;
        default:
          throw new Error(`不支持的定位策略: ${strategy}`);
      }

      if (element) {
        console.log(`成功找到元素`, element);
        return element;
      }
    } catch (error) {
      console.error(`查找元素时出错:`, error);
    }

    // 使用异步等待避免阻塞主线程
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => setTimeout(resolve, 100));
      } else {
        setTimeout(resolve, 100);
      }
    });
  }

  throw new Error(`超时(${timeout}ms)：无法找到元素 ${strategy}="${selector}"`);
}

/**
 * 根据精确文本内容查找元素
 * @param {string} text - 要匹配的文本
 * @param {string[]} tagNames - 要搜索的标签名列表
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<HTMLElement>} - 找到的元素
 */
async function findElementByText(text, tagNames = ["*"], timeout = 5000) {
  console.log(`尝试根据精确文本"${text}"查找元素`);
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // 检查暂停状态
    if (window.simplifiedExecutionControl && window.simplifiedExecutionControl.isPaused) {
      console.log('🔧 [DEBUG] findElementByText检测到暂停状态，停止查找');
      throw new Error('查找已暂停');
    }

    if (window.automationEngine && window.automationEngine.isPaused) {
      console.log('🔧 [DEBUG] findElementByText检测到高级引擎暂停状态，停止查找');
      throw new Error('查找已暂停');
    }

    for (const tagName of tagNames) {
      const elements = document.querySelectorAll(tagName);

      for (const element of elements) {
        if (element.textContent.trim() === text) {
          console.log(`成功根据精确文本找到元素`, element);
          return element;
        }
      }
    }

    // 使用异步等待避免阻塞主线程
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => setTimeout(resolve, 100));
      } else {
        setTimeout(resolve, 100);
      }
    });
  }

  throw new Error(`超时(${timeout}ms)：无法找到文本为"${text}"的元素`);
}

/**
 * 根据包含的文本内容查找元素
 * @param {string} text - 要包含的文本
 * @param {string[]} tagNames - 要搜索的标签名列表
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<HTMLElement>} - 找到的元素
 */
async function findElementContainingText(
  text,
  tagNames = ["*"],
  timeout = 5000
) {
  console.log(`尝试根据包含文本"${text}"查找元素`);
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // 检查暂停状态
    if (window.simplifiedExecutionControl && window.simplifiedExecutionControl.isPaused) {
      console.log('🔧 [DEBUG] findElementContainingText检测到暂停状态，停止查找');
      throw new Error('查找已暂停');
    }

    if (window.automationEngine && window.automationEngine.isPaused) {
      console.log('🔧 [DEBUG] findElementContainingText检测到高级引擎暂停状态，停止查找');
      throw new Error('查找已暂停');
    }

    for (const tagName of tagNames) {
      const elements = document.querySelectorAll(tagName);

      for (const element of elements) {
        if (element.textContent.includes(text)) {
          console.log(`成功根据包含文本找到元素`, element);
          return element;
        }
      }
    }

    // 使用异步等待避免阻塞主线程
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => setTimeout(resolve, 100));
      } else {
        setTimeout(resolve, 100);
      }
    });
  }

  throw new Error(`超时(${timeout}ms)：无法找到包含文本"${text}"的元素`);
}

/**
 * 根据XPath查找元素
 * @param {string} xpath - XPath表达式
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<HTMLElement>} - 找到的元素
 */
async function findElementByXPath(xpath, timeout = 5000) {
  console.log(`尝试使用XPath查找元素: ${xpath}`);
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // 检查暂停状态
    if (window.simplifiedExecutionControl && window.simplifiedExecutionControl.isPaused) {
      console.log('🔧 [DEBUG] findElementByXPath检测到暂停状态，停止查找');
      throw new Error('查找已暂停');
    }

    if (window.automationEngine && window.automationEngine.isPaused) {
      console.log('🔧 [DEBUG] findElementByXPath检测到高级引擎暂停状态，停止查找');
      throw new Error('查找已暂停');
    }

    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      const element = result.singleNodeValue;

      if (element) {
        console.log(`成功通过XPath找到元素`, element);
        return element;
      }
    } catch (error) {
      console.error(`XPath查询错误: ${error.message}`);
      return null;
    }

    // 使用异步等待避免阻塞主线程
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => setTimeout(resolve, 100));
      } else {
        setTimeout(resolve, 100);
      }
    });
  }

  throw new Error(`超时(${timeout}ms)：无法找到元素`);
}

/**
 * 点击元素
 * @param {HTMLElement} element - 要点击的元素
 * @returns {Promise<void>}
 */
async function clickElement(element) {
  console.log(`点击元素:`, element);

  // 使用智能滚动函数，在虚拟列表模式下禁用页面滚动
  smartScrollIntoView(element, { behavior: "smooth", block: "center" });

  // 等待滚动完成
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 高亮元素以便观察
  highlightElement(element);

  try {
    // 尝试多种点击方法
    // 1. 原生点击
    element.click();

    // 2. 创建并分发点击事件
    const clickEvent = new MouseEvent("click", {
      view: window,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(clickEvent);

    // 清除高亮
    setTimeout(removeHighlights, 500);

    console.log(`点击元素成功`);
    return;
  } catch (error) {
    console.error("点击元素时出错:", error);
    removeHighlights();
    throw error;
  }
}

/**
 * 在元素中输入文本
 * @param {HTMLElement} element - 要输入文本的元素
 * @param {string} text - 要输入的文本
 * @returns {Promise<void>}
 */
async function inputText(element, text) {
  console.log(`在元素中输入文本: "${text}"`, element);

  // 使用智能滚动函数，在虚拟列表模式下禁用页面滚动
  smartScrollIntoView(element, { behavior: "smooth", block: "center" });

  // 等待滚动完成
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 高亮元素以便观察
  highlightElement(element);

  try {
    // 确保元素是可输入的
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLTextAreaElement) &&
      element.contentEditable !== "true"
    ) {
      throw new Error("指定的元素不支持输入操作");
    }

    // 聚焦元素
    element.focus();

    // 清除现有值
    element.value = "";

    // 输入新值
    if (element.contentEditable === "true") {
      element.textContent = text;
    } else {
      element.value = text;

      // 触发input和change事件
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // 清除高亮
    setTimeout(removeHighlights, 500);

    console.log(`文本输入成功`);
    return;
  } catch (error) {
    console.error("输入文本时出错:", error);
    removeHighlights();
    throw error;
  }
}

// 全局标志：是否在虚拟列表模式中（禁用页面滚动）
window.isVirtualListMode = false;

/**
 * 智能滚动函数 - 在虚拟列表模式下禁用页面滚动
 * @param {HTMLElement} element - 要滚动到的元素
 * @param {object} options - 滚动选项
 */
function smartScrollIntoView(element, options = { behavior: 'smooth', block: 'center' }) {
  if (window.isVirtualListMode) {
    console.log(`🚫 虚拟列表模式：跳过页面滚动`);
    return;
  }

  console.log(`📍 正常模式：滚动到元素`);
  element.scrollIntoView(options);
}

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
      console.log('✅ 使用增强的简化执行模式（包含完整功能）');
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
    isRunning: true,
    isPaused: false,
    pausePromise: null,
    pauseResolve: null,
    currentStep: 0,
    totalSteps: totalSteps,
    completedSteps: 0,
    startTime: Date.now(),
    currentOperation: '开始执行工作流...',

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
      console.log('🔧 [DEBUG] checkPause 被调用，当前状态:', {
        isRunning: this.isRunning,
        isPaused: this.isPaused
      });

      // 首先检查是否已停止
      if (!this.isRunning) {
        console.log('🔧 [DEBUG] 检测到停止状态，抛出停止信号');
        const stopError = new Error('EXECUTION_STOPPED');
        stopError.isStopSignal = true;
        throw stopError;
      }

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

        // 暂停解除后再次检查是否已停止
        if (!this.isRunning) {
          console.log('🔧 [DEBUG] 暂停解除后检测到停止状态，抛出停止信号');
          const stopError = new Error('EXECUTION_STOPPED');
          stopError.isStopSignal = true;
          throw stopError;
        }
      }
    },

    updateProgress(stepIndex, operation) {
      this.currentStep = stepIndex;
      this.completedSteps = stepIndex;
      if (operation) {
        this.currentOperation = operation;
      }
      console.log('🔧 [DEBUG] 更新执行进度:', {
        currentStep: this.currentStep,
        completedSteps: this.completedSteps,
        currentOperation: this.currentOperation
      });
    },

    stop() {
      console.log('🔧 [DEBUG] 简化模式停止被调用');
      this.isRunning = false;
      this.isPaused = false;
      this.currentOperation = '执行已停止';

      // 解决暂停Promise，让等待的代码继续执行并检查停止状态
      if (this.pauseResolve) {
        this.pauseResolve();
        this.pausePromise = null;
        this.pauseResolve = null;
      }

      // 发送停止确认消息
      chrome.runtime.sendMessage({
        action: 'executionStopped',
        data: { isRunning: false, isStopped: true }
      }).catch(err => console.error('发送停止消息失败:', err));
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

      // 更新简化执行控制器的进度
      if (window.simplifiedExecutionControl) {
        window.simplifiedExecutionControl.updateProgress(i + 1, `执行步骤: ${step.name || step.type}`);
      }

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
    // 检查是否是停止信号
    if (error.isStopSignal) {
      console.log('✅ 执行已正常停止');

      // 发送停止完成消息
      chrome.runtime.sendMessage({
        action: 'executionStopped',
        data: { message: '执行已停止' }
      });

      return { success: true, message: '执行已停止' };
    }

    console.error('❌ 简化模式执行失败:', error);

    // 发送错误消息
    chrome.runtime.sendMessage({
      action: 'executionError',
      data: { error: error.message }
    });

    throw error;
  } finally {
    // 标记执行完成
    if (window.simplifiedExecutionControl) {
      window.simplifiedExecutionControl.isRunning = false;
    }

    // 清理简化执行控制对象
    window.simplifiedExecutionControl = null;
    console.log('🧹 简化模式执行控制已清理');
  }
}

/**
 * 动态加载通用自动化引擎
 */
async function loadUniversalAutomationEngine() {
  return new Promise(async (resolve, reject) => {
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

    // 暂时禁用高级引擎，直接使用增强的简化模式
    console.log('✅ 使用增强的简化模式（包含延迟和虚拟列表功能）');
    reject(new Error('使用增强的简化模式'));
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

  const element = await findElementByStrategy(step.locator.strategy, step.locator.value);
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
  smartScrollIntoView(element, {
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });

  // 等待滚动完成
  await new Promise(resolve => setTimeout(resolve, 500));

  // 高亮显示元素
  console.log('🔧 [DEBUG] 高亮显示目标元素');
  highlightElement(element, 'click');

  // 设置自动清除高亮
  setTimeout(() => {
    clearElementHighlight(element);
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

  const element = await findElementByStrategy(step.locator.strategy, step.locator.value);
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
  smartScrollIntoView(element, {
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });

  // 等待滚动完成
  await new Promise(resolve => setTimeout(resolve, 300));

  // 高亮显示元素
  console.log('🔧 [DEBUG] 高亮显示输入元素');
  highlightElement(element, 'input');

  // 设置自动清除高亮
  setTimeout(() => {
    clearElementHighlight(element);
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
      const element = await findElementByStrategy(step.locator.strategy, step.locator.value);
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
  highlightElement(element, 'processing');

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
      highlightElement(element, 'success');
      console.log(`✅ 条件判断通过: ${step.conditionType} ${step.comparisonType} "${expectedValue}" (实际值: "${actualValue}")`);
    } else {
      highlightElement(element, 'error');
      console.log(`❌ 条件判断失败: ${step.conditionType} ${step.comparisonType} "${expectedValue}" (实际值: "${actualValue}")`);
      throw new Error(`条件判断失败: 期望 ${step.conditionType} ${step.comparisonType} "${expectedValue}"，实际值为 "${actualValue}"`);
    }

    // 等待一下让用户看到结果
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    highlightElement(element, 'error');
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

  const elements = await findElementsByStrategy(step.locator.strategy, step.locator.value);
  if (elements.length === 0) {
    throw new Error(`找不到循环元素: ${step.locator.strategy}=${step.locator.value}`);
  }

  const startIndex = step.startIndex || 0;
  const endIndex = step.endIndex === -1 ? elements.length - 1 : (step.endIndex || elements.length - 1);
  const actualEndIndex = Math.min(endIndex, elements.length - 1);

  // 检查是否为虚拟列表模式
  console.log('🔍 [DEBUG] 检查虚拟列表模式:', {
    isVirtualList: step.isVirtualList,
    stepType: typeof step.isVirtualList,
    virtualListContainer: step.virtualListContainer,
    virtualListTitleLocator: step.virtualListTitleLocator
  });

  if (step.isVirtualList) {
    console.log(`📜 检测到虚拟列表模式，开始智能遍历`);
    // 设置虚拟列表模式标志，禁用页面滚动
    isVirtualListMode = true;
    try {
      await executeVirtualListLoop(step);
    } finally {
      // 执行完成后重置标志
      isVirtualListMode = false;
      console.log(`📜 虚拟列表模式结束，恢复页面滚动`);
    }
    return;
  }

  console.log(`🔄 开始执行${step.loopType}循环: ${elements.length} 个元素，范围 ${startIndex}-${actualEndIndex}`);

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
      } else if (step.loopType === 'container') {
        // 容器循环：直接在容器内执行子操作，不点击容器本身
        await executeContainerLoopAction(element, step);
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
      smartScrollIntoView(element, {
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });

      // 等待滚动完成
      await new Promise(resolve => setTimeout(resolve, 300));

      // 高亮显示元素
      console.log('🔧 [DEBUG] 高亮显示循环目标元素');
      highlightElement(element, 'loop');

      // 设置自动清除高亮
      setTimeout(() => {
        clearElementHighlight(element);
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
  const delay = step.operationDelay || step.actionDelay || step.loopDelay;
  if (delay) {
    console.log(`🔧 [DEBUG] 简单循环延迟开始: ${delay}ms`);
    const delayStartTime = Date.now();
    while (Date.now() - delayStartTime < delay) {
      // 在延迟期间检查暂停状态
      if (window.simplifiedExecutionControl) {
        await window.simplifiedExecutionControl.checkPause();
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(100, delay - (Date.now() - delayStartTime))));
    }
    console.log(`🔧 [DEBUG] 简单循环延迟完成`);
  }
}

async function executeContainerLoopAction(element, step) {
  console.log('🔧 [DEBUG] executeContainerLoopAction 开始执行 - 容器循环模式');

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  console.log(`📦 开始处理容器元素，不点击容器本身`);
  console.log('🔧 [DEBUG] 容器元素信息:', {
    tagName: element.tagName,
    id: element.id,
    className: element.className,
    textContent: element.textContent?.substring(0, 50) + '...'
  });

  // 高亮显示容器元素
  highlightElement(element, 'loop');
  setTimeout(() => {
    clearElementHighlight(element);
  }, 2000);

  // 滚动到容器元素位置，确保可见
  smartScrollIntoView(element, {
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });

  // 等待滚动完成
  await new Promise(resolve => setTimeout(resolve, 300));

  // 直接执行子操作序列，不点击容器元素
  if (step.subOperations && step.subOperations.length > 0) {
    console.log(`🔧 开始在容器内执行 ${step.subOperations.length} 个子操作`);

    for (let i = 0; i < step.subOperations.length; i++) {
      const subOp = step.subOperations[i];
      console.log(`🎯 执行容器内子操作 ${i + 1}: ${subOp.type} - ${subOp.locator?.value || subOp.locator}`);

      try {
        // 传递容器元素上下文给子操作
        await executeSubOperation(subOp, element);
      } catch (error) {
        console.error(`❌ 容器内子操作 ${i + 1} 失败:`, error);
        if (step.errorHandling === 'stop') {
          throw error;
        }
      }

      // 子操作间等待
      if (subOp.delay || subOp.waitAfterClick) {
        const waitTime = subOp.delay || subOp.waitAfterClick || 500;
        console.log(`⏳ 子操作间等待 ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    console.log(`✅ 容器内所有子操作执行完成`);
  } else {
    console.log(`⚠️ 容器循环没有配置子操作`);
  }

  // 操作延迟
  if (step.operationDelay) {
    console.log(`🔧 [DEBUG] 容器操作延迟开始: ${step.operationDelay}ms`);
    const delayStartTime = Date.now();
    while (Date.now() - delayStartTime < step.operationDelay) {
      // 在延迟期间检查暂停状态
      if (window.simplifiedExecutionControl) {
        await window.simplifiedExecutionControl.checkPause();
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(100, step.operationDelay - (Date.now() - delayStartTime))));
    }
    console.log(`🔧 [DEBUG] 容器操作延迟完成`);
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

  // 4. 父级循环操作延迟
  const delay = step.operationDelay || step.loopDelay || step.actionDelay;
  if (delay) {
    console.log(`⏳ 父级循环延迟 ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
    console.log(`✅ 父级循环延迟完成`);
  }
}

async function executeSubOperation(operation, parentElement = null) {
  console.log(`🔍 执行子操作: ${operation.type}`, operation.locator);

  switch (operation.type) {
    case 'click':
      let clickElement;
      if (parentElement) {
        console.log(`🔧 [DEBUG] 尝试在父级元素内查找: ${operation.locator.strategy}=${operation.locator.value}`);

        // 尝试在父级元素内查找，支持多种选择器策略
        try {
          switch (operation.locator.strategy) {
            case 'css':
              clickElement = parentElement.querySelector(operation.locator.value);
              break;
            case 'id':
              // 对于ID选择器，在父级元素内查找
              clickElement = parentElement.querySelector(`#${operation.locator.value}`);
              break;
            case 'xpath':
              // 对于XPath，需要在父级元素的上下文中执行
              const xpathResult = document.evaluate(
                operation.locator.value,
                parentElement,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              );
              clickElement = xpathResult.singleNodeValue;
              break;
            case 'text':
              // 在父级元素内查找包含特定文本的元素
              const textElements = parentElement.querySelectorAll('*');
              for (const el of textElements) {
                if (el.textContent && el.textContent.trim() === operation.locator.value.trim()) {
                  clickElement = el;
                  break;
                }
              }
              break;
            case 'contains':
              // 在父级元素内查找包含文本的元素
              const containsElements = parentElement.querySelectorAll('*');
              for (const el of containsElements) {
                if (el.textContent && el.textContent.includes(operation.locator.value)) {
                  clickElement = el;
                  break;
                }
              }
              break;
          }

          if (clickElement) {
            console.log(`🎯 在父级元素内找到目标: ${operation.locator.strategy}=${operation.locator.value}`);
          } else {
            console.log(`🔍 在父级元素内未找到，尝试全局查找`);
          }
        } catch (error) {
          console.warn(`🔧 [DEBUG] 父级元素内查找失败:`, error);
        }
      }

      // 如果在父级元素内没找到，或者没有父级元素，则进行全局查找
      if (!clickElement) {
        console.log(`🌐 使用全局查找: ${operation.locator.strategy}=${operation.locator.value}`);
        clickElement = await findElementByStrategy(operation.locator.strategy, operation.locator.value);
      }

      if (!clickElement) {
        throw new Error(`找不到点击目标元素: ${operation.locator.strategy}=${operation.locator.value}`);
      }

      // 高亮显示找到的元素
      highlightElement(clickElement, 'click');

      // 使用智能滚动函数，在虚拟列表模式下禁用页面滚动
      smartScrollIntoView(clickElement, { behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 300));

      // 执行点击
      clickElement.click();
      console.log(`👆 子操作-点击完成: ${operation.locator.value}`);

      // 清除高亮
      setTimeout(() => {
        clearElementHighlight(clickElement);
      }, 1000);

      break;

    case 'input':
      let inputElement;
      if (parentElement && operation.locator?.strategy === 'css') {
        // 只有CSS选择器才能在父级元素内查找
        inputElement = parentElement.querySelector(operation.locator.value);
        if (!inputElement) {
          inputElement = await findElementByStrategy(operation.locator.strategy, operation.locator.value);
        }
      } else {
        inputElement = await findElementByStrategy(operation.locator.strategy, operation.locator.value);
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
          const waitElement = await findElementByStrategy(operation.locator.strategy, operation.locator.value, 100);
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
          checkElement = await findElementByStrategy(operation.locator.strategy, operation.locator.value);
        }
      } else {
        checkElement = await findElementByStrategy(operation.locator.strategy, operation.locator.value);
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
          selectElement = await findElementByStrategy(operation.locator.strategy, operation.locator.value);
        }
      } else {
        selectElement = await findElementByStrategy(operation.locator.strategy, operation.locator.value);
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
      elements = await findElementsByStrategy(operation.locator.strategy, operation.locator.value);
      console.log(`🔍 在父级元素内未找到，使用全局查找`);
    } else {
      console.log(`🔍 在父级元素内找到 ${elements.length} 个目标`);
    }
  } else {
    // 对于非CSS选择器或没有父级元素的情况，直接全局查找
    elements = await findElementsByStrategy(operation.locator.strategy, operation.locator.value);
  }

  if (elements.length === 0) {
    throw new Error(`自循环未找到匹配元素: ${selector}`);
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
      highlightExecutionProgress(element);

      await executeAutoLoopAction(element, operation, actionType);
      successCount++;

      console.log(`✅ 第 ${i + 1} 个元素${actionType}操作完成`);

      // 操作间隔
      if (actionDelay > 0 && i < actualEndIndex) {
        await new Promise(resolve => setTimeout(resolve, actionDelay));
      }

      // 清除执行进度高亮
      clearExecutionProgress(element);

    } catch (error) {
      errorCount++;

      const element = elements[i];
      console.error(`❌ 第 ${i + 1} 个元素操作失败:`, error);

      // 清除执行进度高亮（即使失败也要清除）
      clearExecutionProgress(element);

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

// 测试条件判断
function testCondition(condition) {
  console.log('🧪 测试条件:', condition);

  try {
    // 清除之前的测试高亮
    clearTestHighlights();

    // 首先获取元素
    const locator = condition.locator;
    if (!locator || !locator.strategy || !locator.value) {
      return {
        success: false,
        error: '缺少定位器配置'
      };
    }

    // 查找元素
    const element = findSingleElement(locator.strategy, locator.value);
    if (!element) {
      return {
        success: false,
        error: '元素未找到',
        conditionMet: false
      };
    }

    // 高亮元素
    highlightTestElements([element]);

    // 执行条件判断
    let conditionResult = false;
    let actualValue = '';
    let expectedValue = condition.expectedValue || '';
    const attributeName = condition.attributeName || '';

    // 获取实际值
    switch (condition.conditionType) {
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
    if (condition.conditionType !== 'exists' && condition.conditionType !== 'visible') {
      switch (condition.comparisonType) {
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

    // 返回结果
    return {
      success: true,
      conditionMet: conditionResult,
      message: `条件${conditionResult ? '满足' : '不满足'}`,
      actualValue,
      expectedValue
    };
  } catch (error) {
    console.error('❌ 测试条件失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 查找单个元素
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

// 测试定位器元素数量
function testLocatorElements(locator) {
  console.log('🔍 测试定位器:', locator);

  try {
    // 清除之前的测试高亮
    clearTestHighlights();

    let elements;

    switch (locator.strategy) {
      case 'css':
        elements = document.querySelectorAll(locator.value);
        break;
      case 'xpath':
        const xpathResult = document.evaluate(
          locator.value,
          document,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );
        elements = [];
        for (let i = 0; i < xpathResult.snapshotLength; i++) {
          elements.push(xpathResult.snapshotItem(i));
        }
        break;
      case 'id':
        const idElement = document.getElementById(locator.value);
        elements = idElement ? [idElement] : [];
        break;
      case 'className':
        elements = document.getElementsByClassName(locator.value);
        break;
      case 'tagName':
        elements = document.getElementsByTagName(locator.value);
        break;
      case 'text':
        // 精确文本匹配，使用遍历方式避免XPath转义问题
        elements = Array.from(document.querySelectorAll('*')).filter(el =>
          el.textContent && el.textContent.trim() === locator.value.trim()
        );
        break;
      case 'contains':
        // 包含文本匹配，使用遍历方式避免XPath转义问题
        elements = Array.from(document.querySelectorAll('*')).filter(el =>
          el.textContent && el.textContent.includes(locator.value)
        );
        break;
      default:
        throw new Error(`不支持的定位策略: ${locator.strategy}`);
    }

    const count = elements.length;
    console.log(`✅ 找到 ${count} 个匹配元素`);

    // 如果找到元素，添加测试高亮效果
    if (count > 0) {
      highlightTestElements(Array.from(elements));
    }

    return { count };
  } catch (error) {
    console.error('❌ 测试定位器失败:', error);
    // 发生错误时也清除高亮
    clearTestHighlights();
    throw error;
  }
}

// 高亮元素
function highlightElement(element, type = 'processing') {
  if (!element) return;

  // 保存原始样式
  if (!element._originalStyle) {
    element._originalStyle = {
      outline: element.style.outline || '',
      backgroundColor: element.style.backgroundColor || '',
      transition: element.style.transition || ''
    };
  }

  // 设置高亮样式
  element.style.transition = 'all 0.3s ease';

  switch (type) {
    case 'processing':
      element.style.outline = '3px solid #3498db';
      element.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
      break;
    case 'click':
      element.style.outline = '3px solid #f39c12';
      element.style.backgroundColor = 'rgba(243, 156, 18, 0.2)';
      break;
    case 'input':
      element.style.outline = '3px solid #9b59b6';
      element.style.backgroundColor = 'rgba(155, 89, 182, 0.1)';
      break;
    case 'loop':
      element.style.outline = '3px solid #e67e22';
      element.style.backgroundColor = 'rgba(230, 126, 34, 0.15)';
      break;
    case 'success':
      element.style.outline = '3px solid #27ae60';
      element.style.backgroundColor = 'rgba(39, 174, 96, 0.1)';
      break;
    case 'error':
      element.style.outline = '3px solid #e74c3c';
      element.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
      break;
  }

  // 使用智能滚动函数，在虚拟列表模式下禁用页面滚动
  smartScrollIntoView(element, { behavior: 'smooth', block: 'center' });
}

// 清除元素高亮
function clearElementHighlight(element) {
  if (!element || !element._originalStyle) return;

  // 恢复原始样式
  element.style.outline = element._originalStyle.outline;
  element.style.backgroundColor = element._originalStyle.backgroundColor;
  element.style.transition = element._originalStyle.transition;

  // 清除保存的样式
  delete element._originalStyle;
}

// 全局变量存储测试高亮的元素
let testHighlightedElements = [];

// 高亮测试找到的元素
function highlightTestElements(elements) {
  console.log(`🎯 开始高亮 ${elements.length} 个测试元素`);

  // 清除之前的测试高亮
  clearTestHighlights();

  elements.forEach((element, index) => {
    if (!element) return;

    // 保存原始样式
    if (!element._testOriginalStyle) {
      element._testOriginalStyle = {
        outline: element.style.outline || '',
        backgroundColor: element.style.backgroundColor || '',
        transition: element.style.transition || '',
        zIndex: element.style.zIndex || ''
      };
    }

    // 设置测试高亮样式（橙色）
    element.style.transition = 'all 0.3s ease';
    element.style.outline = '2px solid orange';
    element.style.backgroundColor = 'rgba(255, 165, 0, 0.1)';
    element.style.zIndex = '9999';

    // 标记为测试高亮元素
    element._isTestHighlighted = true;
    testHighlightedElements.push(element);

    console.log(`✅ 已高亮第 ${index + 1} 个元素`);
  });

  // 滚动到第一个元素
  if (elements.length > 0 && elements[0]) {
    smartScrollIntoView(elements[0], {
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });
    console.log('📍 已滚动到第一个匹配元素');
  }
}

// 清除所有测试高亮
function clearTestHighlights() {
  console.log(`🧹 清除 ${testHighlightedElements.length} 个测试高亮元素`);

  testHighlightedElements.forEach(element => {
    if (element && element._testOriginalStyle) {
      // 恢复原始样式
      element.style.outline = element._testOriginalStyle.outline;
      element.style.backgroundColor = element._testOriginalStyle.backgroundColor;
      element.style.transition = element._testOriginalStyle.transition;
      element.style.zIndex = element._testOriginalStyle.zIndex;

      // 清除标记和保存的样式
      delete element._testOriginalStyle;
      delete element._isTestHighlighted;
    }
  });

  // 清空数组
  testHighlightedElements = [];
  console.log('✅ 所有测试高亮已清除');
}

// 高亮执行进度（绿色）
function highlightExecutionProgress(element) {
  if (!element) return;

  console.log('🟢 添加执行进度高亮');

  // 保存原始样式（如果还没保存的话）
  if (!element._executionOriginalStyle) {
    element._executionOriginalStyle = {
      outline: element.style.outline || '',
      backgroundColor: element.style.backgroundColor || '',
      transition: element.style.transition || '',
      zIndex: element.style.zIndex || ''
    };
  }

  // 设置执行进度高亮样式（绿色）
  element.style.transition = 'all 0.3s ease';
  element.style.outline = '3px solid #27ae60';
  element.style.backgroundColor = 'rgba(39, 174, 96, 0.1)';
  element.style.zIndex = '10000'; // 比测试高亮更高的层级

  // 标记为执行进度高亮
  element._isExecutionHighlighted = true;

  // 滚动到当前元素
  smartScrollIntoView(element, {
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });
}

// 清除执行进度高亮
function clearExecutionProgress(element) {
  if (!element || !element._executionOriginalStyle) return;

  console.log('🧹 清除执行进度高亮');

  // 恢复原始样式
  element.style.outline = element._executionOriginalStyle.outline;
  element.style.backgroundColor = element._executionOriginalStyle.backgroundColor;
  element.style.transition = element._executionOriginalStyle.transition;
  element.style.zIndex = element._executionOriginalStyle.zIndex;

  // 清除标记和保存的样式
  delete element._executionOriginalStyle;
  delete element._isExecutionHighlighted;
}

/**
 * 执行虚拟列表循环
 * 智能遍历虚拟列表，自动滚动并点击所有未处理的项目
 */
async function executeVirtualListLoop(step) {
  const loopName = step.name || `虚拟列表循环`;
  console.log(`📜 开始执行虚拟列表循环: ${loopName}`);

  // 设置虚拟列表模式标志，禁用页面滚动
  window.isVirtualListMode = true;
  console.log(`🚫 已启用虚拟列表模式，禁用页面滚动`);

  // 设置虚拟列表模式标志，禁用页面滚动
  window.isVirtualListMode = true;
  console.log(`🚫 已启用虚拟列表模式，禁用页面滚动`);

  // 验证配置
  if (!step.virtualListContainer || !step.virtualListContainer.value) {
    throw new Error('虚拟列表容器定位配置缺失');
  }
  if (!step.virtualListTitleLocator || !step.virtualListTitleLocator.value) {
    throw new Error('虚拟列表标题定位配置缺失');
  }

  // 获取容器元素
  const containerElements = await findElementsByStrategy(
    step.virtualListContainer.strategy,
    step.virtualListContainer.value
  );
  if (containerElements.length === 0) {
    throw new Error(`未找到虚拟列表容器: ${step.virtualListContainer.value}`);
  }
  const container = containerElements[0];
  console.log(`📦 找到虚拟列表容器`);

  // 初始化状态
  const processedTitles = new Set();
  const scrollDistance = step.virtualListScrollDistance || 100;
  const waitTime = step.virtualListWaitTime || 1000;
  const maxRetries = step.virtualListMaxRetries || 10;
  let retryCount = 0;
  let noNewItemsCount = 0;
  let totalProcessed = 0;

  console.log(`⚙️ 配置: 滚动距离=${scrollDistance}px, 等待时间=${waitTime}ms, 最大重试=${maxRetries}`);

  while (retryCount < maxRetries && noNewItemsCount < 5) {
    // 检查暂停状态
    if (window.simplifiedExecutionControl) {
      await window.simplifiedExecutionControl.checkPause();
    }

    try {
      // 收集当前可见的标题
      const visibleTitles = await collectVisibleTitles(step.virtualListTitleLocator);
      console.log(`👀 当前可见 ${visibleTitles.length} 个标题`);

      // 逐一检查每个可见标题，找到第一个未处理的
      let unprocessedTitle = null;
      for (const title of visibleTitles) {
        if (!processedTitles.has(title.text)) {
          unprocessedTitle = title;
          console.log(`🔍 找到未处理标题: "${title.text}"`);
          break;
        } else {
          console.log(`⏭️ 跳过已处理标题: "${title.text}"`);
        }
      }

      if (unprocessedTitle) {
        console.log(`🎯 处理标题: "${unprocessedTitle.text}"`);

        try {
          // 点击对应的按钮（使用循环操作的定位器）
          await clickVirtualListItem(unprocessedTitle, step);

          // 标记为已处理
          processedTitles.add(unprocessedTitle.text);
          totalProcessed++;
          noNewItemsCount = 0;

          console.log(`✅ 已处理: "${unprocessedTitle.text}" (总计: ${totalProcessed})`);

          // 操作后等待
          if (step.operationDelay) {
            console.log(`⏳ 操作延迟 ${step.operationDelay}ms`);
            await new Promise(resolve => setTimeout(resolve, step.operationDelay));
          }

          // 处理完一个项目后立即滚动
          const beforeScroll = container.scrollTop;
          console.log(`📜 处理完项目后滚动容器 ${scrollDistance}px (当前位置: ${beforeScroll})`);
          container.scrollTop += scrollDistance;
          const afterScroll = container.scrollTop;
          console.log(`📜 滚动完成，位置: ${beforeScroll} → ${afterScroll}`);

          // 等待新内容渲染
          console.log(`⏳ 等待新内容渲染 ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));

        } catch (clickError) {
          console.log(`❌ 点击失败: "${unprocessedTitle.text}" - ${clickError.message}`);

          // 标记红色边框
          try {
            unprocessedTitle.element.style.border = '2px solid red';
            setTimeout(() => {
              if (unprocessedTitle.element.style) {
                unprocessedTitle.element.style.border = '';
              }
            }, 3000);
          } catch (e) {
            // 忽略样式设置错误
          }

          // 仍然标记为已处理，避免重复尝试
          processedTitles.add(unprocessedTitle.text);

          // 即使失败也要滚动，继续处理下一个
          console.log(`📜 点击失败后滚动容器 ${scrollDistance}px`);
          container.scrollTop += scrollDistance;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

      } else {
        noNewItemsCount++;
        console.log(`ℹ️ 当前可见项目都已处理 (连续 ${noNewItemsCount}/5 次)`);

        // 即使没有新项目也要滚动，尝试加载更多内容
        console.log(`📜 尝试滚动加载更多内容 ${scrollDistance}px (总已处理: ${totalProcessed})`);
        container.scrollTop += scrollDistance;

        // 等待新内容渲染
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // retryCount 不在这里增加，只在出错时增加

    } catch (error) {
      console.log(`❌ 虚拟列表处理出错: ${error.message}`);
      retryCount++;

      if (retryCount >= maxRetries) {
        throw new Error(`虚拟列表处理失败，已达到最大重试次数: ${error.message}`);
      }

      // 短暂等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`🎉 虚拟列表循环完成，共处理 ${totalProcessed} 个项目`);

  // 清除虚拟列表模式标志，恢复正常滚动
  window.isVirtualListMode = false;
  console.log(`✅ 已退出虚拟列表模式，恢复正常滚动`);
}

/**
 * 收集当前可见的标题元素
 */
async function collectVisibleTitles(titleLocator) {
  const titleElements = await findElementsByStrategy(titleLocator.strategy, titleLocator.value);
  const visibleTitles = [];

  for (const element of titleElements) {
    // 检查元素是否在视口中可见（放宽条件，只要部分可见即可）
    const rect = element.getBoundingClientRect();
    const isVisible = rect.bottom > 0 && rect.top < window.innerHeight &&
      rect.right > 0 && rect.left < window.innerWidth;

    if (isVisible && element.innerText && element.innerText.trim()) {
      visibleTitles.push({
        text: element.innerText.trim(),
        element: element
      });
    }
  }

  return visibleTitles;
}

/**
 * 点击虚拟列表项对应的按钮
 */
async function clickVirtualListItem(titleInfo, step) {
  // 从标题元素开始，查找对应的可点击按钮
  // 使用循环操作的定位器来找到按钮
  const buttonElements = await findElementsByStrategy(step.locator.strategy, step.locator.value);

  console.log(`🔍 找到 ${buttonElements.length} 个可点击按钮，正在匹配标题: "${titleInfo.text}"`);

  // 尝试找到与当前标题相关的按钮
  // 策略1：查找同一个父容器内的按钮
  let targetButton = null;

  // 首先尝试在标题元素的父容器中查找按钮
  let currentElement = titleInfo.element;
  for (let level = 0; level < 5; level++) { // 最多向上查找5层
    if (!currentElement || !currentElement.parentElement) break;
    currentElement = currentElement.parentElement;

    // 在当前容器内查找按钮
    for (const button of buttonElements) {
      if (currentElement.contains(button)) {
        targetButton = button;
        console.log(`✅ 在第${level + 1}层父容器中找到匹配按钮`);
        break;
      }
    }
    if (targetButton) break;
  }

  // 策略2：如果没找到，使用距离匹配
  if (!targetButton) {
    console.log(`🔍 使用距离匹配策略查找按钮`);
    let minDistance = Infinity;

    const titleRect = titleInfo.element.getBoundingClientRect();
    const titleCenterX = titleRect.left + titleRect.width / 2;
    const titleCenterY = titleRect.top + titleRect.height / 2;

    for (const button of buttonElements) {
      const buttonRect = button.getBoundingClientRect();

      // 只考虑可见的按钮
      if (buttonRect.width === 0 || buttonRect.height === 0) continue;

      const buttonCenterX = buttonRect.left + buttonRect.width / 2;
      const buttonCenterY = buttonRect.top + buttonRect.height / 2;

      // 计算距离
      const distance = Math.sqrt(
        Math.pow(titleCenterX - buttonCenterX, 2) +
        Math.pow(titleCenterY - buttonCenterY, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        targetButton = button;
      }
    }

    if (targetButton) {
      console.log(`✅ 通过距离匹配找到按钮，距离: ${Math.round(minDistance)}px`);
    }
  }

  if (!targetButton) {
    throw new Error(`未找到与标题 "${titleInfo.text}" 对应的按钮`);
  }

  // 确保按钮在虚拟列表容器内可见，但不滚动整个页面
  console.log(`📍 确保按钮在虚拟列表容器内可见`);

  // 获取虚拟列表容器
  const containerElements = await findElementsByStrategy(
    step.virtualListContainer.strategy,
    step.virtualListContainer.value
  );

  if (containerElements.length > 0) {
    const listContainer = containerElements[0];
    const buttonRect = targetButton.getBoundingClientRect();
    const containerRect = listContainer.getBoundingClientRect();

    // 检查按钮是否在容器可视区域内
    const isButtonVisible = (
      buttonRect.top >= containerRect.top &&
      buttonRect.bottom <= containerRect.bottom &&
      buttonRect.left >= containerRect.left &&
      buttonRect.right <= containerRect.right
    );

    if (!isButtonVisible) {
      console.log(`📜 按钮不在容器可视区域内，调整容器滚动位置`);

      // 计算需要滚动的距离
      const scrollOffset = buttonRect.top - containerRect.top - (containerRect.height / 2);
      listContainer.scrollTop += scrollOffset;

      console.log(`📜 容器滚动调整: ${scrollOffset}px`);
    } else {
      console.log(`✅ 按钮已在容器可视区域内`);
    }
  }

  await new Promise(resolve => setTimeout(resolve, 200)); // 等待滚动完成

  // 根据循环类型决定如何处理
  if (step.loopType === 'container') {
    // 容器循环：先点击容器按钮，再执行子操作
    console.log(`📦 容器循环模式：先点击容器按钮，再执行子操作`);

    // 1. 先点击容器按钮
    console.log(`👆 点击虚拟列表容器按钮`);
    highlightElement(targetButton, 'click');
    targetButton.click();

    // 等待点击效果
    await new Promise(resolve => setTimeout(resolve, 300));

    // 清除点击高亮，改为容器高亮
    clearElementHighlight(targetButton);
    highlightElement(targetButton, 'loop');

    // 2. 然后执行子操作序列
    if (step.subOperations && step.subOperations.length > 0) {
      console.log(`🔧 容器点击后，开始执行 ${step.subOperations.length} 个子操作`);

      for (let i = 0; i < step.subOperations.length; i++) {
        const subOp = step.subOperations[i];
        console.log(`🎯 执行容器内子操作 ${i + 1}: ${subOp.type} - ${subOp.locator?.value || subOp.locator}`);

        try {
          // 传递容器元素上下文给子操作
          await executeSubOperation(subOp, targetButton);
        } catch (error) {
          console.error(`❌ 容器内子操作 ${i + 1} 失败:`, error);
          if (step.errorHandling === 'stop') {
            throw error;
          }
        }

        // 子操作间等待
        if (subOp.delay || subOp.waitAfterClick) {
          const waitTime = subOp.delay || subOp.waitAfterClick || 500;
          console.log(`⏳ 子操作间等待 ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      console.log(`✅ 容器内所有子操作执行完成`);
    } else {
      console.log(`⚠️ 容器循环没有配置子操作`);
    }

    // 清除容器高亮
    setTimeout(() => {
      clearElementHighlight(targetButton);
    }, 1000);

  } else {
    // 非容器循环：只点击按钮
    console.log(`👆 点击虚拟列表按钮`);
    targetButton.click();
  }
}
