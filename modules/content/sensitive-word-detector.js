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

    // 分割敏感词，去除空白字符
    this.sensitiveWords = wordsString
      .split(",")
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
    for (const word of this.sensitiveWords) {
      if (word && textLower.includes(word.toLowerCase())) {
        matchedWords.push(word);
      }
    }

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
   * @returns {string} - 提取的文本内容
   */
  async extractTextFromElement(element, locator) {
    try {
      if (!element || !locator) {
        return "";
      }

      let targetElement = element;

      // 如果提供了定位器，在当前元素内查找目标元素
      if (locator.value && locator.value.trim()) {
        targetElement = await this.findElementWithinContext(element, locator);
        if (!targetElement) {
          console.warn("⚠️ 在当前循环元素内未找到敏感词检测目标元素:", locator);
          return "";
        }
      }

      // 提取文本内容
      const text = targetElement.innerText || targetElement.textContent || "";
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
      // 如果未启用敏感词检测，不跳过
      if (!config.enabled) {
        return { shouldSkip: false, reason: "", matchedWords: [] };
      }

      // 如果没有配置敏感词，不跳过
      if (!config.sensitiveWords || config.sensitiveWords.trim() === "") {
        return { shouldSkip: false, reason: "", matchedWords: [] };
      }

      // 设置敏感词列表
      this.setSensitiveWords(config.sensitiveWords);

      // 构建定位器
      const locator = {
        strategy: config.locatorStrategy || "css",
        value: config.locatorValue || "",
      };

      // 提取文本内容
      const text = await this.extractTextFromElement(element, locator);

      // 检测敏感词
      const detection = this.detectSensitiveWords(text);

      if (detection.hasSensitiveWord) {
        const reason = `包含敏感词: ${detection.matchedWords.join(", ")}`;
        console.log("🚫 跳过循环元素:", reason);
        return {
          shouldSkip: true,
          reason,
          matchedWords: detection.matchedWords,
        };
      }

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
