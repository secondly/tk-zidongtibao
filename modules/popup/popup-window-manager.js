/**
 * 弹窗窗口管理模块
 * 为插件弹窗界面添加新窗口管理功能的UI支持
 */

/**
 * 初始化窗口管理UI组件
 */
function initializeWindowManagerUI() {
    console.log('🪟 初始化窗口管理UI组件...');

    // 添加新窗口步骤类型到步骤类型选择器
    addWindowStepTypes();

    // 初始化窗口管理相关的事件监听器
    initializeWindowManagerListeners();

    // 添加窗口管理工具栏按钮
    addWindowManagerToolbar();

    console.log('✅ 窗口管理UI组件初始化完成');
}

/**
 * 添加新窗口步骤类型到现有的步骤类型选择器
 */
function addWindowStepTypes() {
    // 查找步骤类型选择器
    const stepTypeSelectors = document.querySelectorAll('select[id*="stepType"], select[name*="stepType"]');

    stepTypeSelectors.forEach(selector => {
        // 添加关闭窗口选项
        const closeWindowOption = document.createElement('option');
        closeWindowOption.value = 'closeWindow';
        closeWindowOption.textContent = '🗑️ 关闭窗口';
        selector.appendChild(closeWindowOption);

        // 添加切换窗口选项
        const switchWindowOption = document.createElement('option');
        switchWindowOption.value = 'switchWindow';
        switchWindowOption.textContent = '🔄 切换窗口';
        selector.appendChild(switchWindowOption);

        // 添加等待窗口选项
        const waitWindowOption = document.createElement('option');
        waitWindowOption.value = 'waitWindow';
        waitWindowOption.textContent = '⏳ 等待窗口';
        selector.appendChild(waitWindowOption);
    });

    console.log('✅ 已添加新窗口步骤类型到选择器');
}

/**
 * 初始化窗口管理相关的事件监听器
 */
function initializeWindowManagerListeners() {
    // 监听步骤类型变化，显示相应的配置选项
    document.addEventListener('change', function (event) {
        if (event.target.matches('select[id*="stepType"], select[name*="stepType"]')) {
            handleStepTypeChange(event.target);
        }
    });

    // 监听新窗口选项的变化
    document.addEventListener('change', function (event) {
        if (event.target.matches('input[name="opensNewWindow"]')) {
            handleNewWindowOptionChange(event.target);
        }
    });
}

/**
 * 处理步骤类型变化
 * @param {HTMLSelectElement} selector - 步骤类型选择器
 */
function handleStepTypeChange(selector) {
    const stepType = selector.value;
    const container = selector.closest('.step-config, .modal, .form-container');

    if (!container) return;

    // 移除现有的窗口管理配置
    removeWindowManagerConfig(container);

    // 根据步骤类型添加相应的配置选项
    switch (stepType) {
        case 'click':
            addNewWindowOption(container);
            break;
        case 'closeWindow':
            addCloseWindowConfig(container);
            break;
        case 'switchWindow':
            addSwitchWindowConfig(container);
            break;
        case 'waitWindow':
            addWaitWindowConfig(container);
            break;
    }
}

/**
 * 为点击步骤添加新窗口选项
 * @param {HTMLElement} container - 配置容器
 */
function addNewWindowOption(container) {
    const newWindowConfig = document.createElement('div');
    newWindowConfig.className = 'window-manager-config';
    newWindowConfig.innerHTML = `
    <div class="form-group">
      <label>
        <input type="checkbox" name="opensNewWindow" id="opensNewWindow">
        🪟 此操作会打开新窗口
      </label>
    </div>
    <div class="new-window-options" style="display: none; margin-left: 20px;">
      <div class="form-group">
        <label for="newWindowTimeout">新窗口超时时间 (毫秒):</label>
        <input type="number" name="newWindowTimeout" id="newWindowTimeout" value="10000" min="1000" max="60000">
      </div>
      <div class="form-group">
        <label for="windowReadyTimeout">窗口就绪超时时间 (毫秒):</label>
        <input type="number" name="windowReadyTimeout" id="windowReadyTimeout" value="30000" min="5000" max="120000">
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="switchToNewWindow" id="switchToNewWindow" checked>
          自动切换到新窗口
        </label>
      </div>
    </div>
  `;

    // 插入到定位器配置之后
    const locatorConfig = container.querySelector('.locator-config, .form-group');
    if (locatorConfig) {
        locatorConfig.parentNode.insertBefore(newWindowConfig, locatorConfig.nextSibling);
    } else {
        container.appendChild(newWindowConfig);
    }
}

/**
 * 添加关闭窗口配置
 * @param {HTMLElement} container - 配置容器
 */
