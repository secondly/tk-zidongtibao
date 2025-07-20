/**
 * 性能监控面板
 * 提供实时性能监控、内存使用情况和错误统计的可视化界面
 */

import { performanceMonitor, memoryManager } from '../shared/popup/popup-performance.js';
import { errorHandler } from '../shared/popup/popup-error-handler.js';
import { debugLog } from '../shared/popup/popup-utils.js';

class PerformancePanel {
    constructor() {
        this.isVisible = false;
        this.updateInterval = null;
        this.panel = null;
        this.charts = {};
    }

    // 创建性能面板
    create() {
        if (this.panel) return this.panel;

        this.panel = document.createElement('div');
        this.panel.id = 'performance-panel';
        this.panel.className = 'performance-panel hidden';

        this.panel.innerHTML = `
            <div class="performance-header">
                <h3>🔍 性能监控</h3>
                <div class="performance-controls">
                    <button id="refresh-performance" title="刷新数据">🔄</button>
                    <button id="export-performance" title="导出报告">📊</button>
                    <button id="clear-performance" title="清除数据">🗑️</button>
                    <button id="close-performance" title="关闭面板">✖️</button>
                </div>
            </div>
            
            <div class="performance-content">
                <!-- 概览卡片 -->
                <div class="performance-overview">
                    <div class="perf-card">
                        <div class="perf-card-title">内存使用</div>
                        <div class="perf-card-value" id="memory-usage">--</div>
                        <div class="perf-card-unit">MB</div>
                    </div>
                    <div class="perf-card">
                        <div class="perf-card-title">错误数量</div>
                        <div class="perf-card-value" id="error-count">--</div>
                        <div class="perf-card-unit">个</div>
                    </div>
                    <div class="perf-card">
                        <div class="perf-card-title">平均响应</div>
                        <div class="perf-card-value" id="avg-response">--</div>
                        <div class="perf-card-unit">ms</div>
                    </div>
                    <div class="perf-card">
                        <div class="perf-card-title">操作次数</div>
                        <div class="perf-card-value" id="operation-count">--</div>
                        <div class="perf-card-unit">次</div>
                    </div>
                </div>

                <!-- 详细信息标签页 -->
                <div class="performance-tabs">
                    <div class="tab-buttons">
                        <button class="tab-button active" data-tab="metrics">性能指标</button>
                        <button class="tab-button" data-tab="memory">内存监控</button>
                        <button class="tab-button" data-tab="errors">错误日志</button>
                        <button class="tab-button" data-tab="recommendations">优化建议</button>
                    </div>

                    <!-- 性能指标标签页 -->
                    <div class="tab-content active" id="metrics-tab">
                        <div class="metrics-list" id="metrics-list">
                            <!-- 动态生成的性能指标 -->
                        </div>
                    </div>

                    <!-- 内存监控标签页 -->
                    <div class="tab-content" id="memory-tab">
                        <div class="memory-chart" id="memory-chart">
                            <canvas id="memory-canvas" width="400" height="200"></canvas>
                        </div>
                        <div class="memory-details" id="memory-details">
                            <!-- 内存详细信息 -->
                        </div>
                    </div>

                    <!-- 错误日志标签页 -->
                    <div class="tab-content" id="errors-tab">
                        <div class="error-filters">
                            <select id="error-level-filter">
                                <option value="">所有级别</option>
                                <option value="error">错误</option>
                                <option value="warn">警告</option>
                                <option value="info">信息</option>
                            </select>
                            <select id="error-type-filter">
                                <option value="">所有类型</option>
                                <option value="validation">验证</option>
                                <option value="network">网络</option>
                                <option value="storage">存储</option>
                                <option value="ui">界面</option>
                                <option value="execution">执行</option>
                                <option value="system">系统</option>
                            </select>
                        </div>
                        <div class="error-list" id="error-list">
                            <!-- 动态生成的错误列表 -->
                        </div>
                    </div>

                    <!-- 优化建议标签页 -->
                    <div class="tab-content" id="recommendations-tab">
                        <div class="recommendations-list" id="recommendations-list">
                            <!-- 动态生成的优化建议 -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加样式
        this.addStyles();

        // 绑定事件
        this.bindEvents();

        // 添加到页面
        document.body.appendChild(this.panel);

        return this.panel;
    }

    // 添加样式
    addStyles() {
        if (document.getElementById('performance-panel-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'performance-panel-styles';
        styles.textContent = `
            .performance-panel {
                position: fixed;
                top: 50px;
                right: 20px;
                width: 500px;
                height: 600px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 12px;
                overflow: hidden;
                transition: all 0.3s ease;
            }

            .performance-panel.hidden {
                display: none;
            }

            .performance-header {
                background: #f8f9fa;
                padding: 12px 16px;
                border-bottom: 1px solid #dee2e6;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .performance-header h3 {
                margin: 0;
                font-size: 14px;
                font-weight: 600;
                color: #495057;
            }

            .performance-controls {
                display: flex;
                gap: 8px;
            }

            .performance-controls button {
                background: none;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }

            .performance-controls button:hover {
                background: #e9ecef;
            }

            .performance-content {
                height: calc(100% - 60px);
                overflow-y: auto;
                padding: 16px;
            }

            .performance-overview {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
                margin-bottom: 20px;
            }

            .perf-card {
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                padding: 12px;
                text-align: center;
            }

            .perf-card-title {
                font-size: 11px;
                color: #6c757d;
                margin-bottom: 4px;
            }

            .perf-card-value {
                font-size: 18px;
                font-weight: 600;
                color: #495057;
                margin-bottom: 2px;
            }

            .perf-card-unit {
                font-size: 10px;
                color: #6c757d;
            }

            .performance-tabs {
                border: 1px solid #dee2e6;
                border-radius: 6px;
                overflow: hidden;
            }

            .tab-buttons {
                display: flex;
                background: #f8f9fa;
                border-bottom: 1px solid #dee2e6;
            }

            .tab-button {
                flex: 1;
                background: none;
                border: none;
                padding: 10px 12px;
                cursor: pointer;
                font-size: 11px;
                color: #6c757d;
                transition: all 0.2s;
            }

            .tab-button.active {
                background: white;
                color: #495057;
                font-weight: 500;
            }

            .tab-content {
                display: none;
                padding: 16px;
                max-height: 300px;
                overflow-y: auto;
            }

            .tab-content.active {
                display: block;
            }

            .metrics-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .metric-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: #f8f9fa;
                border-radius: 4px;
                border-left: 3px solid #007bff;
            }

