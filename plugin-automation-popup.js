/**
 * 通用自动化插件弹窗脚本 - 重构版本
 *
 * 依赖的模块文件（通过HTML script标签加载）：
 * - utils/workflowManager.js - 工作流管理功能
 * - utils/uiRenderer.js - UI渲染功能
 * - utils/stepEditor.js - 步骤编辑功能
 * - utils/importExport.js - 导入导出功能
 * - utils/contextMenu.js - 右键菜单功能
 *
 * 内置功能：
 * - 执行控制功能 - 执行、暂停、继续、停止工作流
 * - 事件处理功能 - 按钮事件和消息监听
 */

// 全局变量
let automationEngine;
let workflowManager = null;
let currentWorkflow = null;
let editingStep = null;
let isEditingSubOperation = false;
let selectedNode = null; // 当前选中的节点

// 三栏布局相关变量
let configManager = null;
let flowPreview = null;
let executionStatus = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🤖 通用自动化插件已加载 - 三栏布局版本');

    // 初始化工作流管理器
    if (typeof WorkflowManager !== 'undefined') {
        workflowManager = new WorkflowManager();
        console.log('✅ WorkflowManager 已初始化');
    } else {
        console.error('❌ WorkflowManager 类未找到');
    }

    // 初始化自动化引擎
    if (typeof UniversalAutomationEngine !== 'undefined') {
        automationEngine = new UniversalAutomationEngine();
        console.log('✅ UniversalAutomationEngine 已初始化');
    } else {
        console.warn('⚠️ UniversalAutomationEngine 未找到');
    }

    // 初始化三栏布局
    initializeLayout();

    // 初始化事件监听器
    initializeEventListeners();

    // 调试localStorage内容
    debugLocalStorage();

    // 初始化localStorage监听
    initializeStorageListener();

    // 加载保存的工作流
    loadSavedWorkflows();
});

// 初始化三栏布局
function initializeLayout() {
    // 初始化配置管理器
    initializeConfigManager();

    // 初始化流程图预览
    initializeFlowPreview();

    // 初始化执行状态
    initializeExecutionStatus();

    // 初始化分割线拖拽
    initializeDividerResize();

    // 面板折叠功能已移除
}

// 初始化配置管理器
function initializeConfigManager() {
    // 初始化配置选择下拉框
    const configSelect = document.getElementById('configSelect');
    if (configSelect) {
        configSelect.innerHTML = '<option value="">请选择一个配置...</option>';
    }

    // 隐藏当前配置信息
    hideCurrentConfigDisplay();
}

// 初始化流程图预览
function initializeFlowPreview() {
    const flowGraphContainer = document.getElementById('flowGraphContainer');
    const flowOverlay = document.getElementById('flowOverlay');

    // 初始化mxGraph容器
    if (flowGraphContainer) {
        console.log('✅ 流程图容器已找到，准备初始化mxGraph');

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            if (window.previewGraph) {
                window.previewGraph.refresh();
            }
        });
    } else {
        console.error('❌ 未找到流程图容器 #flowGraphContainer');
    }

    // 缩放控制已移除，改用鼠标滚轮缩放
}

// 初始化执行状态
function initializeExecutionStatus() {
    const statusIcon = document.querySelector('.status-icon');
    const statusText = document.querySelector('.status-text');
    const statusMessage = document.querySelector('.status-message');

    // 设置初始状态
    updateExecutionStatus('idle', '等待执行...');
}

// 初始化分割线拖拽
function initializeDividerResize() {
    const divider = document.getElementById('divider');
    const leftPanel = document.getElementById('leftPanel');
    const rightPanel = document.getElementById('rightPanel');

    if (divider && leftPanel && rightPanel) {
        let isResizing = false;

        divider.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
        });

        function handleResize(e) {
            if (!isResizing) return;

            const containerRect = document.querySelector('.main-content').getBoundingClientRect();
            const newWidth = e.clientX - containerRect.left;

            if (newWidth >= 200 && newWidth <= 400) {
                leftPanel.style.width = newWidth + 'px';
            }
        }

        function stopResize() {
            isResizing = false;
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
        }
    }
}

// 加载保存的工作流列表
function loadSavedWorkflows() {
    console.log('🔄 开始加载保存的工作流列表...');

    const workflows = getWorkflowsFromStorage();
    console.log('📊 获取到的工作流数量:', workflows.length);

    renderConfigSelect(workflows);
    console.log('🎨 配置选择框已渲染');

    // 如果当前有选中的工作流，保持选中状态
    if (currentWorkflow) {
        console.log('🔍 尝试保持当前选中的工作流:', currentWorkflow.name);
        const configSelect = document.getElementById('configSelect');
        if (configSelect) {
            const index = workflows.findIndex(w => w.name === currentWorkflow.name);
            if (index >= 0) {
                configSelect.value = index;
                console.log('✅ 已保持选中状态，索引:', index);
            } else {
                console.log('⚠️ 当前工作流在列表中未找到');
            }
        }
    } else {
        console.log('ℹ️ 当前没有选中的工作流');
    }

    console.log('✅ 工作流列表加载完成');
}

// 渲染配置下拉选择框
function renderConfigSelect(workflows) {
    console.log('🎨 开始渲染配置选择框，工作流数量:', workflows ? workflows.length : 0);

    const configSelect = document.getElementById('configSelect');
    if (!configSelect) {
        console.error('❌ 未找到configSelect元素');
        return;
    }

    // 清空现有选项
    configSelect.innerHTML = '<option value="">请选择一个配置...</option>';
    console.log('🧹 已清空现有选项');

    if (workflows && workflows.length > 0) {
        console.log('📋 开始添加工作流选项...');
        workflows.forEach((workflow, index) => {
            const option = document.createElement('option');
            option.value = index;
            const stepCount = workflow.steps ? workflow.steps.length : 0;
            option.textContent = `${workflow.name || '未命名工作流'} (${stepCount} 步骤)`;
            configSelect.appendChild(option);
            console.log(`✅ 已添加选项 ${index}: ${workflow.name} (${stepCount} 步骤)`);
        });
        console.log('✅ 所有工作流选项已添加完成');
    } else {
        console.log('⚠️ 没有工作流数据，只显示默认选项');
    }
}

// 选择配置
function selectConfig(index) {
    try {
        const savedWorkflows = getWorkflowsFromStorage();
        console.log('🔍 选择配置 - 索引:', index, '工作流列表:', savedWorkflows);

        if (savedWorkflows && savedWorkflows[index]) {
            currentWorkflow = savedWorkflows[index];
            console.log('✅ 当前工作流已设置:', currentWorkflow);
            console.log('📊 工作流详细信息:');
            console.log('  - 名称:', currentWorkflow.name);
            console.log('  - 步骤数量:', currentWorkflow.steps ? currentWorkflow.steps.length : 0);
            console.log('  - 步骤详情:', currentWorkflow.steps);

            updateCurrentConfigDisplay();

            // 渲染流程预览
            console.log('🎨 开始渲染流程预览...');
            renderFlowPreview(currentWorkflow);

            // 启用执行按钮
            const executeBtn = document.getElementById('executeBtn');
            if (executeBtn) {
                executeBtn.disabled = false;
            }

            updateExecutionStatus('idle', '配置已选择，可以执行');
        } else {
            console.warn('⚠️ 未找到指定索引的工作流:', index);
        }
    } catch (error) {
        console.error('❌ 选择配置失败:', error);
    }
}

// 处理下拉选择框变化
function handleConfigSelectChange(event) {
    const selectedIndex = event.target.value;
    if (selectedIndex === '') {
        // 未选择任何配置
        currentWorkflow = null;
        hideCurrentConfigDisplay();
        clearFlowPreview();

        // 禁用执行按钮
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) {
            executeBtn.disabled = true;
        }

        updateExecutionStatus('idle', '请选择一个配置');
    } else {
        selectConfig(parseInt(selectedIndex));
    }
}

// 刷新配置列表
function refreshConfigList() {
    console.log('🔄 手动刷新配置列表...');

    // 显示刷新状态
    const refreshBtn = document.getElementById('refreshConfigBtn');
    if (refreshBtn) {
        const originalText = refreshBtn.textContent;
        refreshBtn.textContent = '🔄 刷新中...';
        refreshBtn.disabled = true;

        // 延迟恢复按钮状态
        setTimeout(() => {
            refreshBtn.textContent = originalText;
            refreshBtn.disabled = false;
        }, 1000);
    }

    try {
        // 调试localStorage内容
        debugLocalStorage();

        // 重新加载工作流列表
        loadSavedWorkflows();

        // 显示成功提示
        updateExecutionStatus('success', '配置列表已刷新');

        // 2秒后恢复状态
        setTimeout(() => {
            updateExecutionStatus('idle', '请选择一个配置');
        }, 2000);

        console.log('✅ 配置列表刷新完成');

    } catch (error) {
        console.error('❌ 刷新配置列表失败:', error);
        updateExecutionStatus('error', '刷新配置列表失败');

        // 3秒后恢复状态
        setTimeout(() => {
            updateExecutionStatus('idle', '请选择一个配置');
        }, 3000);
    }
}

// localStorage管理功能
const STORAGE_KEY = 'automationWorkflows';

// 调试函数：检查localStorage中的所有数据
function debugLocalStorage() {
    console.log('🔍 调试localStorage内容:');
    console.log('📦 localStorage长度:', localStorage.length);

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        console.log(`🔑 键: "${key}" | 值长度: ${value ? value.length : 0}`);

        // 如果是我们关心的键，显示详细内容
        if (key === STORAGE_KEY || key === 'workflow_list' || key === 'mxgraph_workflow') {
            try {
                const parsed = JSON.parse(value);
                console.log(`📋 "${key}" 解析后的数据:`, parsed);
            } catch (e) {
                console.log(`📋 "${key}" 原始数据:`, value);
            }
        }
    }
}

// 从localStorage获取工作流
function getWorkflowsFromStorage() {
    try {
        console.log('🔍 正在读取localStorage，键名:', STORAGE_KEY);
        const data = localStorage.getItem(STORAGE_KEY);
        console.log('📦 localStorage原始数据:', data);

        if (data) {
            const workflows = JSON.parse(data);
            console.log('✅ 解析成功，工作流数量:', workflows.length);
            console.log('📋 工作流列表:', workflows);
            return workflows;
        } else {
            console.log('⚠️ localStorage中没有找到工作流数据');
            return [];
        }
    } catch (error) {
        console.error('❌ 读取工作流失败:', error);
        return [];
    }
}

// 保存工作流到localStorage
function saveWorkflowsToStorage(workflows) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
        return true;
    } catch (error) {
        console.error('保存工作流失败:', error);
        return false;
    }
}

// 监听localStorage变化（跨窗口同步）
function initializeStorageListener() {
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
            console.log('🔄 检测到工作流数据变化，重新加载配置列表...');
            loadSavedWorkflows();

            // 显示同步提示
            updateExecutionStatus('success', '配置列表已同步更新');
            setTimeout(() => {
                updateExecutionStatus('idle', '等待执行...');
            }, 2000);
        }
    });
}

// 更新当前配置显示
function updateCurrentConfigDisplay() {
    const currentConfig = document.getElementById('currentConfig');
    if (!currentConfig || !currentWorkflow) return;

    // 显示配置信息区域
    currentConfig.style.display = 'block';

    const configName = currentConfig.querySelector('.config-name');
    const configStats = currentConfig.querySelector('.config-stats');

    if (configName) {
        configName.textContent = currentWorkflow.name || '未命名工作流';
    }

    if (configStats) {
        configStats.textContent = `${currentWorkflow.steps ? currentWorkflow.steps.length : 0} 个步骤`;
    }
}

// 隐藏当前配置显示
function hideCurrentConfigDisplay() {
    const currentConfig = document.getElementById('currentConfig');
    if (currentConfig) {
        currentConfig.style.display = 'none';
    }
}

// 清除流程图预览
function clearFlowPreview() {
    const container = document.getElementById('flowGraphContainer');
    const overlay = document.getElementById('flowOverlay');

    if (container) {
        container.innerHTML = '';
        // 清除全局图形实例
        if (window.previewGraph) {
            window.previewGraph = null;
        }
    }

    if (overlay) {
        overlay.style.display = 'flex';
    }
}

// 缩放控制已移除，改用鼠标滚轮缩放

// mxGraph容器大小调整（已通过CSS和mxGraph自动处理）



// 更新执行状态
function updateExecutionStatus(status, message) {
    const statusIcon = document.querySelector('.status-icon');
    const statusText = document.querySelector('.status-text');
    const statusMessage = document.querySelector('.status-message');

    const statusTypes = {
        idle: { color: '#6c757d', icon: '⏸️', text: '空闲' },
        testing: { color: '#17a2b8', icon: '🧪', text: '测试中' },
        executing: { color: '#007bff', icon: '▶️', text: '执行中' },
        success: { color: '#28a745', icon: '✅', text: '成功' },
        error: { color: '#dc3545', icon: '❌', text: '错误' },
        warning: { color: '#ffc107', icon: '⚠️', text: '警告' }
    };

    const statusType = statusTypes[status] || statusTypes.idle;

    if (statusIcon) {
        statusIcon.textContent = statusType.icon;
        statusIcon.style.color = statusType.color;
    }

    if (statusText) {
        statusText.textContent = statusType.text;
        statusText.style.color = statusType.color;
    }

    if (statusMessage) {
        statusMessage.textContent = message;
    }
}