function addCloseWindowConfig(container) {
    const closeWindowConfig = document.createElement('div');
    closeWindowConfig.className = 'window-manager-config';
    closeWindowConfig.innerHTML = `
    <div class="form-group">
      <label for="closeTarget">关闭目标:</label>
      <select name="closeTarget" id="closeTarget">
        <option value="current">当前窗口</option>
        <option value="specific">指定窗口</option>
        <option value="all">所有新窗口</option>
      </select>
    </div>
    <div class="form-group specific-window-options" style="display: none;">
      <label for="targetWindowId">目标窗口ID:</label>
      <input type="text" name="targetWindowId" id="targetWindowId" placeholder="输入窗口ID">
    </div>
    <div class="form-group">
      <label>
        <input type="checkbox" name="returnToPrevious" id="returnToPrevious" checked>
        返回到上一个窗口
      </label>
    </div>
  `;

    container.appendChild(closeWindowConfig);

    // 监听关闭目标变化
    const closeTargetSelect = closeWindowConfig.querySelector('#closeTarget');
    closeTargetSelect.addEventListener('change', function () {
        const specificOptions = closeWindowConfig.querySelector('.specific-window-options');
        specificOptions.style.display = this.value === 'specific' ? 'block' : 'none';
    });
}

/**
 * 添加切换窗口配置
 * @param {HTMLElement} container - 配置容器
 */
function addSwitchWindowConfig(container) {
    const switchWindowConfig = document.createElement('div');
    switchWindowConfig.className = 'window-manager-config';
    switchWindowConfig.innerHTML = `
    <div class="form-group">
      <label for="targetWindow">切换目标:</label>
      <select name="targetWindow" id="targetWindow">
        <option value="main">主窗口</option>
        <option value="previous">上一个窗口</option>
        <option value="specific">指定窗口</option>
      </select>
    </div>
    <div class="form-group specific-window-options" style="display: none;">
      <label for="targetWindowId">目标窗口ID:</label>
      <input type="text" name="targetWindowId" id="targetWindowId" placeholder="输入窗口ID">
    </div>
  `;

    container.appendChild(switchWindowConfig);

    // 监听切换目标变化
    const targetWindowSelect = switchWindowConfig.querySelector('#targetWindow');
    targetWindowSelect.addEventListener('change', function () {
        const specificOptions = switchWindowConfig.querySelector('.specific-window-options');
        specificOptions.style.display = this.value === 'specific' ? 'block' : 'none';
    });
}

/**
 * 添加等待窗口配置
 * @param {HTMLElement} container - 配置容器
 */
function addWaitWindowConfig(container) {
    const waitWindowConfig = document.createElement('div');
    waitWindowConfig.className = 'window-manager-config';
    waitWindowConfig.innerHTML = `
    <div class="form-group">
      <label for="waitCondition">等待条件:</label>
      <select name="waitCondition" id="waitCondition">
        <option value="ready">窗口就绪</option>
        <option value="closed">窗口关闭</option>
        <option value="focused">窗口获得焦点</option>
      </select>
    </div>
    <div class="form-group">
      <label for="targetWindowId">目标窗口ID (可选):</label>
      <input type="text" name="targetWindowId" id="targetWindowId" placeholder="留空表示当前窗口">
    </div>
    <div class="form-group">
      <label for="timeout">超时时间 (毫秒):</label>
      <input type="number" name="timeout" id="timeout" value="30000" min="1000" max="300000">
    </div>
  `;

    container.appendChild(waitWindowConfig);
}

/**
 * 处理新窗口选项变化
 * @param {HTMLInputElement} checkbox - 新窗口选项复选框
 */
function handleNewWindowOptionChange(checkbox) {
    const container = checkbox.closest('.window-manager-config');
    if (!container) return;

    const options = container.querySelector('.new-window-options');
    if (options) {
        options.style.display = checkbox.checked ? 'block' : 'none';
    }
}

/**
 * 移除现有的窗口管理配置
 * @param {HTMLElement} container - 配置容器
 */
function removeWindowManagerConfig(container) {
    const existingConfig = container.querySelector('.window-manager-config');
    if (existingConfig) {
        existingConfig.remove();
    }
}

/**
 * 添加窗口管理工具栏按钮
 */
function addWindowManagerToolbar() {
    // 查找现有的工具栏
    const toolbar = document.querySelector('.config-toolbar, .toolbar-actions, .action-buttons');

    if (toolbar) {
        const windowManagerBtn = document.createElement('button');
        windowManagerBtn.className = 'btn btn-secondary btn-sm';
        windowManagerBtn.innerHTML = '<span class="icon">🪟</span> 窗口管理';
        windowManagerBtn.title = '打开窗口管理面板';
        windowManagerBtn.onclick = openWindowManagerPanel;

        toolbar.appendChild(windowManagerBtn);
    }
}

