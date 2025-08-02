/**
 * 窗口管理模块
 * 负责管理多窗口自动化执行，包括新窗口打开、切换、关闭等功能
 */

class WindowManager {
    constructor() {
        this.mainWindowId = null;
        this.windowStack = []; // 窗口栈，用于管理窗口层级
        this.currentWindowId = null;
        this.windowCreationPromises = new Map(); // 存储等待窗口创建的Promise
        this.isInitialized = false;

        this.init();
    }

    /**
     * 初始化窗口管理器
     */
    init() {
        if (this.isInitialized) return;

        console.log('🪟 初始化窗口管理器...');

        // 监听新窗口创建事件
        chrome.tabs.onCreated.addListener((tab) => {
            this.handleNewTabCreated(tab);
        });

        // 监听窗口关闭事件
        chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
            this.handleTabRemoved(tabId, removeInfo);
        });

        // 监听窗口更新事件（用于检测页面加载完成）
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdated(tabId, changeInfo, tab);
        });

        this.isInitialized = true;
        console.log('✅ 窗口管理器初始化完成');
    }

    /**
     * 设置主窗口ID
     * @param {number} tabId - 主窗口的标签页ID
     */
    setMainWindow(tabId) {
        this.mainWindowId = tabId;
        this.currentWindowId = tabId;
        this.windowStack = [tabId];
        console.log(`🏠 设置主窗口: ${tabId}`);
    }

    /**
     * 等待新窗口创建
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<number>} 新窗口的标签页ID
     */
    waitForNewWindow(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`等待新窗口超时（${timeout}ms）`));
            }, timeout);

            // 创建一个唯一的Promise标识
            const promiseId = Date.now() + Math.random();

            const promise = {
                resolve: (tabId) => {
                    clearTimeout(timeoutId);
                    resolve(tabId);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            };

            this.windowCreationPromises.set(promiseId, promise);

            console.log(`⏳ 开始等待新窗口创建... (超时: ${timeout}ms)`);
        });
    }

    /**
     * 处理新标签页创建事件
     * @param {chrome.tabs.Tab} tab - 新创建的标签页
     */
    handleNewTabCreated(tab) {
        console.log(`🆕 检测到新窗口创建: ${tab.id}, URL: ${tab.url}`);

        // 如果有等待中的Promise，解决它们
        if (this.windowCreationPromises.size > 0) {
            const promises = Array.from(this.windowCreationPromises.values());
            this.windowCreationPromises.clear();

            promises.forEach(promise => {
                promise.resolve(tab.id);
            });

            // 将新窗口添加到窗口栈
            this.pushWindow(tab.id);
        }
    }

    /**
     * 处理标签页移除事件
     * @param {number} tabId - 被移除的标签页ID
     * @param {object} removeInfo - 移除信息
     */
    handleTabRemoved(tabId, removeInfo) {
        console.log(`🗑️ 检测到窗口关闭: ${tabId}`);

        // 从窗口栈中移除
        this.removeWindowFromStack(tabId);

        // 如果关闭的是当前窗口，切换到栈顶窗口
        if (this.currentWindowId === tabId) {
            const previousWindow = this.getTopWindow();
            if (previousWindow) {
                this.currentWindowId = previousWindow;
                console.log(`🔄 切换到上一个窗口: ${previousWindow}`);
            }
        }
    }

    /**
     * 处理标签页更新事件
     * @param {number} tabId - 标签页ID
     * @param {object} changeInfo - 变更信息
     * @param {chrome.tabs.Tab} tab - 标签页对象
     */
    handleTabUpdated(tabId, changeInfo, tab) {
        // 当页面加载完成时，可以进行一些初始化操作
        if (changeInfo.status === 'complete' && tab.url) {
            console.log(`📄 窗口页面加载完成: ${tabId}, URL: ${tab.url}`);
        }
    }

    /**
     * 将窗口推入栈顶
     * @param {number} tabId - 窗口标签页ID
     */
    pushWindow(tabId) {
        // 如果窗口已存在于栈中，先移除
        this.removeWindowFromStack(tabId);

        // 推入栈顶
        this.windowStack.push(tabId);
        this.currentWindowId = tabId;

        console.log(`📚 窗口入栈: ${tabId}, 当前栈: [${this.windowStack.join(', ')}]`);
    }

    /**
     * 从窗口栈中移除窗口
     * @param {number} tabId - 窗口标签页ID
     */
    removeWindowFromStack(tabId) {
        const index = this.windowStack.indexOf(tabId);
        if (index > -1) {
            this.windowStack.splice(index, 1);
            console.log(`📚 窗口出栈: ${tabId}, 当前栈: [${this.windowStack.join(', ')}]`);
        }
    }

    /**
     * 获取栈顶窗口（当前活动窗口）
     * @returns {number|null} 窗口标签页ID
     */
    getTopWindow() {
        return this.windowStack.length > 0 ? this.windowStack[this.windowStack.length - 1] : null;
    }

    /**
     * 获取主窗口ID
     * @returns {number|null} 主窗口标签页ID
     */
    getMainWindow() {
        return this.mainWindowId;
    }

    /**
     * 获取当前窗口ID
     * @returns {number|null} 当前窗口标签页ID
     */
    getCurrentWindow() {
        return this.currentWindowId;
    }

    /**
     * 切换到指定窗口
     * @param {number} tabId - 目标窗口标签页ID
     * @returns {Promise<void>}
     */
    async switchToWindow(tabId) {
        try {
            // 激活指定标签页
            await chrome.tabs.update(tabId, { active: true });

            // 获取标签页所在的窗口并激活
            const tab = await chrome.tabs.get(tabId);
            await chrome.windows.update(tab.windowId, { focused: true });

            this.currentWindowId = tabId;
            console.log(`🔄 已切换到窗口: ${tabId}`);
        } catch (error) {
            console.error(`❌ 切换窗口失败: ${tabId}`, error);
            throw new Error(`切换窗口失败: ${error.message}`);
        }
    }

    /**
     * 关闭指定窗口
     * @param {number} tabId - 要关闭的窗口标签页ID
     * @returns {Promise<void>}
     */
    async closeWindow(tabId) {
        try {
            await chrome.tabs.remove(tabId);
            console.log(`🗑️ 已关闭窗口: ${tabId}`);
        } catch (error) {
            console.error(`❌ 关闭窗口失败: ${tabId}`, error);
            throw new Error(`关闭窗口失败: ${error.message}`);
        }
    }

    /**
     * 关闭当前窗口并返回到上一个窗口
     * @returns {Promise<number|null>} 返回的窗口ID
     */
    async closeCurrentAndReturnToPrevious() {
        const currentWindow = this.getCurrentWindow();
        if (!currentWindow) {
            throw new Error('没有当前活动窗口');
        }

        // 如果当前窗口是主窗口，不允许关闭
        if (currentWindow === this.mainWindowId) {
            throw new Error('不能关闭主窗口');
        }

        // 获取上一个窗口
        const windowStack = [...this.windowStack];
        const currentIndex = windowStack.indexOf(currentWindow);

        if (currentIndex <= 0) {
            throw new Error('没有可返回的上一个窗口');
        }

        const previousWindow = windowStack[currentIndex - 1];

        // 先切换到上一个窗口
        await this.switchToWindow(previousWindow);

        // 然后关闭当前窗口
        await this.closeWindow(currentWindow);

        console.log(`🔄 已关闭窗口 ${currentWindow} 并返回到窗口 ${previousWindow}`);
        return previousWindow;
    }

    /**
     * 等待窗口页面加载完成
     * @param {number} tabId - 窗口标签页ID
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<void>}
     */
    async waitForWindowReady(tabId, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`等待窗口加载超时: ${tabId}`));
            }, timeout);

            const checkReady = async () => {
                try {
                    const tab = await chrome.tabs.get(tabId);

                    if (tab.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
                        clearTimeout(timeoutId);
                        console.log(`✅ 窗口加载完成: ${tabId}`);
                        resolve();
                    } else {
                        setTimeout(checkReady, 500);
                    }
                } catch (error) {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            };

            checkReady();
        });
    }

    /**
     * 向指定窗口注入内容脚本
     * @param {number} tabId - 窗口标签页ID
     * @returns {Promise<void>}
     */
    async injectContentScript(tabId) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['/content/content-modular.js']
            });

            console.log(`✅ 已向窗口 ${tabId} 注入内容脚本`);
        } catch (error) {
            console.error(`❌ 向窗口 ${tabId} 注入内容脚本失败:`, error);
            throw new Error(`注入内容脚本失败: ${error.message}`);
        }
    }

    /**
     * 检查窗口是否存在且可访问
     * @param {number} tabId - 窗口标签页ID
     * @returns {Promise<boolean>}
     */
    async isWindowAccessible(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            return tab && !tab.url.startsWith('chrome://');
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取窗口信息
     * @param {number} tabId - 窗口标签页ID
     * @returns {Promise<object>} 窗口信息
     */
    async getWindowInfo(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            return {
                id: tab.id,
                url: tab.url,
                title: tab.title,
                status: tab.status,
                windowId: tab.windowId
            };
        } catch (error) {
            throw new Error(`获取窗口信息失败: ${error.message}`);
        }
    }

    /**
     * 重置窗口管理器状态
     */
    reset() {
        this.mainWindowId = null;
        this.windowStack = [];
        this.currentWindowId = null;
        this.windowCreationPromises.clear();
        console.log('🔄 窗口管理器状态已重置');
    }
}

// 创建全局窗口管理器实例
if (typeof window !== 'undefined') {
    window.WindowManager = WindowManager;

    // 如果在background script环境中，创建全局实例
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getBackgroundPage) {
        if (!window.windowManager) {
            window.windowManager = new WindowManager();
        }
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WindowManager;
}

console.log('📦 窗口管理模块已加载');