// 渲染流程图预览 - 使用mxGraph实现与设计器一致的显示
function renderFlowPreview(workflow) {
    console.log('🎨 renderFlowPreview 被调用，工作流:', workflow);

    const container = document.getElementById('flowGraphContainer');
    const overlay = document.getElementById('flowOverlay');

    console.log('📦 容器元素:', container, '覆盖层:', overlay);

    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
        console.log('⚠️ 工作流为空或无步骤，显示空状态');
        // 显示空状态
        if (overlay) overlay.style.display = 'flex';
        if (container) container.innerHTML = '';
        return;
    }

    console.log('✅ 工作流有效，步骤数量:', workflow.steps.length);

    // 隐藏空状态
    if (overlay) overlay.style.display = 'none';

    if (container) {
        try {
            // 清空容器
            container.innerHTML = '';
            console.log('🧹 容器已清空');

            // 检查mxGraph是否可用
            console.log('🔍 检查mxGraph可用性...');
            console.log('mxGraph类型:', typeof window.mxGraph);
            console.log('mxClient类型:', typeof window.mxClient);
            console.log('window对象中的mxGraph相关属性:', Object.keys(window).filter(key => key.startsWith('mx')));

            if (typeof window.mxGraph === 'undefined' || typeof window.mxClient === 'undefined') {
                console.warn('⚠️ mxGraph未加载，使用简单预览');
                console.log('🎨 切换到简单Canvas预览模式');
                renderSimpleFlowPreview(workflow, container);
                return;
            }

            // 确保mxClient已初始化
            if (!window.mxClient.isBrowserSupported()) {
                console.warn('⚠️ 浏览器不支持mxGraph，使用简单预览');
                renderSimpleFlowPreview(workflow, container);
                return;
            }

            console.log('✅ mxGraph可用，创建图形实例...');

            // 创建只读的mxGraph实例
            const graph = new window.mxGraph(container);

            // 设置为预览模式（只读但支持平移缩放）
            graph.setEnabled(false);
            graph.setPanning(true);
            graph.setTooltips(true);

            // 启用鼠标滚轮缩放
            new window.mxPanningHandler(graph);
            graph.panningHandler.useLeftButtonForPanning = true;

            // 设置缩放
            graph.getView().setScale(1);
            graph.centerZoom = true;

            // 设置网格
            graph.setGridEnabled(true);
            graph.setGridSize(20);

            // 添加鼠标滚轮缩放事件
            if (typeof window.mxEvent !== 'undefined') {
                window.mxEvent.addMouseWheelListener((evt, up) => {
                    if (evt.target.closest('#flowGraphContainer')) {
                        const scale = graph.getView().getScale();
                        const newScale = up ? scale * 1.1 : scale * 0.9;

                        // 限制缩放范围
                        if (newScale >= 0.1 && newScale <= 3.0) {
                            graph.getView().setScale(newScale);

                            // 阻止页面滚动
                            if (evt.preventDefault) {
                                evt.preventDefault();
                            }
                            evt.returnValue = false;
                        }
                    }
                }, container);
            } else {
                // 降级方案：直接监听wheel事件
                container.addEventListener('wheel', (evt) => {
                    const scale = graph.getView().getScale();
                    const delta = evt.deltaY > 0 ? -1 : 1;
                    const newScale = scale * (1 + delta * 0.1);

                    // 限制缩放范围
                    if (newScale >= 0.1 && newScale <= 3.0) {
                        graph.getView().setScale(newScale);
                        evt.preventDefault();
                    }
                });
            }

            // 保存图形实例到全局变量
            window.previewGraph = graph;

            console.log('🎨 设置预览样式...');
            // 设置样式
            setupPreviewStyles(graph);

            console.log('🏗️ 渲染工作流到预览...');
            // 渲染工作流
            renderWorkflowInPreview(graph, workflow);

            // 自适应大小
            graph.fit();

            console.log('✅ 流程预览渲染完成');

        } catch (error) {
            console.error('❌ 渲染流程预览失败:', error);
            renderSimpleFlowPreview(workflow, container);
        }
    } else {
        console.error('❌ 未找到flowGraphContainer容器元素');
    }
}

// 简单流程预览（当mxGraph不可用时使用）
function renderSimpleFlowPreview(workflow, container) {
    console.log('🎨 使用简单Canvas预览，工作流:', workflow);

    // 创建Canvas元素
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth || 400;
    canvas.height = container.clientHeight || 600;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.border = '1px solid #e0e0e0';
    canvas.style.borderRadius = '6px';
    canvas.style.background = '#fff';

    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    // 绘制工作流步骤
    if (workflow && workflow.steps && workflow.steps.length > 0) {
        drawSimpleFlowChart(ctx, workflow.steps);
        console.log('✅ 简单预览渲染完成，步骤数:', workflow.steps.length);
    } else {
        // 绘制空状态
        drawEmptyState(ctx, canvas.width, canvas.height);
        console.log('⚠️ 工作流为空，显示空状态');
    }
}

// 绘制空状态
function drawEmptyState(ctx, width, height) {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#999';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂无工作流数据', width / 2, height / 2);

    ctx.font = '12px Arial';
    ctx.fillText('请在设计器中创建工作流并保存', width / 2, height / 2 + 25);
}

// 设置预览样式 - 使用和设计器完全相同的样式
function setupPreviewStyles(graph) {
    if (typeof window.mxConstants === 'undefined') {
        console.warn('mxConstants未定义，跳过样式设置');
        return;
    }

    try {
        const stylesheet = graph.getStylesheet();
        const mxConstants = window.mxConstants;
        const mxPerimeter = window.mxPerimeter;

        // 节点类型配置（和设计器相同）
        const nodeTypes = {
            click: { name: '点击操作', color: '#e74c3c', icon: '👆' },
            input: { name: '输入文本', color: '#f39c12', icon: '⌨️' },
            wait: { name: '等待时间', color: '#9b59b6', icon: '⏱️' },
            smartWait: { name: '智能等待', color: '#27ae60', icon: '🔍' },
            loop: { name: '循环操作', color: '#3498db', icon: '🔄' },
            condition: { name: '条件判断', color: '#e67e22', icon: '❓' },
            checkState: { name: '节点检测', color: '#8e44ad', icon: '🔍' },
            extract: { name: '提取数据', color: '#1abc9c', icon: '📊' }
        };

        // 基础节点样式（和设计器相同）
        const baseNodeStyle = {
            [mxConstants.STYLE_SHAPE]: mxConstants.SHAPE_RECTANGLE,
            [mxConstants.STYLE_PERIMETER]: mxPerimeter.RectanglePerimeter,
            [mxConstants.STYLE_ROUNDED]: true,
            [mxConstants.STYLE_STROKEWIDTH]: 2,
            [mxConstants.STYLE_FONTSIZE]: 12,
            [mxConstants.STYLE_FONTFAMILY]: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            [mxConstants.STYLE_FONTCOLOR]: '#333333',
            [mxConstants.STYLE_ALIGN]: mxConstants.ALIGN_CENTER,
            [mxConstants.STYLE_VERTICAL_ALIGN]: mxConstants.ALIGN_MIDDLE,
            [mxConstants.STYLE_WHITE_SPACE]: 'wrap',
            [mxConstants.STYLE_OVERFLOW]: 'width'
        };

        // 为每种节点类型创建样式（和设计器相同）
        Object.keys(nodeTypes).forEach(type => {
            const config = nodeTypes[type];
            const style = {
                ...baseNodeStyle,
                [mxConstants.STYLE_FILLCOLOR]: config.color,
                [mxConstants.STYLE_STROKECOLOR]: config.color
            };
            stylesheet.putCellStyle(type, style);
        });

        // 循环容器样式（和设计器相同）
        const loopContainerStyle = {
            [mxConstants.STYLE_SHAPE]: mxConstants.SHAPE_SWIMLANE,
            [mxConstants.STYLE_PERIMETER]: mxPerimeter.RectanglePerimeter,
            [mxConstants.STYLE_ROUNDED]: true,
            [mxConstants.STYLE_STROKEWIDTH]: 2,
            [mxConstants.STYLE_FILLCOLOR]: '#e3f2fd',
            [mxConstants.STYLE_STROKECOLOR]: '#3498db',
            [mxConstants.STYLE_FONTSIZE]: 14,
            [mxConstants.STYLE_FONTFAMILY]: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            [mxConstants.STYLE_FONTCOLOR]: '#1976d2',
            [mxConstants.STYLE_FONTSTYLE]: mxConstants.FONT_BOLD,
            [mxConstants.STYLE_STARTSIZE]: 40,
            [mxConstants.STYLE_WHITE_SPACE]: 'wrap',
            [mxConstants.STYLE_OVERFLOW]: 'width',
            [mxConstants.STYLE_COLLAPSIBLE]: 1,
            [mxConstants.STYLE_RESIZABLE]: 1
        };
        stylesheet.putCellStyle('loopContainer', loopContainerStyle);

        // 条件判断菱形样式（和设计器相同）
        const conditionStyle = {
            ...baseNodeStyle,
            [mxConstants.STYLE_SHAPE]: mxConstants.SHAPE_RHOMBUS,
            [mxConstants.STYLE_PERIMETER]: mxPerimeter.RhombusPerimeter,
            [mxConstants.STYLE_FILLCOLOR]: '#e67e22',
            [mxConstants.STYLE_STROKECOLOR]: '#e67e22'
        };
        stylesheet.putCellStyle('condition', conditionStyle);

        // 连接线样式（和设计器相同）
        const edgeStyle = stylesheet.getDefaultEdgeStyle();
        edgeStyle[mxConstants.STYLE_ROUNDED] = true;
        edgeStyle[mxConstants.STYLE_STROKEWIDTH] = 3;
        edgeStyle[mxConstants.STYLE_STROKECOLOR] = '#2196F3';
        edgeStyle[mxConstants.STYLE_EDGE] = window.mxEdgeStyle.OrthConnector;
        edgeStyle[mxConstants.STYLE_ENDARROW] = mxConstants.ARROW_CLASSIC;
        edgeStyle[mxConstants.STYLE_ENDFILL] = 1;
        edgeStyle[mxConstants.STYLE_ENDSIZE] = 8;
        edgeStyle[mxConstants.STYLE_FONTSIZE] = 12;
        edgeStyle[mxConstants.STYLE_FONTCOLOR] = '#333333';
        edgeStyle[mxConstants.STYLE_FONTFAMILY] = 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
        edgeStyle[mxConstants.STYLE_LABEL_BACKGROUNDCOLOR] = '#ffffff';
        edgeStyle[mxConstants.STYLE_LABEL_BORDERCOLOR] = '#cccccc';

        console.log('✅ 预览样式设置完成（使用设计器样式）');
    } catch (error) {
        console.error('设置预览样式失败:', error);
    }
}

// 在预览中渲染工作流 - 使用和设计器相同的逻辑
function renderWorkflowInPreview(graph, workflow) {
    console.log('🏗️ renderWorkflowInPreview 开始，工作流:', workflow);

    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
        console.warn('⚠️ 工作流数据无效，无法渲染');
        return;
    }

    console.log('📊 准备渲染 ' + workflow.steps.length + ' 个步骤');

    try {
        // 使用和设计器相同的convertWorkflowToGraph函数
        if (typeof window.convertWorkflowToGraph === 'function') {
            console.log('✅ 使用设计器的convertWorkflowToGraph函数');
            window.convertWorkflowToGraph(graph, workflow);
            console.log('✅ 工作流渲染完成');
        } else {
            console.warn('⚠️ convertWorkflowToGraph函数不可用，使用简化版本');
            renderWorkflowInPreviewSimple(graph, workflow);
        }
    } catch (error) {
        console.error('❌ 渲染工作流失败:', error);
        // 降级到简化版本
        renderWorkflowInPreviewSimple(graph, workflow);
    }
}

// 简化版本的工作流渲染（备用）
function renderWorkflowInPreviewSimple(graph, workflow) {
    console.log('🔄 使用简化版本渲染工作流');

    const model = graph.getModel();
    const parent = graph.getDefaultParent();

    model.beginUpdate();
    try {
        const nodes = [];
        const nodeSpacing = 100;
        const startX = 50;
        const startY = 50;

        // 创建节点
        workflow.steps.forEach((step, index) => {
            const x = step.x || startX;
            const y = step.y || (startY + index * nodeSpacing);
            const width = step.width || 120;
            const height = step.height || 60;

            const label = step.name || step.type || '未命名步骤';
            console.log(`🔷 创建节点 ${index}: ${label} 位置(${x}, ${y})`);

            const vertex = graph.insertVertex(parent, null, label, x, y, width, height);
            nodes.push(vertex);
        });

        // 创建连接线
        console.log('🔗 开始创建连接线...');
        for (let i = 0; i < nodes.length - 1; i++) {
            const edge = graph.insertEdge(parent, null, '', nodes[i], nodes[i + 1]);
            console.log(`🔗 连接线 ${i} -> ${i + 1} 创建成功`);
        }

        console.log('✅ 简化版本渲染完成');

    } catch (error) {
        console.error('❌ 简化版本渲染失败:', error);
    } finally {
        model.endUpdate();
    }
}