/**
 * 打开窗口管理面板
 */
function openWindowManagerPanel() {
    // 创建窗口管理面板模态框
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">🪟 窗口管理面板</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="window-manager-panel">
          <div class="panel-section">
            <h4>📋 快速模板</h4>
            <div class="template-buttons">
              <button class="btn btn-sm" onclick="insertWindowTemplate('basic')">基础新窗口流程</button>
              <button class="btn btn-sm" onclick="insertWindowTemplate('complex')">复杂多窗口流程</button>
              <button class="btn btn-sm" onclick="insertWindowTemplate('form')">表单确认流程</button>
            </div>
          </div>
          
          <div class="panel-section">
            <h4>🔧 窗口状态</h4>
            <div class="window-status">
              <div class="status-item">
                <span class="status-label">主窗口:</span>
                <span class="status-value" id="mainWindowStatus">未知</span>
              </div>
              <div class="status-item">
                <span class="status-label">活动窗口:</span>
                <span class="status-value" id="activeWindowStatus">未知</span>
              </div>
              <div class="status-item">
                <span class="status-label">窗口栈:</span>
                <span class="status-value" id="windowStackStatus">空</span>
              </div>
            </div>
          </div>
          
          <div class="panel-section">
            <h4>🧪 测试工具</h4>
            <div class="test-buttons">
              <button class="btn btn-sm" onclick="openTestPage()">打开测试页面</button>
              <button class="btn btn-sm" onclick="validateWindowConfig()">验证窗口配置</button>
              <button class="btn btn-sm" onclick="resetWindowState()">重置窗口状态</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

    document.body.appendChild(modal);
    modal.style.display = 'block';

    // 更新窗口状态显示
    updateWindowStatus();
}

/**
 * 插入窗口模板
 * @param {string} templateType - 模板类型
 */
function insertWindowTemplate(templateType) {
    const templates = {
        basic: {
            name: '基础新窗口流程',
            steps: [
                {
                    name: '主窗口操作',
                    type: 'input',
                    locator: { strategy: 'css', value: '#main-input' },
                    text: '主窗口数据'
                },
                {
                    name: '打开新窗口',
                    type: 'click',
                    opensNewWindow: true,
                    locator: { strategy: 'css', value: '#open-new-window-btn' }
                },
                {
                    name: '新窗口操作',
                    type: 'input',
                    locator: { strategy: 'css', value: '#new-window-input' },
                    text: '新窗口数据'
                },
                {
                    name: '关闭新窗口',
                    type: 'closeWindow',
                    closeTarget: 'current'
                }
            ]
        },
        complex: {
            name: '复杂多窗口流程',
            steps: [
                {
                    name: '主窗口初始化',
                    type: 'click',
                    locator: { strategy: 'css', value: '#init-btn' }
                },
                {
                    name: '打开窗口A',
                    type: 'click',
                    opensNewWindow: true,
                    locator: { strategy: 'css', value: '#open-a-btn' }
                },
                {
                    name: '窗口A操作',
                    type: 'input',
                    locator: { strategy: 'css', value: '#input-a' },
                    text: '窗口A数据'
                },
                {
                    name: '从A打开窗口B',
                    type: 'click',
                    opensNewWindow: true,
                    locator: { strategy: 'css', value: '#open-b-btn' }
                },
                {
                    name: '窗口B操作',
                    type: 'input',
                    locator: { strategy: 'css', value: '#input-b' },
                    text: '窗口B数据'
                },
                {
                    name: '关闭窗口B',
                    type: 'closeWindow',
                    closeTarget: 'current'
                },
                {
                    name: '继续窗口A操作',
                    type: 'click',
                    locator: { strategy: 'css', value: '#continue-a-btn' }
                },
                {
                    name: '关闭窗口A',
                    type: 'closeWindow',
                    closeTarget: 'current'
                }
            ]
        },
        form: {
            name: '表单确认流程',
            steps: [
                {
                    name: '填写主表单',
                    type: 'input',
                    locator: { strategy: 'css', value: '#main-form' },
                    text: '主要信息'
                },
                {
                    name: '打开确认窗口',
                    type: 'click',
                    opensNewWindow: true,
                    locator: { strategy: 'css', value: '#confirm-btn' }
                },
                {
                    name: '确认信息',
                    type: 'click',
                    locator: { strategy: 'css', value: '#confirm-submit' }
                },
                {
                    name: '等待确认成功',
                    type: 'smartWait',
                    locator: { strategy: 'css', value: '#success-msg' },
                    condition: 'appear'
                },
                {
                    name: '关闭确认窗口',
                    type: 'closeWindow',
                    closeTarget: 'current'
                }
            ]
        }
    };

    const template = templates[templateType];
    if (template) {
        // 触发模板插入事件
        const event = new CustomEvent('insertTemplate', {
            detail: template
        });
        document.dispatchEvent(event);

        // 关闭面板
        document.querySelector('.modal-overlay').remove();

        console.log(`✅ 已插入${template.name}模板`);
    }
}

