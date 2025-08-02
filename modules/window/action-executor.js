/**
 * 动作执行器模块
 * 负责在页面中执行具体的自动化操作，支持多窗口环境
 */

class ActionExecutor {
    constructor() {
        this.isInitialized = false;
        this.currentWindowId = null;
        this.executionContext = null;

        this.init();
    }

    /**
     * 初始化动作执行器
     */
    init() {
        if (this.isInitialized) return;

        console.log('🎯 初始化动作执行器...');

        // 监听来自background的执行指令
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.handleMessage(message, sender, sendResponse);
            });
        }

        this.isInitialized = true;
        console.log('✅ 动作执行器初始化完成');
    }

    /**
     * 处理来自background的消息
     * @param {object} message - 消息对象
     * @param {object} sender - 发送者信息
     * @param {function} sendResponse - 响应函数
     */
    handleMessage(message, sender, sendResponse) {
        console.log('🎯 动作执行器收到消息:', message);

        switch (message.action) {
            case 'executeAction':
                this.executeAction(message.config)
                    .then(result => sendResponse({ success: true, result }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;

            case 'setExecutionContext':
                this.setExecutionContext(message.context);
                sendResponse({ success: true });
                return true;

            case 'ping':
                sendResponse({ success: true, status: 'ready' });
                return true;

            default:
                return false;
        }
    }

    /**
     * 设置执行上下文
     * @param {object} context - 执行上下文
     */
    setExecutionContext(context) {
        this.executionContext = context;
        this.currentWindowId = context.windowId;
        console.log('🎯 设置执行上下文:', context);
    }

    /**
     * 执行具体动作
     * @param {object} config - 动作配置
     * @returns {Promise<object>} 执行结果
     */
    async executeAction(config) {
        console.log('🎯 执行动作:', config);

        try {
            switch (config.action) {
                case 'click':
                    return await this.executeClick(config);

                case 'input':
                    return await this.executeInput(config);

                case 'wait':
                    return await this.executeWait(config);

                case 'smartWait':
                    return await this.executeSmartWait(config);

                case 'drag':
                    return await this.executeDrag(config);

                case 'scroll':
                    return await this.executeScroll(config);

                case 'hover':
                    return await this.executeHover(config);

                case 'keyPress':
                    return await this.executeKeyPress(config);

                case 'getAttribute':
                    return await this.executeGetAttribute(config);

                case 'getText':
                    return await this.executeGetText(config);

                case 'screenshot':
                    return await this.executeScreenshot(config);

                default:
                    throw new Error(`不支持的动作类型: ${config.action}`);
            }
        } catch (error) {
            console.error('🎯 动作执行失败:', error);
            throw error;
        }
    }

    /**
     * 执行点击操作
     * @param {object} config - 点击配置
     * @returns {Promise<object>} 执行结果
     */
    async executeClick(config) {
        const element = await this.findElement(config.locator);

        // 滚动到元素位置
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(300);

        // 高亮元素
        this.highlightElement(element, 'click');

        // 检查元素是否可点击
        if (element.disabled) {
            throw new Error('元素已禁用，无法点击');
        }

        // 执行点击
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });

        element.dispatchEvent(clickEvent);

        // 如果配置了等待新窗口，则标记这个操作
        if (config.opensNewWindow) {
            console.log('🪟 点击操作可能会打开新窗口');
            return {
                success: true,
                opensNewWindow: true,
                message: '点击完成，等待新窗口打开'
            };
        }

        return { success: true, message: '点击完成' };
    }

    /**
     * 执行输入操作
     * @param {object} config - 输入配置
     * @returns {Promise<object>} 执行结果
     */
    async executeInput(config) {
        const element = await this.findElement(config.locator);
        const text = config.text || config.inputText || '';

        // 滚动到元素位置
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(300);

        // 高亮元素
        this.highlightElement(element, 'input');

        // 聚焦元素
        element.focus();

        // 清空现有内容（如果需要）
        if (config.clearFirst !== false) {
            element.value = '';
        }

        // 输入文本
        element.value = text;

        // 触发输入事件
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        return { success: true, message: `输入完成: "${text}"` };
    }

    /**
     * 执行等待操作
     * @param {object} config - 等待配置
     * @returns {Promise<object>} 执行结果
     */
    async executeWait(config) {
        const duration = config.duration || config.waitTime || 1000;
        console.log(`⏳ 等待 ${duration}ms`);

        await this.sleep(duration);

        return { success: true, message: `等待完成: ${duration}ms` };
    }

    /**
     * 执行智能等待操作
     * @param {object} config - 智能等待配置
     * @returns {Promise<object>} 执行结果
     */
    async executeSmartWait(config) {
        const timeout = config.timeout || 30000;
        const checkInterval = config.checkInterval || 500;
        const condition = config.condition || 'appear';

        console.log(`🔍 智能等待: ${condition}, 超时: ${timeout}ms`);

        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            try {
                const conditionMet = await this.checkWaitCondition(config);
                if (conditionMet) {
                    return { success: true, message: `智能等待完成: ${condition}` };
                }
            } catch (error) {
                // 继续等待
            }

            await this.sleep(checkInterval);
        }

        throw new Error(`智能等待超时: ${condition} 未在 ${timeout}ms 内满足`);
    }

    /**
     * 执行拖拽操作
     * @param {object} config - 拖拽配置
     * @returns {Promise<object>} 执行结果
     */
    async executeDrag(config) {
        const element = await this.findElement(config.locator);

        // 滚动到元素位置
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(300);

        // 高亮元素
        this.highlightElement(element, 'drag');

        // 获取元素中心位置
        const rect = element.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;

        // 计算目标位置
        const deltaX = config.horizontalDistance || 0;
        const deltaY = config.verticalDistance || 0;
        const endX = startX + deltaX;
        const endY = startY + deltaY;

        // 执行拖拽
        await this.performDrag(element, startX, startY, endX, endY, config);

        return {
            success: true,
            message: `拖拽完成: 水平${deltaX}px, 垂直${deltaY}px`
        };
    }

    /**
     * 执行滚动操作
     * @param {object} config - 滚动配置
     * @returns {Promise<object>} 执行结果
     */
    async executeScroll(config) {
        const scrollX = config.scrollX || 0;
        const scrollY = config.scrollY || 0;

        if (config.locator) {
            // 滚动到指定元素
            const element = await this.findElement(config.locator);
            element.scrollIntoView({
                behavior: config.smooth ? 'smooth' : 'auto',
                block: config.block || 'center',
                inline: config.inline || 'center'
            });
        } else {
            // 滚动页面
            window.scrollBy({
                left: scrollX,
                top: scrollY,
                behavior: config.smooth ? 'smooth' : 'auto'
            });
        }

        return { success: true, message: '滚动完成' };
    }

    /**
     * 执行悬停操作
     * @param {object} config - 悬停配置
     * @returns {Promise<object>} 执行结果
     */
    async executeHover(config) {
        const element = await this.findElement(config.locator);

        // 滚动到元素位置
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(300);

        // 高亮元素
        this.highlightElement(element, 'hover');

        // 触发悬停事件
        const mouseOverEvent = new MouseEvent('mouseover', {
            view: window,
            bubbles: true,
            cancelable: true
        });

        element.dispatchEvent(mouseOverEvent);

        return { success: true, message: '悬停完成' };
    }

    /**
     * 执行按键操作
     * @param {object} config - 按键配置
     * @returns {Promise<object>} 执行结果
     */
    async executeKeyPress(config) {
        const key = config.key;
        const element = config.locator ? await this.findElement(config.locator) : document.activeElement;

        if (element) {
            element.focus();
        }

        // 创建键盘事件
        const keyEvent = new KeyboardEvent('keydown', {
            key: key,
            code: key,
            bubbles: true,
            cancelable: true
        });

        (element || document).dispatchEvent(keyEvent);

        return { success: true, message: `按键完成: ${key}` };
    }

    /**
     * 获取元素属性
     * @param {object} config - 获取属性配置
     * @returns {Promise<object>} 执行结果
     */
    async executeGetAttribute(config) {
        const element = await this.findElement(config.locator);
        const attributeName = config.attributeName;
        const value = element.getAttribute(attributeName);

        return {
            success: true,
            value: value,
            message: `获取属性完成: ${attributeName} = ${value}`
        };
    }

    /**
     * 获取元素文本
     * @param {object} config - 获取文本配置
     * @returns {Promise<object>} 执行结果
     */
    async executeGetText(config) {
        const element = await this.findElement(config.locator);
        const text = element.textContent || element.innerText || '';

        return {
            success: true,
            text: text,
            message: `获取文本完成: "${text}"`
        };
    }

    /**
     * 执行截图操作
     * @param {object} config - 截图配置
     * @returns {Promise<object>} 执行结果
     */
    async executeScreenshot(config) {
        // 这个功能需要在background script中实现
        // 这里只是占位符
        return { success: true, message: '截图功能需要在background script中实现' };
    }

    /**
     * 查找元素
     * @param {object} locator - 定位器
     * @returns {Promise<Element>} 找到的元素
     */
    async findElement(locator) {
        if (!locator) {
            throw new Error('缺少定位器');
        }

        const strategy = locator.strategy || locator.type;
        const value = locator.value;

        if (!strategy || !value) {
            throw new Error('定位器缺少必要字段');
        }

        let element = null;

        switch (strategy) {
            case 'id':
                element = document.getElementById(value);
                break;

            case 'className':
                element = document.getElementsByClassName(value)[0];
                break;

            case 'tagName':
                element = document.getElementsByTagName(value)[0];
                break;

            case 'css':
            case 'cssSelector':
                element = document.querySelector(value);
                break;

            case 'xpath':
                const result = document.evaluate(
                    value,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                );
                element = result.singleNodeValue;
                break;

            case 'text':
                element = this.findElementByText(value);
                break;

            case 'partialText':
                element = this.findElementByPartialText(value);
                break;

            default:
                throw new Error(`不支持的定位策略: ${strategy}`);
        }

        if (!element) {
            throw new Error(`找不到元素: ${strategy}=${value}`);
        }

        return element;
    }

    /**
     * 通过文本查找元素
     * @param {string} text - 要查找的文本
     * @returns {Element|null} 找到的元素
     */
    findElementByText(text) {
        const xpath = `//*[text()='${text}']`;
        const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        );
        return result.singleNodeValue;
    }

    /**
     * 通过部分文本查找元素
     * @param {string} text - 要查找的部分文本
     * @returns {Element|null} 找到的元素
     */
    findElementByPartialText(text) {
        const xpath = `//*[contains(text(),'${text}')]`;
        const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        );
        return result.singleNodeValue;
    }

    /**
     * 高亮显示元素
     * @param {Element} element - 要高亮的元素
     * @param {string} action - 动作类型
     */
    highlightElement(element, action = 'default') {
        const colors = {
            click: '#ff4444',
            input: '#44ff44',
            drag: '#4444ff',
            hover: '#ffff44',
            default: '#ff8800'
        };

        const color = colors[action] || colors.default;

        // 保存原始样式
        const originalStyle = {
            outline: element.style.outline,
            outlineOffset: element.style.outlineOffset
        };

        // 应用高亮样式
        element.style.outline = `3px solid ${color}`;
        element.style.outlineOffset = '2px';

        // 2秒后恢复原始样式
        setTimeout(() => {
            element.style.outline = originalStyle.outline;
            element.style.outlineOffset = originalStyle.outlineOffset;
        }, 2000);
    }

    /**
     * 检查等待条件
     * @param {object} config - 等待配置
     * @returns {Promise<boolean>} 条件是否满足
     */
    async checkWaitCondition(config) {
        const condition = config.condition || 'appear';

        try {
            const element = await this.findElement(config.locator);

            switch (condition) {
                case 'appear':
                    return element !== null;

                case 'visible':
                    return element && this.isElementVisible(element);

                case 'hidden':
                    return element && !this.isElementVisible(element);

                case 'enabled':
                    return element && !element.disabled;

                case 'disabled':
                    return element && element.disabled;

                default:
                    return element !== null;
            }
        } catch (error) {
            switch (condition) {
                case 'disappear':
                    return true; // 元素不存在，说明已消失
                default:
                    return false;
            }
        }
    }

    /**
     * 检查元素是否可见
     * @param {Element} element - 要检查的元素
     * @returns {boolean} 是否可见
     */
    isElementVisible(element) {
        if (!element) return false;

        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    /**
     * 执行拖拽操作的具体实现
     * @param {Element} element - 要拖拽的元素
     * @param {number} startX - 起始X坐标
     * @param {number} startY - 起始Y坐标
     * @param {number} endX - 结束X坐标
     * @param {number} endY - 结束Y坐标
     * @param {object} config - 拖拽配置
     */
    async performDrag(element, startX, startY, endX, endY, config) {
        const dragSpeed = config.dragSpeed || 100;

        // 触发mousedown事件
        const mouseDownEvent = new MouseEvent('mousedown', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: startX,
            clientY: startY,
            button: 0,
            buttons: 1
        });
        element.dispatchEvent(mouseDownEvent);

        await this.sleep(dragSpeed);

        // 分步移动
        const distance = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
        const steps = Math.min(Math.max(Math.floor(distance / 10), 1), 20);

        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const currentX = startX + (endX - startX) * progress;
            const currentY = startY + (endY - startY) * progress;

            const mouseMoveEvent = new MouseEvent('mousemove', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: currentX,
                clientY: currentY,
                button: 0,
                buttons: 1
            });

            document.dispatchEvent(mouseMoveEvent);
            await this.sleep(dragSpeed / steps);
        }

        // 触发mouseup事件
        const mouseUpEvent = new MouseEvent('mouseup', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: endX,
            clientY: endY,
            button: 0,
            buttons: 0
        });
        document.dispatchEvent(mouseUpEvent);

        await this.sleep(config.waitAfterDrag || 1000);
    }

    /**
     * 睡眠指定时间
     * @param {number} ms - 睡眠时间（毫秒）
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 创建全局动作执行器实例
if (typeof window !== 'undefined') {
    window.ActionExecutor = ActionExecutor;

    // 在页面环境中自动创建实例
    if (!window.actionExecutor) {
        window.actionExecutor = new ActionExecutor();
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActionExecutor;
}

console.log('📦 动作执行器模块已加载');