// 绘制简单流程图
function drawSimpleFlowChart(ctx, steps) {
    const nodeWidth = 140;
    const nodeHeight = 70;
    const nodeSpacing = 50;
    const startX = 30;
    const startY = 30;

    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    steps.forEach((step, index) => {
        const x = startX;
        const y = startY + index * (nodeHeight + nodeSpacing);

        // 根据步骤类型设置不同颜色
        let fillColor = '#e3f2fd';
        let strokeColor = '#2196F3';

        if (step.type) {
            switch (step.type) {
                case 'click':
                    fillColor = '#e8f5e8';
                    strokeColor = '#4caf50';
                    break;
                case 'input':
                    fillColor = '#fff3e0';
                    strokeColor = '#ff9800';
                    break;
                case 'condition':
                    fillColor = '#fce4ec';
                    strokeColor = '#e91e63';
                    break;
                case 'wait':
                    fillColor = '#f3e5f5';
                    strokeColor = '#9c27b0';
                    break;
                default:
                    fillColor = '#e3f2fd';
                    strokeColor = '#2196F3';
            }
        }

        // 绘制节点背景（圆角矩形）
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;

        // 绘制圆角矩形
        const radius = 8;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + nodeWidth - radius, y);
        ctx.quadraticCurveTo(x + nodeWidth, y, x + nodeWidth, y + radius);
        ctx.lineTo(x + nodeWidth, y + nodeHeight - radius);
        ctx.quadraticCurveTo(x + nodeWidth, y + nodeHeight, x + nodeWidth - radius, y + nodeHeight);
        ctx.lineTo(x + radius, y + nodeHeight);
        ctx.quadraticCurveTo(x, y + nodeHeight, x, y + nodeHeight - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 绘制节点文本
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px Arial';

        // 主标题
        const title = step.name || step.type || `步骤 ${index + 1}`;
        ctx.fillText(title, x + nodeWidth / 2, y + nodeHeight / 2 - 8);

        // 副标题（步骤类型）
        if (step.name && step.type) {
            ctx.font = '10px Arial';
            ctx.fillStyle = '#666';
            ctx.fillText(`(${step.type})`, x + nodeWidth / 2, y + nodeHeight / 2 + 8);
        }

        // 绘制连接线（除了最后一个节点）
        if (index < steps.length - 1) {
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + nodeWidth / 2, y + nodeHeight);
            ctx.lineTo(x + nodeWidth / 2, y + nodeHeight + nodeSpacing);
            ctx.stroke();

            // 绘制箭头
            const arrowY = y + nodeHeight + nodeSpacing - 8;
            ctx.fillStyle = '#666';
            ctx.beginPath();
            ctx.moveTo(x + nodeWidth / 2, arrowY);
            ctx.lineTo(x + nodeWidth / 2 - 6, arrowY - 8);
            ctx.lineTo(x + nodeWidth / 2 + 6, arrowY - 8);
            ctx.closePath();
            ctx.fill();
        }
    });

    // 绘制标题
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.fillText(`工作流预览 (${steps.length} 个步骤)`, 10, 20);
}

// 清除执行状态
function clearExecutionStatus() {
    updateExecutionStatus('idle', '等待执行...');
    console.log('执行状态已清除');
}

// 新建工作流
function newWorkflow() {
    const name = prompt('请输入工作流名称:', '新建工作流');
    if (name && name.trim()) {
        try {
            if (typeof workflowManager !== 'undefined') {
                currentWorkflow = workflowManager.createWorkflow(name.trim());
                updateWorkflowInfo();
                renderSteps();
                saveCurrentWorkflowState();
                showStatus('工作流创建成功', 'success');
            } else {
                console.error('workflowManager 未定义');
            }
        } catch (error) {
            showStatus(`创建工作流失败: ${error.message}`, 'error');
        }
    }
}

// 加载工作流
function loadWorkflow() {
    const workflowList = workflowManager.getWorkflowList();
    if (workflowList.length === 0) {
        showStatus('没有保存的工作流', 'info');
        return;
    }

    let options = workflowList.map((wf, index) => 
        `${index + 1}. ${wf.name} (${wf.stepCount}个步骤)`
    ).join('\n');
    
    const choice = prompt(`选择要加载的工作流:\n${options}\n\n请输入序号:`);
    const index = parseInt(choice) - 1;
    
    if (index >= 0 && index < workflowList.length) {
        const workflowId = workflowList[index].id;
        try {
            currentWorkflow = workflowManager.loadFromStorage(workflowId);
            updateWorkflowInfo();
            renderSteps();
            // 保存当前工作流状态
            saveCurrentWorkflowState();
            showStatus('工作流加载成功', 'success');
        } catch (error) {
            showStatus(`加载工作流失败: ${error.message}`, 'error');
        }
    }
}

// 保存工作流
function saveWorkflow() {
    if (!currentWorkflow) {
        showStatus('没有工作流可保存', 'error');
        return;
    }

    try {
        workflowManager.saveToStorage(currentWorkflow.id);
        // 同时更新当前工作流状态
        saveCurrentWorkflowState();
        showStatus('工作流保存成功', 'success');
    } catch (error) {
        showStatus(`保存工作流失败: ${error.message}`, 'error');
    }
}

// 清除当前工作流
function clearWorkflow() {
    if (currentWorkflow && currentWorkflow.steps.length > 0) {
        if (confirm('确定要清除当前工作流吗？未保存的更改将丢失。')) {
            clearCurrentWorkflowState();
            showStatus('工作流已清除', 'info');
        }
    } else {
        clearCurrentWorkflowState();
        showStatus('工作流已清除', 'info');
    }
}

// ==================== 执行控制功能 ====================

// 执行状态管理
let executionState = {
    isRunning: false,
    isPaused: false,
    startTime: null,
    totalSteps: 0,
    completedSteps: 0,
    currentMainLoop: 0,
    totalMainLoops: 0,
    currentSubOperation: 0,
    totalSubOperations: 0,
    currentOperation: '等待执行...'
};

// 执行工作流
async function executeWorkflow() {
    if (!currentWorkflow || currentWorkflow.steps.length === 0) {
        showStatus('请先选择一个配置并确保包含步骤', 'warning');
        return;
    }

    console.log('🚀 开始执行工作流:', currentWorkflow.name);

    try {
        // 获取当前活动标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            showStatus('无法获取当前标签页', 'error');
            return;
        }

        // 更新执行状态
        executionState.isRunning = true;
        executionState.isPaused = false;
        executionState.startTime = Date.now();
        executionState.totalSteps = currentWorkflow.steps.length;
        executionState.completedSteps = 0;

        // 更新UI状态
        updateExecutionUI();
        updateExecutionStatus('executing', '正在执行工作流...');

        // 发送消息到content script执行
        chrome.tabs.sendMessage(tab.id, {
            action: 'executeWorkflow',
            workflow: currentWorkflow
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('执行失败:', chrome.runtime.lastError);
                resetExecutionState();
                showStatus(`执行失败: ${chrome.runtime.lastError.message}`, 'error');
            } else if (response && response.success) {
                resetExecutionState();
                showStatus('工作流执行完成', 'success');
            } else {
                resetExecutionState();
                showStatus(`执行失败: ${response?.error || '未知错误'}`, 'error');
            }
        });

    } catch (error) {
        console.error('执行工作流失败:', error);
        showStatus(`执行工作流失败: ${error.message}`, 'error');
        resetExecutionState();
    }
}

// 暂停/继续执行
async function togglePauseResume() {
    console.log('🔧 [DEBUG] togglePauseResume 被调用，当前状态:', {
        isRunning: executionState.isRunning,
        isPaused: executionState.isPaused
    });

    if (!executionState.isRunning) {
        console.log('🔧 [DEBUG] 工作流未运行，忽略暂停/继续操作');
        return;
    }

    try {
        // 获取当前活动标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            showStatus('无法获取当前标签页', 'error');
            return;
        }

        if (executionState.isPaused) {
            // 继续执行
            console.log('🔧 [DEBUG] 发送继续执行消息');
            executionState.isPaused = false;
            updateExecutionUI();
            updateExecutionStatus('executing', '继续执行中...');

            chrome.tabs.sendMessage(tab.id, {
                action: 'resumeExecution'
            });
        } else {
            // 暂停执行
            console.log('🔧 [DEBUG] 发送暂停执行消息');
            executionState.isPaused = true;
            updateExecutionUI();
            updateExecutionStatus('warning', '执行已暂停');

            chrome.tabs.sendMessage(tab.id, {
                action: 'pauseExecution'
            });
        }
    } catch (error) {
        console.error('暂停/继续操作失败:', error);
        showStatus(`操作失败: ${error.message}`, 'error');
    }
}

// 停止执行
async function stopExecution() {
    console.log('🔧 [DEBUG] stopExecution 被调用');

    if (!executionState.isRunning) {
        console.log('🔧 [DEBUG] 工作流未运行，忽略停止操作');
        return;
    }

    try {
        // 获取当前活动标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            showStatus('无法获取当前标签页', 'error');
            return;
        }

        console.log('🔧 [DEBUG] 发送停止执行消息');
        chrome.tabs.sendMessage(tab.id, {
            action: 'stopExecution'
        });

        // 重置执行状态
        resetExecutionState();
        showStatus('执行已停止', 'warning');

    } catch (error) {
        console.error('停止执行失败:', error);
        showStatus(`停止失败: ${error.message}`, 'error');
        resetExecutionState();
    }
}

// 重置执行状态
function resetExecutionState() {
    console.log('🔧 [DEBUG] 重置执行状态');

    executionState.isRunning = false;
    executionState.isPaused = false;
    executionState.startTime = null;
    executionState.totalSteps = 0;
    executionState.completedSteps = 0;
    executionState.currentMainLoop = 0;
    executionState.totalMainLoops = 0;
    executionState.currentSubOperation = 0;
    executionState.totalSubOperations = 0;
    executionState.currentOperation = '等待执行...';

    // 更新UI
    updateExecutionUI();
    updateExecutionStatus('idle', '等待执行...');
}

// 更新执行UI状态
function updateExecutionUI() {
    const executeBtn = document.getElementById('executeBtn');
    const executionControls = document.getElementById('executionControls');
    const pauseResumeBtn = document.getElementById('pauseResumeBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (executionState.isRunning) {
        // 执行中状态
        executeBtn.style.display = 'none';
        executionControls.style.display = 'flex';

        if (executionState.isPaused) {
            // 暂停状态
            pauseResumeBtn.innerHTML = '<span class="icon">▶️</span> 继续';
            pauseResumeBtn.className = 'btn btn-success';
        } else {
            // 运行状态
            pauseResumeBtn.innerHTML = '<span class="icon">⏸️</span> 暂停';
            pauseResumeBtn.className = 'btn btn-warning';
        }
    } else {
        // 空闲状态
        executeBtn.style.display = 'block';
        executionControls.style.display = 'none';
    }
}

// 添加步骤
function addStep(stepType) {
    if (!currentWorkflow) {
        newWorkflow();
        if (!currentWorkflow) return;
    }

    try {
        const step = createStepByType(stepType);
        const addedStep = workflowManager.addStep(currentWorkflow.id, step);
        renderSteps();
        updateWorkflowInfo();
        // 保存当前工作流状态
        saveCurrentWorkflowState();
        showStatus(`已添加${getStepTypeName(stepType)}步骤`, 'success');

        // 自动打开编辑模态框
        editStep(addedStep.id);
    } catch (error) {
        showStatus(`添加步骤失败: ${error.message}`, 'error');
        console.error('添加步骤详细错误:', error);
    }
}

// 根据类型创建步骤
function createStepByType(type) {
    const baseStep = {
        type: type,
        name: getStepTypeName(type),
        errorHandling: 'continue'
    };

    switch (type) {
        case 'click':
            return {
                ...baseStep,
                locator: { strategy: 'css', value: '' }
            };
        case 'input':
            return {
                ...baseStep,
                locator: { strategy: 'css', value: '' },
                text: '',
                clearFirst: true
            };
        case 'wait':
            return {
                ...baseStep,
                duration: 1000
            };
        case 'smartWait':
            return {
                ...baseStep,
                locator: { strategy: 'css', value: '' },
                timeout: 30000,
                interval: 500,
                description: '等待元素出现'
            };
        case 'loop':
            return {
                ...baseStep,
                locator: { strategy: 'css', value: '' },
                loopType: 'parentLoop', // 默认为父级循环
                startIndex: 0,
                endIndex: -1,
                skipIndices: [],
                subOperations: [], // 父级循环的子操作
                waitAfterClick: 1000, // 点击后等待时间
                loopDelay: 500,
                errorHandling: 'continue', // 错误处理策略
                // 简单循环专用属性
                actionType: 'click', // click, input, check, uncheck
                inputText: '', // 当actionType为input时使用
                actionDelay: 200 // 简单循环操作间隔
            };

        default:
            return baseStep;
    }
}

// 获取步骤类型名称
function getStepTypeName(type) {
    const names = {
        'click': '点击操作',
        'input': '输入文本',
        'wait': '等待时间',
        'smartWait': '智能等待',
        'loop': '循环操作',
        'checkState': '检测状态'
    };
    return names[type] || type;
}

// UI渲染函数在 utils/uiRenderer.js 中定义
// updateWorkflowInfo(), renderSteps() 等函数已模块化

// UI元素创建和步骤详情函数在 utils/uiRenderer.js 中定义
// createStepElement(), getStepDetails() 等函数已模块化

// 步骤编辑函数在 utils/stepEditor.js 中定义
// editStep() 函数已模块化

// 步骤测试和删除函数在 utils/stepEditor.js 中定义
// testStep(), deleteStep() 函数已模块化

// 显示步骤编辑模态框
function showStepModal(step) {
    const modal = document.getElementById('stepModal');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');

    console.log('🔍 显示步骤编辑模态框:', step.name);

    // 设置当前编辑的步骤
    editingStep = step;
    console.log('🔧 设置editingStep:', editingStep.name);

    // 确保父级按钮可见并恢复正确的文本和功能
    const saveStepBtn = document.getElementById('saveStepBtn');
    const cancelStepBtn = document.getElementById('cancelStepBtn');
    const buttonContainer = saveStepBtn ? saveStepBtn.parentElement : null;

    if (buttonContainer) {
        buttonContainer.style.display = 'flex';
        console.log('🔧 确保父级按钮容器可见');
    }

    // 只有在非子操作编辑模式下才恢复父级按钮功能
    if (!isEditingSubOperation) {
        // 恢复父级按钮的正确文本和功能（可能被子操作修改了）
        if (saveStepBtn) {
            if (saveStepBtn.textContent !== '保存') {
                saveStepBtn.textContent = '保存';
                console.log('🔧 恢复保存按钮文本');
            }
            // 重新绑定父级保存功能
            saveStepBtn.onclick = saveStepChanges;
            console.log('🔧 重新绑定父级保存功能');
        }
        if (cancelStepBtn) {
            if (cancelStepBtn.textContent !== '取消') {
                cancelStepBtn.textContent = '取消';
                console.log('🔧 恢复取消按钮文本');
            }
            // 重新绑定父级取消功能
            cancelStepBtn.onclick = closeStepModal;
            console.log('🔧 重新绑定父级取消功能');
        }
    } else {
        console.log('🔧 子操作编辑模式：跳过按钮重新绑定');
    }

    // 验证步骤数据完整性
    validateStepData(step);

    if (step.type === 'loop') {
        console.log('🔍 循环步骤完整数据:', {
            name: step.name,
            type: step.type,
            loopType: step.loopType,
            locator: step.locator,
            subOperations: step.subOperations,
            subOperationsCount: step.subOperations?.length || 0,
            startIndex: step.startIndex,
            endIndex: step.endIndex
        });
    }

    title.textContent = `编辑 ${step.name}`;
    content.innerHTML = generateStepEditHTML(step);

    // 为循环类型添加事件监听器
    if (step.type === 'loop') {
        setupLoopTypeHandlers();
        setupSubOperationHandlers();
    }

    // 设置定位器测试监听器
    setupLocatorTestListeners();

    modal.style.display = 'block';
}