/**
 * 打开测试页面
 */
function openTestPage() {
    const testUrl = chrome.runtime.getURL('test-new-window-functionality.html');
    chrome.tabs.create({ url: testUrl });
}

/**
 * 验证窗口配置
 */
function validateWindowConfig() {
    // 获取当前工作流配置
    const currentWorkflow = getCurrentWorkflow();

    if (!currentWorkflow || !currentWorkflow.steps) {
        alert('❌ 没有找到可验证的工作流配置');
        return;
    }

    const windowSteps = currentWorkflow.steps.filter(step =>
        step.opensNewWindow ||
        step.type === 'closeWindow' ||
        step.type === 'switchWindow' ||
        step.type === 'waitWindow'
    );

    if (windowSteps.length === 0) {
        alert('ℹ️ 当前工作流中没有窗口管理步骤');
        return;
    }

    let validationResults = [];

    windowSteps.forEach((step, index) => {
        const result = validateWindowStep(step);
        if (!result.valid) {
            validationResults.push(`步骤 ${index + 1} (${step.name}): ${result.errors.join(', ')}`);
        }
    });

    if (validationResults.length === 0) {
        alert('✅ 窗口配置验证通过！');
    } else {
        alert('❌ 窗口配置验证失败：\n\n' + validationResults.join('\n'));
    }
}

/**
 * 重置窗口状态
 */
function resetWindowState() {
    // 发送重置消息到background script
    chrome.runtime.sendMessage({
        action: 'resetWindowState'
    }, (response) => {
        if (response && response.success) {
            alert('✅ 窗口状态已重置');
            updateWindowStatus();
        } else {
            alert('❌ 重置窗口状态失败');
        }
    });
}

/**
 * 更新窗口状态显示
 */
function updateWindowStatus() {
    // 获取窗口状态
    chrome.runtime.sendMessage({
        action: 'getWindowStatus'
    }, (response) => {
        if (response && response.success) {
            const mainWindowEl = document.getElementById('mainWindowStatus');
            const activeWindowEl = document.getElementById('activeWindowStatus');
            const windowStackEl = document.getElementById('windowStackStatus');

            if (mainWindowEl) mainWindowEl.textContent = response.mainWindow || '未设置';
            if (activeWindowEl) activeWindowEl.textContent = response.activeWindow || '未知';
            if (windowStackEl) windowStackEl.textContent = response.windowStack ?
                `[${response.windowStack.join(', ')}]` : '空';
        }
    });
}

/**
 * 从表单数据中提取窗口管理配置
 * @param {FormData} formData - 表单数据
 * @returns {object} 窗口管理配置
 */
function extractWindowManagerConfig(formData) {
    const config = {};

    // 新窗口配置
    if (formData.get('opensNewWindow') === 'on') {
        config.opensNewWindow = true;
        config.newWindowTimeout = parseInt(formData.get('newWindowTimeout')) || 10000;
        config.windowReadyTimeout = parseInt(formData.get('windowReadyTimeout')) || 30000;
        config.switchToNewWindow = formData.get('switchToNewWindow') === 'on';
    }

    // 关闭窗口配置
    if (formData.get('closeTarget')) {
        config.closeTarget = formData.get('closeTarget');
        config.returnToPrevious = formData.get('returnToPrevious') === 'on';
        if (config.closeTarget === 'specific') {
            config.targetWindowId = formData.get('targetWindowId');
        }
    }

    // 切换窗口配置
    if (formData.get('targetWindow')) {
        config.targetWindow = formData.get('targetWindow');
        if (config.targetWindow === 'specific') {
            config.targetWindowId = formData.get('targetWindowId');
        }
    }

    // 等待窗口配置
    if (formData.get('waitCondition')) {
        config.waitCondition = formData.get('waitCondition');
        config.timeout = parseInt(formData.get('timeout')) || 30000;
        const targetWindowId = formData.get('targetWindowId');
        if (targetWindowId) {
            config.targetWindowId = targetWindowId;
        }
    }

    return config;
}

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
    window.WindowManagerUI = {
        initializeWindowManagerUI,
        addWindowStepTypes,
        handleStepTypeChange,
        extractWindowManagerConfig,
        insertWindowTemplate,
        validateWindowConfig,
        openWindowManagerPanel
    };
}

// 自动初始化（如果在浏览器环境中）
if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWindowManagerUI);
} else if (typeof document !== 'undefined') {
    initializeWindowManagerUI();
}

console.log('📦 弹窗窗口管理模块已加载');