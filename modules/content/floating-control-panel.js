/**
 * 浮层控制面板模块
 * 在每个页面植入一个可以控制插件执行的浮层
 */

class FloatingControlPanel {
    constructor() {
        this.panel = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.isMinimized = false;
        this.executionState = {
            isRunning: false,
            isPaused: false,
            currentWorkflow: null
        };
        
        this.init();
    }

    init() {
        this.createPanel();
        this.bindEvents();
        this.loadWorkflows();
        this.setupStorageListener(); // 监听存储变化
        console.log('✅ 浮层控制面板初始化完成');
    }

    createPanel() {
        // 创建主容器
        this.panel = document.createElement('div');
        this.panel.id = 'automation-floating-panel';
        this.panel.innerHTML = `
            <div class="panel-header">
                <span class="panel-title">🤖 自动助手</span>
                <div class="panel-controls">
                    <button class="btn-minimize" title="最小化">−</button>
                    <button class="btn-close" title="关闭">×</button>
                </div>
            </div>
            <div class="panel-content">
                <div class="workflow-selector">
                    <select id="workflow-select">
                        <option value="">选择工作流...</option>
                    </select>
                    <button id="refresh-workflows" title="刷新工作流列表">🔄</button>
                </div>
                <div class="execution-controls">
                    <button id="execute-btn" class="control-btn execute" disabled>▶️ 执行</button>
                    <button id="pause-btn" class="control-btn pause" disabled>⏸️ 暂停</button>
                    <button id="resume-btn" class="control-btn resume" disabled>▶️ 恢复</button>
                    <button id="stop-btn" class="control-btn stop" disabled>⏹️ 停止</button>
                </div>
                <div class="status-display">
                    <div class="status-text">就绪</div>
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                </div>
            </div>
        `;

        // 添加样式
        this.addStyles();
        
        // 插入到页面
        document.body.appendChild(this.panel);
        
        // 设置初始位置
        this.setInitialPosition();
    }

    addStyles() {
        const style = document.createElement('style');
        style.id = 'automation-floating-panel-styles';
        style.textContent = `
            #automation-floating-panel {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 280px;
                background: #ffffff;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                user-select: none;
                transition: all 0.3s ease;
            }

            #automation-floating-panel.minimized {
                height: 40px;
                overflow: hidden;
            }

            .panel-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 8px 12px;
                border-radius: 8px 8px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
            }

            .panel-title {
                font-weight: 600;
                font-size: 13px;
            }

            .panel-controls {
                display: flex;
                gap: 4px;
            }

            .btn-minimize, .btn-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 20px;
                height: 20px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }

            .btn-minimize:hover, .btn-close:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            .panel-content {
                padding: 12px;
            }

            .workflow-selector {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
            }

            #workflow-select {
                flex: 1;
                padding: 6px 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 12px;
                background: white;
            }

            #refresh-workflows {
                background: #f8f9fa;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 6px 8px;
                cursor: pointer;
                font-size: 12px;
                transition: background 0.2s;
            }

            #refresh-workflows:hover {
                background: #e9ecef;
            }

            .execution-controls {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 6px;
                margin-bottom: 12px;
            }

            .control-btn {
                padding: 8px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 500;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            }

            .control-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .control-btn.execute {
                background: #28a745;
                color: white;
            }

            .control-btn.execute:hover:not(:disabled) {
                background: #218838;
            }

            .control-btn.pause {
                background: #ffc107;
                color: #212529;
            }

            .control-btn.pause:hover:not(:disabled) {
                background: #e0a800;
            }

            .control-btn.resume {
                background: #17a2b8;
                color: white;
            }

            .control-btn.resume:hover:not(:disabled) {
                background: #138496;
            }

            .control-btn.stop {
                background: #dc3545;
                color: white;
            }

            .control-btn.stop:hover:not(:disabled) {
                background: #c82333;
            }

            .status-display {
                border-top: 1px solid #eee;
                padding-top: 8px;
            }

            .status-text {
                font-size: 11px;
                color: #666;
                margin-bottom: 4px;
                transition: color 0.2s;
            }

            .status-text.status-error {
                color: #dc3545;
            }

            .status-text.status-success {
                color: #28a745;
            }

            .status-text.status-warning {
                color: #ffc107;
            }

            .progress-bar {
                height: 4px;
                background: #f0f0f0;
                border-radius: 2px;
                overflow: hidden;
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #667eea, #764ba2);
                width: 0%;
                transition: width 0.3s ease;
            }

            /* 拖拽时的样式 */
            #automation-floating-panel.dragging {
                transition: none;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
            }
        `;
        
        // 检查是否已存在样式，避免重复添加
        if (!document.getElementById('automation-floating-panel-styles')) {
            document.head.appendChild(style);
        }
    }