            .metric-name {
                font-weight: 500;
                color: #495057;
            }

            .metric-value {
                color: #6c757d;
                font-size: 11px;
            }

            .error-filters {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
            }

            .error-filters select {
                flex: 1;
                padding: 6px 8px;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                font-size: 11px;
            }

            .error-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .error-item {
                padding: 8px 12px;
                border-radius: 4px;
                border-left: 3px solid #dc3545;
                background: #f8f9fa;
            }

            .error-item.warn {
                border-left-color: #ffc107;
            }

            .error-item.info {
                border-left-color: #17a2b8;
            }

            .error-message {
                font-weight: 500;
                color: #495057;
                margin-bottom: 4px;
            }

            .error-details {
                font-size: 10px;
                color: #6c757d;
            }

            .recommendations-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .recommendation-item {
                padding: 12px;
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 4px;
                border-left: 3px solid #ffc107;
            }

            .recommendation-title {
                font-weight: 500;
                color: #856404;
                margin-bottom: 4px;
            }

            .recommendation-message {
                color: #856404;
                font-size: 11px;
            }

            .memory-chart {
                margin-bottom: 16px;
            }

            .memory-details {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
            }

            .memory-detail-item {
                padding: 8px;
                background: #f8f9fa;
                border-radius: 4px;
                text-align: center;
            }

