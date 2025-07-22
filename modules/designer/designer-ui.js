/**
 * 工作流设计器UI交互模块
 * 负责事件监听、鼠标交互、键盘快捷键等UI相关功能
 */

/**
 * UI交互管理器
 */
class DesignerUIManager {
    constructor(designer) {
        this.designer = designer;
        this.graph = designer.graph;
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 清空画布
        const clearCanvasBtn = document.getElementById('clearCanvas');
        if (clearCanvasBtn) {
            clearCanvasBtn.addEventListener('click', () => {
                this.designer.clearCanvas();
            });
        }

        // 保存工作流
        const saveBtn = document.getElementById('saveWorkflow');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.designer.saveWorkflowWithDialog();
            });
        }

        // 加载工作流
        const loadBtn = document.getElementById('loadWorkflow');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                this.designer.loadWorkflow();
            });
        }

        // 继续工作流 - 检查元素是否存在
        const resumeBtn = document.getElementById('resumeWorkflow');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                this.designer.resumeWorkflow();
            });
        }

        // 停止工作流 - 检查元素是否存在
        const stopBtn = document.getElementById('stopWorkflow');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.designer.stopWorkflow();
            });
        }

        // 键盘事件监听
        this.setupKeyboardListeners();

        // 选择变化监听
        this.graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
            this.designer.onSelectionChange();
        });

        console.log('✅ UI事件监听器初始化完成');
    }

    /**
     * 设置键盘监听器
     */
    setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            // 检查是否在输入框中
            const isInInputField = e.target.tagName === 'INPUT' ||
                e.target.tagName === 'TEXTAREA' ||
                e.target.contentEditable === 'true';

            // Ctrl+S 保存
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.designer.saveWorkflow();
            }

            // Delete 删除选中节点 - 只在非输入状态下响应
            if (e.key === 'Delete' && this.designer.selectedCell && !isInInputField) {
                e.preventDefault();
                this.designer.deleteNode(this.designer.selectedCell);
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
                    '4': 'condition',
                    '5': 'loop'
                };

                if (keyMap[e.key]) {
                    e.preventDefault();
                    // 在画布中心创建节点
                    const container = this.graph.container;
                    const x = container.offsetWidth / 2;
                    const y = container.offsetHeight / 2;
                    this.designer.addNodeToCanvas(keyMap[e.key], x, y);
                }
            }

            // 删除功能 - 只在非输入状态下响应
            if ((e.key === 'Delete' || e.key === 'Backspace') && !isInInputField) {
                e.preventDefault();

                const selectedCells = this.graph.getSelectionCells();
                if (selectedCells.length > 0) {
                    // 批量删除选中的元素
                    selectedCells.forEach(cell => {
                        if (cell.isVertex()) {
                            this.designer.deleteNode(cell);
                        } else if (cell.isEdge()) {
                            this.graph.removeCells([cell]);
                        }
                    });
                } else if (this.designer.selectedCell) {
                    // 单个删除
                    if (this.designer.selectedCell.isEdge()) {
                        this.graph.removeCells([this.designer.selectedCell]);
                        this.designer.selectedCell = null;
                    } else {
                        this.designer.deleteNode(this.designer.selectedCell);
                    }
                }
            }

            // 区域选择快捷键
            if (e.ctrlKey) {
                switch (e.key) {
                    case 'a':
                        e.preventDefault();
                        this.graph.selectAll();
                        break;
                    case '=':
                    case '+':
                        e.preventDefault();
                        this.graph.zoomIn();
                        break;
                    case '-':
                        e.preventDefault();
                        this.graph.zoomOut();
                        break;
                    case '0':
                        e.preventDefault();
                        this.graph.zoomActual();
                        break;
                }
            }

            // ESC 取消选择
            if (e.key === 'Escape') {
                this.graph.clearSelection();
                this.designer.hidePropertyPanel();
            }
        });
    }

    /**
     * 设置鼠标滚轮缩放
     */
    setupMouseWheelZoom() {
        // 为画布容器添加鼠标滚轮事件监听
        const container = this.graph.container;

        container.addEventListener('wheel', (evt) => {
            if (evt.ctrlKey) {
                evt.preventDefault();

                const delta = evt.deltaY || evt.wheelDelta;

                if (delta > 0) {
                    // 向下滚动，缩小
                    this.graph.zoomOut();
                } else {
                    // 向上滚动，放大
                    this.graph.zoomIn();
                }
            }
        });
    }

    /**
     * 设置右键菜单
     */
    setupContextMenu() {
        // 获取右键菜单元素
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) {
            console.warn('右键菜单元素未找到');
            return;
        }

        // 禁用默认右键菜单
        this.graph.container.addEventListener('contextmenu', (evt) => {
            evt.preventDefault();

            const cell = this.graph.getCellAt(evt.offsetX, evt.offsetY);
            this.designer.contextMenuPoint = { x: evt.offsetX, y: evt.offsetY };
            this.designer.contextMenuContainer = null;

            if (cell && cell.isVertex() && this.graph.isSwimlane(cell)) {
                // 在循环容器内右键，记录容器
                this.designer.contextMenuContainer = cell;
            }

            // 显示右键菜单
            this.showContextMenu(evt, contextMenu);
        });

        // 点击其他地方隐藏菜单
        document.addEventListener('click', () => {
            contextMenu.style.display = 'none';
        });

        // 设置菜单项点击事件
        this.setupContextMenuItems(contextMenu);
    }

    /**
     * 显示右键菜单
     */
    showContextMenu(evt, contextMenu) {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const menuRect = contextMenu.getBoundingClientRect();

        let left = evt.clientX;
        let top = evt.clientY;

        // 计算相对于视口的位置
        const relativeX = evt.clientX;
        const relativeY = evt.clientY;

        left = relativeX;
        top = relativeY;

        if (left + menuRect.width > windowWidth) {
            left = evt.clientX - menuRect.width;
        }

        if (top + menuRect.height > windowHeight) {
            top = evt.clientY - menuRect.height;
        }

        contextMenu.style.left = left + 'px';
        contextMenu.style.top = top + 'px';
        contextMenu.style.display = 'block';
    }

    /**
     * 设置右键菜单项事件
     */
    setupContextMenuItems(contextMenu) {
        const menuItems = contextMenu.querySelectorAll('.context-menu-item');

        menuItems.forEach(item => {
            item.addEventListener('click', async () => {
                const nodeType = item.dataset.type;
                if (this.designer.contextMenuPoint) {
                    await this.designer.addNodeToCanvas(
                        nodeType,
                        this.designer.contextMenuPoint.x,
                        this.designer.contextMenuPoint.y,
                        this.designer.contextMenuContainer
                    );
                }
                contextMenu.style.display = 'none';
            });
        });
    }

    /**
     * 设置窗口大小监听
     */
    setupResizeListener() {
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            if (this.graph && this.graph.container) {
                // 重新调整图形容器大小
                this.graph.doResizeContainer(
                    this.graph.container.offsetWidth,
                    this.graph.container.offsetHeight
                );

                // 刷新显示
                this.graph.refresh();
            }
        });
    }

    /**
     * 显示循环类型选择对话框
     */
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
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                max-width: 400px;
                width: 90%;
            `;

            dialog.innerHTML = `
                <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px;">选择循环类型</h3>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 15px; cursor: pointer; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; transition: all 0.3s;">
                        <input type="radio" name="loopType" value="element" style="margin-right: 10px;">
                        <strong>元素循环</strong><br>
                        <small style="color: #666; margin-left: 20px;">遍历页面元素列表，对每个元素执行子操作</small>
                    </label>
                    <label style="display: block; margin-bottom: 15px; cursor: pointer; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; transition: all 0.3s;">
                        <input type="radio" name="loopType" value="count" style="margin-right: 10px;">
                        <strong>次数循环</strong><br>
                        <small style="color: #666; margin-left: 20px;">指定循环次数，重复执行子操作</small>
                    </label>
                </div>
                <div style="text-align: right;">
                    <button id="cancelLoop" style="margin-right: 10px; padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>
                    <button id="confirmLoop" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">确定</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // 添加样式交互
            const labels = dialog.querySelectorAll('label');
            labels.forEach(label => {
                label.addEventListener('mouseenter', () => {
                    label.style.borderColor = '#3498db';
                    label.style.backgroundColor = '#f8f9fa';
                });
                label.addEventListener('mouseleave', () => {
                    if (!label.querySelector('input').checked) {
                        label.style.borderColor = '#e0e0e0';
                        label.style.backgroundColor = 'white';
                    }
                });
                label.querySelector('input').addEventListener('change', () => {
                    labels.forEach(l => {
                        l.style.borderColor = '#e0e0e0';
                        l.style.backgroundColor = 'white';
                    });
                    if (label.querySelector('input').checked) {
                        label.style.borderColor = '#3498db';
                        label.style.backgroundColor = '#e3f2fd';
                    }
                });
            });

            // 确定按钮
            dialog.querySelector('#confirmLoop').onclick = () => {
                const selected = dialog.querySelector('input[name="loopType"]:checked');
                document.body.removeChild(overlay);
                resolve(selected ? selected.value : null);
            };

            // 取消按钮
            dialog.querySelector('#cancelLoop').onclick = () => {
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

    /**
     * 显示属性面板
     */
    showPropertyPanel(cell) {
        const panel = document.getElementById('propertyPanel');
        const form = document.getElementById('propertyForm');

        if (!panel || !form) return;

        // 优先从 nodeConfigs 获取配置，如果没有则从 cell.nodeData 获取
        let config = this.designer.nodeConfigs.get(cell.id);
        if (!config || Object.keys(config).length === 0) {
            config = cell.nodeData || {};
            // 如果从 nodeData 获取到配置，同步到 nodeConfigs
            if (config && Object.keys(config).length > 0) {
                this.designer.nodeConfigs.set(cell.id, config);
                console.log(`从 nodeData 恢复配置: ${cell.id} -> ${config.type}`);
            }
        }

        // 为旧的条件判断节点添加默认配置（向后兼容性）
        if (config.type === 'condition') {
            if (!config.conditionType) config.conditionType = 'attribute';
            if (!config.comparisonType) config.comparisonType = 'equals';
            if (!config.expectedValue) config.expectedValue = '';
            if (!config.attributeName) config.attributeName = '';
            if (!config.locator) config.locator = { strategy: 'css', value: '' };
        }

        // 生成属性表单
        form.innerHTML = this.designer.nodes.generatePropertyForm(cell, config);

        // 绑定表单事件
        this.designer.nodes.bindPropertyFormEvents(cell);

        // 显示面板
        panel.classList.add('show');
    }

    /**
     * 隐藏属性面板
     */
    hidePropertyPanel() {
        const panel = document.getElementById('propertyPanel');
        if (panel) {
            panel.classList.remove('show');
        }
    }
}