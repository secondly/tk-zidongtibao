/**
 * 工作流设计器主脚本
 * 基于LogicFlow实现可视化流程设计
 */

class WorkflowDesigner {
    constructor() {
        this.lf = null;
        this.selectedNode = null;
        this.workflowData = null;
        this.nodeConfigs = new Map();
        
        this.init();
    }
    
    async init() {
        console.log('🎨 初始化工作流设计器...');

        try {
            // 等待LogicFlow加载完成
            await this.waitForLogicFlow();

            // 初始化LogicFlow
            this.initLogicFlow();

            // 注册自定义节点
            this.registerCustomNodes();

            // 初始化事件监听
            this.initEventListeners();

            // 初始化右键菜单
            this.initContextMenu();

            // 初始化快捷键
            this.initKeyboardShortcuts();

            // 设置消息监听器
            this.setupMessageListener();

            console.log('✅ 工作流设计器初始化完成');
        } catch (error) {
            console.error('❌ 工作流设计器初始化失败:', error);
            this.showError('LogicFlow加载失败，请刷新页面重试');
        }
    }

    showError(message) {
        const container = document.getElementById('logic-flow-container');
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column; color: #d93025;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">加载失败</div>
                <div style="font-size: 14px; color: #5f6368; text-align: center; max-width: 400px;">${message}</div>
                <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 16px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer;">刷新页面</button>
            </div>
        `;
    }
    
    async waitForLogicFlow() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5秒超时

            const checkLogicFlow = () => {
                attempts++;
                console.log(`尝试加载LogicFlow... (${attempts}/${maxAttempts})`);

                // 检查多种可能的LogicFlow全局变量
                if (window.LogicFlow || window.LF || (window.exports && window.exports.LogicFlow)) {
                    console.log('✅ LogicFlow加载成功');
                    // 统一赋值给window.LogicFlow
                    if (!window.LogicFlow) {
                        window.LogicFlow = window.LF || window.exports.LogicFlow;
                    }
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.error('❌ LogicFlow加载超时');
                    reject(new Error('LogicFlow加载超时'));
                } else {
                    setTimeout(checkLogicFlow, 100);
                }
            };
            checkLogicFlow();
        });
    }
    
    initLogicFlow() {
        const container = document.getElementById('logic-flow-container');
        container.innerHTML = ''; // 清除加载提示

        // 配置LogicFlow
        const config = {
            container: container,
            width: container.offsetWidth,
            height: container.offsetHeight,
            background: {
                backgroundColor: '#fafbfc'
            },
            grid: {
                size: 20,
                visible: true,
                type: 'dot',
                config: {
                    color: '#e0e0e0',
                    thickness: 1
                }
            },
            keyboard: {
                enabled: true
            },
            // 简化配置，只保留必要选项
            adjustNodePosition: true,
            // 启用连线功能
            edgeType: 'polyline',
            allowMultiSelect: true,
            multipleSelectKey: 'ctrl',
            // 禁用缩放和文本编辑
            stopZoomGraph: true,
            // 禁用文本编辑
            nodeTextEdit: false,
            edgeTextEdit: false,
            textEdit: false,
            // 样式配置
            style: {
                rect: {
                    rx: 8,
                    ry: 8,
                    strokeWidth: 2,
                    width: 150,  // 增加宽度
                    height: 60
                },
                diamond: {
                    strokeWidth: 2,
                    width: 150,  // 增加宽度
                    height: 80
                },
                line: {
                    strokeWidth: 2,
                    stroke: '#3498db'
                },
                polyline: {
                    strokeWidth: 2,
                    stroke: '#3498db',
                    fill: 'none',
                    strokeDasharray: 'none',
                    // 智能路径配置
                    offset: 20,
                    radius: 5
                },
                text: {
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 'bold'
                }
            }
        };

        // 尝试不同的LogicFlow初始化方式
        try {
            if (typeof LogicFlow === 'function') {
                this.lf = new LogicFlow(config);
            } else if (LogicFlow && LogicFlow.default) {
                this.lf = new LogicFlow.default(config);
            } else if (LogicFlow && LogicFlow.LogicFlow) {
                this.lf = new LogicFlow.LogicFlow(config);
            } else {
                throw new Error('无法找到LogicFlow构造函数');
            }

            // 初始化空画布
            this.lf.render({
                nodes: [],
                edges: []
            });

            console.log('✅ LogicFlow画布初始化成功');

        } catch (error) {
            console.error('❌ LogicFlow画布初始化失败:', error);
            throw error;
        }
        
        // 监听节点选择事件
        this.lf.on('node:click', (data) => {
            this.selectNode(data.data);
        });

        // 监听节点单击事件（编辑属性）
        this.lf.on('node:click', (data) => {
            // 选择节点并显示属性面板
            this.selectNode(data.data);
            this.showPropertyPanel(data.data);
        });

        // 完全禁用节点双击事件
        this.lf.on('node:dblclick', (data) => {
            if (data.e) {
                data.e.preventDefault();
                data.e.stopPropagation();
                data.e.stopImmediatePropagation();
            }
            console.log('节点双击事件被禁用');
            return false;
        });

        // 禁用文本编辑
        this.lf.on('text:dblclick', (data) => {
            if (data.e) {
                data.e.preventDefault();
                data.e.stopPropagation();
                data.e.stopImmediatePropagation();
            }
            console.log('文本双击编辑被禁用');
            return false;
        });

        // 监听画布点击事件（取消选择）
        this.lf.on('blank:click', () => {
            this.deselectNode();
        });

        // 监听画布双击事件（阻止缩放）
        this.lf.on('blank:dblclick', (data) => {
            if (data.e) {
                data.e.preventDefault();
                data.e.stopPropagation();
            }
            console.log('画布双击被阻止');
        });

        // 监听节点删除事件
        this.lf.on('node:delete', (data) => {
            this.nodeConfigs.delete(data.data.id);
            this.deselectNode();
        });
        
        // 监听连线事件
        this.lf.on('connection:not-allowed', (data) => {
            console.warn('连接不被允许:', data);
        });

        // 监听连线创建成功事件
        this.lf.on('edge:add', (data) => {
            console.log('连线创建成功:', data);
        });

        // 监听连线删除事件
        this.lf.on('edge:delete', (data) => {
            console.log('连线已删除:', data);
        });
        
        // 窗口大小变化时调整画布
        window.addEventListener('resize', () => {
            this.lf.resize();
        });

        // 在画布容器上直接阻止双击事件
        const canvasContainer = document.getElementById('logic-flow-container');
        canvasContainer.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('容器双击被阻止');
        });

        // 阻止触摸设备上的双击缩放
        canvasContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        });

        canvasContainer.addEventListener('gesturestart', (e) => {
            e.preventDefault();
        });

        // 只在LogicFlow容器内阻止双击事件
        canvasContainer.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('LogicFlow容器双击事件被阻止');
            return false;
        }, true); // 使用捕获阶段，优先处理

        // 阻止LogicFlow容器内的选择开始事件
        canvasContainer.addEventListener('selectstart', (e) => {
            e.preventDefault();
            return false;
        });
    }
    
    registerCustomNodes() {
        console.log('注册自定义节点...');

        // 使用LogicFlow原生的textWidth和overflowMode属性实现文本换行
        // 无需注册自定义节点，直接使用基础节点类型
        console.log('使用LogicFlow原生文本换行功能');
    }
    
    initEventListeners() {
        // 清空画布
        document.getElementById('clearCanvas').addEventListener('click', () => {
            this.clearCanvas();
        });
        
        // 保存工作流
        document.getElementById('saveWorkflow').addEventListener('click', () => {
            this.saveWorkflow();
        });
        


        // 快捷操作按钮
        document.getElementById('quickSave').addEventListener('click', () => {
            this.saveWorkflow();
        });



        document.getElementById('quickClear').addEventListener('click', () => {
            this.clearCanvas();
        });

        // 帮助弹窗
        document.getElementById('helpIcon').addEventListener('click', () => {
            this.showHelpModal();
        });

        document.getElementById('helpClose').addEventListener('click', () => {
            this.hideHelpModal();
        });

        // 点击弹窗外部关闭
        document.getElementById('helpModal').addEventListener('click', (e) => {
            if (e.target.id === 'helpModal') {
                this.hideHelpModal();
            }
        });
    }
    
    initContextMenu() {
        // 禁用默认右键菜单
        const container = document.getElementById('logic-flow-container');
        container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // 监听LogicFlow的右键事件
        this.lf.on('blank:contextmenu', (data) => {
            console.log('右键事件数据:', data);
            // 使用事件的原始坐标，然后转换为画布坐标
            const clientX = data.e.clientX;
            const clientY = data.e.clientY;

            // 获取画布容器位置
            const container = document.getElementById('logic-flow-container');
            const rect = container.getBoundingClientRect();

            // 计算相对于画布的坐标
            const canvasX = clientX - rect.left;
            const canvasY = clientY - rect.top;

            console.log('坐标计算:', {
                client: { x: clientX, y: clientY },
                containerRect: { left: rect.left, top: rect.top },
                canvas: { x: canvasX, y: canvasY }
            });

            this.showContextMenu(clientX, clientY, { x: canvasX, y: canvasY });
        });

        // 监听节点右键事件
        this.lf.on('node:contextmenu', (data) => {
            this.showNodeContextMenu(data.e.clientX, data.e.clientY, data.data);
        });
    }

    showContextMenu(clientX, clientY, position) {
        // 移除已存在的菜单
        this.removeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-section">
                <div class="context-menu-item" data-node-type="click">
                    <span class="menu-icon">👆</span>
                    <span class="menu-text">点击操作</span>
                    <span class="menu-shortcut">Ctrl+1</span>
                </div>
                <div class="context-menu-item" data-node-type="input">
                    <span class="menu-icon">⌨️</span>
                    <span class="menu-text">输入文本</span>
                    <span class="menu-shortcut">Ctrl+2</span>
                </div>
                <div class="context-menu-item" data-node-type="wait">
                    <span class="menu-icon">⏱️</span>
                    <span class="menu-text">等待时间</span>
                    <span class="menu-shortcut">Ctrl+3</span>
                </div>
                <div class="context-menu-item" data-node-type="smartWait">
                    <span class="menu-icon">🔍</span>
                    <span class="menu-text">智能等待</span>
                    <span class="menu-shortcut">Ctrl+4</span>
                </div>
                <div class="context-menu-item" data-node-type="loop">
                    <span class="menu-icon">🔄</span>
                    <span class="menu-text">循环操作</span>
                    <span class="menu-shortcut">Ctrl+5</span>
                </div>
                <div class="context-menu-item" data-node-type="condition">
                    <span class="menu-icon">❓</span>
                    <span class="menu-text">条件判断</span>
                    <span class="menu-shortcut">Ctrl+6</span>
                </div>
                <div class="context-menu-item" data-node-type="checkState">
                    <span class="menu-icon">🔍</span>
                    <span class="menu-text">节点检测</span>
                    <span class="menu-shortcut">Ctrl+7</span>
                </div>
            </div>
        `;

        // 设置菜单位置
        menu.style.position = 'fixed';
        menu.style.left = clientX + 'px';
        menu.style.top = clientY + 'px';
        menu.style.zIndex = '10000';

        // 添加到页面
        document.body.appendChild(menu);

        // 存储位置信息
        menu.dataset.x = position.x;
        menu.dataset.y = position.y;

        // 绑定点击事件
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (item) {
                const nodeType = item.dataset.nodeType;
                // 使用LogicFlow提供的position坐标，这已经是画布坐标系
                console.log('创建节点位置:', position);
                this.addNode(nodeType, position.x, position.y, true); // 第四个参数表示已经是画布坐标
                this.removeContextMenu();
            }
        });

        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', this.removeContextMenu.bind(this), { once: true });
        }, 0);
    }

    showNodeContextMenu(clientX, clientY, nodeData) {
        // 移除已存在的菜单
        this.removeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-section">
                <div class="context-menu-title">🎯 节点操作</div>
                <div class="context-menu-item" data-action="edit">
                    <span class="menu-icon">✏️</span>
                    <span class="menu-text">编辑属性</span>
                </div>
                <div class="context-menu-item" data-action="copy">
                    <span class="menu-icon">📋</span>
                    <span class="menu-text">复制节点</span>
                </div>
                <div class="context-menu-item" data-action="delete">
                    <span class="menu-icon">🗑️</span>
                    <span class="menu-text">删除节点</span>
                </div>
            </div>
        `;

        // 设置菜单位置
        menu.style.position = 'fixed';
        menu.style.left = clientX + 'px';
        menu.style.top = clientY + 'px';
        menu.style.zIndex = '10000';

        // 添加到页面
        document.body.appendChild(menu);

        // 绑定点击事件
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (item) {
                const action = item.dataset.action;
                this.handleNodeAction(action, nodeData);
                this.removeContextMenu();
            }
        });

        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', this.removeContextMenu.bind(this), { once: true });
        }, 0);
    }

    removeContextMenu() {
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    handleNodeAction(action, nodeData) {
        switch (action) {
            case 'edit':
                this.selectNode(nodeData);
                break;
            case 'copy':
                this.copyNode(nodeData);
                break;
            case 'delete':
                this.lf.deleteNode(nodeData.id);
                break;
        }
    }

    copyNode(nodeData) {
        const config = this.nodeConfigs.get(nodeData.id);
        if (config) {
            // 在原节点旁边创建副本
            const newX = nodeData.x + 150;
            const newY = nodeData.y + 50;
            this.addNode(config.type, newX, newY);
        }
    }

    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && !e.shiftKey && !e.altKey) {
                let nodeType = null;

                switch (e.key) {
                    case '1':
                        nodeType = 'click';
                        break;
                    case '2':
                        nodeType = 'input';
                        break;
                    case '3':
                        nodeType = 'wait';
                        break;
                    case '4':
                        nodeType = 'smartWait';
                        break;
                    case '5':
                        nodeType = 'loop';
                        break;
                    case '6':
                        nodeType = 'condition';
                        break;
                    case '7':
                        nodeType = 'checkState';
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveWorkflow();
                        return;

                    case 'Delete':
                    case 'Backspace':
                        // 删除选中的节点
                        if (this.selectedNode) {
                            e.preventDefault();
                            this.lf.deleteNode(this.selectedNode.id);
                            this.deselectNode();
                        }
                        return;
                }

                if (nodeType) {
                    e.preventDefault();
                    // 在画布中心创建节点
                    const centerX = this.lf.graphModel.width / 2;
                    const centerY = this.lf.graphModel.height / 2;
                    this.addNode(nodeType, centerX, centerY, true); // 使用画布坐标
                }
            }
        });
    }
    
    addNode(type, x, y, isCanvasCoordinate = false) {
        const nodeNameMap = {
            'click': '👆 点击操作',
            'input': '⌨️ 输入文本',
            'wait': '⏱️ 等待时间',
            'smartWait': '🔍 智能等待',
            'loop': '🔄 循环操作',
            'condition': '❓ 条件判断',
            'checkState': '🔍 节点检测'
        };

        const nodeColorMap = {
            'click': '#e74c3c',
            'input': '#3498db',
            'wait': '#f39c12',
            'smartWait': '#9b59b6',
            'loop': '#27ae60',
            'condition': '#e67e22',
            'checkState': '#16a085'
        };

        const nodeName = nodeNameMap[type];
        const nodeColor = nodeColorMap[type];

        if (!nodeName) {
            console.error('未知的节点类型:', type);
            return;
        }

        // 简化坐标处理逻辑
        let lfPoint;

        if (isCanvasCoordinate) {
            // 如果已经是画布坐标，直接使用
            lfPoint = { x: Number(x) || 200, y: Number(y) || 200 };
            console.log('使用画布坐标:', lfPoint);
        } else {
            // 直接使用传入的坐标（应该已经在右键事件中转换过了）
            lfPoint = { x: Number(x) || 200, y: Number(y) || 200 };
            console.log('使用传入坐标:', lfPoint);
        }

        const nodeId = `${type}_${Date.now()}`;

        // 使用基础节点类型
        const logicFlowType = type === 'condition' ? 'diamond' : 'rect';

        // 设置节点大小 - 使用LogicFlow的节点大小设置
        const nodeWidth = 150;  // 更宽的节点
        const nodeHeight = 60;  // 节点高度

        // 确保坐标是有效数字
        const finalX = Number(lfPoint.x) || 200;
        const finalY = Number(lfPoint.y) || 200;

        console.log('创建节点数据:', {
            nodeId,
            type: logicFlowType,
            coordinates: { x: finalX, y: finalY },
            nodeName
        });

        // 使用原始文本，让LogicFlow处理换行
        let displayText = nodeName;

        const nodeData = {
            id: nodeId,
            type: logicFlowType,
            x: finalX,
            y: finalY,
            text: displayText,
            // LogicFlow节点大小设置
            width: nodeWidth,
            height: nodeHeight,
            properties: {
                nodeType: type,
                name: nodeName,
                style: {
                    fill: nodeColor,
                    stroke: nodeColor,
                    strokeWidth: 2,
                    color: '#333333', // 深色文字
                    fontSize: 12,
                    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                    // LogicFlow原生文本换行支持
                    textWidth: 130, // 设置文本最大宽度
                    overflowMode: 'autoWrap' // 设置超出自动换行
                }
            }
        };

        // 尝试不同的添加节点方法
        try {
            if (typeof this.lf.addNode === 'function') {
                this.lf.addNode(nodeData);
            } else if (typeof this.lf.addElement === 'function') {
                this.lf.addElement(nodeData);
            } else {
                // 通过render方法添加
                const currentData = this.lf.getGraphData ? this.lf.getGraphData() : { nodes: [], edges: [] };
                currentData.nodes.push(nodeData);
                this.lf.render(currentData);
            }
        } catch (error) {
            console.error('添加节点失败:', error);
            throw error;
        }

        // 初始化节点配置
        this.initNodeConfig(nodeId, type);

        console.log('添加节点:', nodeData);
    }
    
    initNodeConfig(nodeId, type) {
        const defaultConfigs = {
            'click': {
                locator: { strategy: 'css', value: '' },
                waitAfterClick: 1000,
                errorHandling: 'continue'
            },
            'input': {
                locator: { strategy: 'css', value: '' },
                text: '',
                clearFirst: true,
                errorHandling: 'continue'
            },
            'wait': {
                duration: 1000,
                errorHandling: 'continue'
            },
            'smartWait': {
                locator: { strategy: 'css', value: '' },
                timeout: 30000,
                checkInterval: 500,
                errorHandling: 'continue'
            },
            'loop': {
                locator: { strategy: 'css', value: '' },
                loopType: 'parentLoop',
                subOperations: [],
                errorHandling: 'continue'
            },
            'condition': {
                condition: '',
                errorHandling: 'continue'
            },
            'checkState': {
                locator: { strategy: 'css', value: '' },
                checkType: 'exists', // exists, visible, enabled, disabled, checked, unchecked
                expectedValue: true,
                timeout: 5000,
                errorHandling: 'continue'
            }
        };
        
        this.nodeConfigs.set(nodeId, {
            type: type,
            name: `${type}操作`,
            ...defaultConfigs[type]
        });
    }
    
    selectNode(nodeData) {
        this.selectedNode = nodeData;
        this.showPropertyPanel(nodeData);
    }
    
    deselectNode() {
        this.selectedNode = null;
        this.hidePropertyPanel();
    }
    
    showPropertyPanel(nodeData) {
        const panel = document.getElementById('propertyPanel');
        const content = document.getElementById('propertyContent');
        
        panel.classList.add('active');
        
        const config = this.nodeConfigs.get(nodeData.id);
        if (!config) return;
        
        content.innerHTML = this.generatePropertyForm(nodeData.id, config);
        this.bindPropertyEvents(nodeData.id);
    }
    
    hidePropertyPanel() {
        const panel = document.getElementById('propertyPanel');
        panel.classList.remove('active');
    }
    
    clearCanvas() {
        if (confirm('确定要清空画布吗？这将删除所有节点和连线。')) {
            try {
                // 尝试不同的清空方法
                if (typeof this.lf.clearData === 'function') {
                    this.lf.clearData();
                } else if (typeof this.lf.clear === 'function') {
                    this.lf.clear();
                } else {
                    // 通过render空数据来清空
                    this.lf.render({ nodes: [], edges: [] });
                }

                this.nodeConfigs.clear();
                this.deselectNode();

            } catch (error) {
                console.error('清空画布失败:', error);
                alert('清空画布失败: ' + error.message);
            }
        }
    }

    showHelpModal() {
        const modal = document.getElementById('helpModal');
        modal.classList.add('active');
    }

    hideHelpModal() {
        const modal = document.getElementById('helpModal');
        modal.classList.remove('active');
    }
    
    saveWorkflow() {
        const graphData = this.lf.getGraphData();
        const workflowData = this.convertToWorkflowFormat(graphData);
        
        console.log('保存工作流:', workflowData);
        
        // 这里可以调用原有的保存逻辑
        alert('工作流已保存到控制台，请查看开发者工具');
    }
    


    // 智能文本格式化，支持换行
    formatNodeText(text) {
        if (!text) return '';

        // 移除emoji和特殊字符，只保留核心文本
        let cleanText = text.replace(/[👆⌨️⏱️🔍🔄❓]/g, '').trim();

        // 如果文本很短，直接返回
        if (cleanText.length <= 6) {
            return cleanText;
        }

        // 智能分词换行
        const maxLineLength = 5; // 每行最大字符数
        const words = [];

        // 按空格和常见分隔符分词
        const parts = cleanText.split(/[\s\-_]/);

        if (parts.length > 1) {
            // 有分词的情况，按词换行
            let currentLine = '';
            for (const part of parts) {
                if ((currentLine + part).length <= maxLineLength) {
                    currentLine += (currentLine ? ' ' : '') + part;
                } else {
                    if (currentLine) words.push(currentLine);
                    currentLine = part;
                }
            }
            if (currentLine) words.push(currentLine);
        } else {
            // 没有分词的情况，按字符数强制换行
            for (let i = 0; i < cleanText.length; i += maxLineLength) {
                words.push(cleanText.substr(i, maxLineLength));
            }
        }

        // 最多显示2行
        return words.slice(0, 2).join('\n');
    }

    // 为SVG创建多行文本，返回文本数组
    formatNodeTextForSVG(text) {
        if (!text) return [''];

        // 移除emoji和特殊字符，只保留核心文本
        let cleanText = text.replace(/[👆⌨️⏱️🔍🔄❓]/g, '').trim();

        // 如果文本很短，直接返回
        if (cleanText.length <= 8) {
            return [cleanText];
        }

        // 智能分词换行
        const maxLineLength = 6; // 每行最大字符数
        const lines = [];

        // 按空格和常见分隔符分词
        const parts = cleanText.split(/[\s\-_]/);

        if (parts.length > 1) {
            // 有分词的情况，按词换行
            let currentLine = '';
            for (const part of parts) {
                if ((currentLine + part).length <= maxLineLength) {
                    currentLine += (currentLine ? ' ' : '') + part;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = part;
                }
            }
            if (currentLine) lines.push(currentLine);
        } else {
            // 没有分词的情况，按字符数强制换行
            for (let i = 0; i < cleanText.length; i += maxLineLength) {
                lines.push(cleanText.substr(i, maxLineLength));
            }
        }

        // 最多显示2行
        return lines.slice(0, 2);
    }

    generatePropertyForm(nodeId, config) {
        const commonFields = `
            <div class="form-group">
                <label class="form-label">节点名称</label>
                <input type="text" class="form-input" id="nodeName" value="${config.name || ''}" placeholder="输入节点名称">
                <div class="form-help">为此节点设置一个描述性名称</div>
            </div>
        `;

        let specificFields = '';

        switch (config.type) {
            case 'click':
                specificFields = `
                    <div class="form-group">
                        <label class="form-label">定位策略</label>
                        <select class="form-select" id="locatorStrategy">
                            <option value="css" ${config.locator?.strategy === 'css' ? 'selected' : ''}>CSS选择器</option>
                            <option value="xpath" ${config.locator?.strategy === 'xpath' ? 'selected' : ''}>XPath</option>
                            <option value="id" ${config.locator?.strategy === 'id' ? 'selected' : ''}>ID</option>
                            <option value="className" ${config.locator?.strategy === 'className' ? 'selected' : ''}>Class名称</option>
                            <option value="text" ${config.locator?.strategy === 'text' ? 'selected' : ''}>精确文本</option>
                            <option value="contains" ${config.locator?.strategy === 'contains' ? 'selected' : ''}>包含文本</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位值</label>
                        <input type="text" class="form-input" id="locatorValue" value="${config.locator?.value || ''}" placeholder="输入定位值">
                        <div class="form-help">根据选择的策略输入相应的定位值</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">点击后等待时间 (毫秒)</label>
                        <input type="number" class="form-input" id="waitAfterClick" value="${config.waitAfterClick || 1000}" min="0">
                        <div class="form-help">点击操作完成后的等待时间</div>
                    </div>
                `;
                break;

            case 'input':
                specificFields = `
                    <div class="form-group">
                        <label class="form-label">定位策略</label>
                        <select class="form-select" id="locatorStrategy">
                            <option value="css" ${config.locator?.strategy === 'css' ? 'selected' : ''}>CSS选择器</option>
                            <option value="xpath" ${config.locator?.strategy === 'xpath' ? 'selected' : ''}>XPath</option>
                            <option value="id" ${config.locator?.strategy === 'id' ? 'selected' : ''}>ID</option>
                            <option value="className" ${config.locator?.strategy === 'className' ? 'selected' : ''}>Class名称</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位值</label>
                        <input type="text" class="form-input" id="locatorValue" value="${config.locator?.value || ''}" placeholder="输入定位值">
                    </div>
                    <div class="form-group">
                        <label class="form-label">输入文本</label>
                        <textarea class="form-textarea" id="inputText" placeholder="输入要填写的文本内容">${config.text || ''}</textarea>
                        <div class="form-help">要在输入框中填写的文本内容</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">
                            <input type="checkbox" id="clearFirst" ${config.clearFirst ? 'checked' : ''}> 输入前清空
                        </label>
                        <div class="form-help">输入文本前是否清空原有内容</div>
                    </div>
                `;
                break;

            case 'wait':
                specificFields = `
                    <div class="form-group">
                        <label class="form-label">等待时间 (毫秒)</label>
                        <input type="number" class="form-input" id="waitDuration" value="${config.duration || 1000}" min="100">
                        <div class="form-help">固定等待的时间长度</div>
                    </div>
                `;
                break;

            case 'smartWait':
                specificFields = `
                    <div class="form-group">
                        <label class="form-label">定位策略</label>
                        <select class="form-select" id="locatorStrategy">
                            <option value="css" ${config.locator?.strategy === 'css' ? 'selected' : ''}>CSS选择器</option>
                            <option value="xpath" ${config.locator?.strategy === 'xpath' ? 'selected' : ''}>XPath</option>
                            <option value="id" ${config.locator?.strategy === 'id' ? 'selected' : ''}>ID</option>
                            <option value="className" ${config.locator?.strategy === 'className' ? 'selected' : ''}>Class名称</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位值</label>
                        <input type="text" class="form-input" id="locatorValue" value="${config.locator?.value || ''}" placeholder="输入定位值">
                        <div class="form-help">等待出现的元素定位值</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">超时时间 (毫秒)</label>
                        <input type="number" class="form-input" id="timeout" value="${config.timeout || 10000}" min="1000">
                        <div class="form-help">等待元素出现的最大时间</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">检查间隔 (毫秒)</label>
                        <input type="number" class="form-input" id="checkInterval" value="${config.checkInterval || 500}" min="100">
                        <div class="form-help">检查元素是否出现的时间间隔</div>
                    </div>
                `;
                break;

            case 'loop':
                specificFields = `
                    <div class="form-group">
                        <label class="form-label">循环类型</label>
                        <select class="form-select" id="loopType">
                            <option value="parentLoop" ${config.loopType === 'parentLoop' ? 'selected' : ''}>父级循环</option>
                            <option value="simpleLoop" ${config.loopType === 'simpleLoop' ? 'selected' : ''}>简单循环</option>
                        </select>
                        <div class="form-help">选择循环操作的类型</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位策略</label>
                        <select class="form-select" id="locatorStrategy">
                            <option value="css" ${config.locator?.strategy === 'css' ? 'selected' : ''}>CSS选择器</option>
                            <option value="xpath" ${config.locator?.strategy === 'xpath' ? 'selected' : ''}>XPath</option>
                            <option value="id" ${config.locator?.strategy === 'id' ? 'selected' : ''}>ID</option>
                            <option value="className" ${config.locator?.strategy === 'className' ? 'selected' : ''}>Class名称</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位值</label>
                        <input type="text" class="form-input" id="locatorValue" value="${config.locator?.value || ''}" placeholder="输入循环元素的定位值">
                        <div class="form-help">要循环操作的元素定位值</div>
                    </div>
                `;
                break;

            case 'condition':
                specificFields = `
                    <div class="form-group">
                        <label class="form-label">条件表达式</label>
                        <textarea class="form-textarea" id="conditionExpression" placeholder="输入条件判断表达式">${config.condition || ''}</textarea>
                        <div class="form-help">JavaScript条件表达式，返回true或false</div>
                    </div>
                `;
                break;

            case 'checkState':
                specificFields = `
                    <div class="form-group">
                        <label class="form-label">定位策略</label>
                        <select class="form-select" id="locatorStrategy">
                            <option value="css" ${config.locator?.strategy === 'css' ? 'selected' : ''}>CSS选择器</option>
                            <option value="xpath" ${config.locator?.strategy === 'xpath' ? 'selected' : ''}>XPath</option>
                            <option value="id" ${config.locator?.strategy === 'id' ? 'selected' : ''}>ID</option>
                            <option value="className" ${config.locator?.strategy === 'className' ? 'selected' : ''}>Class名称</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">定位值</label>
                        <input type="text" class="form-input" id="locatorValue" value="${config.locator?.value || ''}" placeholder="输入要检测的元素定位值">
                        <div class="form-help">要检测状态的元素定位值</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">检测类型</label>
                        <select class="form-select" id="checkType">
                            <option value="exists" ${config.checkType === 'exists' ? 'selected' : ''}>元素存在</option>
                            <option value="visible" ${config.checkType === 'visible' ? 'selected' : ''}>元素可见</option>
                            <option value="enabled" ${config.checkType === 'enabled' ? 'selected' : ''}>元素可用</option>
                            <option value="disabled" ${config.checkType === 'disabled' ? 'selected' : ''}>元素禁用</option>
                            <option value="checked" ${config.checkType === 'checked' ? 'selected' : ''}>复选框选中</option>
                            <option value="unchecked" ${config.checkType === 'unchecked' ? 'selected' : ''}>复选框未选中</option>
                            <option value="hasText" ${config.checkType === 'hasText' ? 'selected' : ''}>包含文本</option>
                            <option value="hasClass" ${config.checkType === 'hasClass' ? 'selected' : ''}>包含CSS类</option>
                        </select>
                        <div class="form-help">选择要检测的元素状态类型</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">期望值</label>
                        <input type="text" class="form-input" id="expectedValue" value="${config.expectedValue || ''}" placeholder="输入期望的检测结果">
                        <div class="form-help">对于文本或类名检测，输入期望的值；对于状态检测，输入true或false</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">超时时间 (毫秒)</label>
                        <input type="number" class="form-input" id="timeout" value="${config.timeout || 5000}" min="1000">
                        <div class="form-help">检测操作的最大等待时间</div>
                    </div>
                `;
                break;
        }

        const errorHandlingField = `
            <div class="form-group">
                <label class="form-label">错误处理</label>
                <select class="form-select" id="errorHandling">
                    <option value="continue" ${config.errorHandling === 'continue' ? 'selected' : ''}>继续执行</option>
                    <option value="stop" ${config.errorHandling === 'stop' ? 'selected' : ''}>停止执行</option>
                    <option value="skip" ${config.errorHandling === 'skip' ? 'selected' : ''}>跳过当前步骤</option>
                </select>
                <div class="form-help">当此步骤出错时的处理方式</div>
            </div>
        `;

        return commonFields + specificFields + errorHandlingField;
    }

    bindPropertyEvents(nodeId) {
        const inputs = document.querySelectorAll('#propertyContent input, #propertyContent select, #propertyContent textarea');

        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateNodeConfig(nodeId);
            });

            input.addEventListener('input', () => {
                this.updateNodeConfig(nodeId);
            });
        });
    }

    updateNodeConfig(nodeId) {
        const config = this.nodeConfigs.get(nodeId);
        if (!config) return;

        // 更新通用配置
        const nameInput = document.getElementById('nodeName');
        if (nameInput) {
            config.name = nameInput.value;

            // 更新节点显示文本
            const nodeData = this.lf.getNodeModelById(nodeId);
            if (nodeData) {
                nodeData.updateText(nameInput.value);
            }
        }

        // 更新错误处理
        const errorHandlingSelect = document.getElementById('errorHandling');
        if (errorHandlingSelect) {
            config.errorHandling = errorHandlingSelect.value;
        }

        // 更新特定配置
        switch (config.type) {
            case 'click':
                this.updateClickConfig(config);
                break;
            case 'input':
                this.updateInputConfig(config);
                break;
            case 'wait':
                this.updateWaitConfig(config);
                break;
            case 'smartWait':
                this.updateSmartWaitConfig(config);
                break;
            case 'loop':
                this.updateLoopConfig(config);
                break;
            case 'condition':
                this.updateConditionConfig(config);
                break;
            case 'checkState':
                this.updateCheckStateConfig(config);
                break;
        }

        this.nodeConfigs.set(nodeId, config);
    }

    updateClickConfig(config) {
        const strategySelect = document.getElementById('locatorStrategy');
        const valueInput = document.getElementById('locatorValue');
        const waitInput = document.getElementById('waitAfterClick');

        if (strategySelect && valueInput) {
            config.locator = {
                strategy: strategySelect.value,
                value: valueInput.value
            };
        }

        if (waitInput) {
            config.waitAfterClick = parseInt(waitInput.value) || 1000;
        }
    }

    updateInputConfig(config) {
        const strategySelect = document.getElementById('locatorStrategy');
        const valueInput = document.getElementById('locatorValue');
        const textInput = document.getElementById('inputText');
        const clearCheckbox = document.getElementById('clearFirst');

        if (strategySelect && valueInput) {
            config.locator = {
                strategy: strategySelect.value,
                value: valueInput.value
            };
        }

        if (textInput) {
            config.text = textInput.value;
        }

        if (clearCheckbox) {
            config.clearFirst = clearCheckbox.checked;
        }
    }

    updateWaitConfig(config) {
        const durationInput = document.getElementById('waitDuration');
        if (durationInput) {
            config.duration = parseInt(durationInput.value) || 1000;
        }
    }

    updateSmartWaitConfig(config) {
        const strategySelect = document.getElementById('locatorStrategy');
        const valueInput = document.getElementById('locatorValue');
        const timeoutInput = document.getElementById('timeout');
        const intervalInput = document.getElementById('checkInterval');

        if (strategySelect && valueInput) {
            config.locator = {
                strategy: strategySelect.value,
                value: valueInput.value
            };
        }

        if (timeoutInput) {
            config.timeout = parseInt(timeoutInput.value) || 30000;
        }

        if (intervalInput) {
            config.checkInterval = parseInt(intervalInput.value) || 500;
        }
    }

    updateLoopConfig(config) {
        const typeSelect = document.getElementById('loopType');
        const strategySelect = document.getElementById('locatorStrategy');
        const valueInput = document.getElementById('locatorValue');

        if (typeSelect) {
            config.loopType = typeSelect.value;
        }

        if (strategySelect && valueInput) {
            config.locator = {
                strategy: strategySelect.value,
                value: valueInput.value
            };
        }
    }

    updateConditionConfig(config) {
        const conditionInput = document.getElementById('conditionExpression');
        if (conditionInput) {
            config.condition = conditionInput.value;
        }
    }

    updateCheckStateConfig(config) {
        const strategySelect = document.getElementById('locatorStrategy');
        const valueInput = document.getElementById('locatorValue');
        const checkTypeSelect = document.getElementById('checkType');
        const expectedValueInput = document.getElementById('expectedValue');
        const timeoutInput = document.getElementById('timeout');

        if (strategySelect && valueInput) {
            config.locator = {
                strategy: strategySelect.value,
                value: valueInput.value
            };
        }

        if (checkTypeSelect) {
            config.checkType = checkTypeSelect.value;
        }

        if (expectedValueInput) {
            config.expectedValue = expectedValueInput.value;
        }

        if (timeoutInput) {
            config.timeout = parseInt(timeoutInput.value) || 30000;
        }
    }

    convertToWorkflowFormat(graphData) {
        // 将LogicFlow数据转换为原有的工作流格式
        const steps = [];

        // 根据连线关系确定执行顺序
        const sortedNodes = this.topologicalSort(graphData.nodes, graphData.edges);

        sortedNodes.forEach(node => {
            const config = this.nodeConfigs.get(node.id);
            if (config) {
                // 转换为原有格式
                const step = {
                    id: node.id,
                    type: config.type,
                    name: config.name,
                    errorHandling: config.errorHandling || 'continue'
                };

                // 根据节点类型添加特定配置
                switch (config.type) {
                    case 'click':
                        step.locator = config.locator;
                        step.waitAfterClick = config.waitAfterClick;
                        break;
                    case 'input':
                        step.locator = config.locator;
                        step.text = config.text;
                        step.clearFirst = config.clearFirst;
                        break;
                    case 'wait':
                        step.duration = config.duration;
                        break;
                    case 'smartWait':
                        step.locator = config.locator;
                        step.timeout = config.timeout;
                        step.checkInterval = config.checkInterval;
                        break;
                    case 'loop':
                        step.locator = config.locator;
                        step.loopType = config.loopType;
                        step.subOperations = config.subOperations || [];
                        break;
                    case 'condition':
                        step.condition = config.condition;
                        break;
                }

                steps.push(step);
            }
        });

        return {
            id: 'workflow_' + Date.now(),
            name: '流程图工作流',
            description: '通过流程图设计器创建的工作流',
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            steps: steps,
            settings: {
                errorHandling: 'continue',
                stepDelay: 500,
                retryCount: 0,
                timeout: 30000
            }
        };
    }

    // 拓扑排序，确定节点执行顺序
    topologicalSort(nodes, edges) {
        const nodeMap = new Map();
        const inDegree = new Map();
        const adjList = new Map();

        // 初始化
        nodes.forEach(node => {
            nodeMap.set(node.id, node);
            inDegree.set(node.id, 0);
            adjList.set(node.id, []);
        });

        // 构建邻接表和入度
        edges.forEach(edge => {
            const from = edge.sourceNodeId;
            const to = edge.targetNodeId;

            if (adjList.has(from) && inDegree.has(to)) {
                adjList.get(from).push(to);
                inDegree.set(to, inDegree.get(to) + 1);
            }
        });

        // 拓扑排序
        const queue = [];
        const result = [];

        // 找到所有入度为0的节点
        inDegree.forEach((degree, nodeId) => {
            if (degree === 0) {
                queue.push(nodeId);
            }
        });

        while (queue.length > 0) {
            const currentId = queue.shift();
            const currentNode = nodeMap.get(currentId);
            if (currentNode) {
                result.push(currentNode);
            }

            // 处理相邻节点
            const neighbors = adjList.get(currentId) || [];
            neighbors.forEach(neighborId => {
                inDegree.set(neighborId, inDegree.get(neighborId) - 1);
                if (inDegree.get(neighborId) === 0) {
                    queue.push(neighborId);
                }
            });
        }

        // 如果还有节点没有处理（存在环），按原顺序添加
        if (result.length < nodes.length) {
            nodes.forEach(node => {
                if (!result.find(n => n.id === node.id)) {
                    result.push(node);
                }
            });
        }

        return result;
    }

    // 从原有工作流格式加载数据
    loadFromWorkflowFormat(workflow) {
        if (!workflow || !workflow.steps) {
            console.warn('无效的工作流数据');
            return;
        }

        this.clearCanvas();

        const nodes = [];
        const edges = [];
        let x = 100;
        let y = 100;

        // 转换步骤为节点
        workflow.steps.forEach((step, index) => {
            const nodeNameMap = {
                'click': '👆 点击操作',
                'input': '⌨️ 输入文本',
                'wait': '⏱️ 等待时间',
                'smartWait': '🔍 智能等待',
                'loop': '🔄 循环操作',
                'condition': '❓ 条件判断',
                'checkState': '🔍 节点检测'
            };

            const nodeColorMap = {
                'click': '#e74c3c',
                'input': '#3498db',
                'wait': '#f39c12',
                'smartWait': '#9b59b6',
                'loop': '#27ae60',
                'condition': '#e67e22',
                'checkState': '#16a085'
            };

            const defaultName = nodeNameMap[step.type];
            const nodeColor = nodeColorMap[step.type];

            if (defaultName) {
                // 使用基础节点类型
                const logicFlowType = step.type === 'condition' ? 'diamond' : 'rect';

                // 使用原始文本，让LogicFlow处理换行
                const nodeName = step.name || defaultName;
                const displayText = nodeName;

                // 设置节点大小
                const nodeWidth = 150;  // 更宽的节点
                const nodeHeight = 60;  // 节点高度

                const nodeData = {
                    id: step.id || `${step.type}_${index}`,
                    type: logicFlowType,
                    x: x,
                    y: y,
                    text: displayText,
                    // 设置节点大小
                    width: nodeWidth,
                    height: nodeHeight,
                    properties: {
                        nodeType: step.type,
                        name: nodeName,
                        style: {
                            fill: nodeColor,
                            stroke: nodeColor,
                            strokeWidth: 2,
                            color: '#333333', // 深色文字
                            fontSize: 12,
                            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
                            // LogicFlow原生文本换行支持
                            textWidth: 130, // 设置文本最大宽度
                            overflowMode: 'autoWrap' // 设置超出自动换行
                        }
                    }
                };

                nodes.push(nodeData);

                // 保存节点配置
                this.nodeConfigs.set(nodeData.id, {
                    type: step.type,
                    name: step.name || defaultName,
                    ...step
                });

                // 自动连接相邻节点
                if (index > 0) {
                    const prevNodeId = workflow.steps[index - 1].id || `${workflow.steps[index - 1].type}_${index - 1}`;
                    edges.push({
                        id: `edge_${prevNodeId}_${nodeData.id}`,
                        type: 'polyline',
                        sourceNodeId: prevNodeId,
                        targetNodeId: nodeData.id
                    });
                }

                // 调整下一个节点位置
                y += 120;
                if (y > 600) {
                    y = 100;
                    x += 200;
                }
            }
        });

        // 加载到画布
        this.lf.render({
            nodes: nodes,
            edges: edges
        });

        console.log('从工作流格式加载完成:', { nodes: nodes.length, edges: edges.length });
    }

    // 监听来自插件的消息
    setupMessageListener() {
        // 监听来自插件弹窗的消息
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.action === 'loadWorkflowData' && message.workflow) {
                    console.log('收到工作流数据:', message.workflow);
                    this.loadFromWorkflowFormat(message.workflow);
                    sendResponse({ success: true });
                }
                return true;
            });
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.workflowDesigner = new WorkflowDesigner();
});
