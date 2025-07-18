/**
 * 基于mxGraph的工作流设计器 - 重构版本
 * 支持循环操作带子操作、文本自动换行等功能
 *
 * 依赖的模块文件（通过HTML script标签加载）：
 * - utils/mxGraphConfig.js - mxGraph配置和节点样式
 * - utils/mxGraphOperations.js - 图形操作功能
 * - utils/workflowConverter.js - 工作流转换功能
 */

// mxGraph配置在 utils/mxGraphConfig.js 中处理
// 立即配置mxGraph，防止CORS错误
configureMxGraph();
class MxGraphWorkflowDesigner {
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

            // 设置窗口大小调整监听
            this.setupResizeListener();

            // 更新状态
            this.updateStatus('mxGraph工作流设计器已就绪');

            // 适应画布大小
            this.graph.fit();

            // 尝试从localStorage加载工作流数据
            this.loadWorkflowFromStorage();

        } catch (error) {
            console.error('初始化失败:', error);
            this.updateStatus('初始化失败: ' + error.message);
        }
    }
    
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
            
            // 10秒超时
            setTimeout(() => reject(new Error('mxGraph加载超时')), 10000);
        });
    }
    
    initMxGraph() {
        // 进一步禁用资源加载，防止CORS错误
        if (typeof mxResources !== 'undefined') {
            mxResources.extension = null;
            mxResources.resourcesEncoded = false;
            mxResources.loadDefaultBundle = false;
            mxResources.loadSpecialBundle = false;
            // 完全禁用资源加载
            mxResources.add = function() { return; };
            mxResources.get = function(key, params, defaultValue) { return defaultValue || key; };
        }

        // 禁用样式表加载
        if (typeof mxClient !== 'undefined') {
            mxClient.link = function() { return; }; // 禁用CSS加载
        }

        // 检查浏览器支持
        if (!mxClient.isBrowserSupported()) {
            throw new Error('浏览器不支持mxGraph');
        }

        // 清除加载提示
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
        const originalInsertEdge = this.graph.connectionHandler.insertEdge;
        this.graph.connectionHandler.insertEdge = (parent, id, value, source, target, style) => {
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
                } else {
                    // 条件判断节点最多只能有两条出边
                    alert('条件判断节点最多只能连接两个目标节点！');
                    return null;
                }
            }

            return originalInsertEdge.call(this.graph.connectionHandler, parent, id, value, source, target, style);
        };

        // 启用画布拖动
        this.graph.setPanning(true);
        this.graph.panningHandler.useLeftButtonForPanning = true;

        // 配置拖动行为：只在空白区域拖动
        this.graph.panningHandler.isPanningTrigger = function(me) {
            const cell = me.getCell();
            // 只有在没有选中任何单元格时才允许拖动
            return cell == null;
        };

        // 设置拖动时的鼠标样式
        this.graph.panningHandler.panningEnabled = true;

        // 禁用右键拖动，避免与右键菜单冲突
        this.graph.panningHandler.usePopupTrigger = false;

        // 添加鼠标样式指示器
        this.graph.addMouseListener({
            mouseMove: (sender, me) => {
                const cell = me.getCell();
                if (cell == null) {
                    // 鼠标在空白区域，显示可拖动光标
                    container.style.cursor = 'grab';
                } else {
                    // 鼠标在节点上，显示默认光标
                    container.style.cursor = 'default';
                }
            },
            mouseDown: (sender, me) => {
                const cell = me.getCell();
                if (cell == null) {
                    // 鼠标按下时显示抓取中光标
                    container.style.cursor = 'grabbing';
                }
            },
            mouseUp: () => {
                // 鼠标释放时恢复光标
                const cell = this.graph.getSelectionCell();
                container.style.cursor = cell ? 'default' : 'grab';
            }
        });

        // 启用分组功能
        this.graph.setDropEnabled(true);
        this.graph.setSplitEnabled(false);
        this.graph.setResizeContainer(false); // 禁用自动调整容器大小

        // 设置画布大小为容器大小
        this.graph.minimumContainerSize = new mxRectangle(0, 0, container.offsetWidth, container.offsetHeight);
        this.graph.resizeContainer = false;

        // 设置网格
        this.graph.setGridEnabled(true);
        this.graph.setGridSize(20);

        // 设置连线样式
        const edgeStyle = this.graph.getStylesheet().getDefaultEdgeStyle();
        edgeStyle[mxConstants.STYLE_ROUNDED] = true;
        edgeStyle[mxConstants.STYLE_STROKEWIDTH] = 3;
        edgeStyle[mxConstants.STYLE_STROKECOLOR] = '#2196F3';
        edgeStyle[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector;
        edgeStyle[mxConstants.STYLE_ENDARROW] = mxConstants.ARROW_CLASSIC;
        edgeStyle[mxConstants.STYLE_ENDFILL] = 1;
        edgeStyle[mxConstants.STYLE_ENDSIZE] = 8;
        // 连线标签样式
        edgeStyle[mxConstants.STYLE_FONTSIZE] = 12;
        edgeStyle[mxConstants.STYLE_FONTCOLOR] = '#333333';
        edgeStyle[mxConstants.STYLE_FONTFAMILY] = 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
        edgeStyle[mxConstants.STYLE_LABEL_BACKGROUNDCOLOR] = '#ffffff';
        edgeStyle[mxConstants.STYLE_LABEL_BORDERCOLOR] = '#cccccc';

        // 设置选中时的连线样式
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
                this.selectedCell = cell;
            } else if (cell && cell.isVertex()) {
                // 选中节点
                this.selectedCell = cell;
                // 清除连线选中样式
                const edges = this.graph.getChildEdges(this.graph.getDefaultParent());
                this.graph.setCellStyle(null, edges);
            } else {
                // 点击空白区域，取消所有选中
                const edges = this.graph.getChildEdges(this.graph.getDefaultParent());
                this.graph.setCellStyle(null, edges);
                this.selectedCell = null;
            }
        });

        // 添加键盘事件支持
        document.addEventListener('keydown', (e) => {
            // 检查是否在输入框、文本域或可编辑元素内
            const activeElement = document.activeElement;
            const isInInputField = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.tagName === 'SELECT' ||
                activeElement.isContentEditable ||
                activeElement.hasAttribute('data-focused') ||
                activeElement.closest('.property-panel') // 在属性面板内的任何元素
            );

            // 删除功能 - 只在非输入状态下响应
            if ((e.key === 'Delete' || e.key === 'Backspace') && !isInInputField) {
                e.preventDefault();

                const selectedCells = this.graph.getSelectionCells();
                if (selectedCells.length > 0) {
                    // 批量删除选中的元素
                    selectedCells.forEach(cell => {
                        if (cell.isVertex()) {
                            this.deleteNode(cell);
                        } else if (cell.isEdge()) {
                            this.graph.removeCells([cell]);
                        }
                    });
                } else if (this.selectedCell) {
                    // 单个删除
                    if (this.selectedCell.isEdge()) {
                        this.graph.removeCells([this.selectedCell]);
                        this.selectedCell = null;
                    } else if (this.selectedCell.isVertex()) {
                        this.deleteNode(this.selectedCell);
                    }
                }
            }

            // 区域选择快捷键
            if (e.ctrlKey) {
                switch (e.key) {
                    case '=':
                    case '+':
                        e.preventDefault();
                        this.scaleSelection(1.2);
                        break;
                    case '-':
                        e.preventDefault();
                        this.scaleSelection(0.8);
                        break;
                    case 'a':
                        e.preventDefault();
                        this.graph.selectAll();
                        break;
                }
            }
        });

        // 启用撤销重做
        const undoManager = new mxUndoManager();
        const listener = function(sender, evt) {
            undoManager.undoableEditHappened(evt.getProperty('edit'));
        };
        this.graph.getModel().addListener(mxEvent.UNDO, listener);
        this.graph.getView().addListener(mxEvent.UNDO, listener);

        // 选择事件
        this.graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
            this.onSelectionChange();
        });

        // 启用鼠标滚轮缩放
        this.setupMouseWheelZoom();

        // 设置右键菜单
        this.setupContextMenu();

        console.log('mxGraph初始化完成');
    }

    setupMouseWheelZoom() {
        // 为画布容器添加鼠标滚轮事件监听
        const container = this.graph.container;

        const handleWheel = (evt) => {
            // 阻止页面滚动
            evt.preventDefault();

            // 获取滚轮方向
            const delta = evt.deltaY || evt.wheelDelta;

            if (delta > 0) {
                // 向下滚动，缩小
                this.graph.zoomOut();
            } else {
                // 向上滚动，放大
                this.graph.zoomIn();
            }
        };

        // 添加事件监听器
        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('mousewheel', handleWheel, { passive: false }); // 兼容旧浏览器
    }

    setupContextMenu() {
        // 获取右键菜单元素
        const contextMenu = document.getElementById('contextMenu');
        const graphContainer = document.getElementById('graphContainer');

        // 禁用浏览器默认右键菜单
        graphContainer.addEventListener('contextmenu', (evt) => {
            evt.preventDefault();

            // 获取画布容器的边界矩形
            const containerRect = this.graph.container.getBoundingClientRect();

            // 计算鼠标在画布容器内的相对位置
            const relativeX = evt.clientX - containerRect.left;
            const relativeY = evt.clientY - containerRect.top;

            // 获取当前视图的缩放和平移
            const view = this.graph.getView();
            const scale = view.getScale();
            const translate = view.getTranslate();

            // 计算在图形坐标系中的位置（用于创建节点）
            const graphX = relativeX / scale - translate.x;
            const graphY = relativeY / scale - translate.y;

            this.contextMenuPoint = new mxPoint(graphX, graphY);

            // 检查是否在容器内右键
            const cell = this.graph.getCellAt(graphX, graphY);
            this.contextMenuContainer = null;

            if (cell && cell.isVertex() && this.graph.isSwimlane(cell)) {
                // 在循环容器内右键，记录容器
                this.contextMenuContainer = cell;
                // 调整坐标为相对于容器的坐标
                const geometry = cell.getGeometry();
                this.contextMenuPoint = new mxPoint(
                    graphX - geometry.x,
                    graphY - geometry.y
                );
            }

            // 显示右键菜单（使用鼠标的页面坐标）
            contextMenu.style.display = 'block';
            contextMenu.style.left = relativeX + 'px';
            contextMenu.style.top = relativeY + 'px';

            // 防止菜单超出视窗边界
            setTimeout(() => {
                const menuRect = contextMenu.getBoundingClientRect();
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;

                let left = relativeX;
                let top = relativeY;

                if (left + menuRect.width > windowWidth) {
                    left = evt.clientX - menuRect.width;
                }

                if (top + menuRect.height > windowHeight) {
                    top = evt.clientY - menuRect.height;
                }

                contextMenu.style.left = left + 'px';
                contextMenu.style.top = top + 'px';
            }, 0);
        });

        // 点击其他地方隐藏右键菜单
        document.addEventListener('click', () => {
            contextMenu.style.display = 'none';
        });

        // 为右键菜单项添加点击事件
        const menuItems = document.querySelectorAll('.context-menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', async () => {
                const nodeType = item.dataset.type;
                if (this.contextMenuPoint) {
                    await this.addNodeToCanvas(
                        nodeType,
                        this.contextMenuPoint.x,
                        this.contextMenuPoint.y,
                        this.contextMenuContainer
                    );
                }
                contextMenu.style.display = 'none';
            });
        });
    }
    
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
    }
    
    initEventListeners() {
        // 清空画布
        document.getElementById('clearCanvas').addEventListener('click', () => {
            this.clearCanvas();
        });

        // 保存工作流
        document.getElementById('saveWorkflow').addEventListener('click', () => {
            this.saveWorkflowWithDialog();
        });

        // 加载工作流
        document.getElementById('loadWorkflow').addEventListener('click', () => {
            this.loadWorkflowFromFile();
        });

        // 导出数据
        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });

        // 执行工作流
        document.getElementById('executeWorkflow').addEventListener('click', () => {
            this.executeWorkflow();
        });

        // 暂停工作流
        document.getElementById('pauseWorkflow').addEventListener('click', () => {
            this.pauseWorkflow();
        });

        // 继续工作流
        document.getElementById('resumeWorkflow').addEventListener('click', () => {
            this.resumeWorkflow();
        });

        // 停止工作流
        document.getElementById('stopWorkflow').addEventListener('click', () => {
            this.stopWorkflow();
        });

        // 添加键盘快捷键
        document.addEventListener('keydown', async (e) => {
            // 检查是否在输入框、文本域或可编辑元素内
            const activeElement = document.activeElement;
            const isInInputField = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.tagName === 'SELECT' ||
                activeElement.isContentEditable ||
                activeElement.hasAttribute('data-focused') ||
                activeElement.closest('.property-panel') // 在属性面板内的任何元素
            );

            // Ctrl+S 保存
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveWorkflow();
            }

            // Delete 删除选中节点 - 只在非输入状态下响应
            if (e.key === 'Delete' && this.selectedCell && !isInInputField) {
                e.preventDefault();
                this.deleteNode(this.selectedCell);
            }

            // Ctrl+Z 撤销
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.graph.getModel().undo();
            }

            // Ctrl+Y 重做
            if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                this.graph.getModel().redo();
            }

            // 快速创建节点的快捷键
            if (e.ctrlKey && !e.shiftKey && !e.altKey) {
                const keyMap = {
                    '1': 'click',
                    '2': 'input',
                    '3': 'wait',
                    '4': 'smartWait',
                    '5': 'loop',
                    '6': 'condition',
                    '7': 'checkState'
                };

                if (keyMap[e.key]) {
                    e.preventDefault();
                    // 在画布中心创建节点
                    const bounds = this.graph.getGraphBounds();
                    const centerX = bounds.x + bounds.width / 2 || 200;
                    const centerY = bounds.y + bounds.height / 2 || 200;
                    await this.addNodeToCanvas(keyMap[e.key], centerX, centerY, null);
                }
            }
        });
    }

    setupResizeListener() {
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            // 延迟执行以确保DOM更新完成
            setTimeout(() => {
                const container = this.graph.container;
                const containerRect = container.getBoundingClientRect();

                // 更新画布大小
                this.graph.minimumContainerSize = new mxRectangle(0, 0, containerRect.width, containerRect.height);
                this.graph.doResizeContainer(containerRect.width, containerRect.height);

                // 刷新视图
                this.graph.refresh();
            }, 100);
        });
    }

    showLoopTypeDialog() {
        return new Promise((resolve) => {
            // 创建模态对话框
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
            `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                min-width: 300px;
                text-align: center;
            `;

            dialog.innerHTML = `
                <h3 style="margin-bottom: 15px; color: #333;">选择循环类型</h3>
                <div style="margin-bottom: 20px;">
                    <button id="containerLoop" style="
                        display: block;
                        width: 100%;
                        padding: 12px;
                        margin-bottom: 10px;
                        background: #3498db;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">🔄 循环操作带子操作（容器）</button>
                    <button id="selfLoop" style="
                        display: block;
                        width: 100%;
                        padding: 12px;
                        margin-bottom: 10px;
                        background: #27ae60;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">🔁 自循环操作</button>
                    <button id="cancelLoop" style="
                        display: block;
                        width: 100%;
                        padding: 12px;
                        background: #95a5a6;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">❌ 取消</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // 绑定事件
            document.getElementById('containerLoop').onclick = () => {
                document.body.removeChild(overlay);
                resolve('container');
            };

            document.getElementById('selfLoop').onclick = () => {
                document.body.removeChild(overlay);
                resolve('self');
            };

            document.getElementById('cancelLoop').onclick = () => {
                document.body.removeChild(overlay);
                resolve(null);
            };

            // 点击背景关闭
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    resolve(null);
                }
            };
        });
    }

    // 节点创建功能已移至 utils/mxGraphOperations.js 中的 createNode 函数
    async addNodeToCanvas(nodeType, x = 100, y = 100, parentContainer = null) {
        const config = this.nodeTypes[nodeType];
        if (!config) return;

        // 对于循环节点，需要特殊处理
        if (nodeType === 'loop') {
            const loopType = await this.showLoopTypeDialog();
            if (!loopType) return; // 用户取消

            console.log('选择的循环类型:', loopType); // 调试日志

            const nodeData = {
                type: 'loop',
                name: config.name,
                loopType: loopType,
                loopSelector: '',
                maxIterations: 10,
                subOperations: loopType === 'container' ? [] : undefined
            };

            console.log('创建循环节点数据:', nodeData); // 调试日志

            const cell = createNode(this.graph, nodeType, x, y, nodeData);
            this.nodeConfigs.set(cell.id, nodeData);
            // 确保节点数据同步
            cell.nodeData = nodeData;
            this.graph.setSelectionCell(cell);

            console.log('创建的循环节点:', {
                id: cell.id,
                style: cell.style,
                isSwimlane: this.graph.isSwimlane(cell),
                nodeData: cell.nodeData
            }); // 调试日志
        } else {
            // 使用模块中的 createNode 函数
            const nodeData = {
                type: nodeType,
                name: config.name
            };

            const cell = createNode(this.graph, nodeType, x, y, nodeData);
            this.nodeConfigs.set(cell.id, nodeData);
            // 确保节点数据同步
            cell.nodeData = nodeData;
            this.graph.setSelectionCell(cell);
        }

        // 延迟更新，确保选择事件已处理
        setTimeout(() => {
            this.updateNodeCount();
            this.updateStatus(`已添加${config.name}`);
        }, 50);
    }
    
    onSelectionChange() {
        const cells = this.graph.getSelectionCells();
        if (cells.length === 1 && this.graph.getModel().isVertex(cells[0])) {
            this.selectedCell = cells[0];
            this.showPropertyPanel(this.selectedCell);
        } else {
            this.selectedCell = null;
            this.hidePropertyPanel();
        }
    }
    
    showPropertyPanel(cell) {
        const panel = document.getElementById('propertyPanel');
        const form = document.getElementById('propertyForm');

        panel.classList.add('show');

        // 优先从 nodeConfigs 获取配置，如果没有则从 cell.nodeData 获取
        let config = this.nodeConfigs.get(cell.id);
        if (!config || Object.keys(config).length === 0) {
            config = cell.nodeData || {};
            // 如果从 nodeData 获取到配置，同步到 nodeConfigs
            if (config && Object.keys(config).length > 0) {
                this.nodeConfigs.set(cell.id, config);
                console.log(`从 nodeData 恢复配置: ${cell.id} -> ${config.type}`);
            }
        }

        const nodeType = config.type || 'unknown';

        console.log(`显示属性面板: ${cell.id}, 类型: ${nodeType}, 配置:`, config);

        form.innerHTML = this.generatePropertyForm(cell, config);

        // 绑定表单事件
        this.bindPropertyFormEvents(cell);
    }
    
    hidePropertyPanel() {
        const panel = document.getElementById('propertyPanel');
        panel.classList.remove('show');
    }
    
    updateNodeCount() {
        const parent = this.graph.getDefaultParent();

        // 获取所有顶点（节点）
        const vertices = this.graph.getChildVertices(parent);
        const nodeCount = vertices.length;

        // 获取所有边（连线）
        const edges = this.graph.getChildEdges(parent);
        const edgeCount = edges.length;

        document.getElementById('nodeCount').textContent = `节点: ${nodeCount} | 连线: ${edgeCount}`;
    }
    
    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
        console.log('状态:', message);
    }
    
    clearCanvas() {
        if (confirm('确定要清空画布吗？此操作不可撤销。')) {
            this.graph.removeCells(this.graph.getChildVertices(this.graph.getDefaultParent()));
            this.nodeConfigs.clear();
            this.updateNodeCount();
            this.updateStatus('画布已清空');
        }
    }
    
    // 带对话框的保存工作流
    saveWorkflowWithDialog() {
        try {
            const workflowData = this.exportWorkflowData();
            if (!workflowData || !workflowData.steps || workflowData.steps.length === 0) {
                alert('请先创建工作流步骤再保存');
                return;
            }

            // 获取现有的工作流列表
            let savedWorkflows = [];
            try {
                const existing = localStorage.getItem('automationWorkflows');
                if (existing) {
                    savedWorkflows = JSON.parse(existing);
                }
            } catch (error) {
                console.error('读取现有工作流失败:', error);
            }

            // 获取当前工作流名称（如果有的话）
            const currentName = workflowData.name || '';

            // 弹出输入对话框
            const workflowName = prompt('请输入工作流名称:', currentName || '新建工作流');

            if (!workflowName || !workflowName.trim()) {
                this.updateStatus('保存已取消');
                return;
            }

            const trimmedName = workflowName.trim();

            // 检查是否已存在同名工作流
            const existingIndex = savedWorkflows.findIndex(w => w.name === trimmedName);
            if (existingIndex >= 0) {
                if (!confirm(`工作流 "${trimmedName}" 已存在，是否覆盖？`)) {
                    this.updateStatus('保存已取消');
                    return;
                }
            }

            // 更新工作流数据
            workflowData.name = trimmedName;
            workflowData.updatedAt = new Date().toISOString();
            if (!workflowData.createdAt) {
                workflowData.createdAt = new Date().toISOString();
            }

            // 保存到工作流列表
            if (existingIndex >= 0) {
                savedWorkflows[existingIndex] = workflowData;
                console.log('✅ 更新现有工作流:', trimmedName);
            } else {
                savedWorkflows.push(workflowData);
                console.log('✅ 添加新工作流:', trimmedName);
            }

            // 保存到localStorage
            localStorage.setItem('automationWorkflows', JSON.stringify(savedWorkflows));

            // 同时保存到设计器本地存储
            localStorage.setItem('mxgraph_workflow', JSON.stringify(workflowData));

            // 显示成功提示
            this.updateStatus(`✅ 工作流 "${trimmedName}" 保存成功！`);

            // 触发storage事件，通知插件面板更新
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'automationWorkflows',
                newValue: JSON.stringify(savedWorkflows),
                url: window.location.href
            }));

            console.log('✅ 工作流保存完成，已通知插件面板同步');

        } catch (error) {
            console.error('❌ 保存工作流失败:', error);
            this.updateStatus('保存失败: ' + error.message);
            alert('保存失败: ' + error.message);
        }
    }

    saveWorkflow() {
        try {
            const data = this.exportWorkflowData();
            localStorage.setItem('mxgraph_workflow', JSON.stringify(data));
            this.updateStatus('工作流已保存到本地存储');
        } catch (error) {
            console.error('保存失败:', error);
            this.updateStatus('保存失败: ' + error.message);
        }
    }
    
    loadWorkflow() {
        try {
            const data = localStorage.getItem('mxgraph_workflow');
            if (data) {
                this.importWorkflowData(JSON.parse(data));
                this.updateStatus('工作流已从本地存储加载');
            } else {
                this.updateStatus('未找到保存的工作流');
            }
        } catch (error) {
            console.error('加载失败:', error);
            this.updateStatus('加载失败: ' + error.message);
        }
    }

    loadWorkflowFromFile() {
        // 创建文件输入元素
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    console.log('📁 加载的工作流数据:', data);
                    console.log('📊 数据结构检查:', {
                        hasSteps: !!(data.steps && Array.isArray(data.steps)),
                        stepsCount: data.steps ? data.steps.length : 0,
                        hasConnections: !!(data.connections && Array.isArray(data.connections)),
                        connectionsCount: data.connections ? data.connections.length : 0,
                        hasNodes: !!(data.nodes && Array.isArray(data.nodes)),
                        nodesCount: data.nodes ? data.nodes.length : 0,
                        dataKeys: Object.keys(data)
                    });

                    this.importWorkflowData(data);
                    this.updateStatus(`工作流已从文件 "${file.name}" 加载`);
                } catch (error) {
                    console.error('文件解析失败:', error);
                    this.updateStatus('文件格式错误: ' + error.message);
                    alert('文件格式错误，请选择有效的工作流JSON文件');
                }
            };

            reader.onerror = () => {
                this.updateStatus('文件读取失败');
                alert('文件读取失败，请重试');
            };

            reader.readAsText(file);

            // 清理文件输入元素
            document.body.removeChild(fileInput);
        });

        // 添加到DOM并触发点击
        document.body.appendChild(fileInput);
        fileInput.click();
    }
    
    exportData() {
        try {
            const data = this.exportWorkflowData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // 生成带时间戳的文件名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            a.download = `workflow-${timestamp}.json`;

            a.click();
            URL.revokeObjectURL(url);
            this.updateStatus(`工作流数据已导出为 ${a.download}`);
        } catch (error) {
            console.error('导出失败:', error);
            this.updateStatus('导出失败: ' + error.message);
        }
    }
    
    // 工作流执行功能已移至 utils/mxGraphExecution.js 中
    async executeWorkflow() {
        await executeWorkflow(this);
    }

    // 节点执行功能已移至 utils/mxGraphExecution.js 中
    async executeNode(node) {
        await executeStep(node);
    }

    // 执行点击操作
    async executeClickNode(config) {
        const element = this.findElement(config.locator);
        if (!element) {
            throw new Error(`未找到元素: ${config.locator?.value}`);
        }

        // 滚动到元素位置
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.delay(300);

        // 高亮元素
        this.highlightElement(element);

        // 点击元素
        element.click();
        console.log('点击元素:', element);

        // 等待点击后的延迟
        if (config.clickDelay) {
            await this.delay(config.clickDelay);
        }
    }

    // 执行输入操作
    async executeInputNode(config) {
        const element = this.findElement(config.locator);
        if (!element) {
            throw new Error(`未找到输入元素: ${config.locator?.value}`);
        }

        // 滚动到元素位置
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.delay(300);

        // 高亮元素
        this.highlightElement(element);

        // 清空原有内容（如果配置了）
        if (config.clearBefore) {
            element.value = '';
            element.textContent = '';
        }

        // 输入文本
        if (config.inputText) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.value = config.inputText;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                element.textContent = config.inputText;
            }
        }

        console.log('输入文本:', config.inputText, '到元素:', element);
    }

    // 执行等待操作
    async executeWaitNode(config) {
        const duration = config.duration || 1000;
        console.log('等待', duration, '毫秒');
        await this.delay(duration);
    }

    // 执行智能等待操作
    async executeSmartWaitNode(config) {
        const timeout = config.timeout || 10000;
        const checkInterval = config.checkInterval || 500;
        const startTime = Date.now();

        console.log('智能等待元素:', config.locator?.value);

        while (Date.now() - startTime < timeout) {
            const element = this.findElement(config.locator);

            if (config.waitType === 'appear' && element) {
                console.log('元素已出现');
                return;
            } else if (config.waitType === 'disappear' && !element) {
                console.log('元素已消失');
                return;
            }

            await this.delay(checkInterval);
        }

        throw new Error(`智能等待超时: ${config.locator?.value}`);
    }

    // 查找元素
    findElement(locator) {
        if (!locator || !locator.strategy || !locator.value) {
            return null;
        }

        try {
            console.log('开始查找元素:', locator);

            // 尝试多种查找策略
            let element = null;
            let searchResults = [];

            // 策略1: 在当前页面查找
            console.log('策略1: 在当前页面查找');
            element = this.searchInDocument(document, locator);
            if (element) {
                console.log('在当前页面找到元素:', element);
                return element;
            }
            searchResults.push('当前页面: 未找到');

            // 策略2: 在父页面查找（如果在iframe中）
            if (window.parent && window.parent !== window) {
                try {
                    console.log('策略2: 在父页面查找');
                    element = this.searchInDocument(window.parent.document, locator);
                    if (element) {
                        console.log('在父页面找到元素:', element);
                        return element;
                    }
                    searchResults.push('父页面: 未找到');
                } catch (e) {
                    console.log('无法访问父页面:', e.message);
                    searchResults.push('父页面: 访问被拒绝');
                }
            }

            console.warn('所有策略都未找到元素:', searchResults);
            return null;

        } catch (error) {
            console.error('查找元素时出错:', error);
            return null;
        }
    }

    // 在指定文档中搜索元素
    searchInDocument(doc, locator) {
        try {
            let element = null;
            console.log('在文档中搜索:', doc.title || 'unknown', '定位器:', locator);

            switch (locator.strategy) {
                case 'css':
                    // 自动添加.前缀（如果需要）
                    let cssSelector = locator.value;
                    if (locator.value && !locator.value.startsWith('.') && !locator.value.startsWith('#') && !locator.value.includes(' ') && !locator.value.includes('[')) {
                        cssSelector = '.' + locator.value;
                        console.log('自动添加CSS类选择器前缀:', cssSelector);
                    }
                    element = doc.querySelector(cssSelector);
                    console.log('CSS查询结果:', element);
                    break;
                case 'xpath':
                    const xpathResult = doc.evaluate(locator.value, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    element = xpathResult.singleNodeValue;
                    console.log('XPath查询结果:', element);
                    break;
                case 'id':
                    element = doc.getElementById(locator.value);
                    console.log('ID查询结果:', element);
                    break;
                case 'text':
                    element = Array.from(doc.querySelectorAll('*')).find(el =>
                        el.textContent && el.textContent.trim() === locator.value.trim()
                    );
                    console.log('文本查询结果:', element);
                    break;
                case 'contains':
                    element = Array.from(doc.querySelectorAll('*')).find(el =>
                        el.textContent && el.textContent.includes(locator.value)
                    );
                    console.log('包含文本查询结果:', element);
                    break;
                default:
                    console.warn('不支持的定位策略:', locator.strategy);
                    return null;
            }

            if (element) {
                console.log('找到元素:', element, '在文档:', doc.title || 'unknown');
            }

            return element;
        } catch (error) {
            console.error('在文档中搜索元素时出错:', error);
            return null;
        }
    }

    // 高亮元素
    highlightElement(element) {
        if (!element) return;

        element.style.outline = '3px solid #007bff';
        element.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';

        setTimeout(() => {
            element.style.outline = '';
            element.style.backgroundColor = '';
        }, 2000);
    }

    // 高亮正在执行的节点
    highlightExecutingNode(nodeId) {
        console.log('高亮执行节点:', nodeId);
        // 简化版本：只在控制台输出，避免mxGraph API问题
        this.updateStatus(`正在执行节点: ${nodeId}`);
    }

    // 移除节点高亮
    removeNodeHighlight(nodeId) {
        console.log('移除节点高亮:', nodeId);
        // 简化版本：只在控制台输出
    }

    // 延迟函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 工作流控制功能已移至 utils/mxGraphExecution.js 中
    pauseWorkflow() {
        pauseWorkflow(this);
    }

    resumeWorkflow() {
        resumeWorkflow(this);
    }

    stopWorkflow() {
        stopWorkflow(this);
    }

    // UI更新功能已移至 utils/mxGraphExecution.js 中
    updateExecutionStatus(text, progress = 0) {
        updateExecutionStatus(this, text, progress);
        this.updateStatus(text);
    }

    updateExecutionUI() {
        updateExecutionUI(this);
    }

    generatePropertyForm(cell, config) {
        const nodeType = config.type || 'unknown';
        const nodeConfig = this.nodeTypes[nodeType] || {};

        let formHtml = `
            <div class="form-group">
                <label class="form-label">节点类型</label>
                <input type="text" class="form-input" value="${nodeConfig.name || nodeType}" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">节点名称</label>
                <input type="text" class="form-input" id="nodeName" value="${config.name || ''}" placeholder="输入节点名称">
                <div class="form-help">节点在流程图中显示的名称</div>
            </div>
        `;

        // 根据节点类型添加特定配置
        switch (nodeType) {
            case 'click':
                formHtml += `
                    <div class="form-group">
                        <label class="form-label">定位策略</label>
                        <select class="form-select" id="locatorType">
                            <option value="css" ${config.locator?.strategy === 'css' || config.locator?.type === 'css' ? 'selected' : ''}>CSS选择器 [示例: .btn-primary, #submit-btn]</option>
                            <option value="xpath" ${config.locator?.strategy === 'xpath' || config.locator?.type === 'xpath' ? 'selected' : ''}>XPath [示例: //button[@class='btn']]</option>
                            <option value="id" ${config.locator?.strategy === 'id' || config.locator?.type === 'id' ? 'selected' : ''}>ID [示例: submit-button]</option>
                            <option value="className" ${config.locator?.strategy === 'className' || config.locator?.type === 'className' ? 'selected' : ''}>类名 [示例: btn-primary]</option>
                            <option value="text" ${config.locator?.strategy === 'text' || config.locator?.type === 'text' ? 'selected' : ''}>文本内容 [示例: 确定, 提交]</option>
                            <option value="contains" ${config.locator?.strategy === 'contains' || config.locator?.type === 'contains' ? 'selected' : ''}>包含文本 [示例: 部分文本匹配]</option>
                            <option value="tagName" ${config.locator?.strategy === 'tagName' || config.locator?.type === 'tagName' ? 'selected' : ''}>标签名 [示例: button, input]</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位值</label>
                        <input type="text" class="form-input" id="locatorValue" value="${config.locator?.value || ''}" placeholder="输入定位值">
                        <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">🎯 测试</button>
                        <div class="form-help">用于定位页面元素的值</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">点击后等待时间(毫秒)</label>
                        <input type="number" class="form-input" id="waitAfterClick" value="${config.waitAfterClick || 1000}" min="0">
                        <div class="form-help">点击后等待页面响应的时间</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">错误处理</label>
                        <select class="form-select" id="errorHandling">
                            <option value="continue" ${config.errorHandling === 'continue' ? 'selected' : ''}>继续执行</option>
                            <option value="stop" ${config.errorHandling === 'stop' ? 'selected' : ''}>停止执行</option>
                            <option value="retry" ${config.errorHandling === 'retry' ? 'selected' : ''}>重试操作</option>
                        </select>
                    </div>
                `;
                break;

            case 'input':
                formHtml += `
                    <div class="form-group">
                        <label class="form-label">定位策略</label>
                        <select class="form-select" id="locatorType">
                            <option value="css" ${config.locator?.type === 'css' ? 'selected' : ''}>CSS选择器 [示例: input[name='username'], #email]</option>
                            <option value="xpath" ${config.locator?.type === 'xpath' ? 'selected' : ''}>XPath [示例: //input[@type='text']]</option>
                            <option value="id" ${config.locator?.type === 'id' ? 'selected' : ''}>ID [示例: username-input]</option>
                            <option value="className" ${config.locator?.type === 'className' ? 'selected' : ''}>类名 [示例: form-control]</option>
                            <option value="text" ${config.locator?.type === 'text' ? 'selected' : ''}>文本内容 [示例: 用户名, 邮箱]</option>
                            <option value="contains" ${config.locator?.type === 'contains' ? 'selected' : ''}>包含文本 [示例: 部分文本匹配]</option>
                            <option value="tagName" ${config.locator?.type === 'tagName' ? 'selected' : ''}>标签名 [示例: input, textarea]</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位值</label>
                        <input type="text" class="form-input" id="locatorValue" value="${config.locator?.value || ''}" placeholder="输入定位值">
                        <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">🎯 测试</button>
                        <div class="form-help">用于定位输入框元素的值</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">输入内容</label>
                        <textarea class="form-textarea" id="inputText" placeholder="输入要填写的内容">${config.inputText || ''}</textarea>
                        <div class="form-help">要输入到目标元素中的文本内容</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">输入前清空</label>
                        <select class="form-select" id="clearFirst">
                            <option value="true" ${config.clearFirst !== false ? 'selected' : ''}>是</option>
                            <option value="false" ${config.clearFirst === false ? 'selected' : ''}>否</option>
                        </select>
                        <div class="form-help">输入前是否清空原有内容</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">错误处理</label>
                        <select class="form-select" id="errorHandling">
                            <option value="continue" ${config.errorHandling === 'continue' ? 'selected' : ''}>继续执行</option>
                            <option value="stop" ${config.errorHandling === 'stop' ? 'selected' : ''}>停止执行</option>
                            <option value="retry" ${config.errorHandling === 'retry' ? 'selected' : ''}>重试操作</option>
                        </select>
                    </div>
                `;
                break;

            case 'wait':
                formHtml += `
                    <div class="form-group">
                        <label class="form-label">等待时间(毫秒)</label>
                        <input type="number" class="form-input" id="waitDuration" value="${config.duration || 1000}" min="100" max="60000" step="100">
                        <div class="form-help">固定等待的时间长度</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">错误处理</label>
                        <select class="form-select" id="errorHandling">
                            <option value="continue" ${config.errorHandling === 'continue' ? 'selected' : ''}>继续执行</option>
                            <option value="stop" ${config.errorHandling === 'stop' ? 'selected' : ''}>停止执行</option>
                        </select>
                    </div>
                `;
                break;

            case 'smartWait':
                formHtml += `
                    <div class="form-group">
                        <label class="form-label">定位策略</label>
                        <select class="form-select" id="locatorType">
                            <option value="css" ${config.locator?.type === 'css' ? 'selected' : ''}>CSS选择器 [示例: .loading, #content]</option>
                            <option value="xpath" ${config.locator?.type === 'xpath' ? 'selected' : ''}>XPath [示例: //div[@class='loaded']]</option>
                            <option value="id" ${config.locator?.type === 'id' ? 'selected' : ''}>ID [示例: loading-indicator]</option>
                            <option value="className" ${config.locator?.type === 'className' ? 'selected' : ''}>类名 [示例: content-loaded]</option>
                            <option value="text" ${config.locator?.type === 'text' ? 'selected' : ''}>文本内容 [示例: 加载完成]</option>
                            <option value="contains" ${config.locator?.type === 'contains' ? 'selected' : ''}>包含文本 [示例: 部分文本匹配]</option>
                            <option value="tagName" ${config.locator?.type === 'tagName' ? 'selected' : ''}>标签名 [示例: div, span]</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位值</label>
                        <input type="text" class="form-input" id="locatorValue" value="${config.locator?.value || ''}" placeholder="输入定位值">
                        <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">🎯 测试</button>
                        <div class="form-help">等待出现或消失的元素定位值</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">等待条件</label>
                        <select class="form-select" id="waitCondition">
                            <option value="appear" ${config.waitCondition === 'appear' ? 'selected' : ''}>等待元素出现</option>
                            <option value="disappear" ${config.waitCondition === 'disappear' ? 'selected' : ''}>等待元素消失</option>
                            <option value="visible" ${config.waitCondition === 'visible' ? 'selected' : ''}>等待元素可见</option>
                            <option value="hidden" ${config.waitCondition === 'hidden' ? 'selected' : ''}>等待元素隐藏</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">超时时间(毫秒)</label>
                        <input type="number" class="form-input" id="timeout" value="${config.timeout || 10000}" min="1000" max="60000" step="1000">
                        <div class="form-help">最长等待时间，超时后继续执行</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">检查间隔(毫秒)</label>
                        <input type="number" class="form-input" id="checkInterval" value="${config.checkInterval || 500}" min="100" max="5000" step="100">
                        <div class="form-help">检查条件的时间间隔</div>
                    </div>
                `;
                break;

            case 'checkState':
                formHtml += `
                    <div class="form-group">
                        <label class="form-label">定位策略</label>
                        <select class="form-select" id="locatorType">
                            <option value="css" ${config.locator?.type === 'css' ? 'selected' : ''}>CSS选择器 [示例: input[type='checkbox'], .btn]</option>
                            <option value="xpath" ${config.locator?.type === 'xpath' ? 'selected' : ''}>XPath [示例: //button[@disabled]]</option>
                            <option value="id" ${config.locator?.type === 'id' ? 'selected' : ''}>ID [示例: submit-btn]</option>
                            <option value="className" ${config.locator?.type === 'className' ? 'selected' : ''}>类名 [示例: disabled-btn]</option>
                            <option value="text" ${config.locator?.type === 'text' ? 'selected' : ''}>文本内容 [示例: 提交按钮]</option>
                            <option value="contains" ${config.locator?.type === 'contains' ? 'selected' : ''}>包含文本 [示例: 部分文本匹配]</option>
                            <option value="tagName" ${config.locator?.type === 'tagName' ? 'selected' : ''}>标签名 [示例: button, input]</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位值</label>
                        <input type="text" class="form-input" id="locatorValue" value="${config.locator?.value || ''}" placeholder="输入定位值">
                        <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">🎯 测试</button>
                        <div class="form-help">要检测状态的元素定位值</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">检测类型</label>
                        <select class="form-select" id="checkType">
                            <option value="exists" ${config.checkType === 'exists' ? 'selected' : ''}>元素是否存在</option>
                            <option value="visible" ${config.checkType === 'visible' ? 'selected' : ''}>元素是否可见</option>
                            <option value="enabled" ${config.checkType === 'enabled' ? 'selected' : ''}>元素是否可用</option>
                            <option value="disabled" ${config.checkType === 'disabled' ? 'selected' : ''}>元素是否禁用</option>
                            <option value="checked" ${config.checkType === 'checked' ? 'selected' : ''}>复选框是否选中</option>
                            <option value="unchecked" ${config.checkType === 'unchecked' ? 'selected' : ''}>复选框是否未选中</option>
                            <option value="hasText" ${config.checkType === 'hasText' ? 'selected' : ''}>元素是否包含文本</option>
                            <option value="hasClass" ${config.checkType === 'hasClass' ? 'selected' : ''}>元素是否包含CSS类</option>
                            <option value="hasAttribute" ${config.checkType === 'hasAttribute' ? 'selected' : ''}>元素是否包含属性</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">期望值</label>
                        <input type="text" class="form-input" id="expectedValue" value="${config.expectedValue || ''}" placeholder="输入期望的文本/类名/属性值">
                        <div class="form-help">当检测类型为文本/类名/属性时需要填写</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">检测结果处理</label>
                        <select class="form-select" id="resultAction">
                            <option value="continue" ${config.resultAction === 'continue' ? 'selected' : ''}>无论结果都继续</option>
                            <option value="stopIfTrue" ${config.resultAction === 'stopIfTrue' ? 'selected' : ''}>条件满足时停止</option>
                            <option value="stopIfFalse" ${config.resultAction === 'stopIfFalse' ? 'selected' : ''}>条件不满足时停止</option>
                        </select>
                    </div>
                `;
                break;

            case 'extract':
                formHtml += `
                    <div class="form-group">
                        <label class="form-label">定位策略</label>
                        <select class="form-select" id="locatorType">
                            <option value="css" ${config.locator?.type === 'css' ? 'selected' : ''}>CSS选择器 [示例: .price, #title]</option>
                            <option value="xpath" ${config.locator?.type === 'xpath' ? 'selected' : ''}>XPath [示例: //span[@class='price']]</option>
                            <option value="id" ${config.locator?.type === 'id' ? 'selected' : ''}>ID [示例: product-title]</option>
                            <option value="className" ${config.locator?.type === 'className' ? 'selected' : ''}>类名 [示例: product-price]</option>
                            <option value="text" ${config.locator?.type === 'text' ? 'selected' : ''}>文本内容 [示例: 价格, 标题]</option>
                            <option value="contains" ${config.locator?.type === 'contains' ? 'selected' : ''}>包含文本 [示例: 部分文本匹配]</option>
                            <option value="tagName" ${config.locator?.type === 'tagName' ? 'selected' : ''}>标签名 [示例: span, div]</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位值</label>
                        <input type="text" class="form-input" id="locatorValue" value="${config.locator?.value || ''}" placeholder="输入定位值">
                        <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">🎯 测试</button>
                        <div class="form-help">要提取数据的元素定位值</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">提取属性</label>
                        <select class="form-select" id="extractAttribute">
                            <option value="text" ${config.extractAttribute === 'text' ? 'selected' : ''}>文本内容</option>
                            <option value="innerText" ${config.extractAttribute === 'innerText' ? 'selected' : ''}>纯文本内容</option>
                            <option value="innerHTML" ${config.extractAttribute === 'innerHTML' ? 'selected' : ''}>HTML内容</option>
                            <option value="href" ${config.extractAttribute === 'href' ? 'selected' : ''}>链接地址</option>
                            <option value="src" ${config.extractAttribute === 'src' ? 'selected' : ''}>图片地址</option>
                            <option value="value" ${config.extractAttribute === 'value' ? 'selected' : ''}>输入值</option>
                            <option value="title" ${config.extractAttribute === 'title' ? 'selected' : ''}>标题属性</option>
                            <option value="alt" ${config.extractAttribute === 'alt' ? 'selected' : ''}>替代文本</option>
                            <option value="data-*" ${config.extractAttribute === 'data-*' ? 'selected' : ''}>自定义数据属性</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">自定义属性名</label>
                        <input type="text" class="form-input" id="customAttribute" value="${config.customAttribute || ''}" placeholder="当选择自定义数据属性时填写">
                        <div class="form-help">例如：data-price, data-id 等</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">数据存储变量</label>
                        <input type="text" class="form-input" id="variableName" value="${config.variableName || ''}" placeholder="存储提取数据的变量名">
                        <div class="form-help">提取的数据将存储到此变量中</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">提取多个元素</label>
                        <select class="form-select" id="extractMultiple">
                            <option value="false" ${config.extractMultiple === false ? 'selected' : ''}>只提取第一个</option>
                            <option value="true" ${config.extractMultiple === true ? 'selected' : ''}>提取所有匹配的</option>
                        </select>
                    </div>
                `;
                break;

            case 'loop':
                const isContainer = config.loopType === 'container';
                formHtml += `
                    <div class="form-group">
                        <label class="form-label">循环类型</label>
                        <input type="text" class="form-input" value="${isContainer ? '循环操作带子操作（容器）' : '自循环操作'}" readonly>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位策略</label>
                        <select class="form-select" id="locatorStrategy">
                            <option value="css" ${config.locator?.strategy === 'css' || config.locatorStrategy === 'css' ? 'selected' : ''}>CSS选择器 [示例: .btn-primary, #submit-btn]</option>
                            <option value="xpath" ${config.locator?.strategy === 'xpath' || config.locatorStrategy === 'xpath' ? 'selected' : ''}>XPath [示例: //button[@class='btn']]</option>
                            <option value="id" ${config.locator?.strategy === 'id' || config.locatorStrategy === 'id' ? 'selected' : ''}>ID [示例: submit-button]</option>
                            <option value="className" ${config.locator?.strategy === 'className' || config.locatorStrategy === 'className' ? 'selected' : ''}>类名 [示例: btn-primary]</option>
                            <option value="text" ${config.locator?.strategy === 'text' || config.locatorStrategy === 'text' ? 'selected' : ''}>文本内容 [示例: 确定, 提交]</option>
                            <option value="contains" ${config.locator?.strategy === 'contains' || config.locatorStrategy === 'contains' ? 'selected' : ''}>包含文本 [示例: 部分文本匹配]</option>
                            <option value="tagName" ${config.locator?.strategy === 'tagName' || config.locatorStrategy === 'tagName' ? 'selected' : ''}>标签名 [示例: button, input]</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位值</label>
                        <input type="text" class="form-input" id="locatorValue" value="${config.locator?.value || config.locatorValue || ''}" placeholder="输入定位值">
                        <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">🎯 测试</button>
                        <div class="form-help">用于定位页面元素的值</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">起始索引</label>
                        <input type="number" class="form-input" id="startIndex" value="${config.startIndex || 0}" min="0">
                        <div class="form-help">0 表示从第一个元素开始</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">结束索引</label>
                        <input type="number" class="form-input" id="endIndex" value="${config.endIndex || -1}" min="-1">
                        <div class="form-help">-1 表示处理到最后一个元素</div>
                    </div>
                `;

                // 添加操作类型和间隔配置（容器和自循环都需要）
                formHtml += `
                    <div class="form-group">
                        <label class="form-label">操作类型</label>
                        <select class="form-select" id="operationType">
                            <option value="click" ${config.operationType === 'click' ? 'selected' : ''}>点击</option>
                            <option value="input" ${config.operationType === 'input' ? 'selected' : ''}>输入文本</option>
                            <option value="select" ${config.operationType === 'select' ? 'selected' : ''}>选择</option>
                            <option value="wait" ${config.operationType === 'wait' ? 'selected' : ''}>等待</option>
                            <option value="scroll" ${config.operationType === 'scroll' ? 'selected' : ''}>滚动</option>
                            <option value="hover" ${config.operationType === 'hover' ? 'selected' : ''}>悬停</option>
                            <option value="extract" ${config.operationType === 'extract' ? 'selected' : ''}>提取数据</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">操作间隔(毫秒)</label>
                        <input type="number" class="form-input" id="operationDelay" value="${config.operationDelay || 200}" min="0">
                        <div class="form-help">每次操作之间的等待时间</div>
                    </div>
                `;
                break;

            case 'condition':
                console.log('🔧 [DEBUG] 生成条件判断节点表单，当前配置:', config);
                formHtml += `
                    <div class="form-group">
                        <label class="form-label">定位策略</label>
                        <select class="form-select" id="locatorType">
                            <option value="css" ${config.locator?.strategy === 'css' || config.locator?.type === 'css' ? 'selected' : ''}>CSS选择器 [示例: input[type='checkbox'], .btn]</option>
                            <option value="xpath" ${config.locator?.strategy === 'xpath' || config.locator?.type === 'xpath' ? 'selected' : ''}>XPath [示例: //button[@disabled]]</option>
                            <option value="id" ${config.locator?.strategy === 'id' || config.locator?.type === 'id' ? 'selected' : ''}>ID [示例: submit-btn]</option>
                            <option value="className" ${config.locator?.strategy === 'className' || config.locator?.type === 'className' ? 'selected' : ''}>类名 [示例: disabled-btn]</option>
                            <option value="text" ${config.locator?.strategy === 'text' || config.locator?.type === 'text' ? 'selected' : ''}>文本内容 [示例: 提交按钮]</option>
                            <option value="contains" ${config.locator?.strategy === 'contains' || config.locator?.type === 'contains' ? 'selected' : ''}>包含文本 [示例: 部分文本匹配]</option>
                            <option value="tagName" ${config.locator?.strategy === 'tagName' || config.locator?.type === 'tagName' ? 'selected' : ''}>标签名 [示例: button, input]</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位值</label>
                        <input type="text" class="form-input" id="locatorValue" value="${config.locator?.value || ''}" placeholder="输入定位值">
                        <button type="button" class="test-locator-btn" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">🎯 测试</button>
                        <div class="form-help">要判断的元素定位值</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">判断条件</label>
                        <select class="form-select" id="conditionType">
                            <option value="attribute" ${config.conditionType === 'attribute' ? 'selected' : ''}>属性值</option>
                            <option value="text" ${config.conditionType === 'text' ? 'selected' : ''}>文本内容</option>
                            <option value="class" ${config.conditionType === 'class' ? 'selected' : ''}>CSS类名</option>
                            <option value="style" ${config.conditionType === 'style' ? 'selected' : ''}>样式属性</option>
                            <option value="value" ${config.conditionType === 'value' ? 'selected' : ''}>输入框值</option>
                            <option value="exists" ${config.conditionType === 'exists' ? 'selected' : ''}>元素存在</option>
                            <option value="visible" ${config.conditionType === 'visible' ? 'selected' : ''}>元素可见</option>
                        </select>
                    </div>
                    <div class="form-group" id="attributeNameGroup" style="display: ${config.conditionType === 'attribute' || config.conditionType === 'style' ? 'block' : 'none'};">
                        <label class="form-label">属性/样式名称</label>
                        <input type="text" class="form-input" id="attributeName" value="${config.attributeName || ''}" placeholder="例如: disabled, data-status, color">
                        <div class="form-help">要检查的属性名或样式属性名</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">比较方式</label>
                        <select class="form-select" id="comparisonType">
                            <option value="equals" ${config.comparisonType === 'equals' ? 'selected' : ''}>等于</option>
                            <option value="notEquals" ${config.comparisonType === 'notEquals' ? 'selected' : ''}>不等于</option>
                            <option value="contains" ${config.comparisonType === 'contains' ? 'selected' : ''}>包含</option>
                            <option value="notContains" ${config.comparisonType === 'notContains' ? 'selected' : ''}>不包含</option>
                            <option value="startsWith" ${config.comparisonType === 'startsWith' ? 'selected' : ''}>开始于</option>
                            <option value="endsWith" ${config.comparisonType === 'endsWith' ? 'selected' : ''}>结束于</option>
                            <option value="isEmpty" ${config.comparisonType === 'isEmpty' ? 'selected' : ''}>为空</option>
                            <option value="isNotEmpty" ${config.comparisonType === 'isNotEmpty' ? 'selected' : ''}>不为空</option>
                            <option value="hasAttribute" ${config.comparisonType === 'hasAttribute' ? 'selected' : ''}>具有属性</option>
                            <option value="notHasAttribute" ${config.comparisonType === 'notHasAttribute' ? 'selected' : ''}>不具有属性</option>
                        </select>
                    </div>
                    <div class="form-group" id="expectedValueGroup" style="display: ${['isEmpty', 'isNotEmpty', 'exists', 'visible', 'hasAttribute', 'notHasAttribute'].includes(config.comparisonType) ? 'none' : 'block'};">
                        <label class="form-label">期望值</label>
                        <input type="text" class="form-input" id="expectedValue" value="${config.expectedValue || ''}" placeholder="输入期望的值">
                        <div class="form-help">要比较的目标值</div>
                    </div>
                    <div class="form-group">
                        <button type="button" class="test-condition-btn" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">🧪 测试条件</button>
                        <div class="form-help">测试当前条件配置是否正确</div>
                    </div>
                `;
                break;
        }

        formHtml += `
            <div class="form-group" style="margin-top: 20px;">
                <button class="btn" id="saveNodeConfig">💾 保存配置</button>
                <button class="btn secondary" id="deleteNode" style="margin-top: 10px;">🗑️ 删除节点</button>
            </div>
        `;

        return formHtml;
    }

    bindPropertyFormEvents(cell) {
        // 保存配置
        const saveBtn = document.getElementById('saveNodeConfig');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveNodeConfig(cell);
            });
        }

        // 删除节点
        const deleteBtn = document.getElementById('deleteNode');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteNode(cell);
            });
        }

        // 绑定测试定位器按钮事件
        const testLocatorBtns = document.querySelectorAll('.test-locator-btn');
        testLocatorBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.testLocator(e.target);
            });
        });

        // 绑定测试条件按钮事件
        const testConditionBtn = document.querySelector('.test-condition-btn');
        if (testConditionBtn) {
            testConditionBtn.addEventListener('click', (e) => {
                this.testCondition(e.target);
            });
        }

        // 绑定条件类型选择器事件
        const conditionTypeSelect = document.getElementById('conditionType');
        if (conditionTypeSelect) {
            conditionTypeSelect.addEventListener('change', (e) => {
                this.toggleConditionFields(e.target);
            });
        }

        // 绑定比较方式选择器事件
        const comparisonTypeSelect = document.getElementById('comparisonType');
        if (comparisonTypeSelect) {
            comparisonTypeSelect.addEventListener('change', (e) => {
                this.toggleExpectedValueField(e.target);
            });
        }

        // 为所有输入框添加键盘事件保护
        const propertyPanel = document.querySelector('.property-panel');
        if (propertyPanel) {
            const inputs = propertyPanel.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                // 阻止在输入框内的删除键事件传播到document
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                        e.stopPropagation(); // 阻止事件冒泡到document
                    }
                });

                // 确保输入框获得焦点时有明确的焦点状态
                input.addEventListener('focus', (e) => {
                    e.target.setAttribute('data-focused', 'true');
                });

                input.addEventListener('blur', (e) => {
                    e.target.removeAttribute('data-focused');
                });
            });
        }
    }

    saveNodeConfig(cell) {
        const config = this.nodeConfigs.get(cell.id) || {};

        // 获取基础配置
        const nameInput = document.getElementById('nodeName');
        if (nameInput) {
            config.name = nameInput.value;

            // 更新节点显示文本（使用简单格式）
            const nodeType = config.type || 'unknown';
            const newLabel = getNodeSimpleDisplayText(nodeType, config);

            this.graph.getModel().setValue(cell, newLabel);
        }

        // 根据节点类型保存特定配置
        const nodeType = config.type;
        switch (nodeType) {
            case 'click':
                const clickLocatorType = document.getElementById('locatorType');
                const clickLocatorValue = document.getElementById('locatorValue');
                const waitAfterClick = document.getElementById('waitAfterClick');
                const clickErrorHandling = document.getElementById('errorHandling');

                if (clickLocatorType && clickLocatorValue) {
                    config.locator = {
                        strategy: clickLocatorType.value,  // 使用 strategy 而不是 type
                        value: clickLocatorValue.value
                    };
                }
                if (waitAfterClick) config.waitAfterClick = parseInt(waitAfterClick.value);
                if (clickErrorHandling) config.errorHandling = clickErrorHandling.value;
                break;

            case 'input':
                const inputLocatorType = document.getElementById('locatorType');
                const inputLocatorValue = document.getElementById('locatorValue');
                const inputText = document.getElementById('inputText');
                const clearFirst = document.getElementById('clearFirst');
                const inputErrorHandling = document.getElementById('errorHandling');

                if (inputLocatorType && inputLocatorValue) {
                    config.locator = {
                        strategy: inputLocatorType.value,  // 使用 strategy 而不是 type
                        value: inputLocatorValue.value
                    };
                }
                if (inputText) config.inputText = inputText.value;
                if (clearFirst) config.clearFirst = clearFirst.value === 'true';
                if (inputErrorHandling) config.errorHandling = inputErrorHandling.value;
                break;

            case 'wait':
                const waitDuration = document.getElementById('waitDuration');
                const waitErrorHandling = document.getElementById('errorHandling');

                if (waitDuration) config.duration = parseInt(waitDuration.value);
                if (waitErrorHandling) config.errorHandling = waitErrorHandling.value;
                break;

            case 'smartWait':
                const smartWaitLocatorType = document.getElementById('locatorType');
                const smartWaitLocatorValue = document.getElementById('locatorValue');
                const waitCondition = document.getElementById('waitCondition');
                const timeout = document.getElementById('timeout');
                const checkInterval = document.getElementById('checkInterval');

                if (smartWaitLocatorType && smartWaitLocatorValue) {
                    config.locator = {
                        strategy: smartWaitLocatorType.value,  // 使用 strategy 而不是 type
                        value: smartWaitLocatorValue.value
                    };
                }
                if (waitCondition) config.waitCondition = waitCondition.value;
                if (timeout) config.timeout = parseInt(timeout.value);
                if (checkInterval) config.checkInterval = parseInt(checkInterval.value);
                break;

            case 'checkState':
                const checkLocatorType = document.getElementById('locatorType');
                const checkLocatorValue = document.getElementById('locatorValue');
                const checkType = document.getElementById('checkType');
                const expectedValue = document.getElementById('expectedValue');
                const resultAction = document.getElementById('resultAction');

                if (checkLocatorType && checkLocatorValue) {
                    config.locator = {
                        strategy: checkLocatorType.value,  // 使用 strategy 而不是 type
                        value: checkLocatorValue.value
                    };
                }
                if (checkType) config.checkType = checkType.value;
                if (expectedValue) config.expectedValue = expectedValue.value;
                if (resultAction) config.resultAction = resultAction.value;
                break;

            case 'extract':
                const extractLocatorType = document.getElementById('locatorType');
                const extractLocatorValue = document.getElementById('locatorValue');
                const extractAttribute = document.getElementById('extractAttribute');
                const customAttribute = document.getElementById('customAttribute');
                const variableName = document.getElementById('variableName');
                const extractMultiple = document.getElementById('extractMultiple');

                if (extractLocatorType && extractLocatorValue) {
                    config.locator = {
                        strategy: extractLocatorType.value,  // 使用 strategy 而不是 type
                        value: extractLocatorValue.value
                    };
                }
                if (extractAttribute) config.extractAttribute = extractAttribute.value;
                if (customAttribute) config.customAttribute = customAttribute.value;
                if (variableName) config.variableName = variableName.value;
                if (extractMultiple) config.extractMultiple = extractMultiple.value === 'true';
                break;



            case 'loop':
                const locatorStrategy = document.getElementById('locatorStrategy');
                const loopLocatorValue = document.getElementById('locatorValue');
                const startIndex = document.getElementById('startIndex');
                const endIndex = document.getElementById('endIndex');
                const operationType = document.getElementById('operationType');
                const operationDelay = document.getElementById('operationDelay');

                // 修复：将定位器保存为标准格式
                if (locatorStrategy && loopLocatorValue) {
                    config.locator = {
                        strategy: locatorStrategy.value,  // 使用 strategy 而不是 type
                        value: loopLocatorValue.value
                    };
                    console.log('🔧 [DEBUG] 保存循环定位器:', config.locator);
                }

                // 保存其他循环配置
                if (startIndex) config.startIndex = parseInt(startIndex.value);
                if (endIndex) config.endIndex = parseInt(endIndex.value);
                if (operationType) config.operationType = operationType.value;
                if (operationDelay) config.operationDelay = parseInt(operationDelay.value);
                break;

            case 'condition':
                const conditionLocatorType = document.getElementById('locatorType');
                const conditionLocatorValue = document.getElementById('locatorValue');
                const conditionType = document.getElementById('conditionType');
                const attributeName = document.getElementById('attributeName');
                const comparisonType = document.getElementById('comparisonType');
                const conditionExpectedValue = document.getElementById('expectedValue');

                console.log('🔧 [DEBUG] 保存条件判断节点配置，表单元素:', {
                    conditionLocatorType: conditionLocatorType?.value,
                    conditionLocatorValue: conditionLocatorValue?.value,
                    conditionType: conditionType?.value,
                    attributeName: attributeName?.value,
                    comparisonType: comparisonType?.value,
                    conditionExpectedValue: conditionExpectedValue?.value
                });

                if (conditionLocatorType && conditionLocatorValue) {
                    config.locator = {
                        strategy: conditionLocatorType.value,  // 使用 strategy 而不是 type
                        value: conditionLocatorValue.value
                    };
                }
                if (conditionType) config.conditionType = conditionType.value;
                if (attributeName) config.attributeName = attributeName.value;
                if (comparisonType) config.comparisonType = comparisonType.value;
                if (conditionExpectedValue) config.expectedValue = conditionExpectedValue.value;

                console.log('🔧 [DEBUG] 条件判断节点配置已保存:', config);
                break;
        }

        // 保存配置到两个地方，确保数据同步
        this.nodeConfigs.set(cell.id, config);
        cell.nodeData = { ...config, id: cell.id }; // 同步到 nodeData

        console.log(`🔧 [DEBUG] 节点配置已保存: ${cell.id}`, config);
        console.log(`🔧 [DEBUG] nodeData已同步:`, cell.nodeData);
        this.updateStatus('节点配置已保存');
    }

    deleteNode(cell) {
        if (confirm('确定要删除这个节点吗？')) {
            this.graph.removeCells([cell]);
            this.nodeConfigs.delete(cell.id);
            this.hidePropertyPanel();
            this.updateNodeCount();
            this.updateStatus('节点已删除');
        }
    }

    // 工作流数据导出功能已移至 utils/workflowConverter.js 中的 convertGraphToWorkflow 函数
    exportWorkflowData() {
        try {
            // 使用模块中的转换函数
            const workflowName = document.getElementById('workflowName')?.value || '未命名工作流';
            return convertGraphToWorkflow(this.graph, workflowName);
        } catch (error) {
            console.error('导出工作流数据失败:', error);
            throw error;
        }
    }

    // 工作流数据导入功能已移至 utils/workflowConverter.js 中的 convertWorkflowToGraph 函数
    importWorkflowData(data) {
        try {
            // 使用模块中的转换函数
            convertWorkflowToGraph(this.graph, data);

            // 清空节点配置并重新构建（包括容器内的子节点）
            this.nodeConfigs.clear();

            // 递归重建所有节点配置
            const rebuildConfigs = (container) => {
                const children = this.graph.getChildVertices(container);
                children.forEach(cell => {
                    if (cell.nodeData && typeof cell.nodeData === 'object') {
                        this.nodeConfigs.set(cell.id, cell.nodeData);
                        console.log(`重建节点配置: ${cell.id} -> ${cell.nodeData.type}`);
                    }
                    // 递归处理子容器
                    rebuildConfigs(cell);
                });
            };

            // 处理顶层节点
            const vertices = this.graph.getChildVertices(this.graph.getDefaultParent());
            vertices.forEach(cell => {
                if (cell.nodeData && typeof cell.nodeData === 'object') {
                    this.nodeConfigs.set(cell.id, cell.nodeData);
                    console.log(`🔧 [DEBUG] 重建顶层节点配置: ${cell.id} -> ${cell.nodeData.type}`, cell.nodeData);

                    // 特别检查条件判断节点
                    if (cell.nodeData.type === 'condition') {
                        console.log('🔧 [DEBUG] 条件判断节点配置详情:', {
                            conditionType: cell.nodeData.conditionType,
                            comparisonType: cell.nodeData.comparisonType,
                            expectedValue: cell.nodeData.expectedValue,
                            attributeName: cell.nodeData.attributeName,
                            locator: cell.nodeData.locator
                        });
                    }
                } else {
                    console.warn(`🔧 [DEBUG] 节点 ${cell.id} 缺少 nodeData 或 nodeData 不是对象:`, cell.nodeData);
                }
                // 递归处理容器内的子节点
                rebuildConfigs(cell);
            });

            // 重新应用所有节点的样式（延迟执行确保DOM已更新）
            setTimeout(() => {
                this.reapplyAllStyles();
                console.log('导入完成，样式已重新应用');
            }, 100);

            this.updateNodeCount();
        } catch (error) {
            console.error('导入工作流数据失败:', error);
            throw error;
        }
    }

    // 重新应用所有节点的样式
    reapplyAllStyles() {
        console.log('重新应用所有节点样式...');

        const applyStylesToContainer = (container) => {
            const children = this.graph.getChildVertices(container);
            children.forEach(cell => {
                if (cell.nodeData && cell.nodeData.type) {
                    const nodeType = cell.nodeData.type;
                    let styleName = nodeType;

                    // 特殊处理循环容器
                    if (nodeType === 'loop' && cell.nodeData.loopType === 'container') {
                        styleName = 'loopContainer';
                    }
                    // 特殊处理条件判断
                    else if (nodeType === 'condition') {
                        styleName = 'condition';
                    }

                    console.log(`应用子节点样式: ${cell.id} -> ${styleName} (${nodeType})`);
                    this.graph.setCellStyle(styleName, [cell]);

                    // 确保节点显示正确的文本（使用简单格式）
                    const displayText = getNodeSimpleDisplayText(nodeType, cell.nodeData);
                    cell.setValue(displayText);
                }

                // 递归处理子容器
                applyStylesToContainer(cell);
            });
        };

        // 处理顶层节点
        const vertices = this.graph.getChildVertices(this.graph.getDefaultParent());
        vertices.forEach(cell => {
            if (cell.nodeData && cell.nodeData.type) {
                const nodeType = cell.nodeData.type;
                let styleName = nodeType;

                // 特殊处理循环容器
                if (nodeType === 'loop' && cell.nodeData.loopType === 'container') {
                    styleName = 'loopContainer';
                }
                // 特殊处理条件判断
                else if (nodeType === 'condition') {
                    styleName = 'condition';
                }

                console.log(`应用顶层样式: ${cell.id} -> ${styleName} (${nodeType})`);
                this.graph.setCellStyle(styleName, [cell]);

                // 确保节点显示正确的文本（使用简单格式）
                const displayText = getNodeSimpleDisplayText(nodeType, cell.nodeData);
                cell.setValue(displayText);
            }

            // 递归处理容器内的子节点
            applyStylesToContainer(cell);
        });

        // 强制重新绘制所有节点
        this.graph.getModel().beginUpdate();
        try {
            // 触发重绘
            const allCells = this.graph.getChildCells(this.graph.getDefaultParent(), true, true);
            this.graph.cellsResized(allCells);
        } finally {
            this.graph.getModel().endUpdate();
        }

        // 刷新显示
        this.graph.refresh();
        console.log('样式重新应用完成');
    }

    // 节点创建功能已移至 utils/mxGraphOperations.js 中的 createNode 函数
    createNodeFromData(nodeData, parentContainer) {
        return createNode(this.graph, nodeData.type, nodeData.x, nodeData.y, nodeData);
    }

    validateConnection(source, target) {
        if (!source || !target) return false;

        // 检查条件判断节点的连接限制
        const sourceConfig = this.nodeConfigs.get(source.id);
        if (sourceConfig && sourceConfig.type === 'condition') {
            const existingEdges = this.graph.getOutgoingEdges(source);
            if (existingEdges.length >= 2) {
                return false; // 条件判断节点最多只能有两条出边
            }
        }

        // 获取源节点和目标节点的父容器
        const sourceParent = source.getParent();
        const targetParent = target.getParent();

        // 如果两个节点在同一个容器内，允许连接
        if (sourceParent === targetParent) {
            return true;
        }

        // 如果源节点是容器的最后一个节点，可以连接到其他容器或顶层节点
        if (this.isLastNodeInContainer(source) && this.isValidTargetForContainerExit(target)) {
            return true;
        }

        // 其他情况不允许跨容器连线
        return false;
    }

    isLastNodeInContainer(node) {
        const parent = node.getParent();
        if (!parent || parent === this.graph.getDefaultParent()) {
            return true; // 顶层节点
        }

        // 检查是否是容器内的最后一个节点（没有出边连接到同容器内的其他节点）
        const edges = this.graph.getOutgoingEdges(node);
        const siblings = this.graph.getChildVertices(parent);

        for (let edge of edges) {
            if (edge.target && siblings.includes(edge.target)) {
                return false; // 还有连接到同容器内的节点
            }
        }

        return true;
    }

    isValidTargetForContainerExit(target) {
        const targetParent = target.getParent();

        // 可以连接到顶层节点
        if (targetParent === this.graph.getDefaultParent()) {
            return true;
        }

        // 可以连接到其他容器的第一个节点
        if (this.isFirstNodeInContainer(target)) {
            return true;
        }

        return false;
    }

    isFirstNodeInContainer(node) {
        const parent = node.getParent();
        if (!parent || parent === this.graph.getDefaultParent()) {
            return true; // 顶层节点
        }

        // 检查是否是容器内的第一个节点（没有入边来自同容器内的其他节点）
        const edges = this.graph.getIncomingEdges(node);
        const siblings = this.graph.getChildVertices(parent);

        for (let edge of edges) {
            if (edge.source && siblings.includes(edge.source)) {
                return false; // 有来自同容器内的连接
            }
        }

        return true;
    }

    deleteNode(cell) {
        if (!cell || !cell.isVertex()) return;

        // 检查是否为容器且包含子节点
        if (this.graph.isSwimlane(cell)) {
            const children = this.graph.getChildVertices(cell);
            if (children.length > 0) {
                // 容器内有节点，弹窗确认
                const confirmed = confirm(`该循环容器内包含 ${children.length} 个节点，确定要删除吗？\n删除容器将同时删除其内部的所有节点。`);
                if (!confirmed) {
                    return; // 用户取消删除
                }
            }
        }

        // 执行删除
        this.graph.removeCells([cell]);
        this.selectedCell = null;

        // 清理节点配置
        this.nodeConfigs.delete(cell.id);
    }

    setupCollapseButton() {
        // 自定义折叠按钮的渲染
        const originalCreateFoldingImage = mxGraph.prototype.createFoldingImage;
        this.graph.createFoldingImage = function(state) {
            const image = originalCreateFoldingImage.apply(this, arguments);
            if (image) {
                // 大幅增加折叠按钮的大小，让它更容易点击
                image.bounds.width = 5;
                image.bounds.height = 5;
                // 调整位置到左上角，更符合用户习惯
                image.bounds.x = state.x + 8;
                image.bounds.y = state.y + 8;
            }
            return image;
        };

        // 设置折叠按钮的样式
        mxConstants.HANDLE_SIZE = 5;
        mxConstants.HANDLE_FILLCOLOR = '#2196f3';
        mxConstants.HANDLE_STROKECOLOR = '#1976d2';
    }

    setupAreaSelection() {
        // 存储选中的节点
        this.selectedCells = [];

        // 监听选择变化事件
        this.graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
            this.selectedCells = this.graph.getSelectionCells();
            this.updateSelectionToolbar();
        });

        // 创建选择工具栏
        this.createSelectionToolbar();

        // 自定义Rubberband行为，只在Ctrl键按下时启用
        const originalIsEnabled = this.rubberband.isEnabled;
        this.rubberband.isEnabled = function() {
            // 检查是否按下Ctrl键
            const evt = this.graph.lastEvent || window.event;
            return originalIsEnabled.call(this) && (evt && evt.ctrlKey);
        };
    }

    createSelectionToolbar() {
        // 创建简化的选择工具栏
        const toolbar = document.createElement('div');
        toolbar.id = 'selection-toolbar';
        toolbar.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 5px;
            padding: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            display: none;
            z-index: 1000;
        `;

        toolbar.innerHTML = `
            <div style="display: flex; gap: 8px;">
                <button onclick="workflowDesigner.scaleSelection(1.2)" style="padding: 8px 12px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 14px;">
                    🔍+ 放大
                </button>
                <button onclick="workflowDesigner.scaleSelection(0.8)" style="padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 14px;">
                    🔍- 缩小
                </button>
            </div>
        `;

        document.body.appendChild(toolbar);
        this.selectionToolbar = toolbar;
    }

    updateSelectionToolbar() {
        if (this.selectedCells.length > 1) {
            this.selectionToolbar.style.display = 'block';
        } else {
            this.selectionToolbar.style.display = 'none';
        }
    }

    scaleSelection(factor) {
        if (this.selectedCells.length === 0) return;

        this.graph.getModel().beginUpdate();
        try {
            this.selectedCells.forEach(cell => {
                if (cell.isVertex()) {
                    const geometry = cell.getGeometry();
                    if (geometry) {
                        const newGeometry = geometry.clone();
                        newGeometry.width *= factor;
                        newGeometry.height *= factor;
                        this.graph.getModel().setGeometry(cell, newGeometry);
                    }
                }
            });
        } finally {
            this.graph.getModel().endUpdate();
        }

        this.updateStatus(`已${factor > 1 ? '放大' : '缩小'}选中的 ${this.selectedCells.length} 个元素`);
    }

    clearSelection() {
        this.graph.clearSelection();
        this.updateSelectionToolbar();
    }

    // 切换条件字段显示
    toggleConditionFields(select) {
        const attributeGroup = document.querySelector('.form-group:has(#attributeName)');
        const comparisonGroup = document.querySelector('.form-group:has(#comparisonType)');
        const expectedValueGroup = document.querySelector('.form-group:has(#expectedValue)');

        if (attributeGroup) {
            attributeGroup.style.display = ['attribute', 'style'].includes(select.value) ? 'block' : 'none';
        }

        if (comparisonGroup) {
            comparisonGroup.style.display = 'block';
        }

        // 触发比较方式的字段切换
        const comparisonSelect = document.getElementById('comparisonType');
        if (comparisonSelect) {
            this.toggleExpectedValueField(comparisonSelect);
        }
    }

    // 切换期望值字段显示
    toggleExpectedValueField(select) {
        const expectedValueGroup = document.querySelector('.form-group:has(#expectedValue)');
        if (expectedValueGroup) {
            if (['exists', 'notExists'].includes(select.value)) {
                expectedValueGroup.style.display = 'none';
            } else {
                expectedValueGroup.style.display = 'block';
            }
        }
    }

    // 测试条件 - 使用真实的条件测试器
    async testCondition(button) {
        // 初始化条件测试器
        if (!this.conditionTester) {
            try {
                // 检查依赖是否加载
                console.log('🔧 检查依赖加载状态:');
                console.log('  - ConditionTester:', typeof window.ConditionTester);
                console.log('  - TabSelector:', typeof window.TabSelector);

                if (typeof window.ConditionTester === 'undefined') {
                    throw new Error('ConditionTester 类未加载，请确保 conditionTester.js 已正确引入');
                }
                this.conditionTester = new window.ConditionTester();
                console.log('✅ 条件测试器初始化成功');
            } catch (error) {
                console.error('❌ 初始化条件测试器失败:', error);
                button.style.background = '#dc3545';
                button.textContent = '❌ 初始化失败';
                button.disabled = false;
                setTimeout(() => {
                    button.style.background = '#28a745';
                    button.textContent = '🧪 测试条件';
                }, 3000);
                return;
            }
        }

        // 获取表单数据
        const locatorType = document.getElementById('locatorType')?.value;
        const locatorValue = document.getElementById('locatorValue')?.value;
        const conditionType = document.getElementById('conditionType')?.value;
        const attributeName = document.getElementById('attributeName')?.value;
        const comparisonType = document.getElementById('comparisonType')?.value;
        const expectedValue = document.getElementById('expectedValue')?.value;

        if (!locatorType || !locatorValue || !conditionType || !comparisonType) {
            alert('请完整填写条件配置');
            return;
        }

        // 构建条件配置对象
        const conditionConfig = {
            locator: {
                strategy: locatorType,
                value: locatorValue
            },
            conditionType: conditionType,
            comparisonType: comparisonType,
            expectedValue: expectedValue,
            attributeName: attributeName
        };

        // 更新按钮状态
        const originalText = button.textContent;
        const originalBackground = button.style.background;
        button.style.background = '#ffc107';
        button.textContent = '🔄 测试中...';
        button.disabled = true;

        try {
            console.log('🧪 开始真实条件测试:', conditionConfig);
            console.log('🔧 条件测试器实例:', this.conditionTester);
            console.log('🔧 ConditionTester类:', typeof window.ConditionTester);
            console.log('🔧 TabSelector类:', typeof window.TabSelector);

            // 使用条件测试器进行真实测试
            const result = await this.conditionTester.testCondition(conditionConfig);

            console.log('🧪 条件测试结果:', result);

            if (result.success) {
                if (result.conditionMet) {
                    button.style.background = '#28a745';
                    button.textContent = '✅ 条件满足';
                } else {
                    button.style.background = '#ffc107';
                    button.textContent = '⚠️ 条件不满足';
                }
            } else {
                button.style.background = '#dc3545';
                button.textContent = '❌ 测试失败';
                console.error('条件测试失败:', result.error);
            }
        } catch (error) {
            button.style.background = '#dc3545';
            button.textContent = '❌ 测试出错';
            console.error('测试条件时出错:', error);
        } finally {
            button.disabled = false;

            // 3秒后恢复原状
            setTimeout(() => {
                button.style.background = originalBackground || '#28a745';
                button.textContent = originalText || '🧪 测试条件';
            }, 3000);
        }
    }

    // 测试定位器 - 使用模块化测试器
    async testLocator(button) {
        debugger
        // 初始化定位器测试器
        if (!this.locatorTester) {
            this.locatorTester = new LocatorTester();
        }

        const container = button.closest('.form-group');

        // 智能查找定位器元素 - 支持多种界面环境
        let strategySelect = document.getElementById('locatorType');
        let valueInput = document.getElementById('locatorValue');

        // 如果在编辑模态框中，使用编辑界面的元素ID
        if (!strategySelect || !valueInput) {
            strategySelect = document.getElementById('editLocatorStrategy');
            valueInput = document.getElementById('editLocatorValue');
        }

        // 如果是循环操作，使用循环专用的定位器ID
        if (!strategySelect || !valueInput) {
            strategySelect = document.getElementById('editLoopLocatorStrategy');
            valueInput = document.getElementById('editLoopLocatorValue');
        }

        // 如果是workflow-designer-mxgraph.js中的循环操作，使用locatorStrategy
        if (!strategySelect || !valueInput) {
            strategySelect = document.getElementById('locatorStrategy');
            valueInput = document.getElementById('locatorValue');
        }

        // 如果还是找不到，尝试在容器内查找
        if (!strategySelect || !valueInput) {
            strategySelect = container.querySelector('select[id*="Strategy"], select[id*="locator"]');
            valueInput = container.querySelector('input[id*="Value"], input[id*="locator"]');
        }

        if (!strategySelect || !valueInput) {
            alert('请先选择定位策略和输入定位值');
            return;
        }

        const strategy = strategySelect.value;
        const value = valueInput.value.trim();

        if (!value) {
            alert('请输入定位值');
            return;
        }

        // 查找或创建结果显示元素
        let resultElement = container.querySelector('.form-help, .test-result');
        if (!resultElement) {
            resultElement = document.createElement('div');
            resultElement.className = 'test-result';
            container.appendChild(resultElement);
        }

        // 使用模块化测试器进行测试
        await this.locatorTester.testLocator(strategy, value, resultElement, button);
    }

    // 显示标签页选择器
    async showTabSelector(tabs) {
        return new Promise((resolve) => {
            // 创建模态对话框
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                padding: 20px;
                border-radius: 8px;
                max-width: 600px;
                max-height: 400px;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            `;

            dialog.innerHTML = `
                <h3 style="margin-top: 0;">选择要测试的页面</h3>
                <div id="tabList" style="margin-bottom: 15px;">
                    ${tabs.map((tab, index) => `
                        <div class="tab-item" style="padding: 8px; border: 1px solid #ddd; margin-bottom: 5px; cursor: pointer; border-radius: 4px; background: white;"
                             data-tab-index="${index}">
                            <strong>${tab.title || '无标题'}</strong><br>
                            <small style="color: #666;">${tab.url}</small>
                        </div>
                    `).join('')}
                </div>
                <div style="text-align: right;">
                    <button id="cancelTabSelect" style="margin-right: 10px; padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">取消</button>
                </div>
            `;

            modal.appendChild(dialog);
            document.body.appendChild(modal);

            // 添加鼠标悬停效果
            const tabItems = dialog.querySelectorAll('.tab-item');
            tabItems.forEach(item => {
                item.addEventListener('mouseenter', () => {
                    item.style.background = '#f0f0f0';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.background = 'white';
                });
            });

            // 绑定点击事件
            dialog.addEventListener('click', (e) => {
                const tabDiv = e.target.closest('[data-tab-index]');
                if (tabDiv) {
                    const index = parseInt(tabDiv.dataset.tabIndex);
                    document.body.removeChild(modal);
                    resolve(tabs[index]);
                }
            });

            document.getElementById('cancelTabSelect').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(null);
            });

            // 点击背景关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(null);
                }
            });
        });
    }

    // 确保content script已加载
    async ensureContentScriptLoaded(tabId) {
        try {
            // 尝试发送ping消息
            const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
            return response && response.success;
        } catch (error) {
            console.log('Content script未加载，尝试注入...');
            try {
                // 注入content script
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content/content.js']
                });

                // 等待一下再测试
                await new Promise(resolve => setTimeout(resolve, 500));

                // 再次测试
                const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
                return response && response.success;
            } catch (injectError) {
                console.error('无法注入content script:', injectError);
                return false;
            }
        }
    }

    // 本地页面测试（降级方案）
    testLocatorLocal(button, strategy, value) {
        button.style.background = '#ffc107';
        button.textContent = '🔄 本地测试...';

        setTimeout(() => {
            try {
                let elements = [];

                // 根据不同的定位策略查找元素
                switch (strategy) {
                    case 'css':
                        elements = document.querySelectorAll(value);
                        break;
                    case 'xpath':
                        const xpathResult = document.evaluate(value, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                        elements = [];
                        for (let i = 0; i < xpathResult.snapshotLength; i++) {
                            elements.push(xpathResult.snapshotItem(i));
                        }
                        break;
                    case 'id':
                        const idElement = document.getElementById(value);
                        elements = idElement ? [idElement] : [];
                        break;
                    case 'text':
                        elements = Array.from(document.querySelectorAll('*')).filter(el =>
                            el.textContent && el.textContent.trim() === value.trim()
                        );
                        break;
                    case 'contains':
                        elements = Array.from(document.querySelectorAll('*')).filter(el =>
                            el.textContent && el.textContent.includes(value)
                        );
                        break;
                    default:
                        throw new Error(`不支持的定位策略: ${strategy}`);
                }

                // 更新按钮和帮助文本
                const helpText = container.querySelector('.form-help');

                if (elements.length > 0) {
                    button.style.background = '#28a745';
                    button.textContent = `✅ 找到 ${elements.length} 个`;

                    if (helpText) {
                        helpText.textContent = `找到 ${elements.length} 个匹配元素`;
                        helpText.style.color = '#28a745';
                    }
                } else {
                    button.style.background = '#dc3545';
                    button.textContent = '❌ 未找到';

                    if (helpText) {
                        helpText.textContent = '未找到匹配元素';
                        helpText.style.color = '#dc3545';
                    }
                }
            } catch (error) {
                button.style.background = '#dc3545';
                button.textContent = '❌ 错误';

                const helpText = container.querySelector('.form-help');
                if (helpText) {
                    helpText.textContent = `错误: ${error.message}`;
                    helpText.style.color = '#dc3545';
                }

                console.error('测试定位器时出错:', error);
            }

            // 3秒后恢复原状
            setTimeout(() => {
                button.style.background = '#007bff';
                button.textContent = '🎯 测试';

                const helpText = container.querySelector('.form-help');
                if (helpText) {
                    helpText.textContent = '用于定位页面元素的值';
                    helpText.style.color = '#6c757d';
                }
            }, 3000);
        }, 500);
    }

    // ==================== 数据同步功能 ====================

    // 从localStorage加载工作流数据
    loadWorkflowFromStorage() {
        try {
            const workflowData = localStorage.getItem('designer_workflow_data');
            if (workflowData) {
                const workflow = JSON.parse(workflowData);
                console.log('🔄 从localStorage加载工作流数据:', workflow);

                // 转换并导入工作流数据
                this.importWorkflowData(workflow);

                this.updateStatus(`已加载工作流: ${workflow.name}`);

                // 清除localStorage中的数据，避免重复加载
                localStorage.removeItem('designer_workflow_data');
            } else {
                console.log('ℹ️ 没有找到待加载的工作流数据');
            }
        } catch (error) {
            console.error('❌ 从localStorage加载工作流数据失败:', error);
            this.updateStatus('加载工作流数据失败: ' + error.message);
        }
    }

    // 保存工作流数据到localStorage供插件面板同步
    saveWorkflowToStorage() {
        try {
            const workflowData = this.exportWorkflowData();
            if (workflowData && workflowData.steps && workflowData.steps.length > 0) {
                // 获取现有的工作流列表
                let savedWorkflows = [];
                try {
                    const existing = localStorage.getItem('automationWorkflows');
                    if (existing) {
                        savedWorkflows = JSON.parse(existing);
                    }
                } catch (error) {
                    console.error('读取现有工作流失败:', error);
                }

                // 检查是否已存在同名工作流
                const existingIndex = savedWorkflows.findIndex(w => w.name === workflowData.name);
                if (existingIndex >= 0) {
                    // 更新现有工作流
                    savedWorkflows[existingIndex] = workflowData;
                    console.log('✅ 更新现有工作流:', workflowData.name);
                } else {
                    // 添加新工作流
                    savedWorkflows.push(workflowData);
                    console.log('✅ 添加新工作流:', workflowData.name);
                }

                // 保存到localStorage，使用与插件面板相同的键
                localStorage.setItem('automationWorkflows', JSON.stringify(savedWorkflows));
                console.log('✅ 工作流数据已保存到localStorage供插件面板同步');
                this.updateStatus('工作流已同步到插件面板');
            } else {
                console.log('⚠️ 没有工作流数据需要保存');
                this.updateStatus('请先创建工作流步骤');
            }
        } catch (error) {
            console.error('❌ 保存工作流数据到localStorage失败:', error);
            this.updateStatus('保存工作流数据失败: ' + error.message);
        }
    }
}




// 全局函数：测试条件 - 使用真实页面测试
async function testCondition(button) {
    // 如果有工作流设计器实例，使用其方法
    if (window.workflowDesigner && typeof window.workflowDesigner.testCondition === 'function') {
        await window.workflowDesigner.testCondition(button);
        return;
    }

    const locatorStrategy = document.getElementById('locatorType');
    const locatorValue = document.getElementById('locatorValue');
    const conditionType = document.getElementById('conditionType');
    const attributeName = document.getElementById('attributeName');
    const comparisonType = document.getElementById('comparisonType');
    const expectedValue = document.getElementById('expectedValue');

    if (!locatorStrategy || !locatorValue || !conditionType || !comparisonType) {
        alert('请完整填写条件配置');
        return;
    }

    // 使用全局条件测试器
    const originalText = button.textContent;
    button.style.background = '#ffc107';
    button.textContent = '🔄 测试中...';
    button.disabled = true;

    try {
        // 初始化测试器
        if (!window.conditionTester) {
            if (typeof window.ConditionTester === 'undefined') {
                throw new Error('ConditionTester 类未加载，请确保 conditionTester.js 已正确引入');
            }
            window.conditionTester = new window.ConditionTester();
        }

        const conditionConfig = {
            locator: {
                strategy: locatorStrategy.value,
                value: locatorValue.value.trim()
            },
            conditionType: conditionType.value,
            attributeName: attributeName ? attributeName.value : '',
            comparisonType: comparisonType.value,
            expectedValue: expectedValue ? expectedValue.value : ''
        };

        console.log('🧪 开始全局条件测试:', conditionConfig);

        // 执行真实的条件测试
        const result = await window.conditionTester.testCondition(conditionConfig);

        console.log('🧪 全局条件测试结果:', result);

        if (result.success) {
            if (result.conditionMet) {
                button.style.background = '#28a745';
                button.textContent = '✅ 条件满足';
                console.log(`✅ 条件测试通过: ${result.message}`);
            } else {
                button.style.background = '#ffc107';
                button.textContent = '⚠️ 条件不满足';
                console.log(`⚠️ 条件测试失败: ${result.message}`);
            }
        } else {
            button.style.background = '#dc3545';
            button.textContent = '❌ 测试失败';
            console.error('❌ 条件测试失败:', result.error);
        }

    } catch (error) {
        button.style.background = '#dc3545';
        button.textContent = '❌ 测试错误';
        console.error('条件测试错误:', error);
    } finally {
        // 恢复按钮状态
        button.disabled = false;

        // 3秒后恢复原状
        setTimeout(() => {
            button.style.background = '#28a745';
            button.textContent = originalText || '🧪 测试条件';
        }, 3000);
    }
}

// 全局函数：测试定位器 - 使用模块化测试器
async function testLocator(button) {
    // 如果有工作流设计器实例，使用其方法
    if (window.workflowDesigner && typeof window.workflowDesigner.testLocator === 'function') {
        await window.workflowDesigner.testLocator(button);
        return;
    }

    // 使用全局定位器测试器
    if (!window.globalLocatorTester) {
        window.globalLocatorTester = new LocatorTester();
    }

    const container = button.closest('.form-group');

    // 智能查找定位器元素 - 支持多种界面环境
    let strategySelect = document.getElementById('locatorType');
    let valueInput = document.getElementById('locatorValue');

    // 如果在编辑模态框中，使用编辑界面的元素ID
    if (!strategySelect || !valueInput) {
        strategySelect = document.getElementById('editLocatorStrategy');
        valueInput = document.getElementById('editLocatorValue');
    }

    // 如果是循环操作，使用循环专用的定位器ID
    if (!strategySelect || !valueInput) {
        strategySelect = document.getElementById('editLoopLocatorStrategy');
        valueInput = document.getElementById('editLoopLocatorValue');
    }

    // 如果是workflow-designer-mxgraph.js中的循环操作，使用locatorStrategy
    if (!strategySelect || !valueInput) {
        strategySelect = document.getElementById('locatorStrategy');
        valueInput = document.getElementById('locatorValue');
    }

    // 如果还是找不到，尝试在容器内查找
    if (!strategySelect || !valueInput) {
        strategySelect = container.querySelector('select[id*="Strategy"], select[id*="locator"]');
        valueInput = container.querySelector('input[id*="Value"], input[id*="locator"]');
    }

    if (!strategySelect || !valueInput) {
        alert('请先选择定位策略和输入定位值');
        return;
    }

    const strategy = strategySelect.value;
    const value = valueInput.value.trim();

    if (!value) {
        alert('请输入定位值');
        return;
    }

    // 查找或创建结果显示元素
    let resultElement = container.querySelector('.form-help, .test-result');
    if (!resultElement) {
        resultElement = document.createElement('div');
        resultElement.className = 'test-result';
        container.appendChild(resultElement);
    }

    // 使用模块化测试器进行测试
    // 使用模块化测试器进行测试
    await window.globalLocatorTester.testLocator(strategy, value, resultElement, button);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 确保mxGraph库已加载
    if (typeof mxGraph !== 'undefined') {
        console.log('mxGraph库已加载，开始初始化工作流设计器');
        window.workflowDesigner = new MxGraphWorkflowDesigner();
    } else {
        console.log('等待mxGraph库加载...');
        // 如果mxGraph还没加载，等待一下再试
        const checkMxGraph = () => {
            if (typeof mxGraph !== 'undefined') {
                console.log('mxGraph库加载完成，初始化工作流设计器');
                window.workflowDesigner = new MxGraphWorkflowDesigner();
            } else {
                console.log('mxGraph库仍在加载中，继续等待...');
                setTimeout(checkMxGraph, 100);
            }
        };
        setTimeout(checkMxGraph, 100);
    }
});
