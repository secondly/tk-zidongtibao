/**
 * 工作流设计器核心模块
 * 负责 mxGraph 初始化、基础配置、事件监听等核心功能
 */

class DesignerCore {
  constructor() {
    this.graph = null;
    this.nodeConfigs = new Map();
    this.selectedCell = null;
    this.currentDisplayedCell = null;
    this.contextMenuPoint = null;
    this.contextMenuContainer = null;
    this.rubberband = null;

    // 执行状态管理
    this.executionState = {
      isRunning: false,
      isPaused: false,
      currentNodeIndex: 0,
      totalNodes: 0,
      currentWorkflow: null,
    };

    // 编辑模式相关
    this.editMode = false;
    this.originalWorkflow = null;

    // 节点类型配置（使用模块中的配置）
    this.nodeTypes = nodeTypes;

    // 循环类型配置
    this.loopTypes = {
      element: "元素循环",
      count: "次数循环",
    };
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
      this.updateStatus("mxGraph工作流设计器已就绪");

      // 适应画布大小
      this.graph.fit();

      // 检查是否为编辑模式，否则保持空白画布
      setTimeout(() => {
        if (window.designerWorkflow && typeof window.designerWorkflow.loadWorkflowFromStorage === 'function') {
          // 检查是否有编辑模式数据
          const tempEditData = localStorage.getItem("temp_edit_workflow");
          console.log("🔍 检查编辑模式数据:", tempEditData);

          // 只有在明确的编辑模式下才加载数据
          let shouldLoad = false;
          let isEditMode = false;

          if (tempEditData) {
            try {
              const editData = JSON.parse(tempEditData);
              console.log("🔍 解析编辑数据:", editData);

              // 严格检查编辑模式条件
              if (editData.mode === "edit" && editData.workflow && editData.workflow.name) {
                shouldLoad = true;
                isEditMode = true;
                console.log("🎨 检测到有效的编辑模式数据，准备加载:", editData.workflow.name);
              } else {
                console.log("⚠️ 编辑模式数据不完整，忽略");
                console.log("  - mode:", editData.mode);
                console.log("  - workflow存在:", !!editData.workflow);
                console.log("  - workflow.name存在:", editData.workflow?.name);
              }
            } catch (error) {
              console.warn("编辑模式数据解析失败:", error);
            }
          }

          if (shouldLoad && isEditMode) {
            console.log("🔄 编辑模式：自动加载工作流数据");
            window.designerWorkflow.loadWorkflowFromStorage();
          } else {
            console.log("🆕 新建模式：保持空白状态");

            // 强制清理所有可能的残留数据
            this.clearAllStorageData();

            // 确保画布完全空白
            this.ensureBlankCanvas();

            // 更新状态显示
            this.updateStatus("工作流设计器已就绪 - 新建模式");
          }
        }
      }, 100);
    } catch (error) {
      console.error("初始化失败:", error);
      this.updateStatus("初始化失败: " + error.message);
    }
  }

  waitForMxGraph() {
    return new Promise((resolve, reject) => {
      const checkMxGraph = () => {
        if (typeof mxGraph !== "undefined" && typeof mxClient !== "undefined") {
          resolve();
        } else {
          setTimeout(checkMxGraph, 100);
        }
      };
      checkMxGraph();

      // 10秒超时
      setTimeout(() => reject(new Error("mxGraph加载超时")), 10000);
    });
  }

  initMxGraph() {
    // 进一步禁用资源加载，防止CORS错误
    if (typeof mxResources !== "undefined") {
      mxResources.extension = null;
      mxResources.resourcesEncoded = false;
      mxResources.loadDefaultBundle = false;
      mxResources.loadSpecialBundle = false;
      // 完全禁用资源加载
      mxResources.add = function () {
        return;
      };
      mxResources.get = function (key, params, defaultValue) {
        return defaultValue || key;
      };
    }

    // 禁用样式表加载
    if (typeof mxClient !== "undefined") {
      mxClient.link = function () {
        return;
      }; // 禁用CSS加载
    }

    // 检查浏览器支持
    if (!mxClient.isBrowserSupported()) {
      throw new Error("浏览器不支持mxGraph");
    }

    // 清除加载提示
    const container = document.getElementById("graphContainer");
    container.innerHTML = "";

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
    this.graph.connectionHandler.marker.validColor = "#27ae60"; // 绿色表示可连接
    this.graph.connectionHandler.marker.invalidColor = "#e74c3c"; // 红色表示不可连接

    // 设置连线图标（小圆点）
    this.graph.connectionHandler.connectImage = new mxImage(
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjQiIGZpbGw9IiMyMTk2RjMiLz4KPC9zdmc+",
      16,
      16
    );

    // 添加连线验证（移到连线处理器）
    const originalIsValidConnection =
      this.graph.connectionHandler.isValidConnection;
    this.graph.connectionHandler.isValidConnection = (source, target) => {
      if (
        !originalIsValidConnection.call(
          this.graph.connectionHandler,
          source,
          target
        )
      ) {
        return false;
      }
      return this.validateConnection(source, target);
    };

    // 自定义连线创建，为条件判断添加标签
    const originalInsertEdge = this.graph.connectionHandler.insertEdge;
    this.graph.connectionHandler.insertEdge = (
      parent,
      id,
      value,
      source,
      target,
      style
    ) => {
      // 检查源节点是否为条件判断
      const sourceConfig = this.nodeConfigs.get(source.id);
      if (sourceConfig && sourceConfig.type === "condition") {
        // 为条件判断的连线添加标签和样式
        const existingEdges = this.graph.getOutgoingEdges(source);
        if (existingEdges.length === 0) {
          value = "满足"; // 第一条连线标记为"满足"
          style = "conditionTrue"; // 应用绿色样式
        } else if (existingEdges.length === 1) {
          value = "不满足"; // 第二条连线标记为"不满足"
          style = "conditionFalse"; // 应用红色样式
        } else {
          // 条件判断节点最多只能有两条出边
          alert("条件判断节点最多只能连接两个目标节点！");
          return null;
        }
      }

      return originalInsertEdge.call(
        this.graph.connectionHandler,
        parent,
        id,
        value,
        source,
        target,
        style
      );
    };

    // 启用画布拖动
    this.graph.setPanning(true);
    this.graph.panningHandler.useLeftButtonForPanning = true;

    // 配置拖动行为：只在空白区域拖动
    this.graph.panningHandler.isPanningTrigger = function (me) {
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
          container.style.cursor = "grab";
        } else {
          // 鼠标在节点上，显示默认光标
          container.style.cursor = "default";
        }
      },
      mouseDown: (sender, me) => {
        const cell = me.getCell();
        if (cell == null) {
          // 鼠标按下时显示抓取中光标
          container.style.cursor = "grabbing";
        }
      },
      mouseUp: () => {
        // 鼠标释放时恢复光标
        const cell = this.graph.getSelectionCell();
        container.style.cursor = cell ? "default" : "grab";
      },
    });

    // 启用分组功能
    this.graph.setDropEnabled(true);
    this.graph.setSplitEnabled(false);
    this.graph.setResizeContainer(false); // 禁用自动调整容器大小

    // 设置画布大小为容器大小
    this.graph.minimumContainerSize = new mxRectangle(
      0,
      0,
      container.offsetWidth,
      container.offsetHeight
    );
    this.graph.resizeContainer = false;

    // 设置网格
    this.graph.setGridEnabled(true);
    this.graph.setGridSize(20);

    // 设置连线样式
    const edgeStyle = this.graph.getStylesheet().getDefaultEdgeStyle();
    edgeStyle[mxConstants.STYLE_ROUNDED] = true;
    edgeStyle[mxConstants.STYLE_STROKEWIDTH] = 3;
    edgeStyle[mxConstants.STYLE_STROKECOLOR] = "#2196F3";
    edgeStyle[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector;
    edgeStyle[mxConstants.STYLE_ENDARROW] = mxConstants.ARROW_CLASSIC;
    edgeStyle[mxConstants.STYLE_ENDFILL] = 1;
    edgeStyle[mxConstants.STYLE_ENDSIZE] = 8;
    // 连线标签样式
    edgeStyle[mxConstants.STYLE_FONTSIZE] = 12;
    edgeStyle[mxConstants.STYLE_FONTCOLOR] = "#333333";
    edgeStyle[mxConstants.STYLE_FONTFAMILY] =
      "Segoe UI, Tahoma, Geneva, Verdana, sans-serif";
    edgeStyle[mxConstants.STYLE_LABEL_BACKGROUNDCOLOR] = "#ffffff";
    edgeStyle[mxConstants.STYLE_LABEL_BORDERCOLOR] = "#cccccc";

    // 设置选中时的连线样式
    const selectedEdgeStyle = mxUtils.clone(edgeStyle);
    selectedEdgeStyle[mxConstants.STYLE_STROKECOLOR] = "#FF5722";
    selectedEdgeStyle[mxConstants.STYLE_STROKEWIDTH] = 4;
    this.graph.getStylesheet().putCellStyle("selectedEdge", selectedEdgeStyle);

    // 条件判断连线样式
    const conditionTrueEdgeStyle = mxUtils.clone(edgeStyle);
    conditionTrueEdgeStyle[mxConstants.STYLE_STROKECOLOR] = "#27ae60"; // 绿色表示满足
    conditionTrueEdgeStyle[mxConstants.STYLE_FONTCOLOR] = "#27ae60";
    this.graph
      .getStylesheet()
      .putCellStyle("conditionTrue", conditionTrueEdgeStyle);

    const conditionFalseEdgeStyle = mxUtils.clone(edgeStyle);
    conditionFalseEdgeStyle[mxConstants.STYLE_STROKECOLOR] = "#e74c3c"; // 红色表示不满足
    conditionFalseEdgeStyle[mxConstants.STYLE_FONTCOLOR] = "#e74c3c";
    this.graph
      .getStylesheet()
      .putCellStyle("conditionFalse", conditionFalseEdgeStyle);

    // 改进节点和连线选择
    this.graph.addListener(mxEvent.CLICK, (sender, evt) => {
      const cell = evt.getProperty("cell");
      if (cell && cell.isEdge()) {
        // 选中连线时改变样式
        this.graph.setCellStyle("selectedEdge", [cell]);
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
    document.addEventListener("keydown", (e) => {
      // 检查是否在输入框、文本域或可编辑元素内
      const activeElement = document.activeElement;
      const isInInputField =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "SELECT" ||
          activeElement.isContentEditable ||
          activeElement.hasAttribute("data-focused") ||
          activeElement.closest(".property-panel")); // 在属性面板内的任何元素

      // 删除功能 - 只在非输入状态下响应
      if ((e.key === "Delete" || e.key === "Backspace") && !isInInputField) {
        e.preventDefault();

        const selectedCells = this.graph.getSelectionCells();
        if (selectedCells.length > 0) {
          // 批量删除选中的元素
          selectedCells.forEach((cell) => {
            if (cell.isVertex()) {
              if (window.designerNodes) {
                window.designerNodes.deleteNode(cell);
              }
            } else if (cell.isEdge()) {
              if (this.graph) {
                this.graph.removeCells([cell]);
              }
            }
          });
        } else if (this.selectedCell) {
          // 单个删除
          if (this.selectedCell.isEdge()) {
            if (this.graph) {
              this.graph.removeCells([this.selectedCell]);
            }
            this.selectedCell = null;
          } else if (this.selectedCell.isVertex()) {
            if (window.designerNodes) {
              window.designerNodes.deleteNode(this.selectedCell);
            }
          }
        }
      }

      // 区域选择快捷键
      if (e.ctrlKey) {
        switch (e.key) {
          case "=":
          case "+":
            e.preventDefault();
            this.scaleSelection(1.2);
            break;
          case "-":
            e.preventDefault();
            this.scaleSelection(0.8);
            break;
          case "a":
            e.preventDefault();
            this.graph.selectAll();
            break;
        }
      }
    });

    // 启用撤销重做
    const undoManager = new mxUndoManager();
    const listener = function (sender, evt) {
      undoManager.undoableEditHappened(evt.getProperty("edit"));
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

    console.log("mxGraph初始化完成");
  }

  setupMouseWheelZoom() {
    // 为画布容器添加鼠标滚轮事件监听
    const container = this.graph.container;

    const handleWheel = (evt) => {
      // 检查是否在画布区域内
      if (evt.target === container || container.contains(evt.target)) {
        // 阻止页面滚动
        try {
          evt.preventDefault();
          evt.stopPropagation();
        } catch (error) {
          // 忽略preventDefault错误
          console.debug("preventDefault failed:", error);
        }

        // 获取滚轮方向
        const delta = evt.deltaY || evt.wheelDelta;

        if (delta > 0) {
          // 向下滚动，缩小
          this.graph.zoomOut();
        } else {
          // 向上滚动，放大
          this.graph.zoomIn();
        }
      }
    };

    // 添加事件监听器，使用更安全的方式
    try {
      container.addEventListener("wheel", handleWheel, { passive: false });
    } catch (error) {
      // 如果passive: false不支持，使用默认方式
      container.addEventListener("wheel", handleWheel);
    }

    try {
      container.addEventListener("mousewheel", handleWheel, { passive: false }); // 兼容旧浏览器
    } catch (error) {
      // 如果passive: false不支持，使用默认方式
      container.addEventListener("mousewheel", handleWheel);
    }
  }

  setupContextMenu() {
    // 获取右键菜单元素
    const contextMenu = document.getElementById("contextMenu");
    const graphContainer = document.getElementById("graphContainer");

    // 禁用浏览器默认右键菜单
    graphContainer.addEventListener("contextmenu", (evt) => {
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
      contextMenu.style.display = "block";
      contextMenu.style.left = relativeX + "px";
      contextMenu.style.top = relativeY + "px";

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

        contextMenu.style.left = left + "px";
        contextMenu.style.top = top + "px";
      }, 0);
    });

    // 点击其他地方隐藏右键菜单
    document.addEventListener("click", () => {
      contextMenu.style.display = "none";
    });

    // 为右键菜单项添加点击事件
    const menuItems = document.querySelectorAll(".context-menu-item");
    menuItems.forEach((item) => {
      item.addEventListener("click", async () => {
        const nodeType = item.dataset.type;
        if (this.contextMenuPoint && window.designerNodes) {
          await window.designerNodes.addNodeToCanvas(
            nodeType,
            this.contextMenuPoint.x,
            this.contextMenuPoint.y,
            this.contextMenuContainer
          );
        }
        contextMenu.style.display = "none";
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
      [mxConstants.STYLE_FONTFAMILY]:
        "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
      [mxConstants.STYLE_FONTCOLOR]: "#333333",
      [mxConstants.STYLE_ALIGN]: mxConstants.ALIGN_CENTER,
      [mxConstants.STYLE_VERTICAL_ALIGN]: mxConstants.ALIGN_MIDDLE,
      [mxConstants.STYLE_WHITE_SPACE]: "wrap", // 关键：启用文本换行
      [mxConstants.STYLE_OVERFLOW]: "width", // 关键：按宽度换行
    };

    // 为每种节点类型创建样式
    Object.keys(this.nodeTypes).forEach((type) => {
      const config = this.nodeTypes[type];
      const style = {
        ...baseNodeStyle,
        [mxConstants.STYLE_FILLCOLOR]: config.color,
        [mxConstants.STYLE_STROKECOLOR]: config.color,
      };
      stylesheet.putCellStyle(type, style);
    });

    // 循环容器样式（swimlane）
    const loopContainerStyle = {
      [mxConstants.STYLE_SHAPE]: mxConstants.SHAPE_SWIMLANE,
      [mxConstants.STYLE_PERIMETER]: mxPerimeter.RectanglePerimeter,
      [mxConstants.STYLE_ROUNDED]: true,
      [mxConstants.STYLE_STROKEWIDTH]: 2,
      [mxConstants.STYLE_FILLCOLOR]: "#e3f2fd",
      [mxConstants.STYLE_STROKECOLOR]: "#3498db",
      [mxConstants.STYLE_FONTSIZE]: 14,
      [mxConstants.STYLE_FONTFAMILY]:
        "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
      [mxConstants.STYLE_FONTCOLOR]: "#1976d2",
      [mxConstants.STYLE_FONTSTYLE]: mxConstants.FONT_BOLD,
      [mxConstants.STYLE_STARTSIZE]: 40, // 增加标题栏高度，让收起按钮更大
      [mxConstants.STYLE_WHITE_SPACE]: "wrap",
      [mxConstants.STYLE_OVERFLOW]: "width",
      [mxConstants.STYLE_COLLAPSIBLE]: 1, // 启用折叠功能
      [mxConstants.STYLE_RESIZABLE]: 1, // 启用调整大小
    };
    stylesheet.putCellStyle("loopContainer", loopContainerStyle);

    // 自定义折叠按钮样式
    this.setupCollapseButton();

    // 条件判断菱形样式
    const conditionStyle = {
      ...baseNodeStyle,
      [mxConstants.STYLE_SHAPE]: mxConstants.SHAPE_RHOMBUS,
      [mxConstants.STYLE_PERIMETER]: mxPerimeter.RhombusPerimeter,
      [mxConstants.STYLE_FILLCOLOR]: "#e67e22",
      [mxConstants.STYLE_STROKECOLOR]: "#e67e22",
    };
    stylesheet.putCellStyle("condition", conditionStyle);
  }

  setupCollapseButton() {
    // 自定义折叠按钮的实现
    // 这里可以添加自定义折叠按钮的样式和行为
  }

  setupAreaSelection() {
    // 自定义区域选择行为的实现
    // 这里可以添加区域选择的特殊处理逻辑
  }

  initEventListeners() {
    // 清空画布
    document.getElementById("clearCanvas").addEventListener("click", () => {
      this.clearCanvas();
    });

    // 保存工作流
    document.getElementById("saveWorkflow").addEventListener("click", () => {
      this.saveWorkflowWithDialog();
    });

    // 加载工作流
    document.getElementById("loadWorkflow").addEventListener("click", () => {
      this.loadWorkflowFromFile();
    });

    // 导出数据
    document.getElementById("exportData").addEventListener("click", () => {
      this.exportData();
    });

    // 继续工作流 - 检查元素是否存在
    const resumeBtn = document.getElementById("resumeWorkflow");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => {
        if (window.designerWorkflow) {
          window.designerWorkflow.resumeWorkflow();
        }
      });
    }

    // 停止工作流 - 检查元素是否存在
    const stopBtn = document.getElementById("stopWorkflow");
    if (stopBtn) {
      stopBtn.addEventListener("click", () => {
        if (window.designerWorkflow) {
          window.designerWorkflow.stopWorkflow();
        }
      });
    }

    // 添加键盘快捷键
    document.addEventListener("keydown", async (e) => {
      // 检查是否在输入框、文本域或可编辑元素内
      const activeElement = document.activeElement;
      const isInInputField =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "SELECT" ||
          activeElement.isContentEditable ||
          activeElement.hasAttribute("data-focused") ||
          activeElement.closest(".property-panel")); // 在属性面板内的任何元素

      // Ctrl+S 保存
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        if (window.designerWorkflow) {
          window.designerWorkflow.saveWorkflow();
        }
      }

      // Delete 删除选中节点 - 只在非输入状态下响应
      if (e.key === "Delete" && this.selectedCell && !isInInputField) {
        e.preventDefault();
        if (window.designerNodes) {
          window.designerNodes.deleteNode(this.selectedCell);
        }
      }

      // Ctrl+Z 撤销
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        this.graph.getModel().undo();
      }

      // Ctrl+Y 重做
      if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        this.graph.getModel().redo();
      }

      // 快速创建节点的快捷键
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const keyMap = {
          1: "click",
          2: "input",
          3: "wait",
          4: "smartWait",
          5: "loop",
          6: "condition",
          7: "checkState",
        };

        if (keyMap[e.key]) {
          e.preventDefault();
          // 在画布中心创建节点
          const bounds = this.graph.getGraphBounds();
          const centerX = bounds.x + bounds.width / 2 || 200;
          const centerY = bounds.y + bounds.height / 2 || 200;
          if (window.designerNodes) {
            await window.designerNodes.addNodeToCanvas(keyMap[e.key], centerX, centerY, null);
          }
        }
      }
    });
  }

  setupResizeListener() {
    // 监听窗口大小变化
    window.addEventListener("resize", () => {
      // 延迟执行以确保DOM更新完成
      setTimeout(() => {
        const container = this.graph.container;
        const containerRect = container.getBoundingClientRect();

        // 更新画布大小
        this.graph.minimumContainerSize = new mxRectangle(
          0,
          0,
          containerRect.width,
          containerRect.height
        );
        this.graph.doResizeContainer(containerRect.width, containerRect.height);

        // 刷新视图
        this.graph.refresh();
      }, 100);
    });
  }

  onSelectionChange() {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 1 && this.graph.getModel().isVertex(cells[0])) {
      this.selectedCell = cells[0];
      // 通过全局引用调用节点管理模块的方法
      if (window.designerNodes) {
        window.designerNodes.showPropertyPanel(this.selectedCell);
      }
    } else {
      this.selectedCell = null;
      // 通过全局引用调用节点管理模块的方法
      if (window.designerNodes) {
        window.designerNodes.hidePropertyPanel();
      }
    }
  }

  updateNodeCount() {
    const parent = this.graph.getDefaultParent();

    // 获取所有顶点（节点）
    const vertices = this.graph.getChildVertices(parent);
    const nodeCount = vertices.length;

    // 获取所有边（连线）
    const edges = this.graph.getChildEdges(parent);
    const edgeCount = edges.length;

    document.getElementById(
      "nodeCount"
    ).textContent = `节点: ${nodeCount} | 连线: ${edgeCount}`;
  }

  updateStatus(message) {
    const statusElement = document.getElementById("statusBarText");
    if (statusElement) {
      statusElement.textContent = message;
    }
    console.log("状态:", message);
  }

  /**
   * 清理所有可能的残留存储数据
   */
  clearAllStorageData() {
    console.log("🧹 清理所有残留的存储数据...");

    // 清理编辑模式相关数据
    localStorage.removeItem("temp_edit_workflow");

    // 清理设计器专用数据
    localStorage.removeItem("designer_workflow_data");
    localStorage.removeItem("mxgraph_workflow");
    localStorage.removeItem("mxgraph_workflows");

    // 清理可能的缓存数据
    localStorage.removeItem("workflow_cache");
    localStorage.removeItem("designer_cache");

    console.log("✅ 存储数据清理完成");
  }

  /**
   * 确保画布完全空白
   */
  ensureBlankCanvas() {
    console.log("🎨 确保画布完全空白...");

    try {
      if (this.graph) {
        // 清空图形内容
        this.graph.getModel().beginUpdate();
        try {
          this.graph.removeCells(this.graph.getChildVertices(this.graph.getDefaultParent()));
          console.log("✅ 已清空图形内容");
        } finally {
          this.graph.getModel().endUpdate();
        }

        // 重置选择状态
        this.selectedCell = null;

        // 清空属性面板
        const propertiesPanel = document.getElementById("propertiesPanel");
        if (propertiesPanel) {
          propertiesPanel.innerHTML = '<p>请选择一个节点来编辑其属性</p>';
        }

        // 重置编辑模式标记
        this.editMode = false;
        this.originalWorkflow = null;

        // 重置窗口标题
        document.title = "工作流设计器";

        console.log("✅ 画布已重置为空白状态");
      }
    } catch (error) {
      console.error("重置画布失败:", error);
    }
  }

  clearCanvas() {
    if (!this.graph) {
      console.warn("图形实例未初始化");
      return;
    }

    if (confirm("确定要清空画布吗？此操作不可撤销。")) {
      try {
        const vertices = this.graph.getChildVertices(this.graph.getDefaultParent());
        if (vertices && vertices.length > 0) {
          this.graph.removeCells(vertices);
        }
        this.nodeConfigs.clear();
        this.selectedCell = null;
        this.currentDisplayedCell = null;
        if (window.designerNodes) {
          window.designerNodes.hidePropertyPanel();
        }
        this.updateNodeCount();
        this.updateStatus("画布已清空");
      } catch (error) {
        console.error("清空画布失败:", error);
        this.updateStatus("清空画布失败: " + error.message);
      }
    }
  }

  validateConnection(source, target) {
    // 连线验证逻辑
    if (!source || !target) return false;
    if (source === target) return false; // 不能连接自己

    // 检查是否已经存在连线
    const existingEdges = this.graph.getEdgesBetween(source, target);
    if (existingEdges.length > 0) return false;

    return true;
  }

  scaleSelection(factor) {
    const cells = this.graph.getSelectionCells();
    if (cells.length > 0) {
      this.graph.getModel().beginUpdate();
      try {
        cells.forEach(cell => {
          if (cell.isVertex()) {
            const geometry = cell.getGeometry();
            if (geometry) {
              geometry = geometry.clone();
              geometry.width *= factor;
              geometry.height *= factor;
              this.graph.getModel().setGeometry(cell, geometry);
            }
          }
        });
      } finally {
        this.graph.getModel().endUpdate();
      }
    }
  }

  // 这些方法将在其他模块中实现
  showPropertyPanel(cell) {
    // 将在 designer-nodes.js 中实现
    if (window.designerNodes) {
      window.designerNodes.showPropertyPanel(cell);
    }
  }

  hidePropertyPanel() {
    // 将在 designer-nodes.js 中实现
    if (window.designerNodes) {
      window.designerNodes.hidePropertyPanel();
    }
  }

  addNodeToCanvas(nodeType, x, y, parentContainer) {
    // 将在 designer-nodes.js 中实现
    if (window.designerNodes) {
      return window.designerNodes.addNodeToCanvas(nodeType, x, y, parentContainer);
    }
  }

  deleteNode(cell) {
    // 将在 designer-nodes.js 中实现
    if (window.designerNodes) {
      window.designerNodes.deleteNode(cell);
    }
  }

  saveWorkflowWithDialog() {
    // 将在 designer-workflow.js 中实现
    if (window.designerWorkflow) {
      window.designerWorkflow.saveWorkflowWithDialog();
    }
  }

  loadWorkflowFromFile() {
    // 将在 designer-workflow.js 中实现
    if (window.designerWorkflow) {
      window.designerWorkflow.loadWorkflowFromFile();
    }
  }

  exportData() {
    // 将在 designer-workflow.js 中实现
    if (window.designerWorkflow) {
      window.designerWorkflow.exportData();
    }
  }

  loadWorkflowFromStorage() {
    // 将在 designer-workflow.js 中实现
    if (window.designerWorkflow) {
      window.designerWorkflow.loadWorkflowFromStorage();
    }
  }

  showLoopTypeDialog() {
    return new Promise((resolve) => {
      // 创建模态对话框
      const overlay = document.createElement("div");
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

      const dialog = document.createElement("div");
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
      document.getElementById("containerLoop").onclick = () => {
        document.body.removeChild(overlay);
        resolve("container");
      };

      document.getElementById("selfLoop").onclick = () => {
        document.body.removeChild(overlay);
        resolve("self");
      };

      document.getElementById("cancelLoop").onclick = () => {
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
}

// 导出核心类
window.DesignerCore = DesignerCore;