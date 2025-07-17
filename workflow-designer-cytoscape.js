/**
 * 基于Cytoscape.js的工作流设计器
 * 更稳定、更轻量的流程图解决方案
 */

class CytoscapeWorkflowDesigner {
    constructor() {
        this.cy = null;
        this.selectedNode = null;
        this.nodeConfigs = new Map();
        this.nodeCounter = 0;
        this.isConnecting = false;
        this.sourceNode = null;
        this.tempEdge = null;

        this.init();
    }
    
    async init() {
        console.log('🎨 初始化Cytoscape工作流设计器...');
        
        try {
            // 等待Cytoscape加载
            await this.waitForCytoscape();
            
            // 初始化Cytoscape
            this.initCytoscape();
            
            // 初始化事件监听
            this.initEventListeners();
            
            // 初始化右键菜单
            this.initContextMenu();
            
            // 初始化快捷键
            this.initKeyboardShortcuts();
            
            console.log('✅ Cytoscape工作流设计器初始化完成');
            
        } catch (error) {
            console.error('❌ 工作流设计器初始化失败:', error);
            this.showError('流程图引擎加载失败，请刷新页面重试');
        }
    }
    
    async waitForCytoscape() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50;
            
            const checkCytoscape = () => {
                attempts++;
                console.log(`尝试加载Cytoscape... (${attempts}/${maxAttempts})`);
                
                if (window.cytoscape) {
                    console.log('✅ Cytoscape加载成功');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.error('❌ Cytoscape加载超时');
                    reject(new Error('Cytoscape加载超时'));
                } else {
                    setTimeout(checkCytoscape, 100);
                }
            };
            checkCytoscape();
        });
    }
    
    initCytoscape() {
        const container = document.getElementById('logic-flow-container');
        container.innerHTML = '';

        // 注册edgehandles扩展
        if (window.cytoscapeEdgehandles) {
            cytoscape.use(window.cytoscapeEdgehandles);
            console.log('✅ edgehandles扩展已注册');
        } else {
            console.warn('⚠️ edgehandles扩展未找到');
        }

        this.cy = cytoscape({
            container: container,

            style: [
                // 节点样式
                {
                    selector: 'node',
                    style: {
                        'background-color': '#e74c3c',
                        'label': 'data(label)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'color': '#ffffff',
                        'font-size': '12px',
                        'font-weight': 'bold',
                        'width': '120px',
                        'height': '60px',
                        'border-width': 2,
                        'border-color': '#c0392b',
                        'text-wrap': 'wrap',
                        'text-max-width': '100px'
                    }
                },
                
                // 不同类型节点的颜色
                {
                    selector: 'node[type="click"]',
                    style: {
                        'background-color': '#e74c3c',
                        'border-color': '#c0392b'
                    }
                },
                {
                    selector: 'node[type="input"]',
                    style: {
                        'background-color': '#3498db',
                        'border-color': '#2980b9'
                    }
                },
                {
                    selector: 'node[type="wait"]',
                    style: {
                        'background-color': '#f39c12',
                        'border-color': '#e67e22'
                    }
                },
                {
                    selector: 'node[type="smartWait"]',
                    style: {
                        'background-color': '#9b59b6',
                        'border-color': '#8e44ad'
                    }
                },
                {
                    selector: 'node[type="loop"]',
                    style: {
                        'background-color': '#27ae60',
                        'border-color': '#229954'
                    }
                },
                {
                    selector: 'node[type="condition"]',
                    style: {
                        'background-color': '#e67e22',
                        'border-color': '#d35400',
                        'shape': 'diamond'
                    }
                },
                {
                    selector: 'node[type="checkState"]',
                    style: {
                        'background-color': '#16a085',
                        'border-color': '#138d75'
                    }
                },
                
                // 选中状态
                {
                    selector: 'node:selected',
                    style: {
                        'border-width': 4,
                        'border-color': '#3498db',
                        'box-shadow': '0 0 20px #3498db'
                    }
                },
                
                // 连线样式
                {
                    selector: 'edge',
                    style: {
                        'width': 3,
                        'line-color': '#3498db',
                        'target-arrow-color': '#3498db',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier'
                    }
                },
                
                // 选中的连线
                {
                    selector: 'edge:selected',
                    style: {
                        'width': 5,
                        'line-color': '#e74c3c',
                        'target-arrow-color': '#e74c3c'
                    }
                }
            ],
            
            layout: {
                name: 'preset'
            },
            
            // 启用交互
            userZoomingEnabled: true,
            userPanningEnabled: true,
            boxSelectionEnabled: true,
            selectionType: 'single'
        });
        
        // 绑定事件
        this.cy.on('tap', 'node', (evt) => {
            const node = evt.target;
            this.selectNode(node);
        });
        
        this.cy.on('tap', (evt) => {
            if (evt.target === this.cy) {
                this.deselectNode();
            }
        });
        
        // 右键菜单事件
        this.cy.on('cxttap', (evt) => {
            if (evt.target === this.cy) {
                const position = evt.position || evt.cyPosition;
                this.showContextMenu(evt.originalEvent.clientX, evt.originalEvent.clientY, position);
            }
        });
        
        // 节点右键菜单
        this.cy.on('cxttap', 'node', (evt) => {
            const node = evt.target;
            this.showNodeContextMenu(evt.originalEvent.clientX, evt.originalEvent.clientY, node);
        });

        // 初始化连线功能
        try {
            if (typeof this.cy.edgehandles === 'function') {
                this.edgehandles = this.cy.edgehandles({
                    canConnect: function(sourceNode, targetNode) {
                        // 不允许自连接
                        return !sourceNode.same(targetNode);
                    },
                    edgeParams: function(sourceNode, targetNode) {
                        return {
                            data: {
                                id: 'edge_' + Date.now(),
                                source: sourceNode.id(),
                                target: targetNode.id()
                            }
                        };
                    },
                    hoverDelay: 150,
                    snap: true,
                    snapThreshold: 50,
                    snapFrequency: 15,
                    noEdgeEventsInDraw: false,
                    disableBrowserGestures: false,
                    handleNodes: 'node', // 所有节点都可以作为连接点
                    handlePosition: function(node) {
                        return 'middle middle'; // 连接点位置
                    },
                    handleInDrawMode: false,
                    edgeType: function(sourceNode, targetNode) {
                        return 'flat';
                    },
                    loopAllowed: function(node) {
                        return false; // 不允许自循环
                    },
                    nodeLoopOffset: -50,
                    nodeParams: function(sourceNode, targetNode) {
                        return {};
                    },
                    start: function(sourceNode) {
                        console.log('开始连线:', sourceNode.id());
                    },
                    complete: function(sourceNode, targetNode, addedEles) {
                        console.log('连线完成:', sourceNode.id(), '->', targetNode.id());
                    },
                    stop: function(sourceNode) {
                        console.log('连线停止:', sourceNode.id());
                    }
                });

                // 默认启用连线功能
                this.edgehandles.enableDrawMode();
                this.drawModeEnabled = true;

                console.log('✅ 连线功能已启用');
            } else {
                console.error('❌ edgehandles方法不存在');
            }
        } catch (error) {
            console.error('❌ 连线功能初始化失败:', error);
        }

        console.log('✅ Cytoscape画布初始化成功');
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
    
    initEventListeners() {
        // 保存工作流
        document.getElementById('saveWorkflow').addEventListener('click', () => {
            this.saveWorkflow();
        });

        // 执行工作流
        document.getElementById('executeWorkflow').addEventListener('click', () => {
            this.executeWorkflow();
        });

        // 清空画布
        document.getElementById('clearCanvas').addEventListener('click', () => {
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
    }
    
    showContextMenu(clientX, clientY, position) {
        // 移除已存在的菜单
        this.removeContextMenu();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-section">
                <div class="context-menu-title">📋 基础操作</div>
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
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-section">
                <div class="context-menu-title">🔄 流程控制</div>
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
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-section">
                <div class="context-menu-title">🛠️ 检测功能</div>
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
                this.addNode(nodeType, position.x, position.y);
                this.removeContextMenu();
            }
        });
        
        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', this.removeContextMenu.bind(this), { once: true });
        }, 0);
    }

    showNodeContextMenu(clientX, clientY, node) {
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
                this.handleNodeAction(action, node);
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

    handleNodeAction(action, node) {
        switch (action) {
            case 'edit':
                this.selectNode(node);
                break;
            case 'copy':
                this.copyNode(node);
                break;
            case 'delete':
                this.cy.remove(node);
                this.nodeConfigs.delete(node.id());
                this.deselectNode();
                break;
        }
    }

    copyNode(node) {
        const config = this.nodeConfigs.get(node.id());
        if (config) {
            const position = node.position();
            this.addNode(config.type, position.x + 150, position.y + 50);
        }
    }

    addNode(type, x, y) {
        const nodeNameMap = {
            'click': '👆 点击操作',
            'input': '⌨️ 输入文本',
            'wait': '⏱️ 等待时间',
            'smartWait': '🔍 智能等待',
            'loop': '🔄 循环操作',
            'condition': '❓ 条件判断',
            'checkState': '🔍 节点检测'
        };

        const nodeName = nodeNameMap[type];
        if (!nodeName) {
            console.error('未知的节点类型:', type);
            return;
        }

        this.nodeCounter++;
        const nodeId = `${type}_${this.nodeCounter}`;

        // 添加节点到Cytoscape
        this.cy.add({
            group: 'nodes',
            data: {
                id: nodeId,
                label: nodeName,
                type: type
            },
            position: { x, y }
        });

        // 初始化节点配置
        this.initNodeConfig(nodeId, type);

        console.log('添加节点:', { id: nodeId, type, x, y });
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
                timeout: 10000,
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
                checkType: 'exists',
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

    selectNode(node) {
        // 取消之前的选择
        this.cy.$(':selected').unselect();

        // 选择当前节点
        node.select();
        this.selectedNode = node;

        // 显示属性面板
        this.showPropertyPanel(node);
    }

    deselectNode() {
        this.cy.$(':selected').unselect();
        this.selectedNode = null;
        this.hidePropertyPanel();
    }

    showPropertyPanel(node) {
        const panel = document.getElementById('propertyPanel');
        const content = document.getElementById('propertyContent');

        if (!panel || !content) {
            console.warn('属性面板元素未找到');
            return;
        }

        panel.classList.add('active');

        const nodeId = node.id();
        const config = this.nodeConfigs.get(nodeId);
        if (!config) {
            console.warn('节点配置未找到:', nodeId);
            return;
        }

        try {
            content.innerHTML = this.generatePropertyForm(nodeId, config);
            this.bindPropertyEvents(nodeId);
        } catch (error) {
            console.error('显示属性面板失败:', error);
            content.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #d93025;">
                    <p>属性面板加载失败</p>
                    <p style="font-size: 12px; color: #5f6368;">${error.message}</p>
                </div>
            `;
        }
    }

    hidePropertyPanel() {
        const panel = document.getElementById('propertyPanel');
        panel.classList.remove('active');
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
            const node = this.cy.getElementById(nodeId);
            if (node.length > 0) {
                node.data('label', nameInput.value);
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
            config.timeout = parseInt(timeoutInput.value) || 10000;
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
            config.timeout = parseInt(timeoutInput.value) || 5000;
        }
    }



    clearCanvas() {
        if (confirm('确定要清空画布吗？这将删除所有节点和连线。')) {
            this.cy.elements().remove();
            this.nodeConfigs.clear();
            this.deselectNode();
            this.nodeCounter = 0;
        }
    }

    saveWorkflow() {
        const elements = this.cy.elements().jsons();
        const workflowData = this.convertToWorkflowFormat(elements);

        console.log('保存工作流:', workflowData);
        alert('工作流已保存到控制台，请查看开发者工具');
    }

    executeWorkflow() {
        const elements = this.cy.elements().jsons();
        const workflowData = this.convertToWorkflowFormat(elements);

        console.log('执行工作流:', workflowData);
        alert('工作流数据已输出到控制台，可以集成到原有执行引擎');
    }

    convertToWorkflowFormat(elements) {
        try {
            const nodes = elements.filter(el => el.group === 'nodes');
            const edges = elements.filter(el => el.group === 'edges');

            // 根据连线关系确定执行顺序
            const sortedNodes = this.topologicalSort(nodes, edges);

            const steps = sortedNodes.map(node => {
                const config = this.nodeConfigs.get(node.data.id);
                if (!config) {
                    console.warn('节点配置缺失:', node.data.id);
                    return {
                        id: node.data.id,
                        type: node.data.type || 'unknown',
                        name: node.data.label || '未命名节点'
                    };
                }

                // 创建一个干净的配置副本，避免循环引用
                const cleanConfig = {
                    type: config.type,
                    name: config.name,
                    errorHandling: config.errorHandling
                };

                // 根据类型添加特定配置
                switch (config.type) {
                    case 'click':
                        cleanConfig.locator = config.locator;
                        cleanConfig.waitAfterClick = config.waitAfterClick;
                        break;
                    case 'input':
                        cleanConfig.locator = config.locator;
                        cleanConfig.text = config.text;
                        cleanConfig.clearFirst = config.clearFirst;
                        break;
                    case 'wait':
                        cleanConfig.duration = config.duration;
                        break;
                    case 'smartWait':
                        cleanConfig.locator = config.locator;
                        cleanConfig.timeout = config.timeout;
                        cleanConfig.checkInterval = config.checkInterval;
                        break;
                    case 'loop':
                        cleanConfig.locator = config.locator;
                        cleanConfig.loopType = config.loopType;
                        cleanConfig.subOperations = config.subOperations || [];
                        break;
                    case 'condition':
                        cleanConfig.condition = config.condition;
                        break;
                    case 'checkState':
                        cleanConfig.locator = config.locator;
                        cleanConfig.checkType = config.checkType;
                        cleanConfig.expectedValue = config.expectedValue;
                        cleanConfig.timeout = config.timeout;
                        break;
                }

                return {
                    id: node.data.id,
                    ...cleanConfig
                };
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

        } catch (error) {
            console.error('转换工作流格式失败:', error);
            return {
                id: 'workflow_error_' + Date.now(),
                name: '错误的工作流',
                description: '转换失败: ' + error.message,
                steps: [],
                settings: {}
            };
        }
    }

    topologicalSort(nodes, edges) {
        try {
            // 简化的拓扑排序，避免复杂对象引用
            const nodeIds = nodes.map(node => node.data.id);
            const nodeMap = new Map();
            const inDegree = new Map();
            const adjList = new Map();

            // 初始化
            nodes.forEach(node => {
                const id = node.data.id;
                nodeMap.set(id, node);
                inDegree.set(id, 0);
                adjList.set(id, []);
            });

            // 构建邻接表和入度
            edges.forEach(edge => {
                const from = edge.data.source;
                const to = edge.data.target;

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
                    if (!result.find(n => n.data.id === node.data.id)) {
                        result.push(node);
                    }
                });
            }

            return result;

        } catch (error) {
            console.error('拓扑排序失败:', error);
            // 如果排序失败，返回原始顺序
            return nodes;
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
                    case 'e':
                        e.preventDefault();
                        this.executeWorkflow();
                        return;
                }

                if (nodeType) {
                    e.preventDefault();
                    // 在画布中心创建节点
                    const extent = this.cy.extent();
                    const centerX = (extent.x1 + extent.x2) / 2;
                    const centerY = (extent.y1 + extent.y2) / 2;
                    this.addNode(nodeType, centerX, centerY);
                }
            }

            // Delete键删除选中的节点
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedNode) {
                e.preventDefault();
                this.cy.remove(this.selectedNode);
                this.nodeConfigs.delete(this.selectedNode.id());
                this.deselectNode();
            }
        });
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.workflowDesigner = new CytoscapeWorkflowDesigner();
});
