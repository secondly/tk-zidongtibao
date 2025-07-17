/**
 * mxGraph图形操作模块
 * 负责节点和连接线的创建、删除、移动等操作
 */

/**
 * 创建新节点
 */
function createNode(graph, nodeType, x, y, nodeData = {}) {
    const parent = graph.getDefaultParent();

    // 生成节点ID
    const nodeId = 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // 获取节点显示文本（使用简单格式）
    const displayText = getNodeSimpleDisplayText(nodeType, nodeData);

    // 创建节点
    graph.getModel().beginUpdate();
    try {
        let vertex;

        // 特殊处理循环容器节点
        if (nodeType === 'loop' && nodeData.loopType === 'container') {
            // 创建循环容器（使用主文件中定义的样式）
            vertex = graph.insertVertex(parent, nodeId, displayText, x, y, 200, 150, 'loopContainer');
        } else {
            // 创建普通节点
            const style = createNodeStyleString(nodeType);
            const width = nodeType === 'condition' ? 120 : 100;
            const height = nodeType === 'condition' ? 80 : 40;

            vertex = graph.insertVertex(parent, nodeId, displayText, x, y, width, height, style);
        }

        // 设置节点数据（存储在节点的自定义属性中，而不是 value）
        const cellData = {
            id: nodeId,
            type: nodeType,
            name: nodeData.name || getNodeTypeName(nodeType),
            ...nodeData
        };

        // 将数据存储到节点的自定义属性中
        vertex.nodeData = cellData;

        return vertex;
    } finally {
        graph.getModel().endUpdate();
    }
}

/**
 * 更新节点显示
 */
function updateNodeDisplay(graph, cell, nodeData) {
    if (!cell || !nodeData) return;

    const nodeType = nodeData.type;
    const displayText = getNodeSimpleDisplayText(nodeType, nodeData);

    graph.getModel().beginUpdate();
    try {
        // 更新节点文本
        graph.cellLabelChanged(cell, displayText);

        // 更新节点数据（存储在自定义属性中）
        cell.nodeData = { ...cell.nodeData, ...nodeData };
    } finally {
        graph.getModel().endUpdate();
    }
}

/**
 * 删除选中的节点
 */
function deleteSelectedNodes(graph) {
    const cells = graph.getSelectionCells();
    if (cells.length === 0) {
        alert('请先选择要删除的节点');
        return;
    }
    
    if (confirm(`确定要删除选中的 ${cells.length} 个节点吗？`)) {
        graph.removeCells(cells);
    }
}

/**
 * 连接两个节点
 */
function connectNodes(graph, sourceCell, targetCell, condition = null) {
    const parent = graph.getDefaultParent();
    
    // 获取连接线样式
    let style = getEdgeStyle();
    if (condition) {
        style = getConditionalEdgeStyle(condition);
    }
    
    graph.getModel().beginUpdate();
    try {
        const edge = graph.insertEdge(parent, null, condition || '', sourceCell, targetCell, style);
        return edge;
    } finally {
        graph.getModel().endUpdate();
    }
}

/**
 * 自动布局节点
 */
function autoLayoutNodes(graph) {
    const parent = graph.getDefaultParent();
    const cells = graph.getChildVertices(parent);
    
    if (cells.length === 0) return;
    
    graph.getModel().beginUpdate();
    try {
        // 简单的垂直布局
        let y = 50;
        const x = 100;
        const spacing = 120;
        
        cells.forEach((cell, index) => {
            graph.getModel().setGeometry(cell, new mxGeometry(x, y + index * spacing, 120, 60));
        });
        
        // 刷新视图
        graph.refresh();
    } finally {
        graph.getModel().endUpdate();
    }
}

/**
 * 复制选中的节点
 */
function duplicateSelectedNodes(graph) {
    const cells = graph.getSelectionCells();
    if (cells.length === 0) {
        alert('请先选择要复制的节点');
        return;
    }
    
    graph.getModel().beginUpdate();
    try {
        const clonedCells = [];
        
        cells.forEach(cell => {
            if (graph.getModel().isVertex(cell)) {
                const geometry = graph.getModel().getGeometry(cell);
                const newX = geometry.x + 150;
                const newY = geometry.y + 50;
                
                // 复制节点数据
                const originalData = cell.value || {};
                const newData = {
                    ...originalData,
                    id: 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    name: (originalData.name || '') + ' (副本)'
                };
                
                // 创建新节点
                const newCell = createNode(graph, originalData.type, newX, newY, newData);
                clonedCells.push(newCell);
            }
        });
        
        // 选中新创建的节点
        graph.setSelectionCells(clonedCells);
    } finally {
        graph.getModel().endUpdate();
    }
}

/**
 * 获取节点类型名称
 */
function getNodeTypeName(type) {
    const typeNames = {
        click: '点击操作',
        input: '输入文本',
        wait: '等待时间',
        smartWait: '智能等待',
        loop: '循环操作',
        condition: '条件判断',
        checkState: '状态检测',
        extract: '数据提取'
    };
    return typeNames[type] || '未知操作';
}

/**
 * 验证图形连接的有效性
 */
function validateGraphConnections(graph) {
    const parent = graph.getDefaultParent();
    const vertices = graph.getChildVertices(parent);
    const edges = graph.getChildEdges(parent);
    
    const errors = [];
    
    // 检查是否有孤立的节点
    vertices.forEach(vertex => {
        const incomingEdges = graph.getIncomingEdges(vertex);
        const outgoingEdges = graph.getOutgoingEdges(vertex);
        
        if (incomingEdges.length === 0 && outgoingEdges.length === 0) {
            errors.push(`节点 "${vertex.value?.name || vertex.id}" 没有连接到其他节点`);
        }
    });
    
    // 检查条件节点是否有正确的连接
    vertices.forEach(vertex => {
        if (vertex.value?.type === 'condition') {
            const outgoingEdges = graph.getOutgoingEdges(vertex);
            if (outgoingEdges.length < 2) {
                errors.push(`条件节点 "${vertex.value?.name || vertex.id}" 应该至少有两个输出连接`);
            }
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * 清空画布
 */
function clearCanvas(graph) {
    if (confirm('确定要清空整个画布吗？此操作不可撤销。')) {
        graph.getModel().beginUpdate();
        try {
            const parent = graph.getDefaultParent();
            const cells = graph.getChildCells(parent);
            graph.removeCells(cells);
        } finally {
            graph.getModel().endUpdate();
        }
    }
}

// 导出函数供主文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createNode,
        updateNodeDisplay,
        deleteSelectedNodes,
        connectNodes,
        autoLayoutNodes,
        duplicateSelectedNodes,
        getNodeTypeName,
        validateGraphConnections,
        clearCanvas
    };
}

// 在浏览器环境中，将函数添加到全局作用域
if (typeof window !== 'undefined') {
    window.createNode = createNode;
    window.updateNodeDisplay = updateNodeDisplay;
    window.deleteSelectedNodes = deleteSelectedNodes;
    window.connectNodes = connectNodes;
    window.autoLayoutNodes = autoLayoutNodes;
    window.duplicateSelectedNodes = duplicateSelectedNodes;
    window.getNodeTypeName = getNodeTypeName;
    window.validateGraphConnections = validateGraphConnections;
    window.clearCanvas = clearCanvas;
}
