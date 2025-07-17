/**
 * 节点测试功能模块
 * 负责工作流节点的元素定位测试和高亮显示
 */

class NodeTester {
    constructor() {
        this.isTestingInProgress = false;
    }

    /**
     * 测试步骤节点的元素定位
     * @param {string} stepId - 步骤ID
     * @param {object} currentWorkflow - 当前工作流对象
     * @param {object} workflowManager - 工作流管理器实例
     * @param {function} showStatus - 状态显示函数
     * @param {function} ensureContentScriptLoaded - 确保content script加载的函数
     */
    async testStepNode(stepId, currentWorkflow, workflowManager, showStatus, ensureContentScriptLoaded) {
        if (this.isTestingInProgress) {
            showStatus('测试正在进行中，请稍候...', 'info');
            return;
        }

        try {
            this.isTestingInProgress = true;
            
            const step = workflowManager.findStepById(currentWorkflow, stepId);
            if (!step) {
                showStatus('步骤不存在', 'error');
                return;
            }

            console.log('🧪 测试步骤节点:', step);

            // 检查步骤是否有定位器
            if (!step.locator || !step.locator.value) {
                showStatus('该步骤没有配置定位器，无法测试', 'error');
                return;
            }

            showStatus('🔍 正在测试节点...', 'info');

            // 使用页面选择器选择目标页面，确保与设计器测试环境一致
            let tab;
            try {
                // 初始化页面选择器
                if (!window.tabSelector) {
                    window.tabSelector = new TabSelector();
                }

                // 显示页面选择器
                tab = await window.tabSelector.showTabSelector();
                if (!tab) {
                    showStatus('已取消测试', 'info');
                    return;
                }
                console.log('✅ 用户选择的测试页面:', tab.title, tab.url);
            } catch (error) {
                console.warn('⚠️ 页面选择器失败，使用当前页面:', error);
                // 降级到当前页面
                const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!currentTab) {
                    showStatus('无法获取目标页面', 'error');
                    return;
                }
                tab = currentTab;
                console.log('📍 使用当前页面:', tab.title, tab.url);
            }

            // 确保content script已加载
            const isLoaded = await ensureContentScriptLoaded(tab.id);
            if (!isLoaded) {
                showStatus('页面不支持测试功能', 'error');
                return;
            }

            // 发送测试请求
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'testLocator',
                locator: step.locator
            });

            if (response && response.success) {
                const count = response.count;
                if (count === 0) {
                    showStatus(`节点测试失败：未找到匹配元素`, 'error');
                } else {
                    showStatus(`节点测试成功：找到 ${count} 个匹配元素，已橙色高亮显示`, 'success');
                    console.log(`🎯 节点测试成功，已高亮 ${count} 个元素`);
                    
                    // 3秒后清除高亮
                    setTimeout(async () => {
                        try {
                            await chrome.tabs.sendMessage(tab.id, { action: 'clearTestHighlights' });
                        } catch (error) {
                            console.log('清除高亮失败:', error);
                        }
                    }, 3000);
                }
            } else {
                showStatus(`节点测试失败：${response?.error || '未知错误'}`, 'error');
            }

        } catch (error) {
            console.error('测试节点失败:', error);
            showStatus(`测试节点失败：${error.message}`, 'error');
        } finally {
            this.isTestingInProgress = false;
        }
    }

    /**
     * 批量测试多个节点
     * @param {Array} stepIds - 步骤ID数组
     * @param {object} currentWorkflow - 当前工作流对象
     * @param {object} workflowManager - 工作流管理器实例
     * @param {function} showStatus - 状态显示函数
     * @param {function} ensureContentScriptLoaded - 确保content script加载的函数
     */
    async testMultipleNodes(stepIds, currentWorkflow, workflowManager, showStatus, ensureContentScriptLoaded) {
        if (this.isTestingInProgress) {
            showStatus('测试正在进行中，请稍候...', 'info');
            return;
        }

        try {
            this.isTestingInProgress = true;
            showStatus(`🔍 正在批量测试 ${stepIds.length} 个节点...`, 'info');

            // 选择目标页面（只选择一次，用于所有测试）
            let tab;
            try {
                // 初始化页面选择器
                if (!window.tabSelector) {
                    window.tabSelector = new TabSelector();
                }

                // 显示页面选择器
                tab = await window.tabSelector.showTabSelector();
                if (!tab) {
                    showStatus('已取消批量测试', 'info');
                    return;
                }
                console.log('✅ 用户选择的测试页面:', tab.title, tab.url);
            } catch (error) {
                console.warn('⚠️ 页面选择器失败，使用当前页面:', error);
                // 降级到当前页面
                const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!currentTab) {
                    showStatus('无法获取目标页面', 'error');
                    return;
                }
                tab = currentTab;
                console.log('📍 使用当前页面:', tab.title, tab.url);
            }

            const results = [];
            for (const stepId of stepIds) {
                const step = workflowManager.findStepById(currentWorkflow, stepId);
                if (step && step.locator && step.locator.value) {
                    try {
                        const response = await chrome.tabs.sendMessage(tab.id, {
                            action: 'testLocator',
                            locator: step.locator
                        });
                        
                        results.push({
                            stepId,
                            stepName: step.name,
                            success: response?.success,
                            count: response?.count || 0,
                            error: response?.error
                        });
                    } catch (error) {
                        results.push({
                            stepId,
                            stepName: step.name,
                            success: false,
                            count: 0,
                            error: error.message
                        });
                    }
                }
            }

            // 显示批量测试结果
            const successCount = results.filter(r => r.success && r.count > 0).length;
            const failCount = results.length - successCount;
            
            showStatus(`批量测试完成：${successCount} 个成功，${failCount} 个失败`, 
                      successCount > failCount ? 'success' : 'error');
            
            console.log('🧪 批量测试结果:', results);

        } catch (error) {
            console.error('批量测试失败:', error);
            showStatus(`批量测试失败：${error.message}`, 'error');
        } finally {
            this.isTestingInProgress = false;
        }
    }

    /**
     * 清除所有测试高亮
     */
    async clearAllHighlights() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                await chrome.tabs.sendMessage(tab.id, { action: 'clearTestHighlights' });
                console.log('✅ 已清除所有测试高亮');
            }
        } catch (error) {
            console.log('清除高亮失败:', error);
        }
    }

    /**
     * 获取节点测试状态
     */
    getTestingStatus() {
        return {
            isTestingInProgress: this.isTestingInProgress
        };
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NodeTester;
}

if (typeof window !== 'undefined') {
    window.NodeTester = NodeTester;
}
