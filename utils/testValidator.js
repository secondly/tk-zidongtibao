/**
 * 测试验证模块
 * 用于验证定位器测试结果的真实性
 */

class TestValidator {
    constructor() {
        this.lastTestResult = null;
        this.testHistory = [];
    }

    /**
     * 验证测试结果的真实性
     * @param {Object} testData 测试数据
     * @param {Object} response 测试响应
     * @returns {Object} 验证结果
     */
    validateTestResult(testData, response) {
        const validation = {
            isValid: true,
            warnings: [],
            details: {}
        };

        // 记录测试历史
        const testRecord = {
            timestamp: Date.now(),
            strategy: testData.strategy,
            value: testData.value,
            tabId: testData.tabId,
            tabTitle: testData.tabTitle,
            response: response
        };
        
        this.testHistory.push(testRecord);
        this.lastTestResult = testRecord;

        // 验证1: 检查是否为常见的假阳性结果
        if (this.isSuspiciousResult(testData, response)) {
            validation.warnings.push('⚠️ 可疑的测试结果，建议手动验证');
        }

        // 验证2: 检查定位器语法
        if (this.hasInvalidSyntax(testData.strategy, testData.value)) {
            validation.warnings.push('⚠️ 定位器语法可能有误');
        }

        // 验证3: 检查是否在正确的页面上测试
        if (this.isWrongPage(testData)) {
            validation.warnings.push('⚠️ 可能在错误的页面上进行测试');
        }

        validation.details = {
            testRecord,
            historyCount: this.testHistory.length
        };

        return validation;
    }

    /**
     * 检查是否为可疑的测试结果
     * @param {Object} testData 测试数据
     * @param {Object} response 响应
     * @returns {boolean}
     */
    isSuspiciousResult(testData, response) {
        // 检查是否总是返回相同的结果
        if (this.testHistory.length > 1) {
            const recentResults = this.testHistory.slice(-3);
            const allSameCount = recentResults.every(r => 
                r.response.success && r.response.count === response.count
            );
            if (allSameCount && response.count > 0) {
                return true;
            }
        }

        // 检查是否为明显不存在的元素却返回找到
        const suspiciousSelectors = [
            'non-existent-element',
            'fake-element',
            'test-element-that-does-not-exist'
        ];
        
        if (suspiciousSelectors.some(sel => testData.value.includes(sel)) && response.count > 0) {
            return true;
        }

        return false;
    }

    /**
     * 检查定位器语法是否有效
     * @param {string} strategy 定位策略
     * @param {string} value 定位值
     * @returns {boolean}
     */
    hasInvalidSyntax(strategy, value) {
        try {
            switch (strategy) {
                case 'css':
                    // 简单的CSS选择器语法检查
                    if (value.includes('//') || value.includes('@')) {
                        return true; // 可能是XPath语法
                    }
                    break;
                case 'xpath':
                    // 简单的XPath语法检查
                    if (!value.startsWith('/') && !value.startsWith('.')) {
                        return true; // 可能不是有效的XPath
                    }
                    break;
                case 'id':
                    // ID不应该包含特殊字符
                    if (value.includes('.') || value.includes('#') || value.includes(' ')) {
                        return true;
                    }
                    break;
            }
        } catch (error) {
            return true;
        }
        return false;
    }

    /**
     * 检查是否在错误的页面上测试
     * @param {Object} testData 测试数据
     * @returns {boolean}
     */
    isWrongPage(testData) {
        // 如果在设计器页面上测试业务元素，可能是错误的
        if (testData.tabTitle && testData.tabTitle.includes('工作流设计器')) {
            const businessSelectors = ['el-button', 'ant-btn', 'btn-primary'];
            if (businessSelectors.some(sel => testData.value.includes(sel))) {
                return true;
            }
        }
        return false;
    }

    /**
     * 获取测试建议
     * @param {Object} testData 测试数据
     * @returns {Array} 建议列表
     */
    getTestSuggestions(testData) {
        const suggestions = [];

        // 根据页面类型提供建议
        if (testData.tabTitle) {
            if (testData.tabTitle.includes('测试') || testData.tabTitle.includes('demo')) {
                suggestions.push('✅ 正在测试页面上进行测试，这是正确的');
            } else if (testData.tabTitle.includes('设计器')) {
                suggestions.push('💡 建议在实际的业务页面上测试定位器');
            }
        }

        // 根据定位策略提供建议
        switch (testData.strategy) {
            case 'css':
                suggestions.push('💡 CSS选择器建议：使用具体的类名或ID，避免过于宽泛的选择器');
                break;
            case 'xpath':
                suggestions.push('💡 XPath建议：尽量使用相对路径，避免绝对路径');
                break;
            case 'text':
                suggestions.push('💡 文本匹配建议：确保文本内容准确，注意大小写和空格');
                break;
        }

        return suggestions;
    }

    /**
     * 生成测试报告
     * @returns {string} 测试报告
     */
    generateTestReport() {
        if (this.testHistory.length === 0) {
            return '暂无测试记录';
        }

        const recent = this.testHistory.slice(-5);
        let report = `📊 最近 ${recent.length} 次测试记录:\n\n`;

        recent.forEach((test, index) => {
            const time = new Date(test.timestamp).toLocaleTimeString();
            const result = test.response.success ? 
                `找到 ${test.response.count} 个元素` : 
                `失败: ${test.response.error}`;
            
            report += `${index + 1}. [${time}] ${test.strategy}:"${test.value}" → ${result}\n`;
            report += `   页面: ${test.tabTitle} (ID: ${test.tabId})\n\n`;
        });

        return report;
    }

    /**
     * 清除测试历史
     */
    clearHistory() {
        this.testHistory = [];
        this.lastTestResult = null;
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestValidator;
}

if (typeof window !== 'undefined') {
    window.TestValidator = TestValidator;
}