    setInitialPosition() {
        // 从localStorage读取上次的位置
        const savedPosition = localStorage.getItem('automation-panel-position');
        if (savedPosition) {
            const { top, right } = JSON.parse(savedPosition);
            this.panel.style.top = top + 'px';
            this.panel.style.right = right + 'px';
        }
    }

    bindEvents() {
        // 拖拽功能
        const header = this.panel.querySelector('.panel-header');
        header.addEventListener('mousedown', this.startDrag.bind(this));
        document.addEventListener('mousemove', this.drag.bind(this));
        document.addEventListener('mouseup', this.endDrag.bind(this));

        // 最小化/关闭按钮
        this.panel.querySelector('.btn-minimize').addEventListener('click', this.toggleMinimize.bind(this));
        this.panel.querySelector('.btn-close').addEventListener('click', this.hide.bind(this));

        // 刷新工作流按钮
        this.panel.querySelector('#refresh-workflows').addEventListener('click', this.loadWorkflows.bind(this));

        // 工作流选择
        this.panel.querySelector('#workflow-select').addEventListener('change', this.onWorkflowSelect.bind(this));

        // 控制按钮
        this.panel.querySelector('#execute-btn').addEventListener('click', this.executeWorkflow.bind(this));
        this.panel.querySelector('#pause-btn').addEventListener('click', this.pauseWorkflow.bind(this));
        this.panel.querySelector('#resume-btn').addEventListener('click', this.resumeWorkflow.bind(this));
        this.panel.querySelector('#stop-btn').addEventListener('click', this.stopWorkflow.bind(this));

        // 监听来自content script的 postMessage 状态更新
        window.addEventListener('message', (event) => {
            // 确保消息来源是当前窗口
            if (event.source !== window) return;

            // 检查消息类型
            if (event.data.type === 'FROM_CONTENT_SCRIPT') {
                const { action, data } = event.data;
                console.log(`📊 浮层收到postMessage状态更新: ${action}`, data);

                if (action === 'executionStatusUpdate') {
                    this.updateExecutionStatus(data);
                } else if (action === 'executionProgress') {
                    this.updateProgress(data.progress, data.message);
                }
            }
        });
    }

    // 拖拽相关方法
    startDrag(e) {
        this.isDragging = true;
        this.panel.classList.add('dragging');

        const rect = this.panel.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;

        e.preventDefault();
    }

    drag(e) {
        if (!this.isDragging) return;

        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;

        // 限制在视窗内
        const maxX = window.innerWidth - this.panel.offsetWidth;
        const maxY = window.innerHeight - this.panel.offsetHeight;

        const constrainedX = Math.max(0, Math.min(x, maxX));
        const constrainedY = Math.max(0, Math.min(y, maxY));

        this.panel.style.left = constrainedX + 'px';
        this.panel.style.top = constrainedY + 'px';
        this.panel.style.right = 'auto';
        this.panel.style.bottom = 'auto';
    }

    endDrag() {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.panel.classList.remove('dragging');

        // 保存位置
        const rect = this.panel.getBoundingClientRect();
        const position = {
            top: rect.top,
            right: window.innerWidth - rect.right
        };
        localStorage.setItem('automation-panel-position', JSON.stringify(position));
    }

    // 面板控制方法
    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        this.panel.classList.toggle('minimized', this.isMinimized);

