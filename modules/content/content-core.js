/**
 * 内容脚本核心模块
 * 负责消息监听、基础DOM操作、元素查找等核心功能
 */

// 全局变量存储测试高亮的元素
let testHighlightedElements = [];

/**
 * 监听来自后台脚本的消息
 */
if (
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  chrome.runtime.onMessage
) {
  chrome.runtime.onMessage.addListener(function (
    request,
    _sender,
    sendResponse
  ) {
    console.log("Content script收到消息:", request);

    // 处理ping请求，用于检测content script是否已加载
    if (request.action === "ping") {
      console.log("收到ping请求");
      sendResponse({
        success: true,
        status: "ready",
        message: "Content script已加载",
      });
      return true;
    }

    // 处理重置引擎请求
    if (request.action === "resetEngine") {
      try {
        console.log("🔄 收到重置引擎请求");

        // 清除可能存在的引擎实例
        if (window.UniversalAutomationEngine) {
          // 移除旧的脚本标签
          const oldScripts = document.querySelectorAll(
            'script[data-automation-engine="true"]'
          );
          oldScripts.forEach((script) => {
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
      console.log(
        "🔧 [DEBUG] 收到工作流执行请求，工作流数据:",
        JSON.stringify(request.data, null, 2)
      );

      // 验证工作流数据结构
      if (request.data && request.data.steps) {
        request.data.steps.forEach((step, index) => {
          console.log(`🔧 [DEBUG] 步骤 ${index + 1}:`, {
            type: step.type,
            name: step.name,
            locator: step.locator,
            hasLocator: !!step.locator,
            locatorStrategy: step.locator?.strategy || step.locator?.type,
            locatorValue: step.locator?.value,
          });
        });
      }

      // 调用自动化执行模块
      if (
        window.ContentAutomation &&
        window.ContentAutomation.executeUniversalWorkflow
      ) {
        window.ContentAutomation.executeUniversalWorkflow(request.data)
          .then((result) => {
            sendResponse({ success: true, result });
          })
          .catch((error) => {
            console.error("执行通用工作流失败:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else {
        console.error("❌ 自动化执行模块未加载");
        sendResponse({ success: false, error: "自动化执行模块未加载" });
      }
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

    // 处理敏感词检测测试请求
    if (request.action === "testSensitiveWordDetection") {
      try {
        testSensitiveWordDetection(request.data)
          .then((result) => {
            sendResponse({ success: true, ...result });
          })
          .catch((error) => {
            console.error("敏感词检测测试失败:", error);
            sendResponse({ success: false, error: error.message });
          });
      } catch (error) {
        console.error("敏感词检测测试失败:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    // 处理暂停执行请求
    if (request.action === "pauseExecution") {
      console.log("🔧 [DEBUG] Content script 收到暂停请求");
      console.log("🔧 [DEBUG] 当前引擎状态:", {
        hasAutomationEngine: !!window.automationEngine,
        hasSimplifiedControl: !!window.simplifiedExecutionControl,
        automationEngineRunning: window.automationEngine
          ? window.automationEngine.isRunning
          : false,
        automationEnginePaused: window.automationEngine
          ? window.automationEngine.isPaused
          : false,
        simplifiedControlPaused: window.simplifiedExecutionControl
          ? window.simplifiedExecutionControl.isPaused
          : false,
      });

      try {
        if (window.automationEngine && window.automationEngine.isRunning) {
          console.log("🔧 [DEBUG] 使用高级引擎暂停（引擎正在运行）");
          // 高级引擎模式
          window.automationEngine.pause();
          console.log("🔧 [DEBUG] 高级引擎暂停调用完成");
          sendResponse({ success: true, mode: "advanced" });
        } else if (window.simplifiedExecutionControl) {
          console.log("🔧 [DEBUG] 使用简化模式暂停");
          // 简化模式
          window.simplifiedExecutionControl.pause();
          console.log("🔧 [DEBUG] 简化模式暂停调用完成");
          sendResponse({ success: true, mode: "simplified" });
        } else {
          console.log("❌ [DEBUG] 没有可用的执行引擎或引擎未运行");
          console.log("🔧 [DEBUG] 详细状态:", {
            hasEngine: !!window.automationEngine,
            engineRunning: window.automationEngine
              ? window.automationEngine.isRunning
              : "N/A",
            hasSimplified: !!window.simplifiedExecutionControl,
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
} else {
  console.warn("Chrome runtime API not available");
}

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
function highlightElement(element, type = "processing") {
  if (!element) return;

  // 保存原始样式
  if (!element._originalStyle) {
    element._originalStyle = {
      outline: element.style.outline || "",
      backgroundColor: element.style.backgroundColor || "",
      transition: element.style.transition || "",
    };
  }

  // 设置高亮样式
  element.style.transition = "all 0.3s ease";

  switch (type) {
    case "processing":
      element.style.outline = "3px solid #3498db";
      element.style.backgroundColor = "rgba(52, 152, 219, 0.1)";
      break;
    case "click":
      element.style.outline = "3px solid #f39c12";
      element.style.backgroundColor = "rgba(243, 156, 18, 0.2)";
      break;
    case "input":
      element.style.outline = "3px solid #9b59b6";
      element.style.backgroundColor = "rgba(155, 89, 182, 0.1)";
      break;
    case "loop":
      element.style.outline = "3px solid #e67e22";
      element.style.backgroundColor = "rgba(230, 126, 34, 0.15)";
      break;
    case "success":
      element.style.outline = "3px solid #27ae60";
      element.style.backgroundColor = "rgba(39, 174, 96, 0.1)";
      break;
    case "error":
      element.style.outline = "3px solid #e74c3c";
      element.style.backgroundColor = "rgba(231, 76, 60, 0.1)";
      break;
    case "skip":
      element.style.outline = "3px solid #95a5a6";
      element.style.backgroundColor = "rgba(149, 165, 166, 0.15)";
      break;
  }

  // 滚动到元素可见
  element.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * 清除元素高亮
 * @param {HTMLElement} element - 要清除高亮的元素
 */
function clearElementHighlight(element) {
  if (!element || !element._originalStyle) return;

  // 恢复原始样式
  element.style.outline = element._originalStyle.outline;
  element.style.backgroundColor = element._originalStyle.backgroundColor;
  element.style.transition = element._originalStyle.transition;

  // 清除保存的样式
  delete element._originalStyle;
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
    const elements = await findElementsByStrategy(
      locator.strategy,
      locator.value
    );

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
  const pollingInterval =
    strategy === "text" || strategy === "contains" ? 300 : 100;

  while (Date.now() - startTime < timeout) {
    // 检查暂停状态 - 如果暂停则立即停止搜索
    if (
      window.simplifiedExecutionControl &&
      window.simplifiedExecutionControl.isPaused
    ) {
      console.log("🔧 [DEBUG] 元素搜索检测到暂停状态，停止搜索");
      break;
    }

    // 检查高级引擎暂停状态
    if (window.automationEngine && window.automationEngine.isPaused) {
      console.log("🔧 [DEBUG] 元素搜索检测到高级引擎暂停状态，停止搜索");
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
      if (typeof requestAnimationFrame !== "undefined") {
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
      elements = Array.from(document.querySelectorAll("*")).filter(
        (el) => el.textContent && el.textContent.trim() === value.trim()
      );
      break;

    case "contains":
      // 包含文本匹配，使用遍历方式避免XPath转义问题
      elements = Array.from(document.querySelectorAll("*")).filter(
        (el) => el.textContent && el.textContent.includes(value)
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
    if (
      window.simplifiedExecutionControl &&
      window.simplifiedExecutionControl.isPaused
    ) {
      console.log("🔧 [DEBUG] findElement检测到暂停状态，停止查找");
      throw new Error("查找已暂停");
    }

    if (window.automationEngine && window.automationEngine.isPaused) {
      console.log("🔧 [DEBUG] findElement检测到高级引擎暂停状态，停止查找");
      throw new Error("查找已暂停");
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
      if (typeof requestAnimationFrame !== "undefined") {
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
    if (
      window.simplifiedExecutionControl &&
      window.simplifiedExecutionControl.isPaused
    ) {
      console.log("🔧 [DEBUG] findElementByText检测到暂停状态，停止查找");
      throw new Error("查找已暂停");
    }

    if (window.automationEngine && window.automationEngine.isPaused) {
      console.log(
        "🔧 [DEBUG] findElementByText检测到高级引擎暂停状态，停止查找"
      );
      throw new Error("查找已暂停");
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
      if (typeof requestAnimationFrame !== "undefined") {
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
    if (
      window.simplifiedExecutionControl &&
      window.simplifiedExecutionControl.isPaused
    ) {
      throw new Error("查找已暂停");
    }

    if (window.automationEngine && window.automationEngine.isPaused) {
      throw new Error("查找已暂停");
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
      if (typeof requestAnimationFrame !== "undefined") {
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
    if (
      window.simplifiedExecutionControl &&
      window.simplifiedExecutionControl.isPaused
    ) {
      console.log("🔧 [DEBUG] findElementByXPath检测到暂停状态，停止查找");
      throw new Error("查找已暂停");
    }

    if (window.automationEngine && window.automationEngine.isPaused) {
      console.log(
        "🔧 [DEBUG] findElementByXPath检测到高级引擎暂停状态，停止查找"
      );
      throw new Error("查找已暂停");
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
      if (typeof requestAnimationFrame !== "undefined") {
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
 * 测试条件判断
 */
function testCondition(condition) {
  console.log("🧪 测试条件:", condition);

  try {
    // 清除之前的测试高亮
    clearTestHighlights();

    // 首先获取元素
    const locator = condition.locator;
    if (!locator || !locator.strategy || !locator.value) {
      return {
        success: false,
        error: "缺少定位器配置",
      };
    }

    // 查找元素
    const element = findSingleElement(locator.strategy, locator.value);
    if (!element) {
      return {
        success: false,
        error: "元素未找到",
        conditionMet: false,
      };
    }

    // 高亮元素
    highlightTestElements([element]);

    // 执行条件判断
    let conditionResult = false;
    let actualValue = "";
    let expectedValue = condition.expectedValue || "";
    const attributeName = condition.attributeName || "";

    // 获取实际值
    switch (condition.conditionType) {
      case "attribute":
        actualValue = element.getAttribute(attributeName) || "";
        break;
      case "text":
        actualValue = element.textContent || "";
        break;
      case "class":
        actualValue = element.className || "";
        break;
      case "style":
        actualValue = getComputedStyle(element)[attributeName] || "";
        break;
      case "value":
        actualValue = element.value || "";
        break;
      case "exists":
        conditionResult = true; // 元素已找到
        break;
      case "visible":
        conditionResult = element.offsetParent !== null;
        break;
    }

    // 执行比较
    if (
      condition.conditionType !== "exists" &&
      condition.conditionType !== "visible"
    ) {
      switch (condition.comparisonType) {
        case "equals":
          conditionResult = actualValue === expectedValue;
          break;
        case "notEquals":
          conditionResult = actualValue !== expectedValue;
          break;
        case "contains":
          conditionResult = actualValue.includes(expectedValue);
          break;
        case "notContains":
          conditionResult = !actualValue.includes(expectedValue);
          break;
        case "startsWith":
          conditionResult = actualValue.startsWith(expectedValue);
          break;
        case "endsWith":
          conditionResult = actualValue.endsWith(expectedValue);
          break;
        case "isEmpty":
          conditionResult = actualValue === "";
          break;
        case "isNotEmpty":
          conditionResult = actualValue !== "";
          break;
        case "hasAttribute":
          conditionResult = element.hasAttribute(attributeName);
          break;
        case "notHasAttribute":
          conditionResult = !element.hasAttribute(attributeName);
          break;
      }
    }

    // 返回结果
    return {
      success: true,
      conditionMet: conditionResult,
      message: `条件${conditionResult ? "满足" : "不满足"}`,
      actualValue,
      expectedValue,
    };
  } catch (error) {
    console.error("❌ 测试条件失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 查找单个元素
 */
function findSingleElement(strategy, value) {
  try {
    switch (strategy) {
      case "css":
        return document.querySelector(value);
      case "xpath":
        const xpathResult = document.evaluate(
          value,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        return xpathResult.singleNodeValue;
      case "id":
        return document.getElementById(value);
      case "className":
        const elements = document.getElementsByClassName(value);
        return elements.length > 0 ? elements[0] : null;
      case "text":
        return Array.from(document.querySelectorAll("*")).find(
          (el) => el.textContent && el.textContent.trim() === value.trim()
        );
      case "contains":
        return Array.from(document.querySelectorAll("*")).find(
          (el) => el.textContent && el.textContent.includes(value)
        );
      case "tagName":
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

/**
 * 测试定位器元素数量
 */
function testLocatorElements(locator) {
  console.log("🔍 测试定位器:", locator);

  try {
    // 清除之前的测试高亮
    clearTestHighlights();

    let elements;

    switch (locator.strategy) {
      case "css":
        elements = document.querySelectorAll(locator.value);
        break;
      case "xpath":
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
      case "id":
        const idElement = document.getElementById(locator.value);
        elements = idElement ? [idElement] : [];
        break;
      case "className":
        elements = document.getElementsByClassName(locator.value);
        break;
      case "tagName":
        elements = document.getElementsByTagName(locator.value);
        break;
      case "text":
        // 精确文本匹配，使用遍历方式避免XPath转义问题
        elements = Array.from(document.querySelectorAll("*")).filter(
          (el) =>
            el.textContent && el.textContent.trim() === locator.value.trim()
        );
        break;
      case "contains":
        // 包含文本匹配，使用遍历方式避免XPath转义问题
        elements = Array.from(document.querySelectorAll("*")).filter(
          (el) => el.textContent && el.textContent.includes(locator.value)
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
    console.error("❌ 测试定位器失败:", error);
    // 发生错误时也清除高亮
    clearTestHighlights();
    throw error;
  }
}

/**
 * 高亮测试找到的元素
 */
function highlightTestElements(elements) {
  console.log(`🎯 开始高亮 ${elements.length} 个测试元素`);

  // 清除之前的测试高亮
  clearTestHighlights();

  elements.forEach((element, index) => {
    if (!element) return;

    // 保存原始样式
    if (!element._testOriginalStyle) {
      element._testOriginalStyle = {
        outline: element.style.outline || "",
        backgroundColor: element.style.backgroundColor || "",
        transition: element.style.transition || "",
        zIndex: element.style.zIndex || "",
      };
    }

    // 设置测试高亮样式（橙色）
    element.style.transition = "all 0.3s ease";
    element.style.outline = "2px solid orange";
    element.style.backgroundColor = "rgba(255, 165, 0, 0.1)";
    element.style.zIndex = "9999";

    // 标记为测试高亮元素
    element._isTestHighlighted = true;
    testHighlightedElements.push(element);

    console.log(`✅ 已高亮第 ${index + 1} 个元素`);
  });

  // 滚动到第一个元素
  if (elements.length > 0 && elements[0]) {
    elements[0].scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
    console.log("📍 已滚动到第一个匹配元素");
  }
}

/**
 * 清除所有测试高亮
 */
function clearTestHighlights() {
  console.log(`🧹 清除 ${testHighlightedElements.length} 个测试高亮元素`);

  testHighlightedElements.forEach((element) => {
    if (element && element._testOriginalStyle) {
      // 恢复原始样式
      element.style.outline = element._testOriginalStyle.outline;
      element.style.backgroundColor =
        element._testOriginalStyle.backgroundColor;
      element.style.transition = element._testOriginalStyle.transition;
      element.style.zIndex = element._testOriginalStyle.zIndex;

      // 清除标记和保存的样式
      delete element._testOriginalStyle;
      delete element._isTestHighlighted;
    }
  });

  // 清空数组
  testHighlightedElements = [];
  console.log("✅ 所有测试高亮已清除");
}

/**
 * 高亮执行进度（绿色）
 */
function highlightExecutionProgress(element) {
  if (!element) return;

  console.log("🟢 添加执行进度高亮");

  // 保存原始样式（如果还没保存的话）
  if (!element._executionOriginalStyle) {
    element._executionOriginalStyle = {
      outline: element.style.outline || "",
      backgroundColor: element.style.backgroundColor || "",
      transition: element.style.transition || "",
      zIndex: element.style.zIndex || "",
    };
  }

  // 设置执行进度高亮样式（绿色）
  element.style.transition = "all 0.3s ease";
  element.style.outline = "3px solid #27ae60";
  element.style.backgroundColor = "rgba(39, 174, 96, 0.1)";
  element.style.zIndex = "10000"; // 比测试高亮更高的层级

  // 标记为执行进度高亮
  element._isExecutionHighlighted = true;

  // 滚动到当前元素
  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });
}

/**
 * 清除执行进度高亮
 */
function clearExecutionProgress(element) {
  if (!element || !element._executionOriginalStyle) return;

  console.log("🧹 清除执行进度高亮");

  // 恢复原始样式
  element.style.outline = element._executionOriginalStyle.outline;
  element.style.backgroundColor =
    element._executionOriginalStyle.backgroundColor;
  element.style.transition = element._executionOriginalStyle.transition;
  element.style.zIndex = element._executionOriginalStyle.zIndex;

  // 清除标记和保存的样式
  delete element._executionOriginalStyle;
  delete element._isExecutionHighlighted;
}

// 导出核心功能到全局作用域，供自动化模块使用
window.ContentCore = {
  findElementByStrategy,
  findElementsByStrategy,
  findElement,
  findElementByText,
  findElementContainingText,
  findElementByXPath,
  clickElement,
  inputText,
  highlightElement,
  clearElementHighlight,
  highlightExecutionProgress,
  clearExecutionProgress,
  elementToString,
  performSingleElementSearch,
  performAsyncElementSearch,
};

console.log("✅ Content Core 模块已加载");

/**
 * 测试敏感词检测功能
 * @param {object} data - 测试数据，包含循环定位器和敏感词检测配置
 * @returns {Promise<object>} - 测试结果
 */
async function testSensitiveWordDetection(data) {
  try {
    console.log("🔍 开始测试敏感词检测:", data);

    const { loopLocator, sensitiveWordConfig } = data;

    if (!loopLocator || !sensitiveWordConfig) {
      throw new Error("缺少必要的测试参数");
    }

    // 清除之前的测试高亮
    clearTestHighlights();

    // 查找循环元素
    const elements = await findElementsByStrategy(
      loopLocator.strategy,
      loopLocator.value
    );

    if (elements.length === 0) {
      throw new Error(
        `未找到循环元素: ${loopLocator.strategy}=${loopLocator.value}`
      );
    }

    console.log(`🔍 找到 ${elements.length} 个循环元素，开始敏感词检测测试`);

    // 创建敏感词检测器实例
    if (!window.SensitiveWordDetector) {
      throw new Error("敏感词检测模块未加载");
    }

    const detector = new window.SensitiveWordDetector();
    let skippedCount = 0;
    const testResults = [];

    // 测试每个元素
    for (let i = 0; i < Math.min(elements.length, 10); i++) {
      // 限制测试前10个元素
      const element = elements[i];

      try {
        const skipResult = await detector.checkShouldSkipElement(
          element,
          sensitiveWordConfig
        );

        testResults.push({
          index: i,
          shouldSkip: skipResult.shouldSkip,
          reason: skipResult.reason,
          matchedWords: skipResult.matchedWords,
        });

        if (skipResult.shouldSkip) {
          skippedCount++;
          // 高亮被跳过的元素
          highlightElement(element, "skip");
        } else {
          // 高亮通过检测的元素
          highlightElement(element, "success");
        }
      } catch (error) {
        console.error(`测试第 ${i + 1} 个元素时出错:`, error);
        testResults.push({
          index: i,
          shouldSkip: false,
          reason: `检测失败: ${error.message}`,
          matchedWords: [],
        });
        // 高亮出错的元素
        highlightElement(element, "error");
      }
    }

    // 5秒后清除高亮
    setTimeout(() => {
      elements.forEach((element) => {
        clearElementHighlight(element);
      });
    }, 5000);

    const result = {
      totalElements: elements.length,
      testedElements: Math.min(elements.length, 10),
      skippedElements: skippedCount,
      passedElements: Math.min(elements.length, 10) - skippedCount,
      testResults: testResults,
      message: `测试完成：共 ${elements.length} 个元素，测试了前 ${Math.min(
        elements.length,
        10
      )} 个，其中 ${skippedCount} 个包含敏感词被跳过`,
    };

    console.log("🔍 敏感词检测测试结果:", result);
    return result;
  } catch (error) {
    console.error("❌ 敏感词检测测试失败:", error);
    throw error;
  }
}
