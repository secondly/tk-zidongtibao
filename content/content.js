// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("Content script收到消息:", request);

  // 处理ping请求，用于检测content script是否已加载
  if (request.action === "ping") {
    console.log("收到ping请求");
    sendResponse({ success: true, message: "Content script已加载" });
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
    executeUniversalWorkflow(request.workflow)
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

    case "class":
      return await findElement("css", `.${value}`, timeout);

    case "css":
      return await findElement("css", value, timeout);

    case "xpath":
      return await findElementByXPath(value, timeout);

    case "text":
      return await findElementByText(value, ["*"], timeout);

    case "contains":
      return await findElementContainingText(value, ["*"], timeout);

    case "all":
      // 对于查找所有元素，仍返回第一个元素，但会发出警告
      console.warn(
        "使用findElementByStrategy查找'all'策略，将只返回第一个元素"
      );
      const elements = await findElementsByStrategy(strategy, value, timeout);
      if (elements.length === 0) {
        throw new Error(`未找到匹配元素 ${strategy}="${value}"`);
      }
      return elements[0];

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
  if (["id", "class", "css", "xpath", "all"].includes(strategy)) {
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

  // 对于需要轮询的情况（未找到元素或复杂查询如文本查找）
  const startTime = Date.now();
  let elements = [];

  // 减少轮询频率，特别是对于文本查找
  const pollingInterval =
    strategy === "text" || strategy === "contains" ? 300 : 100;
  let lastQueryTime = 0;

  while (Date.now() - startTime < timeout) {
    // 限制查询频率，减少DOM操作频率
    if (Date.now() - lastQueryTime < pollingInterval) {
      await new Promise((resolve) => setTimeout(resolve, 50)); // 短暂休眠
      continue;
    }

    lastQueryTime = Date.now();

    try {
      elements = await performSingleElementSearch(strategy, value);

      // 如果找到了元素或已尝试超过一半时间，则返回结果
      if (elements.length > 0 || Date.now() - startTime > timeout / 2) {
        break;
      }
    } catch (error) {
      console.error(`查找元素时出错:`, error);
    }

    // 等待一段时间再试，减少CPU占用
    await new Promise((resolve) => setTimeout(resolve, pollingInterval));
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

    case "class":
      elements = Array.from(document.getElementsByClassName(value));
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
      // 优化文本完全匹配搜索，使用XPath而非遍历所有元素
      const textXPath = `//*[text()="${escapeXPathString(value)}"]`;
      const textResult = document.evaluate(
        textXPath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      elements = [];
      for (let i = 0; i < textResult.snapshotLength; i++) {
        elements.push(textResult.snapshotItem(i));
      }
      break;

    case "contains":
      // 优化包含文本搜索，使用XPath而非遍历所有元素
      const containsXPath = `//*[contains(text(),"${escapeXPathString(
        value
      )}")]`;
      const containsResult = document.evaluate(
        containsXPath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      elements = [];
      for (let i = 0; i < containsResult.snapshotLength; i++) {
        elements.push(containsResult.snapshotItem(i));
      }
      break;

    case "all":
      // "all"策略下，默认使用CSS选择器查找所有匹配元素
      elements = Array.from(document.querySelectorAll(value));
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

    // 等待100ms再试
    await new Promise((resolve) => setTimeout(resolve, 100));
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
    for (const tagName of tagNames) {
      const elements = document.querySelectorAll(tagName);

      for (const element of elements) {
        if (element.textContent.trim() === text) {
          console.log(`成功根据精确文本找到元素`, element);
          return element;
        }
      }
    }

    // 等待100ms再试
    await new Promise((resolve) => setTimeout(resolve, 100));
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
    for (const tagName of tagNames) {
      const elements = document.querySelectorAll(tagName);

      for (const element of elements) {
        if (element.textContent.includes(text)) {
          console.log(`成功根据包含文本找到元素`, element);
          return element;
        }
      }
    }

    // 等待100ms再试
    await new Promise((resolve) => setTimeout(resolve, 100));
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

  // 确保元素在视图中
  element.scrollIntoView({ behavior: "smooth", block: "center" });

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

  // 确保元素在视图中
  element.scrollIntoView({ behavior: "smooth", block: "center" });

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
    },

    resume() {
      this.isPaused = false;
      console.log('▶️ 简化模式继续执行');
      if (this.pauseResolve) {
        this.pauseResolve();
        this.pauseResolve = null;
        this.pausePromise = null;
      }
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
        case 'loop':
          await executeLoopStep(step);
          break;
        default:
          console.log(`⚠️ 跳过不支持的步骤类型: ${step.type}`);
      }

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
      console.log('🔧 [DEBUG] 步骤间等待完成');
    }

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
  return new Promise(async (resolve, reject) => {
    console.log('🔄 开始加载通用自动化引擎...');

    // 检查是否已经加载
    if (window.UniversalAutomationEngine && typeof window.UniversalAutomationEngine === 'function') {
      console.log('✅ 通用自动化引擎已存在');
      resolve();
      return;
    }

    // 清理所有旧的脚本
    const oldScripts = document.querySelectorAll('script[data-automation-engine="true"]');
    oldScripts.forEach(script => {
      console.log('🗑️ 移除旧的引擎脚本');
      script.remove();
    });

    // 创建脚本标签注入到页面
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('universal-automation-engine.js');
    script.setAttribute('data-automation-engine', 'true');

    // 监听页面脚本的加载完成消息
    const messageHandler = (event) => {
      if (event.data && event.data.type === 'AUTOMATION_ENGINE_LOADED') {
        console.log('✅ 收到引擎加载完成消息');
        window.removeEventListener('message', messageHandler);

        // 直接检查引擎是否可用（简化方法）
        setTimeout(() => {
          console.log('✅ 引擎加载完成，直接解析');
          resolve();
        }, 100);
      }

      if (event.data && event.data.type === 'ENGINE_CHECK_RESULT') {
        if (event.data.available) {
          console.log('✅ 引擎在页面上下文中可用');
          resolve();
        } else {
          console.error('❌ 引擎在页面上下文中不可用:', event.data.engineType);
          reject(new Error(`引擎不可用: ${event.data.engineType}`));
        }
      }
    };

    window.addEventListener('message', messageHandler);

    // 设置超时 - 减少到3秒
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      reject(new Error('引擎加载超时'));
    }, 3000);

    script.onload = () => {
      console.log('📦 引擎脚本文件已加载，等待初始化...');
    };

    script.onerror = (error) => {
      console.error('❌ 脚本加载失败:', error);
      reject(new Error('脚本加载失败'));
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

  const selector = step.locator?.value || step.locator;
  if (!selector) {
    throw new Error('缺少定位器');
  }

  console.log('🔧 [DEBUG] 查找元素:', selector);
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`找不到元素: ${selector}`);
  }

  console.log('🔧 [DEBUG] 准备点击元素');
  element.click();
  console.log(`✅ 点击元素: ${selector}`);
}

async function executeInputStep(step) {
  console.log('🔧 [DEBUG] executeInputStep 开始执行');

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  const selector = step.locator?.value || step.locator;
  const text = step.text || step.inputText || '';

  if (!selector) {
    throw new Error('缺少定位器');
  }

  console.log('🔧 [DEBUG] 查找输入元素:', selector);
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`找不到元素: ${selector}`);
  }

  console.log('🔧 [DEBUG] 准备输入文本:', text);
  element.value = text;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  console.log(`✅ 输入文本: ${selector} = "${text}"`);
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

