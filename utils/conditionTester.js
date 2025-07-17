/**
 * 条件测试器
 * 用于在真实页面上测试条件判断逻辑
 */

class ConditionTester {
    constructor() {
        this.tabSelector = null;
    }

    /**
     * 获取或创建TabSelector实例
     * @returns {TabSelector}
     */
    getTabSelector() {
        if (!this.tabSelector) {
            if (typeof TabSelector === 'undefined') {
                throw new Error('TabSelector 类未加载，请确保 tabSelector.js 已正确引入');
            }
            this.tabSelector = new TabSelector();
        }
        return this.tabSelector;
    }

    /**
     * 测试条件判断
     * @param {Object} conditionConfig 条件配置
     * @returns {Promise<Object>} 测试结果
     */
    async testCondition(conditionConfig) {
        try {
            console.log('🧪 开始测试条件:', conditionConfig);

            // 选择目标页面
            const tabSelector = this.getTabSelector();
            const selectedTab = await tabSelector.showTabSelector();
            if (!selectedTab) {
                return {
                    success: false,
                    error: '未选择测试页面'
                };
            }

            console.log('🎯 选择的测试页面:', selectedTab.title, selectedTab.url);

            // 确保content script已加载
            const isLoaded = await this.ensureContentScriptLoaded(selectedTab.id);
            if (!isLoaded) {
                return {
                    success: false,
                    error: '页面不支持测试功能'
                };
            }

            console.log('✅ Content script已加载，发送条件测试请求...');

            // 发送条件测试请求到目标页面
            const response = await chrome.tabs.sendMessage(selectedTab.id, {
                action: 'testCondition',
                condition: conditionConfig
            });

            console.log('📨 收到条件测试响应:', response);

            if (response && response.success) {
                return {
                    success: true,
                    conditionMet: response.conditionMet,
                    message: response.message || `条件${response.conditionMet ? '满足' : '不满足'}`,
                    actualValue: response.actualValue,
                    expectedValue: response.expectedValue
                };
            } else {
                return {
                    success: false,
                    error: response?.error || '条件测试失败'
                };
            }

        } catch (error) {
            console.error('条件测试失败:', error);
            return {
                success: false,
                error: error.message || '条件测试出错'
            };
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
     * 验证条件配置
     * @param {Object} conditionConfig 条件配置
     * @returns {Object} 验证结果
     */
    validateConditionConfig(conditionConfig) {
        const errors = [];

        if (!conditionConfig.locator) {
            errors.push('缺少定位器配置');
        } else {
            if (!conditionConfig.locator.strategy) {
                errors.push('缺少定位策略');
            }
            if (!conditionConfig.locator.value) {
                errors.push('缺少定位值');
            }
        }

        if (!conditionConfig.conditionType) {
            errors.push('缺少条件类型');
        }

        if (!conditionConfig.comparisonType) {
            errors.push('缺少比较类型');
        }

        // 检查是否需要期望值
        const needsExpectedValue = ![
            'exists', 'notExists', 'visible', 'notVisible', 
            'isEmpty', 'isNotEmpty', 'hasAttribute', 'notHasAttribute'
        ].includes(conditionConfig.comparisonType);

        if (needsExpectedValue && !conditionConfig.expectedValue) {
            errors.push('该比较类型需要提供期望值');
        }

        // 检查是否需要属性名
        const needsAttributeName = [
            'attribute', 'style', 'hasAttribute', 'notHasAttribute'
        ].includes(conditionConfig.conditionType);

        if (needsAttributeName && !conditionConfig.attributeName) {
            errors.push('该条件类型需要提供属性名');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 获取支持的条件类型
     * @returns {Array} 条件类型列表
     */
    getSupportedConditionTypes() {
        return [
            { value: 'text', label: '文本内容' },
            { value: 'attribute', label: '属性值' },
            { value: 'class', label: '类名' },
            { value: 'style', label: '样式属性' },
            { value: 'value', label: '输入值' },
            { value: 'exists', label: '元素存在' },
            { value: 'visible', label: '元素可见' }
        ];
    }

    /**
     * 获取支持的比较类型
     * @returns {Array} 比较类型列表
     */
    getSupportedComparisonTypes() {
        return [
            { value: 'equals', label: '等于' },
            { value: 'notEquals', label: '不等于' },
            { value: 'contains', label: '包含' },
            { value: 'notContains', label: '不包含' },
            { value: 'startsWith', label: '开始于' },
            { value: 'endsWith', label: '结束于' },
            { value: 'isEmpty', label: '为空' },
            { value: 'isNotEmpty', label: '不为空' },
            { value: 'hasAttribute', label: '具有属性' },
            { value: 'notHasAttribute', label: '不具有属性' }
        ];
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConditionTester;
}

if (typeof window !== 'undefined') {
    window.ConditionTester = ConditionTester;
}