            .memory-detail-label {
                font-size: 10px;
                color: #6c757d;
                margin-bottom: 2px;
            }

            .memory-detail-value {
                font-size: 12px;
                font-weight: 500;
                color: #495057;
            }
        `;

        document.head.appendChild(styles);
    }

    // 绑定事件
    bindEvents() {
        // 控制按钮事件
        this.panel.querySelector('#refresh-performance').addEventListener('click', () => {
            this.updateData();
        });

        this.panel.querySelector('#export-performance').addEventListener('click', () => {
            this.exportReport();
        });

        this.panel.querySelector('#clear-performance').addEventListener('click', () => {
            this.clearData();
        });

        this.panel.querySelector('#close-performance').addEventListener('click', () => {
            this.hide();
        });

        // 标签页切换
        this.panel.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 错误过滤器
        this.panel.querySelector('#error-level-filter').addEventListener('change', () => {
            this.updateErrorList();
        });

        this.panel.querySelector('#error-type-filter').addEventListener('change', () => {
            this.updateErrorList();
        });
    }

    // 显示面板
    show() {
        if (!this.panel) this.create();

        this.panel.classList.remove('hidden');
        this.isVisible = true;

        // 开始定期更新
        this.startUpdating();

        // 立即更新一次数据
        this.updateData();

        debugLog('性能监控面板已显示');
    }

    // 隐藏面板
    hide() {
        if (this.panel) {
            this.panel.classList.add('hidden');
        }
        this.isVisible = false;

        // 停止更新
        this.stopUpdating();

        debugLog('性能监控面板已隐藏');
    }

    // 切换显示状态
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    // 开始定期更新
    startUpdating() {
        if (this.updateInterval) return;

        this.updateInterval = setInterval(() => {
            if (this.isVisible) {
                this.updateData();
            }
        }, 2000); // 每2秒更新一次
    }

    // 停止更新
    stopUpdating() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // 更新数据
    updateData() {
        this.updateOverview();
        this.updateCurrentTab();
    }

    // 更新概览卡片
    updateOverview() {
        const memory = performanceMonitor.getMemoryUsage();
        const errorStats = errorHandler.getErrorStats();
        const performanceReport = performanceMonitor.getReport();

        // 内存使用
        if (memory) {
            const memoryMB = (memory.used / 1024 / 1024).toFixed(1);
            this.panel.querySelector('#memory-usage').textContent = memoryMB;
        }

        // 错误数量
        this.panel.querySelector('#error-count').textContent = errorStats.total;

        // 平均响应时间
        const avgResponse = this.calculateAverageResponseTime(performanceReport.metrics);
        this.panel.querySelector('#avg-response').textContent = avgResponse.toFixed(0);

        // 操作次数
        this.panel.querySelector('#operation-count').textContent = performanceReport.metrics.length;
    }

    // 计算平均响应时间
    calculateAverageResponseTime(metrics) {
        if (metrics.length === 0) return 0;

        const totalDuration = metrics.reduce((sum, metric) => sum + (metric.duration || 0), 0);
        return totalDuration / metrics.length;
    }

    // 更新当前标签页
    updateCurrentTab() {
        const activeTab = this.panel.querySelector('.tab-button.active').dataset.tab;

        switch (activeTab) {
            case 'metrics':
                this.updateMetricsList();
                break;
            case 'memory':
                this.updateMemoryTab();
                break;
            case 'errors':
                this.updateErrorList();
                break;
            case 'recommendations':
                this.updateRecommendations();
                break;
        }
    }

    // 切换标签页
    switchTab(tabName) {
        // 更新按钮状态
        this.panel.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        this.panel.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 更新内容显示
        this.panel.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        this.panel.querySelector(`#${tabName}-tab`).classList.add('active');