// 设置循环类型处理器
function setupLoopTypeHandlers() {
    const loopTypeSelect = document.getElementById('editLoopType');
    const actionTypeSelect = document.getElementById('editActionType');

    if (loopTypeSelect) {
        loopTypeSelect.addEventListener('change', function() {
            const loopType = this.value;
            const simpleConfig = document.getElementById('simpleLoopConfig');
            const parentConfig = document.getElementById('parentLoopConfig');

            if (loopType === 'simpleLoop') {
                simpleConfig.style.display = 'block';
                parentConfig.style.display = 'none';
            } else {
                simpleConfig.style.display = 'none';
                parentConfig.style.display = 'block';
            }
        });
    }

    if (actionTypeSelect) {
        actionTypeSelect.addEventListener('change', function() {
            const actionType = this.value;
            const inputTextGroup = document.getElementById('inputTextGroup');

            if (actionType === 'input') {
                inputTextGroup.style.display = 'block';
            } else {
                inputTextGroup.style.display = 'none';
            }
        });
    }
}

// 设置子操作处理器
function setupSubOperationHandlers() {
    // 添加子操作按钮
    const addBtn = document.getElementById('addSubOperationBtn');
    if (addBtn) {
        addBtn.addEventListener('click', addSubOperation);
    }

    // 子操作编辑和删除按钮（使用事件委托）
    const container = document.getElementById('subOperationsList');
    if (container) {
        container.addEventListener('click', function(e) {
            if (e.target.classList.contains('edit-sub-op')) {
                const index = parseInt(e.target.dataset.index);
                editSubOperation(index);
            } else if (e.target.classList.contains('remove-sub-op')) {
                const index = parseInt(e.target.dataset.index);
                removeSubOperation(index);
            }
        });
    }
}

// 关闭步骤编辑模态框
function closeStepModal() {
    document.getElementById('stepModal').style.display = 'none';
    editingStep = null;
    // 关闭模态框时清除测试高亮
    clearTestHighlights();
}

// 关闭模态框但保持editingStep数据（用于子操作编辑流程）
function hideStepModal() {
    document.getElementById('stepModal').style.display = 'none';
    // 不清空editingStep，保持数据状态
    // 隐藏模态框时也清除测试高亮
    clearTestHighlights();
}

// 生成步骤编辑HTML
function generateStepEditHTML(step) {
    let html = `
        <div class="form-group">
            <label>步骤名称</label>
            <input type="text" id="editStepName" value="${escapeHtmlAttribute(step.name)}" placeholder="输入步骤名称">
        </div>
    `;

    // 根据步骤类型添加特定配置
    switch (step.type) {
        case 'click':
        case 'input':
        case 'smartWait':

            html += `
                <div class="form-group">
                    <label>定位策略</label>
                    <select id="editLocatorStrategy">
                        <option value="css" ${step.locator?.strategy === 'css' ? 'selected' : ''}>CSS选择器 [示例: .btn-primary, #submit-btn]</option>
                        <option value="xpath" ${step.locator?.strategy === 'xpath' ? 'selected' : ''}>XPath表达式 [示例: //div[@class='container']//button]</option>
                        <option value="id" ${step.locator?.strategy === 'id' ? 'selected' : ''}>ID选择器 [示例: submit-btn]</option>
                        <option value="tagName" ${step.locator?.strategy === 'tagName' ? 'selected' : ''}>标签名选择器 [示例: button, input]</option>
                        <option value="text" ${step.locator?.strategy === 'text' ? 'selected' : ''}>精确文本匹配 [示例: 提交表单]</option>
                        <option value="contains" ${step.locator?.strategy === 'contains' ? 'selected' : ''}>包含文本匹配 [示例: 提交]</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>定位值</label>
                    <div class="input-with-test">
                        <input type="text" id="editLocatorValue" value="${escapeHtmlAttribute(step.locator?.value || '')}" placeholder="输入定位值">
                        <button type="button" class="test-locator-btn" id="testMainLocatorBtn">🔍测试</button>
                    </div>
                    <div id="mainLocatorTestResult" class="test-result"></div>
                    <div class="help-text">用于定位页面元素的值</div>
                </div>
            `;
            break;
        case 'loop':
            html += `
                <div class="form-group">
                    <label>循环类型</label>
                    <select id="editLoopType">
                        <option value="parentLoop" ${step.loopType === 'parentLoop' ? 'selected' : ''}>父级循环（带子操作）</option>
                        <option value="simpleLoop" ${step.loopType === 'simpleLoop' ? 'selected' : ''}>简单循环（单一操作）</option>
                    </select>
                    <div class="help-text">选择循环类型：父级循环用于复杂的多步骤操作，简单循环用于对多个元素执行相同操作</div>
                </div>
                <div class="form-group">
                    <label>定位策略</label>
                    <select id="editLoopLocatorStrategy">
                        <option value="css" ${(step.locator && step.locator.strategy === 'css') ? 'selected' : ''}>CSS选择器 [示例: .btn-primary, #submit-btn]</option>
                        <option value="xpath" ${(step.locator && step.locator.strategy === 'xpath') ? 'selected' : ''}>XPath表达式 [示例: //div[@class='container']//button]</option>
                        <option value="id" ${(step.locator && step.locator.strategy === 'id') ? 'selected' : ''}>ID选择器 [示例: submit-btn]</option>
                        <option value="className" ${(step.locator && step.locator.strategy === 'className') ? 'selected' : ''}>类名选择器 [示例: btn-primary]</option>
                        <option value="tagName" ${(step.locator && step.locator.strategy === 'tagName') ? 'selected' : ''}>标签名选择器 [示例: button, input]</option>
                        <option value="text" ${(step.locator && step.locator.strategy === 'text') ? 'selected' : ''}>精确文本匹配 [示例: 提交表单]</option>
                        <option value="contains" ${(step.locator && step.locator.strategy === 'contains') ? 'selected' : ''}>包含文本匹配 [示例: 提交]</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>定位值</label>
                    <div class="input-with-test">
                        <input type="text" id="editLoopLocatorValue" value="${escapeHtmlAttribute((step.locator && step.locator.value) ? step.locator.value : '')}" placeholder="输入定位值">
                        <button type="button" class="test-locator-btn" id="testLoopLocatorBtn">🔍测试</button>
                    </div>
                    <div id="loopLocatorTestResult" class="test-result"></div>
                    <div class="help-text">用于定位页面元素的值</div>
                </div>
                <div class="form-group">
                    <label>起始索引</label>
                    <input type="number" id="editLoopStartIndex" value="${step.startIndex || 0}" min="0">
                </div>
                <div class="form-group">
                    <label>结束索引</label>
                    <input type="number" id="editLoopEndIndex" value="${step.endIndex || -1}" min="-1">
                    <div class="help-text">-1 表示处理所有元素</div>
                </div>
                <div id="simpleLoopConfig" style="display: ${step.loopType === 'simpleLoop' ? 'block' : 'none'};">
                    <div class="form-group">
                        <label>操作类型</label>
                        <select id="editActionType">
                            <option value="click" ${step.actionType === 'click' ? 'selected' : ''}>点击</option>
                            <option value="input" ${step.actionType === 'input' ? 'selected' : ''}>输入文本</option>
                            <option value="check" ${step.actionType === 'check' ? 'selected' : ''}>勾选复选框</option>
                            <option value="uncheck" ${step.actionType === 'uncheck' ? 'selected' : ''}>取消勾选</option>
                        </select>
                    </div>
                    <div class="form-group" id="inputTextGroup" style="display: ${step.actionType === 'input' ? 'block' : 'none'};">
                        <label>输入文本</label>
                        <input type="text" id="editInputText" value="${escapeHtmlAttribute(step.inputText || '')}" placeholder="要输入的文本">
                    </div>
                    <div class="form-group">
                        <label>操作间隔(毫秒)</label>
                        <input type="number" id="editActionDelay" value="${step.actionDelay || 200}" min="0">
                    </div>
                </div>
                <div id="parentLoopConfig" style="display: ${step.loopType === 'parentLoop' ? 'block' : 'none'};">
                    <div class="form-group">
                        <label>点击后等待时间(毫秒)</label>
                        <input type="number" id="editWaitAfterClick" value="${step.waitAfterClick || 1000}" min="0">
                        <div class="help-text">点击父级元素后等待页面加载的时间</div>
                    </div>
                    <div class="form-group">
                        <label>循环间隔(毫秒)</label>
                        <input type="number" id="editLoopDelay" value="${step.loopDelay || 500}" min="0">
                    </div>
                    <div class="form-group">
                        <label>子操作配置</label>
                        <div id="subOperationsList">
                            ${renderSubOperationsList(step.subOperations || [])}
                        </div>
                        <button type="button" class="btn-secondary" id="addSubOperationBtn">+ 添加子操作</button>
                        <div class="help-text">配置在每个父级元素上执行的操作序列</div>
                    </div>
                    <div class="form-group">
                        <label>错误处理</label>
                        <select id="editErrorHandling">
                            <option value="continue" ${step.errorHandling === 'continue' ? 'selected' : ''}>跳过错误继续</option>
                            <option value="stop" ${step.errorHandling === 'stop' ? 'selected' : ''}>遇到错误停止</option>
                        </select>
                    </div>
                </div>
            `;
            break;

    }

    // 添加类型特定配置
    switch (step.type) {
        case 'input':
            html += `
                <div class="form-group">
                    <label>输入文本</label>
                    <input type="text" id="editInputText" value="${escapeHtmlAttribute(step.text || '')}" placeholder="要输入的文本">
                </div>
            `;
            break;
        case 'wait':
            html += `
                <div class="form-group">
                    <label>等待时间(毫秒)</label>
                    <input type="number" id="editWaitDuration" value="${step.duration || 1000}" min="100" max="60000">
                </div>
            `;
            break;
        case 'smartWait':
            html += `
                <div class="form-group">
                    <label>超时时间(毫秒)</label>
                    <input type="number" id="editSmartWaitTimeout" value="${step.timeout || 30000}" min="1000" max="60000">
                </div>
                <div class="form-group">
                    <label>等待描述</label>
                    <input type="text" id="editSmartWaitDescription" value="${escapeHtmlAttribute(step.description || '')}" placeholder="等待的描述">
                </div>
            `;
            break;

    }

    return html;
}

