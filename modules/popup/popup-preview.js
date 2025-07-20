/**
 * 弹窗预览模块
 * 负责流程图预览功能，包括mxGraph集成和简单预览
 */

import { debugLog, getElement, validateWorkflow } from '../../shared/popup/popup-utils.js';

/**
 * 渲染流程图预览 - 使用mxGraph实现与设计器一致的显示
 * @param {Object} workflow - 工作流数据
 */
export function renderFlowPreview(workflow) {
    debugLog('renderFlowPreview 被调用，工作流:', workflow);

    const container = getElement('#flowGraphContainer');
    const overlay = getElement('#flowOverlay');

    if (!container) {
        console.error('流程图容器未找到');
        return;
    }

    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
        showEmptyPreview(container, overlay);
        return;
    }

    try {
        // 检查mxGraph是否可用
        if (typeof window.mxGraph !== 'undefined' && typeof window.mxClient !== 'undefined') {
            debugLog('mxGraph可用，开始渲染预览');
            renderMxGraphPreview(workflow, container, overlay);
        } else {
            console.warn('⚠️ mxGraph不可用，使用简单预览');
            debugLog('mxGraph状态:', {
                mxGraph: typeof window.mxGraph,
                mxClient: typeof window.mxClient
            });
            renderSimpleFlowPreview(workflow, container, overlay);
        }
    } catch (error) {
        console.error('渲染流程图预览失败:', error);
        showErrorPreview(container, overlay, error.message);
    }
}

/**
 * 使用mxGraph渲染预览
 * @param {Object} workflow - 工作流数据
 * @param {Element} container - 容器元素
 * @param {Element} overlay - 覆盖层元素
 */
function renderMxGraphPreview(workflow, container, overlay) {
    debugLog('使用mxGraph渲染预览');

    try {
        // 隐藏覆盖层
        if (overlay) {
            overlay.style.display = 'none';
        }

        // 清空容器
        container.innerHTML = '';

        // 检查mxClient是否已初始化
        if (!window.mxClient.isBrowserSupported()) {
            throw new Error('浏览器不支持mxGraph');
        }

        // 创建图形对象
        const graph = new window.mxGraph(container);

        // 启用交互功能（允许缩放和平移）
        graph.setEnabled(true);

        // 启用缩放和平移
        graph.setPanning(true);
        graph.setTooltips(true);
        graph.setConnectable(false); // 禁用连接创建
        graph.setCellsEditable(false); // 禁用编辑
        graph.setCellsResizable(false); // 禁用调整大小
        graph.setCellsMovable(true); // 启用移动（允许拖拽）
        graph.setCellsDeletable(false); // 禁用删除

        // 设置预览样式
        setupPreviewStyles(graph);

        // 渲染工作流
        renderWorkflowInPreview(graph, workflow);

        // 自动调整视图
        graph.fit();
        graph.center();

        // 添加鼠标滚轮缩放支持
        if (window.mxEvent) {
            window.mxEvent.addMouseWheelListener((evt, up) => {
                if (container.contains(evt.target) || evt.target === container) {
                    if (up) {
                        graph.zoomIn();
                    } else {
                        graph.zoomOut();
                    }
                    window.mxEvent.consume(evt);
                }
            });
        }

        debugLog('mxGraph预览渲染完成');

    } catch (error) {
        console.error('mxGraph预览渲染失败:', error);
        // 降级到简单预览
        renderSimpleFlowPreview(workflow, container, overlay);
    }
}

/**
 * 简单流程预览（当mxGraph不可用时使用）
 * @param {Object} workflow - 工作流数据
 * @param {Element} container - 容器元素
 * @param {Element} overlay - 覆盖层元素
 */
function renderSimpleFlowPreview(workflow, container, overlay) {
    debugLog('使用简单Canvas预览，工作流:', workflow);

    try {
        // 隐藏覆盖层
        if (overlay) {
            overlay.style.display = 'none';
        }

        // 清空容器并创建canvas
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.width = container.clientWidth || 400;
        canvas.height = container.clientHeight || 300;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');

        // 绘制简单流程图
        drawSimpleFlowChart(ctx, workflow.steps, canvas.width, canvas.height);

        debugLog('简单预览渲染完成');

    } catch (error) {
        console.error('简单预览渲染失败:', error);
        showErrorPreview(container, overlay, error.message);
    }
}

/**
 * 显示空预览状态
 * @param {Element} container - 容器元素
 * @param {Element} overlay - 覆盖层元素
 */
