/**
 * 定位器测试模块
 * 用于测试元素定位器在目标页面上的效果
 */

class LocatorTester {
    constructor() {
        this.tabSelector = new TabSelector();
        this.validator = new TestValidator();
    }

    /**
     * 测试定位器
     * @param {string} strategy 定位策略
     * @param {string} value 定位值
     * @param {HTMLElement} resultElement 结果显示元素
     * @param {HTMLElement} testButton 测试按钮
     * @returns {Promise<void>}
     */
    async testLocator(strategy, value, resultElement, testButton) {
        if (!value || !value.trim()) {
            this.showTestResult(resultElement, '请输入定位值', 'error');
            return;
        }

        // 禁用按钮并显示加载状态
        const originalText = testButton.textContent;
        testButton.disabled = true;
        testButton.textContent = '🔄测试中...';

        try {
            // 先清除之前的测试高亮
            await this.clearTestHighlights();

            // 显示页面选择器
            const selectedTab = await this.tabSelector.showTabSelector();
            if (!selectedTab) {
                this.showTestResult(resultElement, '已取消测试', 'info');
                return;
            }

            console.log('🎯 选择的测试页面:', selectedTab.title, selectedTab.url);
            console.log('🔍 测试定位器:', { strategy, value });

            // 确保content script已加载
            const isLoaded = await this.ensureContentScriptLoaded(selectedTab.id);
            if (!isLoaded) {
                this.showTestResult(resultElement, '页面不支持测试功能', 'error');
                return;
            }

            console.log('✅ Content script已加载，发送测试请求...');

            // 发送测试请求到目标页面
            const response = await chrome.tabs.sendMessage(selectedTab.id, {
                action: 'testLocator',
                locator: { strategy, value }
            });

            console.log('📨 收到测试响应:', response);

            // 验证测试结果的真实性
            const testData = {
                strategy,
                value,
                tabId: selectedTab.id,
                tabTitle: selectedTab.title,
                tabUrl: selectedTab.url
            };

            const validation = this.validator.validateTestResult(testData, response);

            if (response && response.success) {
                const count = response.count;
                if (count === 0) {
                    this.showTestResult(resultElement, `未找到匹配元素 (页面: ${selectedTab.title})`, 'error');
                    console.log(`❌ 在页面 "${selectedTab.title}" 中未找到匹配元素`);
                } else {
                    let message = `找到 ${count} 个匹配元素 (页面: ${selectedTab.title})`;
                    let type = 'success';

                    // 如果有警告，显示警告信息
                    if (validation.warnings.length > 0) {
                        message += '\n' + validation.warnings.join('\n');
                        type = 'warning';
                    }

                    this.showTestResult(resultElement, message, type);
                    console.log(`🎯 定位器测试成功，在页面 "${selectedTab.title}" 中找到 ${count} 个元素`);

                    // 显示测试建议
                    const suggestions = this.validator.getTestSuggestions(testData);
                    if (suggestions.length > 0) {
                        console.log('💡 测试建议:', suggestions);
                    }
                }
            } else {
                this.showTestResult(resultElement, response?.error || '测试失败', 'error');
                console.error('❌ 测试失败:', response);
            }
        } catch (error) {
            console.error('测试定位器失败:', error);
            this.showTestResult(resultElement, '测试失败，请检查页面是否支持', 'error');
        } finally {
            // 恢复按钮状态
            testButton.disabled = false;
            testButton.textContent = originalText;
        }
    }

    /**
     * 显示测试结果
     * @param {HTMLElement} element 结果显示元素
     * @param {string} message 消息内容
     * @param {string} type 消息类型 (success|error|info)
     */
    showTestResult(element, message, type) {
        if (!element) return;

        element.textContent = message;
        element.className = `test-result ${type}`;
        
        // 设置样式
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            info: '#17a2b8',
            warning: '#ffc107'
        };

        element.style.color = colors[type] || '#333';
        element.style.whiteSpace = 'pre-line'; // 支持换行显示
        element.style.marginTop = '5px';
        element.style.fontSize = '12px';
        element.style.display = 'block';

        // 3秒后自动清除结果（除了成功结果）
        if (type !== 'success') {
            setTimeout(() => {
                if (element.textContent === message) {
                    element.textContent = '';
                    element.style.display = 'none';
                }
            }, 3000);
        }
    }

    /**
     * 清除测试结果
     * @param {string} elementId 结果元素ID
     */
    clearTestResult(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = '';
            element.style.display = 'none';
        }
    }

    /**
     * 确保content script已加载
     * @param {number} tabId 标签页ID
     * @returns {Promise<boolean>}
     */
    async ensureContentScriptLoaded(tabId) {
        try {
            // 尝试发送ping消息
            const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
            return response && response.success;
        } catch (error) {
            // 如果失败，尝试注入content script
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content/content.js']
                });
                
                // 等待一下让script初始化
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 再次测试
                const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
                return response && response.success;
            } catch (injectError) {
                console.error('注入content script失败:', injectError);
                return false;
            }
        }
    }

    /**
     * 清除测试高亮
     * @returns {Promise<void>}
     */
    async clearTestHighlights() {
        try {
            const tabs = await chrome.tabs.query({});
            const clearPromises = tabs.map(async (tab) => {
                try {
                    await chrome.tabs.sendMessage(tab.id, { action: 'clearHighlights' });
                } catch (error) {
                    // 忽略无法发送消息的标签页
                }
            });
            await Promise.allSettled(clearPromises);
        } catch (error) {
            console.log('⚠️ 无法清除测试高亮，可能是因为页面不支持');
        }
    }

    /**
     * 测试主操作定位器的便捷方法
     * @returns {Promise<void>}
     */
    async testMainLocator() {
        const strategyElement = document.getElementById('editLocatorStrategy');
        const valueElement = document.getElementById('editLocatorValue');
        const resultElement = document.getElementById('mainLocatorTestResult');
        const testBtn = document.getElementById('testMainLocatorBtn');

        if (!strategyElement || !valueElement || !resultElement || !testBtn) {
            console.error('❌ 找不到必要的元素');
            return;
        }

        const strategy = strategyElement.value;
        const value = valueElement.value.trim();

        await this.testLocator(strategy, value, resultElement, testBtn);
    }

    /**
     * 测试子操作定位器的便捷方法
     * @returns {Promise<void>}
     */
    async testSubOpLocator() {
        const strategyElement = document.getElementById('subOpLocatorStrategy');
        const valueElement = document.getElementById('subOpLocatorValue');
        const resultElement = document.getElementById('subOpLocatorTestResult');
        const testBtn = document.getElementById('testSubOpLocatorBtn');

        if (!strategyElement || !valueElement || !resultElement || !testBtn) {
            console.error('❌ 找不到必要的元素');
            return;
        }

        const strategy = strategyElement.value;
        const value = valueElement.value.trim();

        await this.testLocator(strategy, value, resultElement, testBtn);
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocatorTester;
}

if (typeof window !== 'undefined') {
    window.LocatorTester = LocatorTester;
}