async function executeLoopStep(step) {
  const selector = step.locator?.value || step.locator;
  if (!selector) {
    throw new Error('缺少循环定位器');
  }

  const elements = document.querySelectorAll(selector);
  if (elements.length === 0) {
    throw new Error(`找不到循环元素: ${selector}`);
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
    console.log(`🎯 处理第 ${i + 1} 个元素`);

    try {
      if (step.loopType === 'simpleLoop') {
        // 简单循环：执行单一操作
        await executeSimpleLoopAction(element, step);
      } else {
        // 父级循环：点击后执行子操作
        await executeParentLoopAction(element, step);
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
      element.click();
      console.log(`👆 点击元素`);
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
  const selector = operation.locator?.value || operation.locator;

  // 如果有父级元素上下文，优先在父级元素内查找，否则全局查找
  const searchContext = parentElement || document;

  console.log(`🔍 在${parentElement ? '父级元素内' : '全局'}查找: ${selector}`);

  switch (operation.type) {
    case 'click':
      const clickElement = searchContext.querySelector(selector);
      if (!clickElement) {
        // 如果在父级元素内找不到，尝试全局查找
        const globalElement = document.querySelector(selector);
        if (!globalElement) {
          throw new Error(`找不到点击元素: ${selector}`);
        }
        globalElement.click();
        console.log(`👆 子操作-点击(全局): ${selector}`);
      } else {
        clickElement.click();
        console.log(`👆 子操作-点击(父级内): ${selector}`);
      }
      break;

    case 'input':
      const inputElement = searchContext.querySelector(selector) || document.querySelector(selector);
      if (!inputElement) throw new Error(`找不到输入元素: ${selector}`);
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
      console.log(`🔍 子操作-等待元素: ${selector}`);
      const timeout = operation.timeout || 10000;
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        const waitElement = searchContext.querySelector(selector) || document.querySelector(selector);
        if (waitElement) {
          console.log(`✅ 元素已出现: ${selector}`);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      break;

    case 'check':
      const checkElement = searchContext.querySelector(selector) || document.querySelector(selector);
      if (!checkElement) throw new Error(`找不到复选框元素: ${selector}`);
      if (!checkElement.checked) {
        checkElement.checked = true;
        checkElement.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`☑️ 子操作-勾选复选框`);
      }
      break;

    case 'select':
      const selectElement = searchContext.querySelector(selector) || document.querySelector(selector);
      if (!selectElement) throw new Error(`找不到选择元素: ${selector}`);
      selectElement.value = operation.value || '';
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`📋 子操作-选择选项: ${operation.value}`);
      break;

    case 'autoLoop':
      console.log(`🔁 子操作-自循环开始: ${selector}`);
      await executeSubOperationAutoLoop(operation, parentElement);
      break;

    default:
      throw new Error(`不支持的子操作类型: ${operation.type}`);
  }
}

// 执行子操作中的自循环
async function executeSubOperationAutoLoop(operation, parentElement = null) {
  const selector = operation.locator?.value || operation.locator;
  console.log(`🔁 开始执行子操作自循环: ${selector}`);

  // 查找所有匹配的元素
  let elements;
  if (parentElement) {
    // 优先在父级元素内查找
    elements = Array.from(parentElement.querySelectorAll(selector));
    if (elements.length === 0) {
      // 如果在父级元素内找不到，尝试全局查找
      elements = Array.from(document.querySelectorAll(selector));
      console.log(`🔍 在父级元素内未找到，使用全局查找`);
    } else {
      console.log(`🔍 在父级元素内找到 ${elements.length} 个目标`);
    }
  } else {
    elements = Array.from(document.querySelectorAll(selector));
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
    case 'success':
      element.style.outline = '3px solid #27ae60';
      element.style.backgroundColor = 'rgba(39, 174, 96, 0.1)';
      break;
    case 'error':
      element.style.outline = '3px solid #e74c3c';
      element.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
      break;
  }

  // 滚动到元素可见
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    // 设置测试高亮样式（黄色）
    element.style.transition = 'all 0.3s ease';
    element.style.outline = '3px solid #f1c40f';
    element.style.backgroundColor = 'rgba(241, 196, 15, 0.1)';
    element.style.zIndex = '9999';

    // 标记为测试高亮元素
    element._isTestHighlighted = true;
    testHighlightedElements.push(element);

    console.log(`✅ 已高亮第 ${index + 1} 个元素`);
  });

  // 滚动到第一个元素
  if (elements.length > 0 && elements[0]) {
    elements[0].scrollIntoView({
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
  element.scrollIntoView({
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