function showEmptyPreview(container, overlay) {
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="overlay-content">
                <div class="overlay-icon">📊</div>
                <div class="overlay-text">选择配置后显示流程图预览</div>
            </div>
        `;
    }

    if (container) {
        container.innerHTML = '';
    }

    debugLog('显示空预览状态');
}

/**
 * 显示错误预览状态
 * @param {Element} container - 容器元素
 * @param {Element} overlay - 覆盖层元素
 * @param {string} errorMessage - 错误消息
 */
function showErrorPreview(container, overlay, errorMessage) {
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="overlay-content">
                <div class="overlay-icon">❌</div>
                <div class="overlay-text">预览加载失败</div>
                <div class="overlay-detail">${errorMessage}</div>
            </div>
        `;
    }

    if (container) {
        container.innerHTML = '';
    }

    debugLog('显示错误预览状态:', errorMessage);
}

/**
 * 清除流程图预览
 */
export function clearFlowPreview() {
    debugLog('清除流程图预览');

    const container = getElement('#flowGraphContainer');
    const overlay = getElement('#flowOverlay');

    if (container) {
        container.innerHTML = '';
    }

    if (overlay) {
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="overlay-content">
                <div class="overlay-icon">📊</div>
                <div class="overlay-text">选择配置后显示流程图预览</div>
            </div>
        `;
    }
}

/**
 * 设置预览样式 - 使用和设计器完全相同的样式
 * @param {Object} graph - mxGraph实例
 */
function setupPreviewStyles(graph) {
    if (typeof window.mxConstants === 'undefined') {
        console.warn('mxConstants未定义，跳过样式设置');
        return;
    }

    try {
        const stylesheet = graph.getStylesheet();

        // 开始节点样式
        const startStyle = stylesheet.getDefaultVertexStyle();
        startStyle[window.mxConstants.STYLE_SHAPE] = window.mxConstants.SHAPE_ELLIPSE;
        startStyle[window.mxConstants.STYLE_FILLCOLOR] = '#4CAF50';
        startStyle[window.mxConstants.STYLE_STROKECOLOR] = '#45a049';
        startStyle[window.mxConstants.STYLE_FONTCOLOR] = 'white';
        startStyle[window.mxConstants.STYLE_FONTSIZE] = '12';
        startStyle[window.mxConstants.STYLE_FONTSTYLE] = window.mxConstants.FONT_BOLD;

        // 使用和设计器相同的节点类型配置
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

        // 基础节点样式
        const baseNodeStyle = {
            [window.mxConstants.STYLE_SHAPE]: window.mxConstants.SHAPE_RECTANGLE,
            [window.mxConstants.STYLE_PERIMETER]: window.mxPerimeter.RectanglePerimeter,
            [window.mxConstants.STYLE_ROUNDED]: true,
            [window.mxConstants.STYLE_STROKEWIDTH]: 2,
            [window.mxConstants.STYLE_FONTSIZE]: 12,
            [window.mxConstants.STYLE_FONTFAMILY]: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            [window.mxConstants.STYLE_FONTCOLOR]: '#ffffff',
            [window.mxConstants.STYLE_ALIGN]: window.mxConstants.ALIGN_CENTER,
            [window.mxConstants.STYLE_VERTICAL_ALIGN]: window.mxConstants.ALIGN_MIDDLE,
            [window.mxConstants.STYLE_WHITE_SPACE]: 'wrap',
            [window.mxConstants.STYLE_OVERFLOW]: 'width'
        };

        // 为每种节点类型创建样式
        Object.keys(nodeTypes).forEach(type => {
            const config = nodeTypes[type];
            const style = {
                ...baseNodeStyle,
                [window.mxConstants.STYLE_FILLCOLOR]: config.color,
                [window.mxConstants.STYLE_STROKECOLOR]: config.color
            };
            stylesheet.putCellStyle(type, style);
        });

        // 条件判断菱形样式（覆盖基础样式）
        const conditionStyle = {
            ...baseNodeStyle,
            [window.mxConstants.STYLE_SHAPE]: window.mxConstants.SHAPE_RHOMBUS,
            [window.mxConstants.STYLE_PERIMETER]: window.mxPerimeter.RhombusPerimeter,
            [window.mxConstants.STYLE_FILLCOLOR]: '#e67e22',
            [window.mxConstants.STYLE_STROKECOLOR]: '#e67e22'
        };
        stylesheet.putCellStyle('condition', conditionStyle);

        // 循环容器样式
        const loopContainerStyle = {
            [window.mxConstants.STYLE_SHAPE]: window.mxConstants.SHAPE_SWIMLANE,
            [window.mxConstants.STYLE_PERIMETER]: window.mxPerimeter.RectanglePerimeter,
            [window.mxConstants.STYLE_ROUNDED]: true,
            [window.mxConstants.STYLE_STROKEWIDTH]: 2,
            [window.mxConstants.STYLE_FILLCOLOR]: '#e3f2fd',
            [window.mxConstants.STYLE_STROKECOLOR]: '#3498db',
            [window.mxConstants.STYLE_FONTSIZE]: 14,
            [window.mxConstants.STYLE_FONTFAMILY]: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            [window.mxConstants.STYLE_FONTCOLOR]: '#1976d2',
            [window.mxConstants.STYLE_FONTSTYLE]: window.mxConstants.FONT_BOLD,
            [window.mxConstants.STYLE_STARTSIZE]: 40,
            [window.mxConstants.STYLE_WHITE_SPACE]: 'wrap',
            [window.mxConstants.STYLE_OVERFLOW]: 'width'
        };
        stylesheet.putCellStyle('loopContainer', loopContainerStyle);

        // 结束节点样式
        stylesheet.putCellStyle('end', {
            [window.mxConstants.STYLE_SHAPE]: window.mxConstants.SHAPE_ELLIPSE,
            [window.mxConstants.STYLE_FILLCOLOR]: '#F44336',
            [window.mxConstants.STYLE_STROKECOLOR]: '#D32F2F',
            [window.mxConstants.STYLE_FONTCOLOR]: 'white',
            [window.mxConstants.STYLE_FONTSIZE]: '12',
            [window.mxConstants.STYLE_FONTSTYLE]: window.mxConstants.FONT_BOLD
        });

        // 连接线样式
        const edgeStyle = stylesheet.getDefaultEdgeStyle();
        edgeStyle[window.mxConstants.STYLE_STROKECOLOR] = '#666666';
        edgeStyle[window.mxConstants.STYLE_STROKEWIDTH] = 2;
        edgeStyle[window.mxConstants.STYLE_ROUNDED] = true;
        edgeStyle[window.mxConstants.STYLE_EDGE] = window.mxConstants.EDGESTYLE_ORTHOGONAL;

        debugLog('预览样式设置完成');

    } catch (error) {
        console.error('设置预览样式失败:', error);
    }
}

/**
 * 在预览中渲染工作流 - 使用和设计器相同的逻辑
 * @param {Object} graph - mxGraph实例
 * @param {Object} workflow - 工作流数据
 */
function renderWorkflowInPreview(graph, workflow) {
    debugLog('renderWorkflowInPreview 开始，工作流:', workflow);

    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
        debugLog('工作流为空，跳过渲染');
        return;
    }

    // 使用设计器的转换函数（如果可用）
    if (typeof window.convertWorkflowToGraph === 'function') {
        try {
            debugLog('尝试使用设计器转换函数');
            debugLog('工作流数据:', workflow);
            debugLog('工作流步骤数量:', workflow.steps?.length);
            debugLog('第一个步骤:', workflow.steps?.[0]);

            // 确保工作流数据格式正确
            if (workflow && workflow.steps && Array.isArray(workflow.steps)) {
                // 提供clearCanvas函数给convertWorkflowToGraph使用
                window.clearCanvas = function (graph) {
                    const model = graph.getModel();
                    model.beginUpdate();
                    try {
                        const parent = graph.getDefaultParent();
                        const children = graph.getChildVertices(parent);
                        graph.removeCells(children);
                    } finally {
                        model.endUpdate();
                    }
                };

                // 调用设计器的转换函数
                console.log('🔄 调用 convertWorkflowToGraph...');
                window.convertWorkflowToGraph(graph, workflow);
                console.log('✅ convertWorkflowToGraph 完成');
                debugLog('使用设计器转换函数渲染完成');
                return;
            } else {
                debugLog('工作流数据格式不匹配，使用简化渲染');
                console.log('❌ 工作流数据格式不匹配:', {
                    hasWorkflow: !!workflow,
                    hasSteps: !!workflow?.steps,
                    isArray: Array.isArray(workflow?.steps),
                    stepsLength: workflow?.steps?.length
                });
            }
        } catch (error) {
            console.error('❌ 设计器转换函数失败:', error);
            console.error('错误堆栈:', error.stack);
            debugLog('转换函数错误详情:', error);
        }
    } else {
        console.warn('⚠️ convertWorkflowToGraph函数不可用');
        debugLog('convertWorkflowToGraph函数不可用，使用简化渲染');
    }

    // 简化版本的渲染逻辑
    const parent = graph.getDefaultParent();
    const model = graph.getModel();

    model.beginUpdate();
    try {
        // 计算布局参数
        const nodeWidth = 140;
        const nodeHeight = 70;
        const horizontalSpacing = 200;
        const verticalSpacing = 120;
        const startX = 50;
        const startY = 50;

        let currentX = startX;
        let currentY = startY;
        const nodes = [];

        // 渲染每个步骤
        workflow.steps.forEach((step, index) => {
            let style = getNodeStyle(step.type);
            let label = getNodeLabel(step);
            let width = nodeWidth;
            let height = nodeHeight;

            // 特殊节点类型的处理
            if (step.type === 'condition') {
                width = 120;
                height = 80;
                style = 'condition';
            } else if (step.type === 'loop') {
                width = 160;
                height = 90;
                style = 'loop';

                // 如果是循环容器，需要更大的尺寸
                if (step.loopType === 'container' && step.subOperations && step.subOperations.length > 0) {
                    width = 200;
                    height = 120;
                }
            }

            // 创建节点
            const node = graph.insertVertex(
                parent,
                step.id || `step_${index}`,
                label,
                currentX,
                currentY,
                width,
                height,
                style
            );

            // 保存节点数据
            node.nodeData = { ...step };
            nodes.push(node);

            // 处理循环容器的子操作
            if (step.type === 'loop' && step.loopType === 'container' && step.subOperations) {
                renderSubOperations(graph, node, step.subOperations);
            }

            // 更新位置
            currentX += horizontalSpacing;

            // 如果一行太长，换行
            if (currentX > 1000) {
                currentX = startX;
                currentY += verticalSpacing;
            }
        });

        // 添加连接线
        for (let i = 0; i < nodes.length - 1; i++) {
            const source = nodes[i];
            const target = nodes[i + 1];

            if (source && target) {
                graph.insertEdge(parent, null, '', source, target);
            }
        }

        debugLog('工作流预览渲染完成');

    } catch (error) {
        console.error('渲染工作流预览失败:', error);
    } finally {
        model.endUpdate();
    }
}

/**
 * 绘制简单流程图
 * @param {CanvasRenderingContext2D} ctx - Canvas上下文
 * @param {Array} steps - 步骤数组
 * @param {number} canvasWidth - 画布宽度
 * @param {number} canvasHeight - 画布高度
 */
function drawSimpleFlowChart(ctx, steps, canvasWidth, canvasHeight) {
    if (!steps || steps.length === 0) {
        drawEmptyState(ctx, canvasWidth, canvasHeight);
        return;
    }

    // 清空画布
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 设置基本样式
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const nodeWidth = 120;
    const nodeHeight = 50;
    const spacing = 150;
    const startY = canvasHeight / 2;

    // 计算总宽度和起始X位置
    const totalWidth = (steps.length + 2) * spacing; // +2 for start and end
    const startX = Math.max(50, (canvasWidth - totalWidth) / 2 + spacing);

    // 绘制开始节点
    drawNode(ctx, startX - spacing, startY, 80, 40, '开始', '#4CAF50');

    // 绘制步骤节点
    steps.forEach((step, index) => {
        const x = startX + index * spacing;
        const label = step.name || `步骤 ${index + 1}`;
        let color = '#2196F3';

        // 根据步骤类型设置颜色
        if (step.type === 'condition') {
            color = '#FF9800';
        } else if (step.type === 'loop') {
            color = '#9C27B0';
        }

        drawNode(ctx, x, startY, nodeWidth, nodeHeight, label, color);

        // 绘制连接线
        if (index === 0) {
            // 从开始节点到第一个步骤
            drawArrow(ctx, startX - spacing + 40, startY, x - nodeWidth / 2, startY);
        } else {
            // 步骤之间的连接
            const prevX = startX + (index - 1) * spacing;
            drawArrow(ctx, prevX + nodeWidth / 2, startY, x - nodeWidth / 2, startY);
        }
    });

    // 绘制结束节点
    const endX = startX + steps.length * spacing;
    drawNode(ctx, endX, startY, 80, 40, '结束', '#F44336');

    // 从最后一个步骤到结束节点的连接线
    if (steps.length > 0) {
        const lastStepX = startX + (steps.length - 1) * spacing;
        drawArrow(ctx, lastStepX + nodeWidth / 2, startY, endX - 40, startY);
    }
}

/**
 * 绘制节点
 * @param {CanvasRenderingContext2D} ctx - Canvas上下文
 * @param {number} x - X坐标
 * @param {number} y - Y坐标
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {string} text - 文本
 * @param {string} color - 颜色
 */
function drawNode(ctx, x, y, width, height, text, color) {
    const nodeX = x - width / 2;
    const nodeY = y - height / 2;

    // 绘制节点背景
    ctx.fillStyle = color;
    ctx.fillRect(nodeX, nodeY, width, height);

    // 绘制边框
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(nodeX, nodeY, width, height);

    // 绘制文本
    ctx.fillStyle = 'white';
    ctx.fillText(text, x, y);
}

/**
 * 绘制箭头
 * @param {CanvasRenderingContext2D} ctx - Canvas上下文
 * @param {number} fromX - 起始X坐标
 * @param {number} fromY - 起始Y坐标
 * @param {number} toX - 结束X坐标
 * @param {number} toY - 结束Y坐标
 */
function drawArrow(ctx, fromX, fromY, toX, toY) {
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;

    // 绘制线条
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // 绘制箭头头部
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const arrowLength = 10;
    const arrowAngle = Math.PI / 6;

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - arrowLength * Math.cos(angle - arrowAngle),
        toY - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - arrowLength * Math.cos(angle + arrowAngle),
        toY - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.stroke();
}

/**
 * 绘制空状态
 * @param {CanvasRenderingContext2D} ctx - Canvas上下文
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 */
function drawEmptyState(ctx, width, height) {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#999';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂无流程图数据', width / 2, height / 2);
}

/**
 * 初始化预览事件监听器
 */
export function initializePreviewListeners() {
    // 监听配置选择事件
    window.addEventListener('configSelected', (event) => {
        const workflow = event.detail.workflow;
        renderFlowPreview(workflow);
    });

    // 监听清除预览事件
    window.addEventListener('clearPreview', () => {
        clearFlowPreview();
    });

    debugLog('预览事件监听器已初始化');
}

/**
 * 渲染循环容器的子操作
 * @param {Object} graph - mxGraph实例
 * @param {Object} containerNode - 容器节点
 * @param {Array} subOperations - 子操作列表
 */
function renderSubOperations(graph, containerNode, subOperations) {
    if (!subOperations || subOperations.length === 0) return;

    const containerGeometry = containerNode.getGeometry();
    const subNodeWidth = 100;
    const subNodeHeight = 40;
    const padding = 10;

    subOperations.forEach((subOp, index) => {
        const x = padding + (index * (subNodeWidth + 10));
        const y = containerGeometry.height - subNodeHeight - padding;

        const subNode = graph.insertVertex(
            containerNode,
            subOp.id || `sub_${index}`,
            getNodeLabel(subOp),
            x,
            y,
            subNodeWidth,
            subNodeHeight,
            getNodeStyle(subOp.type)
        );

        subNode.nodeData = { ...subOp };
    });
}

/**
 * 获取节点样式
 * @param {string} nodeType - 节点类型
 * @returns {string} 样式名称
 */
function getNodeStyle(nodeType) {
    // 直接使用节点类型作为样式名，这样可以匹配我们在setupPreviewStyles中定义的样式
    const validTypes = ['click', 'input', 'wait', 'smartWait', 'loop', 'condition', 'checkState', 'extract'];

    if (validTypes.includes(nodeType)) {
        return nodeType;
    }

    // 对于特殊情况的映射
    const styleMap = {
        'navigate': 'click',
        'delay': 'wait'
    };

    return styleMap[nodeType] || 'click';
}

/**
 * 获取节点标签
 * @param {Object} step - 步骤数据
 * @returns {string} 节点标签
 */
function getNodeLabel(step) {
    if (step.name) {
        return step.name;
    }

    const labelMap = {
        'click': '点击操作',
        'input': '输入文本',
        'wait': '智能等待',
        'condition': '条件判断',
        'loop': '循环操作',
        'extract': '提取数据',
        'navigate': '页面导航'
    };

    return labelMap[step.type] || '未知操作';
}