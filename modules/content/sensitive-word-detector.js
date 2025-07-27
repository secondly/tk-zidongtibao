/**
 * 敏感词检测模块
 * 负责敏感词的检测和过滤功能
 */

class SensitiveWordDetector {
  constructor() {
    this.sensitiveWords = [];
  }

  /**
   * 设置敏感词列表
   * @param {string} wordsString - 用逗号分隔的敏感词字符串
   */
  setSensitiveWords(wordsString) {
    if (!wordsString || typeof wordsString !== "string") {
      this.sensitiveWords = [];
      return;
    }

    // 分割敏感词，去除空白字符，支持中英文逗号
    this.sensitiveWords = wordsString
      .split(/[,，]/) // 支持英文逗号和中文逗号
      .map((word) => word.trim())
      .filter((word) => word.length > 0);

    console.log("🔍 敏感词列表已更新:", this.sensitiveWords);
  }

  /**
   * 检测文本中是否包含敏感词
   * @param {string} text - 要检测的文本
   * @returns {object} - 检测结果 {hasSensitiveWord: boolean, matchedWords: string[]}
   */
  detectSensitiveWords(text) {
    if (!text || typeof text !== "string") {
      return { hasSensitiveWord: false, matchedWords: [] };
    }

    if (this.sensitiveWords.length === 0) {
      return { hasSensitiveWord: false, matchedWords: [] };
    }

    const matchedWords = [];
    const textLower = text.toLowerCase();

    // 检查每个敏感词
    console.log("🔍 敏感词检测详情:");
    console.log("  - 原文本:", text);
    console.log("  - 小写文本:", textLower);
    console.log("  - 敏感词列表:", this.sensitiveWords);

    for (const word of this.sensitiveWords) {
      if (word && word.trim()) {
        const wordLower = word.trim().toLowerCase();

        // 使用更精确的匹配方式
        let isMatched = false;

        // 方式1: 完整词匹配（推荐）
        // 使用正则表达式进行完整词匹配，避免部分匹配
        try {
          const regex = new RegExp(
            `\\b${wordLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
            "i"
          );
          isMatched = regex.test(text);
        } catch (regexError) {
          // 如果正则表达式失败，回退到简单包含检查
          console.warn(
            `正则表达式匹配失败，回退到简单匹配: ${regexError.message}`
          );
          isMatched = textLower.includes(wordLower);
        }

        // 方式2: 对于中文，使用直接包含检查（因为中文没有词边界）
        if (!isMatched && /[\u4e00-\u9fff]/.test(wordLower)) {
          isMatched = textLower.includes(wordLower);
        }

        console.log(
          `  - 检查敏感词 "${word}" (小写: "${wordLower}"): ${isMatched}`
        );

        if (isMatched) {
          matchedWords.push(word);
        }
      }
    }

    console.log("  - 匹配的敏感词:", matchedWords);

    const hasSensitiveWord = matchedWords.length > 0;

    if (hasSensitiveWord) {
      console.log("🚫 检测到敏感词:", {
        text: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        matchedWords,
      });
    }

    return { hasSensitiveWord, matchedWords };
  }

  /**
   * 从元素中提取文本内容
   * @param {Element} element - DOM元素
   * @param {object} locator - 定位器配置 {strategy, value}
   * @param {object} parentLocator - 父级容器定位器配置 {strategy, value}
   * @returns {string} - 提取的文本内容
   */
  async extractTextFromElement(element, locator, parentLocator = null) {
    try {
      if (!element) {
        return "";
      }

      let contextElement = element;

      // 如果提供了父级容器定位器，先找到父级容器
      if (parentLocator && parentLocator.value && parentLocator.value.trim()) {
        contextElement = await this.findParentContainer(element, parentLocator);
        if (!contextElement) {
          console.warn("⚠️ 未找到指定的父级容器:", parentLocator);
          contextElement = element; // 回退到原始元素
        } else {
          console.log("✅ 找到父级容器，将在此范围内检测敏感词");
        }
      }

      let targetElement = contextElement;

      // 如果提供了具体的定位器，在上下文元素内查找目标元素
      if (locator && locator.value && locator.value.trim()) {
        console.log("🔍 查找目标元素，定位器:", locator);
        targetElement = await this.findElementWithinContext(
          contextElement,
          locator
        );
        console.log("🔍 找到的目标元素:", targetElement);
        if (!targetElement) {
          console.warn("⚠️ 在指定范围内未找到敏感词检测目标元素:", locator);
          // 如果找不到具体目标，使用整个上下文元素
          targetElement = contextElement;
          console.log("🔍 回退到上下文元素:", targetElement);
        }
      }

      // 提取文本内容
      const text = targetElement.innerText || targetElement.textContent || "";
      console.log("📝 文本提取详情:");
      console.log("  - 目标元素:", targetElement);
      console.log("  - innerText:", targetElement.innerText);
      console.log("  - textContent:", targetElement.textContent);
      console.log("  - 最终文本:", text);
      console.log(
        "📝 提取的文本内容:",
        text.substring(0, 100) + (text.length > 100 ? "..." : "")
      );

      return text;
    } catch (error) {
      console.error("❌ 提取文本内容失败:", error);
      return "";
    }
  }

  /**
   * 查找父级容器
   * @param {Element} element - 当前循环元素
   * @param {object} parentLocator - 父级容器定位器 {strategy, value}
   * @returns {Element|null} - 找到的父级容器元素
   */
  async findParentContainer(element, parentLocator) {
    try {
      if (!element || !parentLocator || !parentLocator.value) {
        return null;
      }

      const { strategy, value } = parentLocator;
      let parentElement = element;

      // 向上遍历DOM树查找匹配的父级容器
      while (parentElement && parentElement !== document.body) {
        parentElement = parentElement.parentElement;
        if (!parentElement) break;

        // 检查当前父级元素是否匹配定位器
        if (await this.elementMatchesLocator(parentElement, strategy, value)) {
          console.log("🎯 找到匹配的父级容器:", parentElement);
          return parentElement;
        }
      }

      // 如果向上查找失败，尝试从document根节点查找
      console.log("⚠️ 向上查找父级容器失败，尝试全局查找");
      return await this.findElementByLocator(strategy, value);
    } catch (error) {
      console.error("❌ 查找父级容器失败:", error);
      return null;
    }
  }

  /**
   * 检查元素是否匹配定位器
   * @param {Element} element - 要检查的元素
   * @param {string} strategy - 定位策略
   * @param {string} value - 定位值
   * @returns {boolean} - 是否匹配
   */
  async elementMatchesLocator(element, strategy, value) {
    try {
      switch (strategy) {
        case "css":
          return element.matches(value);
        case "id":
          return element.id === value;
        case "className":
          return element.classList.contains(value);
        case "tagName":
          return element.tagName.toLowerCase() === value.toLowerCase();
        case "text":
          return element.textContent && element.textContent.trim() === value;
        case "contains":
          return element.textContent && element.textContent.includes(value);
        default:
          return false;
      }
    } catch (error) {
      console.error("❌ 检查元素匹配失败:", error);
      return false;
    }
  }

  /**
   * 根据定位器查找元素
   * @param {string} strategy - 定位策略
   * @param {string} value - 定位值
   * @returns {Element|null} - 找到的元素
   */
  async findElementByLocator(strategy, value) {
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
          return document.querySelector(`.${value}`);
        case "tagName":
          return document.querySelector(value);
        default:
          return null;
      }
    } catch (error) {
      console.error("❌ 根据定位器查找元素失败:", error);
      return null;
    }
  }

  /**
   * 在指定上下文元素内查找目标元素
   * @param {Element} contextElement - 上下文元素
   * @param {object} locator - 定位器配置
   * @returns {Element|null} - 找到的元素
   */
  async findElementWithinContext(contextElement, locator) {
    try {
      const { strategy, value } = locator;

      if (!strategy || !value) {
        return null;
      }

      let targetElement = null;

      switch (strategy) {
        case "css":
          targetElement = contextElement.querySelector(value);
          break;
        case "xpath":
          // 在上下文元素内执行XPath查询
          const xpathResult = document.evaluate(
            `.${value}`, // 相对XPath
            contextElement,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          targetElement = xpathResult.singleNodeValue;
          break;
        case "id":
          targetElement = contextElement.querySelector(`#${value}`);
          break;
        case "className":
          targetElement = contextElement.querySelector(`.${value}`);
          break;
        case "tagName":
          targetElement = contextElement.querySelector(value);
          break;
        case "text":
          // 查找包含指定文本的元素
          const allElements = contextElement.querySelectorAll("*");
          for (const el of allElements) {
            if (el.textContent && el.textContent.trim() === value) {
              targetElement = el;
              break;
            }
          }
          break;
        case "contains":
          // 查找包含指定文本的元素
          const allContainsElements = contextElement.querySelectorAll("*");
          for (const el of allContainsElements) {
            if (el.textContent && el.textContent.includes(value)) {
              targetElement = el;
              break;
            }
          }
          break;
        default:
          console.warn("⚠️ 不支持的定位策略:", strategy);
      }

      return targetElement;
    } catch (error) {
      console.error("❌ 在上下文内查找元素失败:", error);
      return null;
    }
  }

  /**
   * 检查循环元素是否应该跳过
   * @param {Element} element - 循环元素
   * @param {object} config - 敏感词检测配置
   * @returns {Promise<object>} - {shouldSkip: boolean, reason: string, matchedWords: string[]}
   */
  async checkShouldSkipElement(element, config) {
    try {
      console.log("🔍 开始检查元素是否应该跳过:");
      console.log("  - 元素:", element);
      console.log("  - 配置:", config);

      // 如果未启用敏感词检测，不跳过
      if (!config.enabled) {
        console.log("  - 敏感词检测未启用，不跳过");
        return { shouldSkip: false, reason: "", matchedWords: [] };
      }

      // 如果没有配置敏感词，不跳过
      if (!config.sensitiveWords || config.sensitiveWords.trim() === "") {
        console.log("  - 没有配置敏感词，不跳过");
        return { shouldSkip: false, reason: "", matchedWords: [] };
      }

      // 设置敏感词列表
      this.setSensitiveWords(config.sensitiveWords);
      console.log("  - 已设置敏感词:", this.sensitiveWords);

      // 简化的文本提取逻辑，确保稳定性
      let textToCheck = "";

      if (config.locatorValue && config.locatorValue.trim()) {
        // 如果指定了目标选择器，查找目标元素
        try {
          const targetElement = element.querySelector(config.locatorValue);
          if (targetElement) {
            textToCheck =
              targetElement.innerText || targetElement.textContent || "";
            console.log("  - 从目标元素提取文本:", textToCheck);
          } else {
            // 如果找不到目标元素，使用整个元素的文本
            textToCheck = element.innerText || element.textContent || "";
            console.log("  - 目标元素未找到，使用整个元素文本:", textToCheck);
          }
        } catch (error) {
          console.warn("  - 查找目标元素失败，使用整个元素文本:", error);
          textToCheck = element.innerText || element.textContent || "";
        }
      } else {
        // 如果没有指定目标选择器，使用整个元素的文本
        textToCheck = element.innerText || element.textContent || "";
        console.log("  - 使用整个元素文本:", textToCheck);
      }

      // 直接检测敏感词，简化流程
      console.log("  - 开始检测敏感词");
      const detection = this.detectSensitiveWords(textToCheck);
      console.log("  - 检测结果:", detection);

      if (detection.hasSensitiveWord) {
        const reason = `包含敏感词: ${detection.matchedWords.join(", ")}`;
        console.log("🚫 跳过循环元素:", reason);
        return {
          shouldSkip: true,
          reason,
          matchedWords: detection.matchedWords,
        };
      }

      console.log("✅ 元素通过敏感词检测");
      return { shouldSkip: false, reason: "", matchedWords: [] };
    } catch (error) {
      console.error("❌ 敏感词检测失败:", error);
      // 检测失败时不跳过，避免影响正常流程
      return { shouldSkip: false, reason: "检测失败", matchedWords: [] };
    }
  }
}

// 创建全局实例
window.SensitiveWordDetector = SensitiveWordDetector;

// 导出模块（如果在模块环境中）
if (typeof module !== "undefined" && module.exports) {
  module.exports = SensitiveWordDetector;
}
