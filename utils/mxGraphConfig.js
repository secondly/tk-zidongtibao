/**
 * mxGraph配置模块
 * 负责mxGraph的初始化配置和基础设置
 */

/**
 * 配置mxGraph基础设置
 */
function configureMxGraph() {
    // 禁用所有外部资源加载
    window.mxLoadResources = false;
    window.mxLoadStylesheets = false;
    window.mxResourceExtension = null;

    // 设置基础路径为空，避免加载外部文件
    window.mxBasePath = '';
    window.mxImageBasePath = '';

    // 禁用语言包加载
    window.mxLanguage = null;
    window.mxDefaultLanguage = null;

    console.log('mxGraph配置已设置，禁用外部资源加载');
}

/**
 * 节点类型配置
 */
const nodeTypes = {
    click: { name: '点击操作', color: '#e74c3c', icon: '👆' },
    input: { name: '输入文本', color: '#f39c12', icon: '⌨️' },
    wait: { name: '等待时间', color: '#9b59b6', icon: '⏱️' },
    smartWait: { name: '智能等待', color: '#27ae60', icon: '🔍' },
    loop: { name: '循环操作', color: '#3498db', icon: '🔄' },
    condition: { name: '条件判断', color: '#e67e22', icon: '❓' },
    checkState: { name: '节点检测', color: '#8e44ad', icon: '🔍' },
    extract: { name: '提取数据', color: '#1abc9c', icon: '📊' },
    drag: { name: '拖拽操作', color: '#ff6b35', icon: '🖱️' }
};

/**
 * 获取节点样式
 */
function getNodeStyle(nodeType) {
    const config = nodeTypes[nodeType];
    if (!config) {
        return 'fillColor=#cccccc;strokeColor=#999999;fontColor=#333333;';
    }
    
    return `fillColor=${config.color};strokeColor=#ffffff;fontColor=#ffffff;fontSize=12;fontStyle=1;`;
}

/**
 * 获取节点显示文本（包含配置信息）
 */
function getNodeDisplayText(nodeType, nodeData) {
    const config = nodeTypes[nodeType];
    const icon = config ? config.icon : '⚪';
    const name = config ? config.name : nodeType;

    let text = `${icon} ${name}`;

    // 根据节点类型添加额外信息
    if (nodeData) {
        switch (nodeType) {
            case 'click':
                if (nodeData.locator && nodeData.locator.value) {
                    text += `\n${nodeData.locator.value}`;
                }
                break;
            case 'input':
                if (nodeData.locator && nodeData.locator.value) {
                    text += `\n${nodeData.locator.value}`;
                }
                if (nodeData.inputText) {
                    text += `\n"${nodeData.inputText}"`;
                }
                break;
            case 'wait':
                if (nodeData.waitTime) {
                    text += `\n${nodeData.waitTime}ms`;
                }
                break;
            case 'smartWait':
                if (nodeData.locator && nodeData.locator.value) {
                    text += `\n${nodeData.locator.value}`;
                }
                break;
            case 'loop':
                if (nodeData.locator && nodeData.locator.value) {
                    text += `\n${nodeData.locator.value}`;
                }
                if (nodeData.loopType) {
                    text += `\n(${nodeData.loopType})`;
                }
                break;
        }
    }

    return text;
}

/**
 * 获取节点简单显示文本（仅名称，用于导入时）
 */
function getNodeSimpleDisplayText(nodeType, nodeData) {
    const config = nodeTypes[nodeType];
    const icon = config ? config.icon : '⚪';

    // 优先使用自定义名称，否则使用默认名称
    let name = '';
    if (nodeData && nodeData.name) {
        name = nodeData.name;
    } else {
        name = config ? config.name : nodeType;
    }

    return `${icon} ${name}`;
}

/**
 * 创建节点样式字符串
 */
function createNodeStyleString(nodeType, isSelected = false) {
    let style = getNodeStyle(nodeType);
    
    // 添加基础样式
    style += 'shape=rectangle;rounded=1;whiteSpace=wrap;html=1;';
    
    // 选中状态样式
    if (isSelected) {
        style += 'strokeWidth=3;strokeColor=#ff6b6b;';
    } else {
        style += 'strokeWidth=2;';
    }
    
    return style;
}

/**
 * 获取连接线样式
 */
function getEdgeStyle() {
    return 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeWidth=2;strokeColor=#34495e;';
}

/**
 * 获取条件连接线样式
 */
function getConditionalEdgeStyle(condition) {
    let style = getEdgeStyle();
    
    if (condition === 'true') {
        style += 'strokeColor=#27ae60;'; // 绿色表示true
    } else if (condition === 'false') {
        style += 'strokeColor=#e74c3c;'; // 红色表示false
    }
    
    return style;
}

// 导出函数供主文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        configureMxGraph,
        nodeTypes,
        getNodeStyle,
        getNodeDisplayText,
        createNodeStyleString,
        getEdgeStyle,
        getConditionalEdgeStyle
    };
}

// 在浏览器环境中，将函数添加到全局作用域
if (typeof window !== 'undefined') {
    window.configureMxGraph = configureMxGraph;
    window.nodeTypes = nodeTypes;
    window.getNodeStyle = getNodeStyle;
    window.getNodeDisplayText = getNodeDisplayText;
    window.createNodeStyleString = createNodeStyleString;
    window.getEdgeStyle = getEdgeStyle;
    window.getConditionalEdgeStyle = getConditionalEdgeStyle;
}