// 保存步骤修改
function saveStepChanges() {
    if (!editingStep) return;

    try {
        const updates = {
            name: document.getElementById('editStepName')?.value || editingStep.name
        };

        // 更新定位器 - 支持不同类型的定位器ID
        let strategyElement = document.getElementById('editLocatorStrategy');
        let valueElement = document.getElementById('editLocatorValue');

        // 如果是循环操作，使用循环专用的定位器ID
        if (!strategyElement || !valueElement) {
            strategyElement = document.getElementById('editLoopLocatorStrategy');
            valueElement = document.getElementById('editLoopLocatorValue');
        }

        if (strategyElement && valueElement) {
            updates.locator = {
                strategy: strategyElement.value,
                value: valueElement.value
            };
        }

        // 更新类型特定属性
        switch (editingStep.type) {
            case 'input':
                const textElement = document.getElementById('editInputText');
                if (textElement) updates.text = textElement.value;
                break;
            case 'wait':
                const durationElement = document.getElementById('editWaitDuration');
                if (durationElement) updates.duration = parseInt(durationElement.value);
                break;
            case 'smartWait':
                const timeoutElement = document.getElementById('editSmartWaitTimeout');
                const descElement = document.getElementById('editSmartWaitDescription');
                if (timeoutElement) updates.timeout = parseInt(timeoutElement.value);
                if (descElement) updates.description = descElement.value;
                break;

            case 'loop':
                console.log('🔍 开始保存循环步骤配置...');

                // 循环类型
                const loopTypeElement = document.getElementById('editLoopType');
                if (loopTypeElement) {
                    updates.loopType = loopTypeElement.value;
                    console.log('🔍 循环类型:', updates.loopType);
                }

                // 定位器配置已在上面的通用部分处理，这里不需要重复
                console.log('🔍 定位器配置:', updates.locator);

                // 循环范围
                const loopStartElement = document.getElementById('editLoopStartIndex');
                const loopEndElement = document.getElementById('editLoopEndIndex');
                if (loopStartElement) updates.startIndex = parseInt(loopStartElement.value);
                if (loopEndElement) updates.endIndex = parseInt(loopEndElement.value);
                console.log('🔍 循环范围:', updates.startIndex, 'to', updates.endIndex);

                // 简单循环配置
                if (updates.loopType === 'simpleLoop') {
                    const actionTypeElement = document.getElementById('editActionType');
                    const actionDelayElement = document.getElementById('editActionDelay');
                    const inputTextElement = document.getElementById('editInputText');

                    if (actionTypeElement) updates.actionType = actionTypeElement.value;
                    if (actionDelayElement) updates.actionDelay = parseInt(actionDelayElement.value);
                    if (inputTextElement && updates.actionType === 'input') {
                        updates.inputText = inputTextElement.value;
                    }
                    console.log('🔍 简单循环配置:', {
                        actionType: updates.actionType,
                        actionDelay: updates.actionDelay,
                        inputText: updates.inputText
                    });
                }

                // 父级循环配置
                if (updates.loopType === 'parentLoop') {
                    const waitAfterClickElement = document.getElementById('editWaitAfterClick');
                    const loopDelayElement = document.getElementById('editLoopDelay');
                    const errorHandlingElement = document.getElementById('editErrorHandling');

                    if (waitAfterClickElement) updates.waitAfterClick = parseInt(waitAfterClickElement.value);
                    if (loopDelayElement) updates.loopDelay = parseInt(loopDelayElement.value);
                    if (errorHandlingElement) updates.errorHandling = errorHandlingElement.value;

                    // 保存子操作配置（确保总是保存，即使是空数组）
                    updates.subOperations = editingStep.subOperations || [];
                    console.log('🔍 子操作配置:', updates.subOperations);

                    console.log('🔍 父级循环配置:', {
                        waitAfterClick: updates.waitAfterClick,
                        loopDelay: updates.loopDelay,
                        errorHandling: updates.errorHandling,
                        subOperationsCount: updates.subOperations?.length || 0
                    });
                }

                console.log('🔍 完整的循环更新数据:', updates);
                break;

        }

        // 应用更新到editingStep
        Object.assign(editingStep, updates);

        // 调试信息
        if (editingStep.type === 'loop') {
            console.log('🔍 保存循环步骤完整数据:', {
                name: editingStep.name,
                type: editingStep.type,
                loopType: editingStep.loopType,
                locator: editingStep.locator,
                subOperations: editingStep.subOperations,
                subOperationsCount: editingStep.subOperations?.length || 0
            });
        }

        workflowManager.updateStep(currentWorkflow.id, editingStep.id, updates);

        // 立即保存到localStorage
        try {
            workflowManager.saveToStorage(currentWorkflow.id);
            console.log('✅ 工作流已保存到localStorage');

            // 验证保存是否成功
            const savedData = localStorage.getItem(`workflow_${currentWorkflow.id}`);
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                const savedStep = workflowManager.findStepById(parsedData, editingStep.id);
                if (savedStep) {
                    console.log('✅ 验证：步骤已正确保存到localStorage:', {
                        stepId: savedStep.id,
                        stepName: savedStep.name,
                        stepType: savedStep.type,
                        locator: savedStep.locator,
                        loopType: savedStep.loopType,
                        subOperations: savedStep.subOperations,
                        subOperationsCount: savedStep.subOperations?.length || 0
                    });
                } else {
                    console.error('❌ 验证失败：在保存的数据中找不到步骤');
                }
            } else {
                console.error('❌ 验证失败：localStorage中没有找到工作流数据');
            }
        } catch (error) {
            console.error('❌ 保存工作流到localStorage失败:', error);
        }

        renderSteps();

        // 检查是否在子操作编辑模式下
        const saveStepBtn = document.getElementById('saveStepBtn');
        const isSubOperationMode = saveStepBtn && saveStepBtn.textContent === '保存子操作';

        if (isSubOperationMode) {
            // 子操作编辑模式：不关闭模态框，不清空editingStep
            console.log('🔧 子操作编辑模式：保持模态框打开');
            hideStepModal(); // 只隐藏，不清空数据
        } else {
            // 正常模式：关闭模态框并清空editingStep
            closeStepModal();
        }

        // 保存当前工作流状态
        saveCurrentWorkflowState();
        showStatus('步骤更新成功', 'success');
    } catch (error) {
        showStatus(`更新步骤失败: ${error.message}`, 'error');
    }
}

// 显示状态消息
function showStatus(message, type) {
    // 使用新的执行状态显示
    const statusMap = {
        'success': 'success',
        'error': 'error',
        'warning': 'warning',
        'info': 'idle'
    };

    const status = statusMap[type] || 'idle';
    updateExecutionStatus(status, message);

    // 如果是成功、错误或警告消息，3秒后恢复到空闲状态
    if (type !== 'info') {
        setTimeout(() => {
            updateExecutionStatus('idle', '等待执行...');
        }, 3000);
    }
}

// 重复的loadSavedWorkflows函数已移除，使用上面的统一版本

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    console.log('🔧 [DEBUG] 插件面板收到消息:', message);

    if (message.action === 'executionProgress') {
        updateProgress(message.data);
    } else if (message.action === 'executionComplete') {
        onExecutionComplete(message.data);
    } else if (message.action === 'executionError') {
        onExecutionError(message.data);
    } else if (message.action === 'executionPaused') {
        executionState.isPaused = true;
        updateExecutionUI();
        updateExecutionStatus('warning', '执行已暂停');
    } else if (message.action === 'executionResumed') {
        executionState.isPaused = false;
        updateExecutionUI();
        updateExecutionStatus('executing', '继续执行中...');
    } else if (message.action === 'executionStopped') {
        resetExecutionState();
        showStatus('执行已停止', 'warning');
    }
});

// 更新执行进度
function updateProgress(progressData) {
    console.log('📊 更新进度:', progressData);

    if (progressData.isRunning !== undefined) {
        executionState.isRunning = progressData.isRunning;
    }
    if (progressData.isPaused !== undefined) {
        executionState.isPaused = progressData.isPaused;
    }
    if (progressData.totalSteps !== undefined) {
        executionState.totalSteps = progressData.totalSteps;
    }
    if (progressData.completedSteps !== undefined) {
        executionState.completedSteps = progressData.completedSteps;
    }
    if (progressData.currentOperation !== undefined) {
        executionState.currentOperation = progressData.currentOperation;
    }
    if (progressData.currentMainLoop !== undefined) {
        executionState.currentMainLoop = progressData.currentMainLoop;
    }
    if (progressData.totalMainLoops !== undefined) {
        executionState.totalMainLoops = progressData.totalMainLoops;
    }

    // 更新UI显示
    updateExecutionUI();

    // 更新状态消息
    let statusMessage = progressData.currentOperation || '执行中...';
    if (progressData.totalSteps > 0) {
        statusMessage += ` (${progressData.completedSteps || 0}/${progressData.totalSteps})`;
    }

    const status = progressData.isPaused ? 'warning' : 'executing';
    updateExecutionStatus(status, statusMessage);
}

// 执行完成回调
function onExecutionComplete(stats) {
    console.log('🎉 执行完成:', stats);
    resetExecutionState();

    const successCount = stats.successCount || 0;
    const errorCount = stats.errorCount || 0;
    const message = `执行完成! 成功: ${successCount}, 失败: ${errorCount}`;

    showStatus(message, 'success');
}

// 执行错误回调
function onExecutionError(error) {
    console.error('❌ 执行错误:', error);
    resetExecutionState();

    const errorMessage = error.error || error.message || '未知错误';
    showStatus(`执行失败: ${errorMessage}`, 'error');
}

// 保存当前工作流状态到本地存储
function saveCurrentWorkflowState() {
    try {
        if (currentWorkflow) {
            // 保存当前工作流ID和完整数据
            localStorage.setItem('current_workflow_id', currentWorkflow.id);
            localStorage.setItem('current_workflow_data', JSON.stringify(currentWorkflow));
            console.log('✅ 当前工作流状态已保存:', currentWorkflow.name);
        } else {
            // 清除当前工作流状态
            localStorage.removeItem('current_workflow_id');
            localStorage.removeItem('current_workflow_data');
            console.log('🗑️ 当前工作流状态已清除');
        }
    } catch (error) {
        console.error('❌ 保存工作流状态失败:', error);
    }
}

// 加载上次的工作流状态
function loadLastWorkflowState() {
    try {
        const savedWorkflowData = localStorage.getItem('current_workflow_data');
        const savedWorkflowId = localStorage.getItem('current_workflow_id');

        console.log('🔍 尝试加载上次工作流状态...');
        console.log('🔍 保存的工作流ID:', savedWorkflowId);

        if (savedWorkflowData && savedWorkflowId) {
            // 恢复工作流数据
            currentWorkflow = JSON.parse(savedWorkflowData);

            console.log('🔍 恢复的工作流数据:', currentWorkflow);
            console.log('🔍 工作流步骤数量:', currentWorkflow.steps?.length || 0);

            // 检查循环步骤的配置
            currentWorkflow.steps?.forEach((step, index) => {
                if (step.type === 'loop') {
                    console.log(`🔍 加载的循环步骤 ${index + 1}:`, {
                        id: step.id,
                        name: step.name,
                        loopType: step.loopType,
                        locator: step.locator,
                        subOperations: step.subOperations,
                        subOperationsCount: step.subOperations?.length || 0
                    });

                    // 检查定位器
                    if (!step.locator || !step.locator.value) {
                        console.warn(`⚠️ 循环步骤 ${step.name} 缺少定位器配置`);
                    }

                    // 检查子操作
                    if (step.loopType === 'parentLoop' && (!step.subOperations || step.subOperations.length === 0)) {
                        console.warn(`⚠️ 父级循环步骤 ${step.name} 没有子操作`);
                    }
                }
            });

            // 验证工作流数据完整性
            if (currentWorkflow && currentWorkflow.id === savedWorkflowId) {
                // 修复数据结构不一致问题
                fixWorkflowDataStructure(currentWorkflow);

                // 确保工作流管理器中也有这个工作流
                try {
                    workflowManager.loadFromStorage(savedWorkflowId);
                } catch (error) {
                    // 如果存储中没有，则添加当前工作流
                    workflowManager.workflows.set(currentWorkflow.id, currentWorkflow);
                }

                updateWorkflowInfo();
                renderSteps();
                console.log('✅ 已恢复上次的工作流:', currentWorkflow.name);
                showStatus(`已恢复工作流: ${currentWorkflow.name}`, 'info');
            } else {
                console.log('⚠️ 工作流数据不完整，跳过恢复');
                clearCurrentWorkflowState();
            }
        } else {
            console.log('ℹ️ 没有找到上次的工作流状态');
            updateWorkflowInfo(); // 确保UI正确显示空状态
        }
    } catch (error) {
        console.error('❌ 加载工作流状态失败:', error);
        clearCurrentWorkflowState();
        showStatus('加载上次工作流失败，已重置', 'warning');
    }
}

// 清除当前工作流状态
function clearCurrentWorkflowState() {
    currentWorkflow = null;
    localStorage.removeItem('current_workflow_id');
    localStorage.removeItem('current_workflow_data');
    updateWorkflowInfo();
    renderSteps();
}

// 验证步骤数据完整性
function validateStepData(step) {
    if (!step) {
        console.error('❌ 步骤数据为null或undefined');
        return false;
    }

    // 检查基本属性
    if (!step.id) {
        console.warn('⚠️ 步骤缺少ID');
    }
    if (!step.name) {
        console.warn('⚠️ 步骤缺少名称');
    }
    if (!step.type) {
        console.warn('⚠️ 步骤缺少类型');
    }

    // 检查定位器
    if (['click', 'input', 'loop', 'smartWait'].includes(step.type)) {
        if (!step.locator) {
            console.warn('⚠️ 步骤缺少定位器对象');
        } else if (!step.locator.strategy || !step.locator.value) {
            console.warn('⚠️ 步骤定位器不完整:', step.locator);
        }
    }

    // 检查循环步骤特有属性
    if (step.type === 'loop') {
        if (!step.loopType) {
            console.warn('⚠️ 循环步骤缺少loopType');
        }
        if (step.loopType === 'parentLoop' && !step.subOperations) {
            console.warn('⚠️ 父级循环步骤缺少subOperations数组');
        }
    }

    return true;
}

// 修复工作流数据结构不一致问题
function fixWorkflowDataStructure(workflow) {
    if (!workflow || !workflow.steps) return;

    let hasChanges = false;

    workflow.steps.forEach(step => {
        if (step.type === 'loop') {
            // 修复旧的steps字段为subOperations
            if (step.steps && !step.subOperations) {
                step.subOperations = step.steps;
                delete step.steps;
                hasChanges = true;
                console.log('🔧 修复循环步骤：将steps字段重命名为subOperations');
            }

            // 确保subOperations存在
            if (!step.subOperations) {
                step.subOperations = [];
                hasChanges = true;
                console.log('🔧 修复循环步骤：添加缺失的subOperations数组');
            }

            // 确保errorHandling存在
            if (!step.errorHandling) {
                step.errorHandling = 'continue';
                hasChanges = true;
            }
        }
    });

    if (hasChanges) {
        console.log('✅ 工作流数据结构已修复');
        // 保存修复后的数据
        try {
            workflowManager.workflows.set(workflow.id, workflow);
            workflowManager.saveToStorage(workflow.id);
        } catch (error) {
            console.error('❌ 保存修复后的工作流失败:', error);
        }
    }
}

// 确保content script已加载
async function ensureContentScriptLoaded(tabId) {
    try {
        // 尝试ping content script
        const response = await sendMessageToTab(tabId, { action: 'ping' }, 2000);
        if (response && response.success) {
            console.log('Content script已就绪');
            return true;
        }
    } catch (error) {
        console.log('Content script未响应，尝试注入...');
    }

    // 如果ping失败，尝试注入content script
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content/content.js']
        });

        // 等待脚本加载
        await new Promise(resolve => setTimeout(resolve, 500));

        // 再次尝试ping
        const response = await sendMessageToTab(tabId, { action: 'ping' }, 2000);
        if (response && response.success) {
            console.log('Content script注入成功');
            return true;
        } else {
            throw new Error('Content script注入后仍无响应');
        }
    } catch (error) {
        console.error('注入content script失败:', error);
        throw new Error('无法加载content script，请刷新页面后重试');
    }
}

