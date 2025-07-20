/**
 * 工作流设计器核心模块
 * 负责mxGraph初始化、基础配置和核心功能
 */

// mxGraph配置在 utils/mxGraphConfig.js 中处理
// 立即配置mxGraph，防止CORS错误
configureMxGraph();

/**
 * 工作流设计器核心类
 */
export class MxGraphWorkflowDesigner {
    constructor() {
        this.graph = null;
        this.nodeConfigs = new Map(); // 存储节点配置
        this.selectedCell = null;

        // 执行状态管理
        this.executionState = {
            isRunning: false,
            isPaused: false,
            currentNodeIndex: 0,
            totalNodes: 0,
            currentWorkflow: null
        };
        this.contextMenuPoint = null;
        this.contextMenuContainer = null;

        // 节点类型配置（使用模块中的配置）
        this.nodeTypes = nodeTypes;

        // 循环类型配置
        this.loopTypes = {
            element: '元素循环',
            count: '次数循环'
        };

        this.init();
    }

    /**
     * 初始化设计器
     */
    async init() {
        try {
            // 等待mxGraph加载
            await this.waitForMxGraph();

            // 初始化mxGraph
            this.initMxGraph();

            // 设置样式
            this.setupStyles();

            // 初始化事件监听
            this.initEventListeners();

            // 设置窗口大小监听
            this.setupResizeListener();

            // 设置鼠标滚轮缩放
            this.setupMouseWheelZoom();

            // 设置右键菜单
            this.setupContextMenu();

            // 从localStorage加载工作流数据
            this.loadWorkflowFromStorage();

            // 更新节点计数
            this.updateNodeCount();

            console.log('✅ 工作流设计器初始化完成');
        } catch (error) {
            console.error('❌ 工作流设计器初始化失败:', error);
            this.updateStatus('初始化失败: ' + error.message);
        }
    }

