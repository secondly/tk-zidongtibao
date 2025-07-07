// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
  console.log("Content script收到消息:", request);

  // 处理ping请求，用于检测content script是否已加载
  if (request.action === "ping") {
    console.log("收到ping请求");
    sendResponse({ success: true, message: "Content script已加载" });
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
      // 为outerHTML策略提供更详细的错误信息
      let errorMessage = "未找到匹配元素";
      if (locator.strategy === "outerhtml") {
        if (!locator.value.startsWith('<')) {
          errorMessage = "outerHTML格式错误：必须以'<'开头的完整HTML标签";
        } else if (!locator.value.includes('>')) {
          errorMessage = "outerHTML格式错误：缺少'>'结束符";
        } else {
          errorMessage = "未找到匹配的HTML元素，请检查HTML代码是否正确";
        }
      }
      throw new Error(errorMessage);
    }

    // 移除之前的高亮
    removeHighlights();

    // 高亮显示找到的元素
    elements.forEach((element) => {
      highlightElement(element);
    });

    // 5秒后移除高亮
    setTimeout(removeHighlights, 5000);

    // 收集元素信息用于调试
    const elementInfo = elements.map(el => {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? '#' + el.id : '';
      const classes = el.className ? '.' + el.className.split(' ').filter(c => c).join('.') : '';
      return `${tag}${id}${classes}`;
    }).join(', ');

    return {
      count: elements.length,
      message: `找到 ${elements.length} 个匹配元素并已高亮显示`,
      elementInfo: elementInfo,
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
  textToInput
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
        if (textToInput === undefined) {
          throw new Error("输入操作需要提供输入文本");
        }
        await inputText(element, textToInput);
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

    // 等待元素出现操作
    if (config.action === "waitfor") {
      const timeout = parseInt(config.waitTime) || 30000; // 默认30秒超时
      console.log(`等待元素出现: ${config.locator.strategy}="${config.locator.value}"`);

      const element = await waitForElement(
        config.locator.strategy,
        config.locator.value,
        timeout
      );

      // 高亮显示找到的元素
      highlightElement(element);
      setTimeout(removeHighlights, 2000);

      return {
        message: `元素已出现并找到`,
        element: elementToString(element)
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

    case "outerhtml":
      // outerHTML策略查找元素
      const outerHTMLElements = await findElementsByStrategy(strategy, value, timeout);
      if (outerHTMLElements.length === 0) {
        throw new Error(`未找到匹配元素 ${strategy}="${value}"`);
      }
      return outerHTMLElements[0];

    case "jspath":
      // JS路径策略查找元素
      const jsPathElements = await findElementsByStrategy(strategy, value, timeout);
      if (jsPathElements.length === 0) {
        throw new Error(`未找到匹配元素 ${strategy}="${value}"`);
      }
      return jsPathElements[0];

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
 * 等待元素出现
 * @param {string} strategy - 定位策略
 * @param {string} value - 定位值
 * @param {number} timeout - 超时时间（毫秒）
 * @param {number} pollInterval - 轮询间隔（毫秒）
 * @returns {Promise<HTMLElement>} - 找到的元素
 */
async function waitForElement(strategy, value, timeout = 30000, pollInterval = 500) {
  console.log(`等待元素出现: ${strategy}="${value}", 超时时间: ${timeout}ms`);
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const elements = await performSingleElementSearch(strategy, value);
      if (elements.length > 0) {
        console.log(`元素已出现: 找到 ${elements.length} 个匹配元素`);
        return elements[0];
      }
    } catch (error) {
      // 忽略查找过程中的错误，继续等待
      console.log(`等待过程中的查找尝试失败，继续等待...`);
    }

    // 等待指定间隔后再次尝试
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`等待超时(${timeout}ms): 元素未出现 ${strategy}="${value}"`);
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
  if (["id", "class", "css", "xpath", "outerhtml", "jspath", "all"].includes(strategy)) {
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

    case "outerhtml":
      // 通过outerHTML匹配元素
      elements = findElementsByOuterHTML(value);
      break;

    case "jspath":
      // 通过JS路径匹配元素
      elements = findElementsByJSPath(value);
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
 * 通过outerHTML查找元素
 * @param {string} outerHTML - 要匹配的outerHTML字符串
 * @returns {HTMLElement[]} - 匹配的元素数组
 */
function findElementsByOuterHTML(outerHTML) {
  console.log('开始outerHTML匹配，目标HTML:', outerHTML);
  const elements = [];
  const allElements = document.querySelectorAll('*');

  // 清理和验证输入的HTML
  let targetHTML = cleanAndValidateHTML(outerHTML);
  console.log('清理后的目标HTML:', targetHTML);

  // 如果输入的HTML不完整，尝试智能补全
  if (!targetHTML.startsWith('<')) {
    console.log('检测到不完整的HTML，尝试智能匹配...');
    return findElementsByPartialHTML(targetHTML);
  }

  for (const element of allElements) {
    try {
      // 获取元素的outerHTML并清理空白字符
      const elementHTML = element.outerHTML.replace(/\s+/g, ' ').trim();

      // 完全匹配
      if (elementHTML === targetHTML) {
        console.log('找到完全匹配的元素:', element);
        elements.push(element);
        continue;
      }

      // 如果完全匹配失败，尝试部分匹配（忽略属性顺序）
      if (isHTMLStructureMatch(element, targetHTML)) {
        console.log('找到结构匹配的元素:', element);
        elements.push(element);
      }
    } catch (error) {
      // 忽略无法访问outerHTML的元素
      console.warn('无法访问元素的outerHTML:', error);
    }
  }

  console.log(`outerHTML匹配完成，找到 ${elements.length} 个元素`);
  return elements;
}

/**
 * 清理和验证HTML字符串
 * @param {string} html - 原始HTML字符串
 * @returns {string} - 清理后的HTML字符串
 */
function cleanAndValidateHTML(html) {
  // 移除多余的空白字符
  let cleaned = html.replace(/\s+/g, ' ').trim();

  // 检测并修复重复的HTML结构
  if (cleaned.includes('</a></a>') || cleaned.includes('</span></span>') || cleaned.includes('</div></div>')) {
    console.warn('检测到重复的HTML结构，尝试修复...');

    // 尝试提取第一个完整的标签
    const match = cleaned.match(/^<[^>]+>.*?<\/[^>]+>/);
    if (match) {
      const firstComplete = match[0];
      console.log('提取的第一个完整标签:', firstComplete);

      // 检查是否是有效的HTML
      if (isValidHTML(firstComplete)) {
        cleaned = firstComplete;
        console.log('使用修复后的HTML:', cleaned);
      }
    }
  }

  return cleaned;
}

/**
 * 验证HTML字符串是否有效
 * @param {string} html - HTML字符串
 * @returns {boolean} - 是否有效
 */
function isValidHTML(html) {
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // 检查是否成功解析为单个元素
    const children = tempDiv.children;
    if (children.length === 1) {
      const element = children[0];
      // 检查元素的outerHTML是否与输入匹配（忽略空白差异）
      const normalizedInput = html.replace(/\s+/g, ' ').trim();
      const normalizedOutput = element.outerHTML.replace(/\s+/g, ' ').trim();
      return normalizedInput === normalizedOutput;
    }

    return false;
  } catch (error) {
    console.warn('HTML验证失败:', error);
    return false;
  }
}

/**
 * 处理不完整HTML的匹配
 * @param {string} partialHTML - 不完整的HTML片段
 * @returns {HTMLElement[]} - 匹配的元素数组
 */
function findElementsByPartialHTML(partialHTML) {
  console.log('使用部分HTML匹配:', partialHTML);
  const elements = [];
  const allElements = document.querySelectorAll('*');

  for (const element of allElements) {
    try {
      const elementHTML = element.outerHTML.replace(/\s+/g, ' ').trim();

      // 检查元素的outerHTML是否包含目标片段
      if (elementHTML.includes(partialHTML)) {
        console.log('找到包含目标片段的元素:', element);
        elements.push(element);
      }

      // 也检查innerHTML
      const elementInnerHTML = element.innerHTML.replace(/\s+/g, ' ').trim();
      if (elementInnerHTML.includes(partialHTML)) {
        console.log('找到innerHTML包含目标片段的元素:', element);
        elements.push(element);
      }
    } catch (error) {
      console.warn('处理元素时出错:', error);
    }
  }

  return elements;
}

/**
 * 检查HTML结构是否匹配（忽略属性顺序）
 * @param {HTMLElement} element - 要检查的元素
 * @param {string} targetHTML - 目标HTML字符串
 * @returns {boolean} - 是否匹配
 */
function isHTMLStructureMatch(element, targetHTML) {
  try {
    // 创建一个临时元素来解析目标HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = targetHTML;
    const targetElement = tempDiv.firstElementChild;

    if (!targetElement) {
      // 如果无法解析为元素，尝试文本匹配
      return element.textContent.includes(targetHTML.replace(/<[^>]*>/g, ''));
    }

    // 比较标签名
    if (element.tagName.toLowerCase() !== targetElement.tagName.toLowerCase()) {
      return false;
    }

    // 比较属性（更宽松的匹配）
    const targetAttrs = targetElement.attributes;

    // 检查目标元素的所有属性是否在当前元素中存在（允许当前元素有更多属性）
    for (let i = 0; i < targetAttrs.length; i++) {
      const attr = targetAttrs[i];
      const elementAttrValue = element.getAttribute(attr.name);

      // 如果属性不存在或值不匹配，则不匹配
      if (elementAttrValue === null || elementAttrValue !== attr.value) {
        return false;
      }
    }

    // 比较文本内容（更宽松的匹配）
    if (targetElement.textContent.trim()) {
      const elementText = element.textContent.trim();
      const targetText = targetElement.textContent.trim();

      // 检查是否包含目标文本
      if (!elementText.includes(targetText)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.warn('HTML结构匹配检查失败:', error);
    return false;
  }
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
      throw new Error(`XPath语法错误: ${error.message}`);
    }

    // 等待一段时间再重试
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`超时(${timeout}ms)：无法找到XPath元素 "${xpath}"`);
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
 * 通过JS路径查找元素
 * @param {string} jsPath - JS路径字符串，如 'document.querySelector("#btn2")'
 * @returns {HTMLElement[]} - 匹配的元素数组
 */
function findElementsByJSPath(jsPath) {
  console.log('开始JS路径匹配，目标路径:', jsPath);
  const elements = [];

  try {
    // 清理和验证JS路径
    let cleanPath = jsPath.trim();

    // 提取CSS选择器
    const selector = extractSelectorFromJSPath(cleanPath);
    if (!selector) {
      console.error('无法从JS路径中提取选择器:', cleanPath);
      return elements;
    }

    console.log('提取的CSS选择器:', selector);

    // 使用提取的选择器查找元素
    const foundElements = document.querySelectorAll(selector);
    elements.push(...foundElements);

    console.log(`JS路径匹配完成，找到 ${elements.length} 个元素`);
  } catch (error) {
    console.error('JS路径匹配出错:', error);
  }

  return elements;
}

/**
 * 从JS路径中提取CSS选择器
 * @param {string} jsPath - JS路径字符串
 * @returns {string|null} - 提取的CSS选择器，失败返回null
 */
function extractSelectorFromJSPath(jsPath) {
  try {
    // 匹配 document.querySelector("selector") 或 document.querySelector('selector')
    const querySelectorMatch = jsPath.match(/document\.querySelector\s*\(\s*["']([^"']+)["']\s*\)/);
    if (querySelectorMatch) {
      return querySelectorMatch[1];
    }

    // 匹配 document.querySelectorAll("selector") 或 document.querySelectorAll('selector')
    const querySelectorAllMatch = jsPath.match(/document\.querySelectorAll\s*\(\s*["']([^"']+)["']\s*\)/);
    if (querySelectorAllMatch) {
      return querySelectorAllMatch[1];
    }

    // 匹配 document.getElementById("id")
    const getElementByIdMatch = jsPath.match(/document\.getElementById\s*\(\s*["']([^"']+)["']\s*\)/);
    if (getElementByIdMatch) {
      return `#${getElementByIdMatch[1]}`;
    }

    // 匹配 document.getElementsByClassName("class")[index]
    const getElementByClassMatch = jsPath.match(/document\.getElementsByClassName\s*\(\s*["']([^"']+)["']\s*\)\s*\[\s*(\d+)\s*\]/);
    if (getElementByClassMatch) {
      const className = getElementByClassMatch[1];
      const index = parseInt(getElementByClassMatch[2]);
      return `.${className}:nth-of-type(${index + 1})`;
    }

    // 匹配 document.getElementsByTagName("tag")[index]
    const getElementByTagMatch = jsPath.match(/document\.getElementsByTagName\s*\(\s*["']([^"']+)["']\s*\)\s*\[\s*(\d+)\s*\]/);
    if (getElementByTagMatch) {
      const tagName = getElementByTagMatch[1];
      const index = parseInt(getElementByTagMatch[2]);
      return `${tagName}:nth-of-type(${index + 1})`;
    }

    console.warn('无法识别的JS路径格式:', jsPath);
    return null;
  } catch (error) {
    console.error('解析JS路径时出错:', error);
    return null;
  }
}