// 发送消息到标签页（带超时）
function sendMessageToTab(tabId, message, timeout = 3000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`消息发送超时（${timeout}ms）`));
        }, timeout);

        chrome.tabs.sendMessage(tabId, message, (response) => {
            clearTimeout(timeoutId);

            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}

// 重置自动化引擎
async function resetEngine() {
    try {
        showStatus('🔄 正在重置自动化引擎...', 'info');

        // 获取当前标签页
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        if (!tab) {
            throw new Error('无法获取当前标签页');
        }

        // 发送重置消息
        const response = await sendMessageToTab(tab.id, { action: 'resetEngine' }, 3000);

        if (response && response.success) {
            showStatus('✅ 自动化引擎已重置', 'success');
        } else {
            showStatus('⚠️ 重置引擎失败，请刷新页面', 'warning');
        }

    } catch (error) {
        console.error('重置引擎失败:', error);
        showStatus(`❌ 重置失败: ${error.message}`, 'error');
    }
}

// ==================== 子操作管理 ====================

// 渲染子操作列表
function renderSubOperationsList(subOperations) {
    if (!subOperations || subOperations.length === 0) {
        return '<div class="sub-operations-empty">暂无子操作，点击"添加子操作"开始配置</div>';
    }

    return subOperations.map((op, index) => `
        <div class="sub-operation-item" data-index="${index}">
            <div class="sub-operation-info">
                <span class="sub-operation-type">${getSubOperationTypeName(op.type)}</span>
                <span class="sub-operation-detail">${getSubOperationDetail(op)}</span>
            </div>
            <div class="sub-operation-actions">
                <button type="button" class="btn-small edit-sub-op" data-index="${index}">编辑</button>
                <button type="button" class="btn-small btn-danger remove-sub-op" data-index="${index}">删除</button>
            </div>
        </div>
    `).join('');
}

// 获取子操作类型名称
function getSubOperationTypeName(type) {
    const names = {
        'click': '点击',
        'input': '输入',
        'wait': '等待',
        'waitForElement': '等待元素',
        'check': '勾选',
        'select': '选择',
        'autoLoop': '自循环'
    };
    return names[type] || type;
}

// 获取子操作详情
function getSubOperationDetail(op) {
    if (!op) return '未配置';

    console.log('🔍 获取子操作详情:', op);

    switch (op.type) {
        case 'click':
        case 'check':
        case 'waitForElement':
            if (op.locator && op.locator.value) {
                return `${op.locator.strategy || 'css'}: ${op.locator.value}`;
            }
            return '未配置定位器';
        case 'input':
            const inputLocator = (op.locator && op.locator.value) ? op.locator.value : '未配置';
            const inputText = op.text || '';
            return `${inputLocator} = "${inputText}"`;
        case 'wait':
            return `等待 ${op.duration || 1000}ms`;
        case 'select':
            const selectLocator = (op.locator && op.locator.value) ? op.locator.value : '未配置';
            const selectValue = op.value || '';
            return `${selectLocator} = "${selectValue}"`;
        case 'autoLoop':
            const autoLoopLocator = (op.locator && op.locator.value) ? op.locator.value : '未配置';
            const autoLoopAction = op.actionType || 'click';
            const autoLoopRange = `[${op.startIndex || 0}-${op.endIndex === -1 ? '全部' : op.endIndex || 0}]`;
            return `${autoLoopLocator} (${autoLoopAction}) ${autoLoopRange}`;
        default:
            return `${op.type} 操作`;
    }
}

// 添加子操作
function addSubOperation() {
    const newOp = {
        type: 'click',
        name: '新子操作',
        locator: { strategy: 'css', value: '' }
    };

    if (!editingStep.subOperations) {
        editingStep.subOperations = [];
    }

    editingStep.subOperations.push(newOp);
    console.log('✅ 已添加子操作，当前子操作数量:', editingStep.subOperations.length);
    console.log('🔍 新添加的子操作:', newOp);
    updateSubOperationsList();
}

// 编辑子操作
function editSubOperation(index) {
    console.log('🔍 开始编辑子操作:', { index, editingStep: editingStep?.name });

    // 验证editingStep和子操作数据
    if (!editingStep) {
        console.error('❌ editingStep不存在');
        showStatus('编辑步骤数据丢失', 'error');
        return;
    }

    if (!editingStep.subOperations) {
        console.error('❌ subOperations数组不存在');
        showStatus('子操作数据丢失', 'error');
        return;
    }

    if (!editingStep.subOperations[index]) {
        console.error('❌ 指定索引的子操作不存在:', index);
        showStatus('子操作不存在', 'error');
        return;
    }

    const subOp = editingStep.subOperations[index];
    console.log('🔍 子操作数据:', subOp);

    // 确保子操作有必要的数据结构
    if (!subOp.locator) {
        subOp.locator = { strategy: 'css', value: '' };
        console.log('🔧 为子操作初始化locator对象');
    }

    showSubOperationModal(subOp, index);
}

// 删除子操作
function removeSubOperation(index) {
    if (confirm('确定要删除这个子操作吗？')) {
        editingStep.subOperations.splice(index, 1);
        updateSubOperationsList();
    }
}

// 更新子操作列表显示
function updateSubOperationsList() {
    const container = document.getElementById('subOperationsList');
    if (container) {
        container.innerHTML = renderSubOperationsList(editingStep.subOperations || []);
        // 重新绑定事件监听器
        setupSubOperationListHandlers();
    }
}

// 为子操作列表设置事件监听器
function setupSubOperationListHandlers() {
    const container = document.getElementById('subOperationsList');
    if (container) {
        // 移除旧的监听器
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);

        // 添加新的监听器
        newContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('edit-sub-op')) {
                const index = parseInt(e.target.dataset.index);
                editSubOperation(index);
            } else if (e.target.classList.contains('remove-sub-op')) {
                const index = parseInt(e.target.dataset.index);
                removeSubOperation(index);
            }
        });
    }
}

// 显示子操作编辑模态框
function showSubOperationModal(subOp, index) {
    const modal = document.getElementById('stepModal');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');

    title.textContent = `编辑子操作 ${index + 1}`;

    content.innerHTML = `
        <div class="form-group">
            <label>操作类型</label>
            <select id="subOpType">
                <option value="click" ${subOp.type === 'click' ? 'selected' : ''}>点击</option>
                <option value="input" ${subOp.type === 'input' ? 'selected' : ''}>输入文本</option>
                <option value="wait" ${subOp.type === 'wait' ? 'selected' : ''}>等待</option>
                <option value="waitForElement" ${subOp.type === 'waitForElement' ? 'selected' : ''}>等待元素</option>
                <option value="check" ${subOp.type === 'check' ? 'selected' : ''}>勾选复选框</option>
                <option value="select" ${subOp.type === 'select' ? 'selected' : ''}>选择选项</option>
                <option value="autoLoop" ${subOp.type === 'autoLoop' ? 'selected' : ''}>自循环</option>
            </select>
        </div>
        <div class="form-group" id="subOpLocatorGroup" style="display: ${['click', 'input', 'waitForElement', 'check', 'select', 'autoLoop'].includes(subOp.type) ? 'block' : 'none'};">
            <label>定位策略</label>
            <select id="subOpLocatorStrategy">
                <option value="css" ${(subOp.locator && subOp.locator.strategy === 'css') ? 'selected' : ''}>CSS选择器 [示例: .btn-primary, #submit-btn]</option>
                <option value="xpath" ${(subOp.locator && subOp.locator.strategy === 'xpath') ? 'selected' : ''}>XPath表达式 [示例: //div[@class='container']//button]</option>
                <option value="id" ${(subOp.locator && subOp.locator.strategy === 'id') ? 'selected' : ''}>ID选择器 [示例: submit-btn]</option>
                <option value="className" ${(subOp.locator && subOp.locator.strategy === 'className') ? 'selected' : ''}>类名选择器 [示例: btn-primary]</option>
                <option value="tagName" ${(subOp.locator && subOp.locator.strategy === 'tagName') ? 'selected' : ''}>标签名选择器 [示例: button, input]</option>
                <option value="text" ${(subOp.locator && subOp.locator.strategy === 'text') ? 'selected' : ''}>精确文本匹配 [示例: 提交表单]</option>
                <option value="contains" ${(subOp.locator && subOp.locator.strategy === 'contains') ? 'selected' : ''}>包含文本匹配 [示例: 提交]</option>
            </select>
        </div>
        <div class="form-group" id="subOpLocatorValueGroup" style="display: ${['click', 'input', 'waitForElement', 'check', 'select', 'autoLoop'].includes(subOp.type) ? 'block' : 'none'};">
            <label>定位值</label>
            <div class="input-with-test">
                <input type="text" id="subOpLocatorValue" value="${escapeHtmlAttribute((subOp.locator && subOp.locator.value) ? subOp.locator.value : '')}" placeholder="输入定位值">
                <button type="button" class="test-locator-btn" id="testSubOpLocatorBtn">🔍测试</button>
            </div>
            <div id="subOpLocatorTestResult" class="test-result"></div>
        </div>
        <div class="form-group" id="subOpTextGroup" style="display: ${subOp.type === 'input' ? 'block' : 'none'};">
            <label>输入文本</label>
            <input type="text" id="subOpText" value="${escapeHtmlAttribute(subOp.text || '')}" placeholder="要输入的文本">
        </div>
        <div class="form-group" id="subOpValueGroup" style="display: ${subOp.type === 'select' ? 'block' : 'none'};">
            <label>选择值</label>
            <input type="text" id="subOpValue" value="${escapeHtmlAttribute(subOp.value || '')}" placeholder="选择的值">
        </div>
        <div class="form-group" id="subOpDurationGroup" style="display: ${['wait', 'waitForElement'].includes(subOp.type) ? 'block' : 'none'};">
            <label>${subOp.type === 'wait' ? '等待时间(毫秒)' : '超时时间(毫秒)'}</label>
            <input type="number" id="subOpDuration" value="${subOp.duration || subOp.timeout || (subOp.type === 'waitForElement' ? 30000 : 1000)}" min="0">
        </div>

        <!-- 自循环专用配置 -->
        <div id="autoLoopConfig" style="display: ${subOp.type === 'autoLoop' ? 'block' : 'none'};">
            <div class="form-group">
                <label>循环操作类型</label>
                <select id="subOpAutoLoopActionType">
                    <option value="click" ${(subOp.actionType || 'click') === 'click' ? 'selected' : ''}>点击</option>
                    <option value="input" ${subOp.actionType === 'input' ? 'selected' : ''}>输入文本</option>
                </select>
                <div class="help-text">对每个匹配元素执行的操作类型</div>
            </div>
            <div class="form-group" id="subOpAutoLoopInputTextGroup" style="display: ${subOp.actionType === 'input' ? 'block' : 'none'};">
                <label>输入文本</label>
                <input type="text" id="subOpAutoLoopInputText" value="${escapeHtmlAttribute(subOp.inputText || '')}" placeholder="要输入的文本">
                <div class="help-text">当操作类型为"输入文本"时使用</div>
            </div>
            <div class="form-group">
                <label>起始索引</label>
                <input type="number" id="subOpAutoLoopStartIndex" value="${subOp.startIndex || 0}" min="0">
                <div class="help-text">从第几个元素开始处理（从0开始计数）</div>
            </div>
            <div class="form-group">
                <label>结束索引</label>
                <input type="number" id="subOpAutoLoopEndIndex" value="${subOp.endIndex !== undefined ? subOp.endIndex : -1}" min="-1">
                <div class="help-text">处理到第几个元素结束，-1表示处理所有元素</div>
            </div>
            <div class="form-group">
                <label>操作间隔(毫秒)</label>
                <input type="number" id="subOpAutoLoopActionDelay" value="${subOp.actionDelay || 200}" min="0">
                <div class="help-text">每次操作之间的等待时间</div>
            </div>
            <div class="form-group">
                <label>错误处理</label>
                <select id="subOpAutoLoopErrorHandling">
                    <option value="continue" ${(subOp.errorHandling || 'continue') === 'continue' ? 'selected' : ''}>继续执行</option>
                    <option value="stop" ${subOp.errorHandling === 'stop' ? 'selected' : ''}>停止执行</option>
                </select>
                <div class="help-text">当某个元素操作失败时的处理策略</div>
            </div>
        </div>

        <div class="form-group">
            <label>延迟时间(毫秒)</label>
            <input type="number" id="subOpDelay" value="${subOp.delay || 0}" min="0">
            <div class="help-text">操作完成后的等待时间</div>
        </div>
    `;

    // 添加类型变化监听
    document.getElementById('subOpType').addEventListener('change', function() {
        const type = this.value;
        const needsLocator = ['click', 'input', 'waitForElement', 'check', 'select', 'autoLoop'].includes(type);

        document.getElementById('subOpLocatorGroup').style.display = needsLocator ? 'block' : 'none';
        document.getElementById('subOpLocatorValueGroup').style.display = needsLocator ? 'block' : 'none';
        document.getElementById('subOpTextGroup').style.display = type === 'input' ? 'block' : 'none';
        document.getElementById('subOpValueGroup').style.display = type === 'select' ? 'block' : 'none';
        document.getElementById('subOpDurationGroup').style.display = ['wait', 'waitForElement'].includes(type) ? 'block' : 'none';
        document.getElementById('autoLoopConfig').style.display = type === 'autoLoop' ? 'block' : 'none';

        // 清除测试结果
        const testResult = document.getElementById('subOpLocatorTestResult');
        if (testResult) {
            testResult.innerHTML = '';
        }

        const durationLabel = document.querySelector('#subOpDurationGroup label');
        if (durationLabel) {
            durationLabel.textContent = type === 'wait' ? '等待时间(毫秒)' : '超时时间(毫秒)';
        }
    });

    // 添加自循环操作类型变化监听
    const autoLoopActionTypeSelect = document.getElementById('subOpAutoLoopActionType');
    if (autoLoopActionTypeSelect) {
        autoLoopActionTypeSelect.addEventListener('change', function() {
            const actionType = this.value;
            const inputTextGroup = document.getElementById('subOpAutoLoopInputTextGroup');
            if (inputTextGroup) {
                inputTextGroup.style.display = actionType === 'input' ? 'block' : 'none';
            }
        });
    }

    // 直接替换父级按钮的功能和文本
    const saveStepBtn = document.getElementById('saveStepBtn');
    const cancelStepBtn = document.getElementById('cancelStepBtn');

    if (saveStepBtn && cancelStepBtn) {
        // 保存原始的按钮处理函数
        const originalSaveHandler = saveStepBtn.onclick;
        const originalCancelHandler = cancelStepBtn.onclick;
        const originalSaveText = saveStepBtn.textContent;
        const originalCancelText = cancelStepBtn.textContent;

        // 设置子操作编辑状态
        isEditingSubOperation = true;

        // 修改按钮文本和功能为子操作专用
        saveStepBtn.textContent = '保存子操作';
        cancelStepBtn.textContent = '返回父级配置';

        saveStepBtn.onclick = () => {
            console.log('🔧 子操作保存按钮被点击');
            console.log('🔍 按钮点击时的全局状态:', {
                editingStepExists: !!editingStep,
                editingStepName: editingStep?.name,
                editingStepType: editingStep?.type,
                hasSubOperations: !!editingStep?.subOperations,
                subOperationsLength: editingStep?.subOperations?.length,
                isEditingSubOperation: isEditingSubOperation,
                targetIndex: index
            });

            // 额外验证
            if (!editingStep) {
                console.error('❌ 致命错误：editingStep为null，无法保存子操作');
                showStatus('编辑数据丢失，请重新打开编辑界面', 'error');
                return;
            }

            saveSubOperation(index);
        };

        cancelStepBtn.onclick = () => {
            console.log('🔧 子操作取消按钮被点击');

            // 清除子操作编辑状态
            isEditingSubOperation = false;

            // 恢复原始按钮文本和功能
            saveStepBtn.textContent = originalSaveText;
            cancelStepBtn.textContent = originalCancelText;
            saveStepBtn.onclick = originalSaveHandler;
            cancelStepBtn.onclick = originalCancelHandler;

            // 返回父级循环配置
            returnToParentConfig();
        };

        console.log('🔧 已替换按钮功能为子操作专用');
    }

    // 设置定位器测试监听器
    setupLocatorTestListeners();

    modal.style.display = 'block';
}