    /**
     * 等待mxGraph库加载完成
     */
    waitForMxGraph() {
        return new Promise((resolve, reject) => {
            const checkMxGraph = () => {
                if (typeof mxGraph !== 'undefined' && typeof mxClient !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkMxGraph, 100);
                }
            };
            checkMxGraph();
        });
    }

    /**
     * 初始化mxGraph实例
     */
    initMxGraph() {
        // 进一步禁用资源加载，防止CORS错误
        if (typeof mxResources !== 'undefined') {
            mxResources.extension = null;
            mxResources.resourcesEncoded = false;
            mxResources.loadDefaultBundle = false;
        }

        // 禁用样式表加载
        if (typeof mxClient !== 'undefined') {
            mxClient.link = function () { return; }; // 禁用CSS加载
        }

        // 检查浏览器支持
        if (!mxClient.isBrowserSupported()) {
            throw new Error('浏览器不支持mxGraph');
        }

        const container = document.getElementById('graphContainer');
        container.innerHTML = '';

        // 创建图形实例
        this.graph = new mxGraph(container);

        // 基础配置
        this.graph.setConnectable(true);
        this.graph.setMultigraph(false);
        this.graph.setAllowDanglingEdges(false);
        this.graph.setCellsEditable(false); // 禁用双击编辑
        this.graph.setHtmlLabels(true); // 启用HTML标签

        // 确保容器内的子节点跟随容器移动
        this.graph.setCellsMovable(true);
        this.graph.setRecursiveResize(true); // 启用递归调整大小
        this.graph.setConstrainChildren(true); // 约束子节点在父容器内
        this.graph.setExtendParents(false); // 禁止自动扩展父容器

        // 启用区域选择功能
        this.rubberband = new mxRubberband(this.graph);

        // 自定义区域选择行为
        this.setupAreaSelection();

        // 启用连线处理器
        this.graph.connectionHandler.enabled = true;
        this.graph.connectionHandler.setCreateTarget(false);

        // 改进连线选择和操作
        this.graph.setTolerance(10); // 增加选择容差
        this.graph.connectionHandler.marker.validColor = '#27ae60'; // 绿色表示可连接
        this.graph.connectionHandler.marker.invalidColor = '#e74c3c'; // 红色表示不可连接

        // 设置连线图标（小圆点）
        this.graph.connectionHandler.connectImage = new mxImage('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjQiIGZpbGw9IiMyMTk2RjMiLz4KPC9zdmc+', 16, 16);

        // 添加连线验证（移到连线处理器）
        const originalIsValidConnection = this.graph.connectionHandler.isValidConnection;
        this.graph.connectionHandler.isValidConnection = (source, target) => {
            if (!originalIsValidConnection.call(this.graph.connectionHandler, source, target)) {
                return false;
            }
            return this.validateConnection(source, target);
        };

        // 自定义连线创建，为条件判断添加标签
        this.graph.connectionHandler.factoryMethod = (source, target, style, create) => {
            let value = '';

            // 检查源节点是否为条件判断
            const sourceConfig = this.nodeConfigs.get(source.id);
            if (sourceConfig && sourceConfig.type === 'condition') {
                // 为条件判断的连线添加标签和样式
                const existingEdges = this.graph.getOutgoingEdges(source);
                if (existingEdges.length === 0) {
                    value = '满足'; // 第一条连线标记为"满足"
                    style = 'conditionTrue'; // 应用绿色样式
                } else if (existingEdges.length === 1) {
                    value = '不满足'; // 第二条连线标记为"不满足"
                    style = 'conditionFalse'; // 应用红色样式
                }
            }

            if (create) {
                return this.graph.insertEdge(this.graph.getDefaultParent(), null, value, source, target, style);
            }
            return null;
        };

        console.log('✅ mxGraph初始化完成');
    }

    /**
     * 设置区域选择行为
     */
    setupAreaSelection() {
        const container = this.graph.container;

        // 添加鼠标事件监听器来改善用户体验
        this.graph.addMouseListener({
            mouseMove: (sender, me) => {
                const cell = me.getCell();
                if (cell == null) {
                    // 鼠标在空白区域，显示可拖动光标
                    container.style.cursor = 'grab';
                } else {
                    container.style.cursor = 'pointer';
                }
            },
            mouseDown: (sender, me) => {
                const cell = me.getCell();
                if (cell == null) {
                    // 鼠标按下时显示抓取中光标
                    container.style.cursor = 'grabbing';
                }
            },
            mouseUp: (sender, me) => {
                container.style.cursor = 'default';
            }
        });
    }

    /**
     * 验证连线是否有效
     */
    validateConnection(source, target) {
        // 不允许自连接
        if (source === target) {
            return false;
        }

        // 检查是否已经存在连接
        const edges = this.graph.getEdgesBetween(source, target);
        if (edges.length > 0) {
            return false;
        }

        // 条件判断节点最多只能有两个输出连接
        const sourceConfig = this.nodeConfigs.get(source.id);
        if (sourceConfig && sourceConfig.type === 'condition') {
            const outgoingEdges = this.graph.getOutgoingEdges(source);
            if (outgoingEdges.length >= 2) {
                return false;
            }
        }

        return true;
    }

    /**
     * 设置样式
     */
    setupStyles() {
        const stylesheet = this.graph.getStylesheet();

        // 基础节点样式
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
            [mxConstants.STYLE_WHITE_SPACE]: 'wrap', // 关键：启用文本换行
            [mxConstants.STYLE_OVERFLOW]: 'width'    // 关键：按宽度换行
        };

        // 为每种节点类型创建样式
        Object.keys(this.nodeTypes).forEach(type => {
            const config = this.nodeTypes[type];
            const style = {
                ...baseNodeStyle,
                [mxConstants.STYLE_FILLCOLOR]: config.color,
                [mxConstants.STYLE_STROKECOLOR]: config.color
            };
            stylesheet.putCellStyle(type, style);
        });

        // 循环容器样式（swimlane）
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
            [mxConstants.STYLE_STARTSIZE]: 40, // 增加标题栏高度，让收起按钮更大
            [mxConstants.STYLE_WHITE_SPACE]: 'wrap',
            [mxConstants.STYLE_OVERFLOW]: 'width',
            [mxConstants.STYLE_COLLAPSIBLE]: 1, // 启用折叠功能
            [mxConstants.STYLE_RESIZABLE]: 1    // 启用调整大小
        };
        stylesheet.putCellStyle('loopContainer', loopContainerStyle);

        // 自定义折叠按钮样式
        this.setupCollapseButton();

        // 条件判断菱形样式
        const conditionStyle = {
            ...baseNodeStyle,
            [mxConstants.STYLE_SHAPE]: mxConstants.SHAPE_RHOMBUS,
            [mxConstants.STYLE_PERIMETER]: mxPerimeter.RhombusPerimeter,
            [mxConstants.STYLE_FILLCOLOR]: '#e67e22',
            [mxConstants.STYLE_STROKECOLOR]: '#e67e22'
        };
        stylesheet.putCellStyle('condition', conditionStyle);

        // 设置连线样式
        const edgeStyle = this.graph.getStylesheet().getDefaultEdgeStyle();
        edgeStyle[mxConstants.STYLE_ROUNDED] = true;
        edgeStyle[mxConstants.STYLE_STROKEWIDTH] = 3;
        edgeStyle[mxConstants.STYLE_STROKECOLOR] = '#666666';
        edgeStyle[mxConstants.STYLE_EDGE] = mxConstants.EDGESTYLE_ORTHOGONAL;
        edgeStyle[mxConstants.STYLE_FONTSIZE] = 12;
        edgeStyle[mxConstants.STYLE_FONTCOLOR] = '#333333';

        // 选中连线样式
        const selectedEdgeStyle = mxUtils.clone(edgeStyle);
        selectedEdgeStyle[mxConstants.STYLE_STROKECOLOR] = '#FF5722';
        selectedEdgeStyle[mxConstants.STYLE_STROKEWIDTH] = 4;
        this.graph.getStylesheet().putCellStyle('selectedEdge', selectedEdgeStyle);

        // 条件判断连线样式
        const conditionTrueEdgeStyle = mxUtils.clone(edgeStyle);
        conditionTrueEdgeStyle[mxConstants.STYLE_STROKECOLOR] = '#27ae60'; // 绿色表示满足
        conditionTrueEdgeStyle[mxConstants.STYLE_FONTCOLOR] = '#27ae60';
        this.graph.getStylesheet().putCellStyle('conditionTrue', conditionTrueEdgeStyle);

        const conditionFalseEdgeStyle = mxUtils.clone(edgeStyle);
        conditionFalseEdgeStyle[mxConstants.STYLE_STROKECOLOR] = '#e74c3c'; // 红色表示不满足
        conditionFalseEdgeStyle[mxConstants.STYLE_FONTCOLOR] = '#e74c3c';
        this.graph.getStylesheet().putCellStyle('conditionFalse', conditionFalseEdgeStyle);

        // 改进节点和连线选择
        this.graph.addListener(mxEvent.CLICK, (sender, evt) => {
            const cell = evt.getProperty('cell');
            if (cell && cell.isEdge()) {
                // 选中连线时改变样式
                this.graph.setCellStyle('selectedEdge', [cell]);
            }
        });

        console.log('✅ 样式设置完成');
    }

    /**
     * 设置折叠按钮样式
     */
    setupCollapseButton() {
        // 自定义折叠按钮的绘制
        const originalDrawFoldingImage = mxSwimlane.prototype.drawFoldingImage;
        mxSwimlane.prototype.drawFoldingImage = function (c, x, y, w, h) {
            // 绘制更大的折叠按钮
            const size = 16; // 按钮大小
            const margin = 8; // 边距

            c.setStrokeColor('#1976d2');
            c.setFillColor('#ffffff');
            c.setStrokeWidth(2);

            // 绘制圆形背景
            c.ellipse(x + w - size - margin, y + margin, size, size);
            c.fillAndStroke();

            // 绘制折叠图标
            c.setStrokeColor('#1976d2');
            c.setStrokeWidth(2);
            c.begin();

            if (this.state.cell.collapsed) {
                // 展开图标 (+)
                c.moveTo(x + w - size / 2 - margin, y + margin + 4);
                c.lineTo(x + w - size / 2 - margin, y + margin + size - 4);
                c.moveTo(x + w - size - margin + 4, y + margin + size / 2);
                c.lineTo(x + w - margin - 4, y + margin + size / 2);
            } else {
                // 收起图标 (-)
                c.moveTo(x + w - size - margin + 4, y + margin + size / 2);
                c.lineTo(x + w - margin - 4, y + margin + size / 2);
            }

            c.stroke();
        };
    }

    /**
     * 更新状态显示
     */
    updateStatus(message) {
        const statusElement = document.getElementById('statusText');
        if (statusElement) {
            statusElement.textContent = message;
        }
        console.log('状态:', message);
    }

    /**
     * 更新节点计数
     */
    updateNodeCount() {
        const parent = this.graph.getDefaultParent();
        const vertices = this.graph.getChildVertices(parent);

        // 递归计算所有节点（包括容器内的子节点）
        let totalCount = 0;
        const countNodes = (container) => {
            const children = this.graph.getChildVertices(container);
            totalCount += children.length;
            children.forEach(child => {
                if (this.graph.isSwimlane(child)) {
                    countNodes(child);
                }
            });
        };

        countNodes(parent);

        const countElement = document.getElementById('nodeCount');
        if (countElement) {
            countElement.textContent = totalCount;
        }
    }

    /**
     * 清空画布
     */
    clearCanvas() {
        if (confirm('确定要清空画布吗？此操作不可撤销。')) {
            this.graph.removeCells(this.graph.getChildVertices(this.graph.getDefaultParent()));
            this.nodeConfigs.clear();
            this.updateNodeCount();
            this.updateStatus('画布已清空');
        }
    }
}