        const btn = this.panel.querySelector('.btn-minimize');
        btn.textContent = this.isMinimized ? '+' : '−';
    }

    hide() {
        this.panel.style.display = 'none';
    }

    show() {
        this.panel.style.display = 'block';
    }

    // 工作流相关方法
    async loadWorkflows() {
        try {
            // 从localStorage获取工作流列表
            const workflowsData = localStorage.getItem('automationWorkflows');
            let workflows = [];

            if (workflowsData) {
                workflows = JSON.parse(workflowsData);
            }

            const select = this.panel.querySelector('#workflow-select');
            select.innerHTML = '<option value="">选择工作流...</option>';

            if (Array.isArray(workflows) && workflows.length > 0) {
                workflows.forEach(workflow => {
                    const option = document.createElement('option');
                    option.value = workflow.name;
                    option.textContent = workflow.name;
                    option.dataset.workflow = JSON.stringify(workflow);
                    select.appendChild(option);
                });

                console.log(`✅ 加载了 ${workflows.length} 个工作流`);
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = '暂无工作流';
                option.disabled = true;
                select.appendChild(option);

                console.log('ℹ️ 没有找到工作流');
            }
        } catch (error) {
            console.error('❌ 加载工作流失败:', error);
        }
    }

    // 设置存储监听器，监听来自插件的数据更新
    setupStorageListener() {
        // 监听来自content script的localStorage更新消息
        window.addEventListener('storage', (event) => {
            if (event.key === 'automationWorkflows') {
                console.log('📡 检测到工作流数据变化，自动刷新列表');
                this.loadWorkflows();
            }
        });

        // 监听来自插件的直接更新消息
        window.addEventListener('message', (event) => {
            if (event.source !== window) return;

            if (event.data.type === 'WORKFLOW_DATA_UPDATED') {
                console.log('📡 收到工作流数据更新通知，刷新列表');
                this.loadWorkflows();
            }
        });

        console.log('✅ 存储监听器已设置');
    }

    onWorkflowSelect(e) {
        const selectedOption = e.target.selectedOptions[0];
        if (selectedOption && selectedOption.dataset.workflow) {
            this.executionState.currentWorkflow = JSON.parse(selectedOption.dataset.workflow);
            this.panel.querySelector('#execute-btn').disabled = false;
            this.updateStatus(`已选择: ${selectedOption.textContent}`);
            console.log('✅ 选择工作流:', this.executionState.currentWorkflow.name);
        } else {
            this.executionState.currentWorkflow = null;
            this.panel.querySelector('#execute-btn').disabled = true;
            this.updateStatus('请选择工作流');
        }
    }

    // 执行控制方法 - 直接调用插件相同的方法
    executeWorkflow() {
        if (!this.executionState.currentWorkflow) {
            this.updateStatus('请先选择工作流', 'error');
            return;
        }

        try {
            this.updateStatus('正在启动执行...');
            this.setExecutionState(true, false);

            // 发送与插件面板相同的executeWorkflow消息
            this.sendMessageToContentScript('executeWorkflow', this.executionState.currentWorkflow);

            this.updateStatus('工作流执行中...');
            console.log('✅ 工作流执行请求已发送');
        } catch (error) {
            console.error('❌ 执行工作流失败:', error);
            this.updateStatus('执行失败: ' + error.message, 'error');
            this.setExecutionState(false, false);
        }
    }

    pauseWorkflow() {
        try {
            this.updateStatus('正在暂停...');

            // 发送与插件面板相同的pauseExecution消息
            this.sendMessageToContentScript('pauseExecution');

            this.setExecutionState(true, true);
            this.updateStatus('已暂停');
            console.log('✅ 工作流暂停请求已发送');
        } catch (error) {
            console.error('❌ 暂停失败:', error);
            this.updateStatus('暂停失败: ' + error.message, 'error');
        }
    }

    resumeWorkflow() {
        try {
            this.updateStatus('正在恢复...');

            // 发送与插件面板相同的resumeExecution消息
            this.sendMessageToContentScript('resumeExecution');

            this.setExecutionState(true, false);
            this.updateStatus('已恢复执行');
            console.log('✅ 工作流恢复请求已发送');
        } catch (error) {
            console.error('❌ 恢复失败:', error);
            this.updateStatus('恢复失败: ' + error.message, 'error');
        }
    }

    stopWorkflow() {
        try {
            this.updateStatus('正在停止...');

            // 发送与插件面板相同的stopExecution消息
            this.sendMessageToContentScript('stopExecution');

            this.setExecutionState(false, false);
            this.updateStatus('已停止');
            this.updateProgress(0);
            console.log('✅ 工作流停止请求已发送');
        } catch (error) {
            console.error('❌ 停止失败:', error);
            this.updateStatus('停止失败: ' + error.message, 'error');
        }
    }

    // 通过 background script 中转消息到 content script
    sendMessageToContentScript(action, data = null) {
        // 发送消息到 background script，让它转发到 content script
        const message = {
            type: 'FLOATING_PANEL_TO_CONTENT',
            action: action,
            data: data,
            timestamp: Date.now()
        };

        // 使用 postMessage 发送到 background script
        window.postMessage({
            type: 'TO_BACKGROUND_SCRIPT',
            payload: message
        }, '*');

        console.log(`📡 通过background script转发消息: ${action}`, data);
    }

    // 状态更新方法
    setExecutionState(isRunning, isPaused) {
        this.executionState.isRunning = isRunning;
        this.executionState.isPaused = isPaused;

        const executeBtn = this.panel.querySelector('#execute-btn');
        const pauseBtn = this.panel.querySelector('#pause-btn');
        const resumeBtn = this.panel.querySelector('#resume-btn');
        const stopBtn = this.panel.querySelector('#stop-btn');

        if (isRunning) {
            executeBtn.disabled = true;
            stopBtn.disabled = false;

            if (isPaused) {
                pauseBtn.disabled = true;
                resumeBtn.disabled = false;
            } else {
                pauseBtn.disabled = false;
                resumeBtn.disabled = true;
            }
        } else {
            executeBtn.disabled = !this.executionState.currentWorkflow;
            pauseBtn.disabled = true;
            resumeBtn.disabled = true;
            stopBtn.disabled = true;
        }
    }

    updateExecutionStatus(data) {
        if (data.isRunning !== undefined) {
            this.setExecutionState(data.isRunning, data.isPaused || false);
        }

        if (data.message) {
            this.updateStatus(data.message);
        }
    }

    updateStatus(message, type = 'info') {
        const statusElement = this.panel.querySelector('.status-text');
        statusElement.textContent = message;

        // 移除之前的状态类
        statusElement.classList.remove('status-error', 'status-success', 'status-warning');

        // 添加新的状态类
        if (type === 'error') {
            statusElement.classList.add('status-error');
        } else if (type === 'success') {
            statusElement.classList.add('status-success');
        } else if (type === 'warning') {
            statusElement.classList.add('status-warning');
        }

        console.log(`📊 状态更新: ${message} (${type})`);
    }

    updateProgress(progress, message) {
        const progressFill = this.panel.querySelector('.progress-fill');
        const statusText = this.panel.querySelector('.status-text');

        if (typeof progress === 'number') {
            progressFill.style.width = Math.max(0, Math.min(100, progress)) + '%';
        }

        if (message) {
            statusText.textContent = message;
        }
    }

    // 销毁方法
    destroy() {
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }

        const styles = document.getElementById('automation-floating-panel-styles');
        if (styles && styles.parentNode) {
            styles.parentNode.removeChild(styles);
        }

        console.log('✅ 浮层控制面板已销毁');
    }
}

// 创建全局实例
if (!window.automationFloatingPanel) {
    window.automationFloatingPanel = new FloatingControlPanel();
}

// 导出类
window.FloatingControlPanel = FloatingControlPanel;


// 监听从扩展发回的消息
window.addEventListener('message', (event) => {
    if (event.source !== window) return; // 确保消息来源是当前窗口

    if (event.data.type && event.data.type === 'FROM_EXTENSION') {
        console.log('Received from extension:', event.data.text);
    }
});