        // 更新对应的数据
        this.updateCurrentTab();
    }

    // 更新性能指标列表
    updateMetricsList() {
        const report = performanceMonitor.getReport();
        const metricsList = this.panel.querySelector('#metrics-list');

        metricsList.innerHTML = '';

        report.metrics.forEach(metric => {
            const item = document.createElement('div');
            item.className = 'metric-item';
            item.innerHTML = `
                <div class="metric-name">${metric.name}</div>
                <div class="metric-value">${metric.duration ? metric.duration.toFixed(2) + 'ms' : '--'}</div>
            `;
            metricsList.appendChild(item);
        });
    }

    // 更新内存标签页
    updateMemoryTab() {
        const memory = performanceMonitor.getMemoryUsage();
        if (!memory) return;

        // 更新内存详情
        const memoryDetails = this.panel.querySelector('#memory-details');
        memoryDetails.innerHTML = `
            <div class="memory-detail-item">
                <div class="memory-detail-label">已使用</div>
                <div class="memory-detail-value">${(memory.used / 1024 / 1024).toFixed(1)} MB</div>
            </div>
            <div class="memory-detail-item">
                <div class="memory-detail-label">总计</div>
                <div class="memory-detail-value">${(memory.total / 1024 / 1024).toFixed(1)} MB</div>
            </div>
            <div class="memory-detail-item">
                <div class="memory-detail-label">限制</div>
                <div class="memory-detail-value">${(memory.limit / 1024 / 1024).toFixed(1)} MB</div>
            </div>
            <div class="memory-detail-item">
                <div class="memory-detail-label">使用率</div>
                <div class="memory-detail-value">${((memory.used / memory.limit) * 100).toFixed(1)}%</div>
            </div>
        `;
    }

    // 更新错误列表
    updateErrorList() {
        const errorStats = errorHandler.getErrorStats();
        const levelFilter = this.panel.querySelector('#error-level-filter').value;
        const typeFilter = this.panel.querySelector('#error-type-filter').value;
        const errorList = this.panel.querySelector('#error-list');

        errorList.innerHTML = '';

        let filteredErrors = errorStats.recent;

        if (levelFilter) {
            filteredErrors = filteredErrors.filter(error => error.level === levelFilter);
        }

        if (typeFilter) {
            filteredErrors = filteredErrors.filter(error => error.type === typeFilter);
        }

        filteredErrors.forEach(error => {
            const item = document.createElement('div');
            item.className = `error-item ${error.level}`;
            item.innerHTML = `
                <div class="error-message">${error.message}</div>
                <div class="error-details">
                    ${error.type} • ${new Date(error.timestamp).toLocaleTimeString()}
                </div>
            `;
            errorList.appendChild(item);
        });
    }

    // 更新优化建议
    updateRecommendations() {
        const report = performanceMonitor.getReport();
        const recommendationsList = this.panel.querySelector('#recommendations-list');

        recommendationsList.innerHTML = '';

        if (report.recommendations.length === 0) {
            recommendationsList.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px;">暂无优化建议</div>';
            return;
        }

        report.recommendations.forEach(rec => {
            const item = document.createElement('div');
            item.className = 'recommendation-item';
            item.innerHTML = `
                <div class="recommendation-title">${rec.type.toUpperCase()}</div>
                <div class="recommendation-message">${rec.message}</div>
            `;
            recommendationsList.appendChild(item);
        });
    }

    // 导出报告
    exportReport() {
        const report = {
            timestamp: Date.now(),
            performance: performanceMonitor.getReport(),
            memory: performanceMonitor.getMemoryUsage(),
            errors: errorHandler.getErrorStats()
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        debugLog('性能报告已导出');
    }

    // 清除数据
    clearData() {
        if (confirm('确定要清除所有性能数据吗？')) {
            performanceMonitor.cleanup();
            errorHandler.clearErrors();
            this.updateData();
            debugLog('性能数据已清除');
        }
    }

    // 销毁面板
    destroy() {
        this.stopUpdating();
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }
        this.isVisible = false;
    }
}

// 创建全局实例
const performancePanel = new PerformancePanel();

// 添加快捷键支持
document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+P 打开性能面板
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        performancePanel.toggle();
    }
});

// 导出
export { PerformancePanel, performancePanel };