// 返回父级配置（恢复父级按钮功能）
function returnToParentConfig() {
    console.log('🔄 返回父级配置');

    if (!editingStep) {
        console.error('❌ editingStep不存在，无法返回父级配置');
        return;
    }

    // 清除子操作编辑状态
    isEditingSubOperation = false;

    // 恢复父级按钮功能
    const saveStepBtn = document.getElementById('saveStepBtn');
    const cancelStepBtn = document.getElementById('cancelStepBtn');

    if (saveStepBtn) {
        saveStepBtn.textContent = '保存';
        saveStepBtn.onclick = saveStepChanges;
        console.log('🔧 恢复父级保存按钮功能');
    }

    if (cancelStepBtn) {
        cancelStepBtn.textContent = '取消';
        cancelStepBtn.onclick = closeStepModal;
        console.log('🔧 恢复父级取消按钮功能');
    }

    // 更新模态框内容
    const content = document.getElementById('modalContent');
    const title = document.getElementById('modalTitle');

    if (title) {
        title.textContent = `编辑 ${editingStep.name}`;
    }

    if (content) {
        content.innerHTML = generateStepEditHTML(editingStep);

        // 重新设置循环类型处理器和子操作处理器
        if (editingStep.type === 'loop') {
            setupLoopTypeHandlers();
            setupSubOperationHandlers();
        }
    }

    console.log('✅ 父级配置已恢复');
}

// 保存子操作
function saveSubOperation(index) {
    try {
        console.log('🔧 开始保存子操作:', {
            index,
            editingStep: editingStep?.name,
            editingStepExists: !!editingStep,
            subOperationsExists: !!editingStep?.subOperations,
            subOperationsLength: editingStep?.subOperations?.length,
            targetSubOpExists: !!editingStep?.subOperations?.[index]
        });

        // 验证必要的数据
        if (!editingStep) {
            throw new Error('编辑步骤数据不存在');
        }

        if (!editingStep.subOperations) {
            throw new Error('子操作数组不存在');
        }

        if (!editingStep.subOperations[index]) {
            throw new Error(`索引${index}的子操作不存在，当前子操作数量：${editingStep.subOperations.length}`);
        }

        const typeElement = document.getElementById('subOpType');
        if (!typeElement) {
            throw new Error('找不到子操作类型选择器');
        }

        const type = typeElement.value;
        const updates = { type };

        console.log('🔍 收集子操作数据:', { type });

        // 根据类型收集数据
        if (['click', 'input', 'waitForElement', 'check', 'select', 'autoLoop'].includes(type)) {
            const strategyElement = document.getElementById('subOpLocatorStrategy');
            const valueElement = document.getElementById('subOpLocatorValue');

            if (!strategyElement || !valueElement) {
                throw new Error('找不到定位器配置元素');
            }

            const strategy = strategyElement.value;
            const value = valueElement.value;
            updates.locator = { strategy, value };

            console.log('🔍 定位器数据:', { strategy, value });
        }

        if (type === 'input') {
            const textElement = document.getElementById('subOpText');
            if (textElement) {
                updates.text = textElement.value;
            }
        }

        if (type === 'select') {
            const selectValueElement = document.getElementById('subOpValue');
            if (selectValueElement) {
                updates.value = selectValueElement.value;
            }
        }

        if (['wait', 'waitForElement'].includes(type)) {
            const durationElement = document.getElementById('subOpDuration');
            if (durationElement) {
                const duration = parseInt(durationElement.value);
                if (type === 'wait') {
                    updates.duration = duration;
                } else {
                    updates.timeout = duration;
                }
            }
        }

        // 自循环特定配置
        if (type === 'autoLoop') {
            const actionTypeElement = document.getElementById('subOpAutoLoopActionType');
            const inputTextElement = document.getElementById('subOpAutoLoopInputText');
            const startIndexElement = document.getElementById('subOpAutoLoopStartIndex');
            const endIndexElement = document.getElementById('subOpAutoLoopEndIndex');
            const actionDelayElement = document.getElementById('subOpAutoLoopActionDelay');
            const errorHandlingElement = document.getElementById('subOpAutoLoopErrorHandling');

            if (actionTypeElement) {
                updates.actionType = actionTypeElement.value;
            }
            if (inputTextElement) {
                updates.inputText = inputTextElement.value;
            }
            if (startIndexElement) {
                updates.startIndex = parseInt(startIndexElement.value);
            }
            if (endIndexElement) {
                updates.endIndex = parseInt(endIndexElement.value);
            }
            if (actionDelayElement) {
                updates.actionDelay = parseInt(actionDelayElement.value);
            }
            if (errorHandlingElement) {
                updates.errorHandling = errorHandlingElement.value;
            }

            console.log('🔍 自循环配置数据:', {
                actionType: updates.actionType,
                inputText: updates.inputText,
                startIndex: updates.startIndex,
                endIndex: updates.endIndex,
                actionDelay: updates.actionDelay,
                errorHandling: updates.errorHandling
            });
        }

        const delayElement = document.getElementById('subOpDelay');
        if (delayElement) {
            const delay = parseInt(delayElement.value);
            if (delay > 0) {
                updates.delay = delay;
            }
        }

        // 更新子操作
        Object.assign(editingStep.subOperations[index], updates);

        console.log('✅ 子操作已更新:', {
            index: index,
            updates: updates,
            updatedOperation: editingStep.subOperations[index],
            totalSubOperations: editingStep.subOperations.length
        });

        // 验证更新后的子操作
        const updatedOp = editingStep.subOperations[index];
        console.log('🔍 验证更新后的子操作:', {
            type: updatedOp.type,
            locator: updatedOp.locator,
            hasLocator: !!(updatedOp.locator && updatedOp.locator.value),
            detail: getSubOperationDetail(updatedOp)
        });

        // 更新子操作列表显示
        updateSubOperationsList();

        // 保存到工作流
        saveCurrentWorkflowState();

        // 清除子操作编辑状态
        isEditingSubOperation = false;

        // 返回父级配置，但不重新绑定按钮
        returnToParentConfig();

        showStatus('子操作已更新', 'success');

    } catch (error) {
        console.error('❌ 保存子操作失败:', error);
        showStatus(`保存子操作失败: ${error.message}`, 'error');

        // 发生错误时不要关闭模态框，只显示错误信息
        // 用户可以修正错误后重新保存
    }
}

// ==================== 定位器测试功能 ====================

// 初始化定位器测试器
let locatorTester = null;

// 初始化定位器测试器实例
function initializeLocatorTester() {
    if (!locatorTester) {
        locatorTester = new LocatorTester();
    }
}

// 测试主操作定位器
async function testMainLocator() {
    initializeLocatorTester();
    await locatorTester.testMainLocator();
}

// 测试循环操作定位器
async function testLoopLocator() {
    initializeLocatorTester();

    const strategyElement = document.getElementById('editLoopLocatorStrategy');
    const valueElement = document.getElementById('editLoopLocatorValue');
    const resultElement = document.getElementById('loopLocatorTestResult');
    const testBtn = document.getElementById('testLoopLocatorBtn');

    if (!strategyElement || !valueElement || !resultElement || !testBtn) {
        console.error('❌ 找不到循环操作定位器测试的必要元素');
        return;
    }

    const strategy = strategyElement.value;
    const value = valueElement.value.trim();

    await locatorTester.testLocator(strategy, value, resultElement, testBtn);
}

// 测试子操作定位器
async function testSubOpLocator() {
    initializeLocatorTester();
    await locatorTester.testSubOpLocator();
}

// 保留向后兼容的函数（已迁移到LocatorTester模块）
function showTestResult(resultElement, message, type) {
    initializeLocatorTester();
    locatorTester.showTestResult(resultElement, message, type);
}

function clearTestResult(resultElementId) {
    initializeLocatorTester();
    locatorTester.clearTestResult(resultElementId);
}

async function clearTestHighlights() {
    initializeLocatorTester();
    await locatorTester.clearTestHighlights();
}

// 设置定位器测试监听器
function setupLocatorTestListeners() {
    // 主操作定位器测试按钮监听
    const mainTestBtn = document.getElementById('testMainLocatorBtn');
    if (mainTestBtn) {
        mainTestBtn.addEventListener('click', testMainLocator);
    }

    // 循环操作定位器测试按钮监听
    const loopTestBtn = document.getElementById('testLoopLocatorBtn');
    if (loopTestBtn) {
        loopTestBtn.addEventListener('click', testLoopLocator);
    }

    // 子操作定位器测试按钮监听
    const subOpTestBtn = document.getElementById('testSubOpLocatorBtn');
    if (subOpTestBtn) {
        subOpTestBtn.addEventListener('click', testSubOpLocator);
    }

    // 主操作定位器输入框监听
    const mainLocatorValue = document.getElementById('editLocatorValue');
    const mainLocatorStrategy = document.getElementById('editLocatorStrategy');

    if (mainLocatorValue) {
        mainLocatorValue.addEventListener('input', () => {
            initializeLocatorTester();
            locatorTester.clearTestResult('mainLocatorTestResult');
            locatorTester.clearTestHighlights(); // 清除高亮
        });
    }

    if (mainLocatorStrategy) {
        mainLocatorStrategy.addEventListener('change', () => {
            initializeLocatorTester();
            locatorTester.clearTestResult('mainLocatorTestResult');
            locatorTester.clearTestHighlights(); // 清除高亮
        });
    }

    // 循环操作定位器输入框监听
    const loopLocatorValue = document.getElementById('editLoopLocatorValue');
    const loopLocatorStrategy = document.getElementById('editLoopLocatorStrategy');

    if (loopLocatorValue) {
        loopLocatorValue.addEventListener('input', () => {
            initializeLocatorTester();
            locatorTester.clearTestResult('loopLocatorTestResult');
            locatorTester.clearTestHighlights(); // 清除高亮
        });
    }

    if (loopLocatorStrategy) {
        loopLocatorStrategy.addEventListener('change', () => {
            initializeLocatorTester();
            locatorTester.clearTestResult('loopLocatorTestResult');
            locatorTester.clearTestHighlights(); // 清除高亮
        });
    }

    // 子操作定位器输入框监听
    const subOpLocatorValue = document.getElementById('subOpLocatorValue');
    const subOpLocatorStrategy = document.getElementById('subOpLocatorStrategy');

    if (subOpLocatorValue) {
        subOpLocatorValue.addEventListener('input', () => {
            initializeLocatorTester();
            locatorTester.clearTestResult('subOpLocatorTestResult');
            locatorTester.clearTestHighlights(); // 清除高亮
        });
    }

    if (subOpLocatorStrategy) {
        subOpLocatorStrategy.addEventListener('change', () => {
            initializeLocatorTester();
            locatorTester.clearTestResult('subOpLocatorTestResult');
            locatorTester.clearTestHighlights(); // 清除高亮
        });
    }
}

// ==================== 导入导出功能 ====================
// 导入导出函数在 utils/importExport.js 中定义
// exportWorkflow(), importWorkflow() 函数已模块化

// 导出辅助函数在 utils/importExport.js 中定义
// createAnnotatedWorkflowData(), getStepTypeDescription() 函数已模块化

// 打开流程图设计器
function openWorkflowDesigner() {
    try {
        // 使用Chrome扩展URL打开弹窗
        const designerUrl = chrome.runtime.getURL('workflow-designer-mxgraph.html');

        // 打开设计器弹窗
        const designerWindow = window.open(
            designerUrl,
            'workflowDesigner',
            'width=1200,height=800,scrollbars=yes,resizable=yes'
        );

        if (!designerWindow) {
            alert('无法打开设计器窗口，请检查浏览器弹窗设置');
            return;
        }

        // 保存当前工作流到localStorage，供设计器页面读取
        if (currentWorkflow) {
            try {
                localStorage.setItem('designer_workflow_data', JSON.stringify(currentWorkflow));
                console.log('✅ 工作流数据已保存到localStorage供设计器使用');
            } catch (error) {
                console.error('❌ 保存工作流数据到localStorage失败:', error);
            }
        }

        // 监听设计器窗口关闭事件，重新加载工作流列表
        const checkClosed = setInterval(() => {
            if (designerWindow.closed) {
                clearInterval(checkClosed);
                console.log('设计器窗口已关闭，重新加载工作流列表');
                loadSavedWorkflows();
            }
        }, 1000);

        updateExecutionStatus('idle', '设计器已打开');
        console.log('🎨 工作流设计器已在弹窗中打开');

    } catch (error) {
        console.error('❌ 打开设计器失败:', error);
        alert('打开设计器失败: ' + error.message);
    }
}

// 设置设计器数据同步 - 已合并到initializeStorageListener中
function setupDesignerDataSync() {
    // 数据同步逻辑已合并到主storage监听器中
    console.log('设计器数据同步已通过主storage监听器处理');
}

// 获取定位策略的中文描述
function getLocatorStrategyDescription(strategy) {
    const descriptions = {
        'css': 'CSS选择器 - 使用CSS语法定位元素，示例: .btn-primary, #submit-btn',
        'xpath': 'XPath表达式 - 使用XPath语法定位元素，示例: //div[@class=\'container\']//button',
        'id': 'ID选择器 - 通过元素ID定位，示例: submit-btn',
        'className': '类名选择器 - 通过CSS类名定位，示例: btn-primary',
        'tagName': '标签名选择器 - 通过HTML标签名定位元素，示例: button, input',
        'text': '精确文本匹配 - 通过元素的精确文本内容定位，示例: 提交表单',
        'contains': '包含文本匹配 - 通过元素包含的文本内容定位，示例: 提交'
    };
    return descriptions[strategy] || '未知定位策略';
}

// 获取子操作类型的中文描述
function getSubOperationTypeDescription(type) {
    const descriptions = {
        'click': '点击 - 点击指定元素',
        'input': '输入 - 在输入框中输入文本',
        'wait': '等待 - 固定时间等待',
        'waitForElement': '等待元素 - 等待指定元素出现',
        'check': '勾选 - 勾选复选框',
        'select': '选择 - 在下拉框中选择选项'
    };
    return descriptions[type] || '未知子操作类型';
}

// 导入工作流配置
function importWorkflow(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importData = JSON.parse(e.target.result);

            let workflow;

            // 检查是否是新格式（带注释）的配置文件
            if (importData["工作流配置"]) {
                console.log('🔍 检测到带注释的配置文件格式');
                workflow = parseAnnotatedWorkflowData(importData);
            } else if (importData.workflow) {
                console.log('🔍 检测到标准配置文件格式');
                workflow = importData.workflow;
            } else {
                throw new Error('无效的工作流配置文件格式');
            }

            // 验证工作流数据
            if (!workflow.steps) {
                throw new Error('配置文件中缺少步骤数据');
            }

            // 创建新的工作流ID（避免冲突）
            const newWorkflowId = 'workflow_' + Date.now();
            workflow.id = newWorkflowId;
            workflow.name = (workflow.name || '未命名工作流') + '_导入';
            workflow.updatedAt = new Date().toISOString();

            // 重新生成步骤ID（避免冲突）
            workflow.steps.forEach(step => {
                step.id = 'step_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
            });

            // 保存到工作流管理器
            workflowManager.workflows.set(newWorkflowId, workflow);
            workflowManager.saveToStorage(newWorkflowId);

            // 设置为当前工作流
            currentWorkflow = workflow;
            updateWorkflowInfo();
            renderSteps();
            saveCurrentWorkflowState();

            console.log('✅ 工作流配置已导入:', workflow);
            showStatus(`工作流 "${workflow.name}" 导入成功`, 'success');

            // 清空文件输入
            event.target.value = '';

        } catch (error) {
            console.error('❌ 导入工作流失败:', error);
            showStatus(`导入失败: ${error.message}`, 'error');
            event.target.value = '';
        }
    };

    reader.readAsText(file);
}

// 解析带注释的工作流数据
function parseAnnotatedWorkflowData(annotatedData) {
    const workflowConfig = annotatedData["工作流配置"];

    const workflow = {
        id: workflowConfig["工作流ID"],
        name: workflowConfig["工作流名称"],
        description: workflowConfig["工作流描述"],
        createdAt: workflowConfig["创建时间"],
        updatedAt: workflowConfig["更新时间"],
        steps: []
    };

    // 解析步骤数据
    if (workflowConfig["自动化步骤"]) {
        workflow.steps = workflowConfig["自动化步骤"].map(annotatedStep => {
            // 如果有原始步骤数据，直接使用
            if (annotatedStep["原始步骤数据"]) {
                return annotatedStep["原始步骤数据"];
            }

            // 否则从注释数据重构步骤
            const step = {
                id: annotatedStep["步骤ID"],
                name: annotatedStep["步骤名称"],
                type: annotatedStep["步骤类型"]
            };

            // 重构定位器
            if (annotatedStep["定位器配置"]) {
                step.locator = {
                    strategy: annotatedStep["定位器配置"]["定位策略"],
                    value: annotatedStep["定位器配置"]["定位值"]
                };
            }

            // 根据步骤类型重构特定配置
            switch (step.type) {
                case 'loop':
                    step.loopType = annotatedStep["循环类型"];
                    step.startIndex = annotatedStep["起始索引"];
                    step.endIndex = annotatedStep["结束索引"];

                    if (annotatedStep["点击后等待时间(毫秒)"]) {
                        step.waitAfterClick = annotatedStep["点击后等待时间(毫秒)"];
                    }
                    if (annotatedStep["循环间隔(毫秒)"]) {
                        step.loopDelay = annotatedStep["循环间隔(毫秒)"];
                    }

                    // 重构子操作
                    if (annotatedStep["子操作列表"]) {
                        step.subOperations = annotatedStep["子操作列表"].map(annotatedSubOp => {
                            const subOp = {
                                type: annotatedSubOp["操作类型"]
                            };

                            if (annotatedSubOp["定位器配置"]) {
                                subOp.locator = {
                                    strategy: annotatedSubOp["定位器配置"]["定位策略"],
                                    value: annotatedSubOp["定位器配置"]["定位值"]
                                };
                            }

                            if (annotatedSubOp["输入文本"]) subOp.text = annotatedSubOp["输入文本"];
                            if (annotatedSubOp["选择值"]) subOp.value = annotatedSubOp["选择值"];
                            if (annotatedSubOp["等待时间(毫秒)"]) subOp.duration = annotatedSubOp["等待时间(毫秒)"];
                            if (annotatedSubOp["超时时间(毫秒)"]) subOp.timeout = annotatedSubOp["超时时间(毫秒)"];
                            if (annotatedSubOp["操作后延迟(毫秒)"]) subOp.delay = annotatedSubOp["操作后延迟(毫秒)"];

                            return subOp;
                        });
                    }
                    break;

                // 可以继续添加其他步骤类型的重构逻辑
            }

            return step;
        });
    }

    return workflow;
}

// HTML属性值转义函数
function escapeHtmlAttribute(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ==================== 右键菜单功能 ====================
// 右键菜单函数在 utils/contextMenu.js 中定义
// initializeContextMenu(), showStepContextMenu() 等函数已模块化

// 右键菜单显示、隐藏和操作处理函数已在 utils/contextMenu.js 中定义

// ==================== 节点测试功能 ====================
// 节点测试函数在 utils/stepEditor.js 中定义
// testStepNode() 函数已模块化

// 执行状态管理函数已在上面定义

// ==================== 新增的三栏布局功能 ====================

// 导入工作流
function importWorkflow() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.click();
    }
}

// 处理文件选择
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const workflow = JSON.parse(e.target.result);

            // 验证工作流格式
            if (!workflow.name) {
                alert('无效的工作流文件：缺少名称');
                return;
            }

            // 保存到localStorage
            let savedWorkflows = getWorkflowsFromStorage();

            // 检查是否已存在同名工作流
            const existingIndex = savedWorkflows.findIndex(w => w.name === workflow.name);
            if (existingIndex >= 0) {
                if (confirm(`工作流 "${workflow.name}" 已存在，是否覆盖？`)) {
                    savedWorkflows[existingIndex] = workflow;
                } else {
                    return;
                }
            } else {
                savedWorkflows.push(workflow);
            }

            // 保存到localStorage
            if (!saveWorkflowsToStorage(savedWorkflows)) {
                alert('保存工作流失败');
                return;
            }

            // 重新渲染下拉选择框
            renderConfigSelect(savedWorkflows);

            // 自动选择导入的工作流
            const newIndex = existingIndex >= 0 ? existingIndex : savedWorkflows.length - 1;
            selectConfig(newIndex);

            updateExecutionStatus('success', `工作流 "${workflow.name}" 导入成功`);

        } catch (error) {
            alert('导入失败：文件格式错误');
            console.error('导入工作流失败:', error);
        }
    };

    reader.readAsText(file);

    // 清空文件输入，允许重复选择同一文件
    event.target.value = '';
}

// 这个函数已被上面的Chrome扩展版本替代，删除重复定义

// 基本事件监听器初始化
function initializeEventListeners() {
    // 打开设计器按钮
    const openDesignerBtn = document.getElementById('openDesignerBtn');
    if (openDesignerBtn) {
        openDesignerBtn.addEventListener('click', openWorkflowDesigner);
        console.log('✅ 打开设计器按钮事件已绑定');
    } else {
        console.error('❌ 未找到打开设计器按钮');
    }

    // 导入配置按钮
    const importBtn = document.getElementById('importBtn');
    if (importBtn) {
        importBtn.addEventListener('click', importWorkflow);
        console.log('✅ 导入配置按钮事件已绑定');
    } else {
        console.error('❌ 未找到导入配置按钮');
    }

    // 执行按钮
    const executeBtn = document.getElementById('executeBtn');
    if (executeBtn) {
        executeBtn.addEventListener('click', executeWorkflow);
        console.log('✅ 执行按钮事件已绑定');
    } else {
        console.error('❌ 未找到执行按钮');
    }

    // 暂停/继续按钮
    const pauseResumeBtn = document.getElementById('pauseResumeBtn');
    if (pauseResumeBtn) {
        pauseResumeBtn.addEventListener('click', togglePauseResume);
        console.log('✅ 暂停/继续按钮事件已绑定');
    } else {
        console.error('❌ 未找到暂停/继续按钮');
    }

    // 停止按钮
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) {
        stopBtn.addEventListener('click', stopExecution);
        console.log('✅ 停止按钮事件已绑定');
    } else {
        console.error('❌ 未找到停止按钮');
    }

    // 配置选择下拉框
    const configSelect = document.getElementById('configSelect');
    if (configSelect) {
        configSelect.addEventListener('change', handleConfigSelectChange);
        console.log('✅ 配置选择下拉框事件已绑定');
    } else {
        console.error('❌ 未找到配置选择下拉框');
    }

    // 刷新配置按钮
    const refreshConfigBtn = document.getElementById('refreshConfigBtn');
    if (refreshConfigBtn) {
        refreshConfigBtn.addEventListener('click', refreshConfigList);
        console.log('✅ 刷新配置按钮事件已绑定');
    } else {
        console.error('❌ 未找到刷新配置按钮');
    }

    // 文件输入
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
        console.log('✅ 文件输入事件已绑定');
    } else {
        console.error('❌ 未找到文件输入元素');
    }

    // 模态框关闭按钮
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
        console.log('✅ 模态框关闭按钮事件已绑定');
    }

    // 右键菜单按钮
    const testNodeBtn = document.getElementById('testNodeBtn');
    if (testNodeBtn) {
        testNodeBtn.addEventListener('click', testSelectedNode);
    }

    const viewConfigBtn = document.getElementById('viewConfigBtn');
    if (viewConfigBtn) {
        viewConfigBtn.addEventListener('click', viewSelectedNodeConfig);
    }

    // 右键菜单事件
    initializeContextMenu();
}

// ==================== 缺失的函数实现 ====================

// 更新工作流信息显示
function updateWorkflowInfo() {
    // 在新的三栏布局中，这个功能由updateCurrentConfigDisplay处理
    if (currentWorkflow) {
        updateCurrentConfigDisplay();
    } else {
        hideCurrentConfigDisplay();
    }
}

// 渲染步骤列表
function renderSteps() {
    // 在新的三栏布局中，这个功能由renderFlowPreview处理
    if (currentWorkflow) {
        renderFlowPreview(currentWorkflow);
    } else {
        clearFlowPreview();
    }
}

// 保存当前工作流状态
function saveCurrentWorkflowState() {
    if (currentWorkflow) {
        try {
            localStorage.setItem('current_workflow_id', currentWorkflow.id || '');
            localStorage.setItem('current_workflow_data', JSON.stringify(currentWorkflow));
        } catch (error) {
            console.error('保存工作流状态失败:', error);
        }
    }
}

// 加载上次工作流状态
function loadLastWorkflowState() {
    try {
        const workflowData = localStorage.getItem('current_workflow_data');
        if (workflowData) {
            currentWorkflow = JSON.parse(workflowData);
            updateWorkflowInfo();
            renderSteps();
            console.log('已恢复上次的工作流:', currentWorkflow.name);
        }
    } catch (error) {
        console.error('加载工作流状态失败:', error);
    }
}

// 清除当前工作流状态
function clearCurrentWorkflowState() {
    currentWorkflow = null;
    localStorage.removeItem('current_workflow_id');
    localStorage.removeItem('current_workflow_data');
    updateWorkflowInfo();
    renderSteps();
}

// ==================== 缺失的函数实现 ====================

// 关闭模态框
function closeModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
    }
}

// 测试选中的节点
function testSelectedNode() {
    console.log('测试选中的节点:', selectedNode);
    // 这里可以添加具体的测试逻辑
}

// 查看选中节点的配置
function viewSelectedNodeConfig() {
    console.log('查看选中节点的配置:', selectedNode);
    // 这里可以添加具体的查看配置逻辑
}

// 初始化右键菜单
function initializeContextMenu() {
    // 右键菜单相关逻辑
    console.log('右键菜单已初始化');
}

// 执行工作流函数已在上面定义
