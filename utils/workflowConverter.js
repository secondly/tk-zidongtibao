/**
 * 工作流转换模块
 * 负责图形和工作流数据之间的转换
 */

/**
 * 将图形转换为工作流数据
 */
function convertGraphToWorkflow(graph, workflowName = '新工作流') {
    const parent = graph.getDefaultParent();
    const vertices = graph.getChildVertices(parent);

    if (vertices.length === 0) {
        throw new Error('画布中没有节点，无法生成工作流');
    }

    // 简单的图形验证（可选，不影响导出）
    console.log('开始导出工作流，跳过图形连接验证');

    console.log(`开始导出工作流，顶层节点数量: ${vertices.length}`);

    // 直接处理所有顶层节点，不依赖执行顺序
    const steps = vertices.map((vertex, index) => {
        const nodeData = vertex.nodeData || {};
        const geometry = vertex.getGeometry();

        console.log(`处理节点 ${index + 1}/${vertices.length}: ${vertex.id} (${nodeData.type})`);

        // 处理循环容器的子操作
        let subOperations = [];
        if (nodeData.type === 'loop' && nodeData.loopType === 'container') {
            // 获取容器内的子节点
            const childVertices = graph.getChildVertices(vertex);
            console.log(`循环容器 ${nodeData.id || vertex.id} 包含 ${childVertices.length} 个子节点`);

            subOperations = childVertices.map((childVertex, childIndex) => {
                const childData = childVertex.nodeData || {};
                const childGeometry = childVertex.getGeometry();

                console.log(`  子节点 ${childIndex + 1}: ${childVertex.id} (${childData.type})`);

                const subStepData = {
                    id: childData.id || childVertex.id || `sub_${vertex.id}_${childIndex}`,
                    type: childData.type || 'click',
                    name: childData.name || getNodeTypeName(childData.type),
                    locator: childData.locator || { strategy: 'css', value: '' },
                    inputText: childData.inputText || '',
                    waitTime: childData.waitTime || 1000,
                    timeout: childData.timeout || 10000,
                    delay: childData.delay || 0,
                    errorHandling: childData.errorHandling || 'continue',
                    // 保存子节点的相对坐标
                    x: childGeometry ? childGeometry.x : 10,
                    y: childGeometry ? childGeometry.y : 10,
                    width: childGeometry ? childGeometry.width : 100,
                    height: childGeometry ? childGeometry.height : 40
                };

                // 为子操作添加类型特定的字段
                switch (childData.type) {
                    case 'input':
                        if (childData.inputText) subStepData.inputText = childData.inputText;
                        if (childData.clearFirst !== undefined) subStepData.clearFirst = childData.clearFirst;
                        break;
                    case 'wait':
                        if (childData.waitType) subStepData.waitType = childData.waitType;
                        if (childData.waitTime) subStepData.waitTime = childData.waitTime;
                        break;
                    case 'smartWait':
                        if (childData.timeout) subStepData.timeout = childData.timeout;
                        if (childData.checkInterval) subStepData.checkInterval = childData.checkInterval;
                        if (childData.waitCondition) subStepData.waitCondition = childData.waitCondition;
                        if (childData.attributeName !== undefined) subStepData.attributeName = childData.attributeName;
                        console.log('🔧 [DEBUG] 导出智能等待子操作:', {
                            timeout: subStepData.timeout,
                            checkInterval: subStepData.checkInterval,
                            waitCondition: subStepData.waitCondition,
                            attributeName: subStepData.attributeName
                        });
                        break;
                    case 'extract':
                        if (childData.extractType) subStepData.extractType = childData.extractType;
                        if (childData.attributeName) subStepData.attributeName = childData.attributeName;
                        if (childData.variableName) subStepData.variableName = childData.variableName;
                        break;
                    case 'condition':
                        console.log('🔧 [DEBUG] 导出条件判断子操作，原始childData:', childData);
                        if (childData.conditionType) subStepData.conditionType = childData.conditionType;
                        if (childData.comparisonType) subStepData.comparisonType = childData.comparisonType;
                        if (childData.expectedValue !== undefined) subStepData.expectedValue = childData.expectedValue;
                        if (childData.attributeName !== undefined) subStepData.attributeName = childData.attributeName;
                        console.log('🔧 [DEBUG] 导出条件判断子操作，最终subStepData:', {
                            conditionType: subStepData.conditionType,
                            comparisonType: subStepData.comparisonType,
                            expectedValue: subStepData.expectedValue,
                            attributeName: subStepData.attributeName
                        });
                        break;
                }

                return subStepData;
            });
        }

        // 构建完整的节点数据
        const stepData = {
            id: nodeData.id || vertex.id || `step_${index}`,
            type: nodeData.type || 'click',
            name: nodeData.name || getNodeTypeName(nodeData.type),
            locator: nodeData.locator || { strategy: 'css', value: '' },
            inputText: nodeData.inputText || '',
            waitTime: nodeData.waitTime || 1000,
            timeout: nodeData.timeout || 10000,
            errorHandling: nodeData.errorHandling || 'continue',
            // 保存节点坐标信息
            x: geometry ? geometry.x : 100,
            y: geometry ? geometry.y : 100,
            width: geometry ? geometry.width : 120,
            height: geometry ? geometry.height : 60
        };

        // 为不同节点类型添加特定字段
        switch (nodeData.type) {
            case 'input':
                if (nodeData.inputText) stepData.inputText = nodeData.inputText;
                if (nodeData.clearFirst !== undefined) stepData.clearFirst = nodeData.clearFirst;
                break;
            case 'wait':
                if (nodeData.waitType) stepData.waitType = nodeData.waitType;
                if (nodeData.waitTime) stepData.waitTime = nodeData.waitTime;
                break;
            case 'smartWait':
                console.log('🔧 [DEBUG] 导出智能等待节点，原始nodeData:', nodeData);
                if (nodeData.timeout) stepData.timeout = nodeData.timeout;
                if (nodeData.checkInterval) stepData.checkInterval = nodeData.checkInterval;
                if (nodeData.waitCondition) stepData.waitCondition = nodeData.waitCondition;
                if (nodeData.attributeName !== undefined) stepData.attributeName = nodeData.attributeName;
                console.log('🔧 [DEBUG] 导出智能等待节点，最终stepData:', {
                    timeout: stepData.timeout,
                    checkInterval: stepData.checkInterval,
                    waitCondition: stepData.waitCondition,
                    attributeName: stepData.attributeName
                });
                break;
            case 'extract':
                if (nodeData.extractType) stepData.extractType = nodeData.extractType;
                if (nodeData.attributeName) stepData.attributeName = nodeData.attributeName;
                if (nodeData.variableName) stepData.variableName = nodeData.variableName;
                break;
            case 'condition':
                console.log('🔧 [DEBUG] 导出条件判断节点，原始nodeData:', nodeData);
                if (nodeData.conditionType) stepData.conditionType = nodeData.conditionType;
                if (nodeData.comparisonType) stepData.comparisonType = nodeData.comparisonType;
                if (nodeData.expectedValue !== undefined) stepData.expectedValue = nodeData.expectedValue;
                if (nodeData.attributeName !== undefined) stepData.attributeName = nodeData.attributeName;
                console.log('🔧 [DEBUG] 导出条件判断节点，最终stepData:', {
                    conditionType: stepData.conditionType,
                    comparisonType: stepData.comparisonType,
                    expectedValue: stepData.expectedValue,
                    attributeName: stepData.attributeName
                });
                break;
        }

        // 只有循环节点才添加循环相关属性
        if (nodeData.type === 'loop') {
            console.log('🔧 [DEBUG] 导出循环节点，原始nodeData:', nodeData);
            stepData.loopType = nodeData.loopType || 'container';
            stepData.startIndex = nodeData.startIndex || 0;
            stepData.endIndex = nodeData.endIndex || -1;
            stepData.operationType = nodeData.operationType || 'click';
            stepData.operationDelay = nodeData.operationDelay || 1000;
            stepData.maxIterations = nodeData.maxIterations || 10;
            stepData.subOperations = subOperations;

            // 虚拟列表相关配置
            console.log('🔍 [DEBUG] 检查虚拟列表配置:', {
                isVirtualList: nodeData.isVirtualList,
                type: typeof nodeData.isVirtualList,
                container: nodeData.virtualListContainer,
                titleLocator: nodeData.virtualListTitleLocator
            });

            // 始终传递虚拟列表配置，便于调试
            stepData.isVirtualList = nodeData.isVirtualList;
            stepData.virtualListContainer = nodeData.virtualListContainer;
            stepData.virtualListTitleLocator = nodeData.virtualListTitleLocator;
            stepData.virtualListScrollDistance = nodeData.virtualListScrollDistance || 100;
            stepData.virtualListWaitTime = nodeData.virtualListWaitTime || 1000;
            stepData.virtualListMaxRetries = nodeData.virtualListMaxRetries || 10;

            if (nodeData.isVirtualList) {
                console.log('✅ [DEBUG] 虚拟列表已启用，配置已添加到stepData');
            } else {
                console.log('❌ [DEBUG] 虚拟列表未启用，但配置已传递便于调试');
            }

            console.log('🔧 [DEBUG] 导出循环节点，最终stepData:', {
                loopType: stepData.loopType,
                startIndex: stepData.startIndex,
                endIndex: stepData.endIndex,
                operationType: stepData.operationType,
                operationDelay: stepData.operationDelay,
                isVirtualList: stepData.isVirtualList,
                locator: stepData.locator
            });
        }

        // 只有条件节点才添加条件相关属性
        if (nodeData.type === 'condition') {
            console.log('🔧 [DEBUG] 导出条件判断节点，原始nodeData:', nodeData);
            stepData.conditionType = nodeData.conditionType || 'element';
            stepData.attributeName = nodeData.attributeName || '';
            stepData.comparisonType = nodeData.comparisonType || 'equals';
            stepData.expectedValue = nodeData.expectedValue || '';
            console.log('🔧 [DEBUG] 导出条件判断节点，最终stepData:', {
                conditionType: stepData.conditionType,
                attributeName: stepData.attributeName,
                comparisonType: stepData.comparisonType,
                expectedValue: stepData.expectedValue
            });
        }

        console.log(`节点 ${stepData.id} 导出完成，包含 ${subOperations.length} 个子操作`);

        return stepData;
    });

    // 导出连接信息
    const connections = [];

    // 递归收集所有连接（包括容器内的连接）
    function collectConnections(container, parentId = null) {
        const containerEdges = graph.getChildEdges(container);
        containerEdges.forEach(edge => {
            const sourceId = edge.source ? (edge.source.nodeData?.id || edge.source.id) : null;
            const targetId = edge.target ? (edge.target.nodeData?.id || edge.target.id) : null;

            if (sourceId && targetId) {
                connections.push({
                    id: edge.id,
                    source: sourceId,
                    target: targetId,
                    label: edge.value || '',
                    style: edge.style || null,
                    parentId: parentId
                });
            }
        });

        // 递归处理子容器
        const childVertices = graph.getChildVertices(container);
        childVertices.forEach(child => {
            if (child.nodeData?.type === 'loop' && child.nodeData?.loopType === 'container') {
                collectConnections(child, child.nodeData?.id || child.id);
            }
        });
    }

    // 收集顶层连接
    collectConnections(parent);

    console.log(`导出完成: ${steps.length} 个步骤, ${connections.length} 个连接`);

    return {
        id: 'workflow_' + Date.now(),
        name: workflowName,
        description: `从图形设计器生成的工作流，包含${steps.length}个步骤`,
        steps: steps,
        connections: connections, // 添加连接信息
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0'
    };
}

/**
 * 构建执行顺序
 */
function buildExecutionOrder(graph, startNode) {
    const visited = new Set();
    const executionOrder = [];

    function traverse(node) {
        if (visited.has(node.id)) {
            return; // 避免循环引用
        }

        visited.add(node.id);
        executionOrder.push(node);

        // 获取输出连接（只处理顶层连接）
        const outgoingEdges = graph.getOutgoingEdges(node).filter(edge => {
            // 确保目标节点也是顶层节点
            return edge.target && edge.target.getParent() === parent;
        });

        // 对于条件节点，需要特殊处理
        if (node.nodeData?.type === 'condition') {
            // 先处理true分支，再处理false分支
            const trueEdge = outgoingEdges.find(edge => edge.value === 'true');
            const falseEdge = outgoingEdges.find(edge => edge.value === 'false');

            if (trueEdge) {
                traverse(trueEdge.target);
            }
            if (falseEdge) {
                traverse(falseEdge.target);
            }
        } else {
            // 普通节点，按顺序处理所有输出
            outgoingEdges.forEach(edge => {
                traverse(edge.target);
            });
        }
    }

    traverse(startNode);
    return executionOrder;
}

/**
 * 将工作流数据转换为图形
 */
function convertWorkflowToGraph(graph, workflow) {
    console.log('🔄 convertWorkflowToGraph 开始，接收到的工作流数据:', workflow);

    if (!workflow) {
        throw new Error('工作流数据无效或为空');
    }

    // 兼容不同的数据格式
    let steps = [];
    let nodes = [];
    let edges = [];

    console.log('🔍 分析工作流数据格式...');
    console.log('  - workflow.steps 存在:', !!workflow.steps);
    console.log('  - workflow.steps 是数组:', Array.isArray(workflow.steps));
    console.log('  - workflow.nodes 存在:', !!workflow.nodes);
    console.log('  - workflow.nodes 是数组:', Array.isArray(workflow.nodes));

    if (workflow.steps && Array.isArray(workflow.steps)) {
        // 新格式：标准工作流格式
        steps = workflow.steps;
        console.log(`✅ 检测到新格式数据: ${steps.length} 个步骤, 连接数: ${workflow.connections ? workflow.connections.length : 0}`);
        console.log('🔍 步骤详情:', steps);
    } else if (workflow.nodes && Array.isArray(workflow.nodes)) {
        // 旧格式：mxGraph格式
        nodes = workflow.nodes;
        edges = workflow.edges || [];
        console.log(`✅ 检测到旧格式数据: ${nodes.length} 个节点, ${edges.length} 个连接`);
        console.log('🔍 节点详情:', nodes);
    } else {
        console.error('❌ 不支持的工作流数据格式，数据结构:', Object.keys(workflow));
        console.error('完整数据:', workflow);
        throw new Error('不支持的工作流数据格式');
    }

    // 清空现有图形
    clearCanvas(graph);

    const parent = graph.getDefaultParent();
    const nodeMap = new Map(); // 存储步骤ID到节点的映射

    graph.getModel().beginUpdate();
    try {
        if (steps.length > 0) {
            // 处理标准工作流格式
            steps.forEach((step, index) => {
                // 使用JSON中的精确坐标和尺寸，如果没有则使用默认布局
                const x = step.x || (100 + (index % 3) * 200);
                const y = step.y || (100 + Math.floor(index / 3) * 150);
                const width = step.width || (step.type === 'condition' ? 120 : (step.type === 'loop' ? 200 : 100));
                const height = step.height || (step.type === 'condition' ? 80 : (step.type === 'loop' ? 150 : 40));

                // 特殊处理循环容器
                let node;
                if (step.type === 'loop' && step.loopType === 'container') {
                    // 直接创建循环容器
                    const nodeId = step.id || `step_${index}`;
                    const displayText = getNodeSimpleDisplayText(step.type, step);
                    node = graph.insertVertex(parent, nodeId, displayText, x, y, width, height, 'loopContainer');
                } else {
                    // 创建普通节点
                    console.log('🔧 [DEBUG] 创建普通节点，传递的步骤数据:', step);
                    node = createNode(graph, step.type, x, y, step);
                    // 应用正确的尺寸
                    const geometry = node.getGeometry();
                    if (geometry) {
                        geometry.width = width;
                        geometry.height = height;
                    }
                    // 更新显示文本为简单格式
                    const simpleText = getNodeSimpleDisplayText(step.type, step);
                    node.setValue(simpleText);
                }

                // 添加到节点映射，使用多个可能的ID
                nodeMap.set(step.id, node);
                if (step.id !== node.id) {
                    nodeMap.set(node.id, node); // 也添加mxGraph生成的ID
                }

                // 确保节点数据同步，并为旧数据添加默认配置
                const nodeData = { ...step, id: step.id };

                // 为旧的条件判断节点添加默认配置（向后兼容性）
                if (nodeData.type === 'condition') {
                    if (!nodeData.conditionType) nodeData.conditionType = 'attribute';
                    if (!nodeData.comparisonType) nodeData.comparisonType = 'equals';
                    if (!nodeData.expectedValue) nodeData.expectedValue = '';
                    if (!nodeData.attributeName) nodeData.attributeName = '';
                    console.log('🔧 [DEBUG] 为导入的旧条件判断节点添加默认配置:', nodeData);
                }

                node.nodeData = nodeData;

                console.log(`节点映射: ${step.id} -> ${node.id}`);

                // 如果是循环容器且有子操作，创建子节点
                if (step.type === 'loop' && step.loopType === 'container' && step.subOperations && step.subOperations.length > 0) {
                    console.log(`重建循环容器 ${step.id} 的 ${step.subOperations.length} 个子操作:`, step.subOperations);

                    step.subOperations.forEach((subOp, subIndex) => {
                        // 使用子操作的精确位置和尺寸
                        const subX = subOp.x || (10 + (subIndex % 2) * 80);
                        const subY = subOp.y || (40 + Math.floor(subIndex / 2) * 50);
                        const subWidth = subOp.width || (subOp.type === 'condition' ? 120 : 100);
                        const subHeight = subOp.height || (subOp.type === 'condition' ? 80 : 40);

                        // 直接在容器内创建子节点
                        const subNodeId = subOp.id || `sub_${step.id}_${subIndex}`;
                        const displayText = getNodeSimpleDisplayText(subOp.type, subOp);

                        // 根据节点类型确定样式
                        let style;
                        if (subOp.type === 'condition') {
                            style = 'condition'; // 使用菱形样式
                        } else {
                            style = createNodeStyleString(subOp.type);
                        }

                        const subNode = graph.insertVertex(node, subNodeId, displayText, subX, subY, subWidth, subHeight, style);

                        // 设置子节点数据，并为旧数据添加默认配置
                        const subNodeData = { ...subOp, id: subNodeId };

                        // 为旧的条件判断子节点添加默认配置（向后兼容性）
                        if (subNodeData.type === 'condition') {
                            if (!subNodeData.conditionType) subNodeData.conditionType = 'attribute';
                            if (!subNodeData.comparisonType) subNodeData.comparisonType = 'equals';
                            if (!subNodeData.expectedValue) subNodeData.expectedValue = '';
                            if (!subNodeData.attributeName) subNodeData.attributeName = '';
                            console.log('🔧 [DEBUG] 为导入的旧条件判断子节点添加默认配置:', subNodeData);
                        }

                        subNode.nodeData = subNodeData;

                        // 也将子节点添加到映射中，以便后续可能的连接
                        nodeMap.set(subOp.id, subNode);
                        if (subOp.id !== subNode.id) {
                            nodeMap.set(subNode.id, subNode); // 也添加mxGraph生成的ID
                        }

                        console.log(`子节点映射: ${subOp.id} -> ${subNode.id}`);

                        console.log(`创建子节点: ${subOp.id} (${subOp.type}) 在容器 ${step.id} 内，位置 (${subX}, ${subY})，尺寸 (${subWidth}x${subHeight})`);
                    });
                }
            });

            // 创建连接（使用导出的连接信息）
            if (workflow.connections && workflow.connections.length > 0) {
                console.log('创建连接，连接数量:', workflow.connections.length);

                workflow.connections.forEach((connData, index) => {
                    console.log(`处理连接 ${index + 1}/${workflow.connections.length}:`, connData);

                    const sourceNode = nodeMap.get(connData.source);
                    const targetNode = nodeMap.get(connData.target);

                    if (sourceNode && targetNode) {
                        console.log(`✓ 创建连接: ${connData.source} -> ${connData.target}，父容器: ${connData.parentId || 'root'}`);

                        // 确定连接的父容器
                        let edgeParent = parent;
                        if (connData.parentId) {
                            const parentContainer = nodeMap.get(connData.parentId);
                            if (parentContainer) {
                                edgeParent = parentContainer;
                                console.log(`  连接将创建在容器 ${connData.parentId} 内`);
                            } else {
                                console.warn(`  找不到父容器 ${connData.parentId}，使用根容器`);
                            }
                        }

                        // 创建连接
                        const edge = graph.insertEdge(edgeParent, connData.id, connData.label || '', sourceNode, targetNode);

                        // 应用样式
                        if (connData.style) {
                            console.log(`  应用连接样式: ${connData.style}`);
                            graph.setCellStyle(connData.style, [edge]);
                        }

                        // 设置连接标签
                        if (connData.label) {
                            edge.setValue(connData.label);
                        }

                        console.log(`  连接创建成功: ${edge.id}`);
                    } else {
                        console.error(`✗ 连接失败: ${connData.source} -> ${connData.target}`);
                        console.error(`  源节点 ${connData.source} 存在: ${!!sourceNode}`);
                        console.error(`  目标节点 ${connData.target} 存在: ${!!targetNode}`);
                        console.error(`  可用节点映射:`, Array.from(nodeMap.keys()));
                    }
                });
            } else {
                console.log('没有连接信息，跳过连接创建');
            }
        } else if (nodes.length > 0) {
            // 处理mxGraph格式
            console.log('处理旧格式mxGraph数据，节点数量:', nodes.length);

            // 首先创建所有顶层节点
            const topLevelNodes = nodes.filter(nodeData => !nodeData.parentId);
            const childNodes = nodes.filter(nodeData => nodeData.parentId);

            console.log('顶层节点:', topLevelNodes.length, '子节点:', childNodes.length);

            // 创建顶层节点
            topLevelNodes.forEach(nodeData => {
                const x = nodeData.x || 100;
                const y = nodeData.y || 100;
                const width = nodeData.width || (nodeData.type === 'condition' ? 120 : (nodeData.type === 'loop' ? 460 : 100));
                const height = nodeData.height || (nodeData.type === 'condition' ? 80 : (nodeData.type === 'loop' ? 480 : 40));
                const config = nodeData.config || {};

                console.log(`创建顶层节点: ${nodeData.id} (${nodeData.type}) at (${x}, ${y}) size (${width}x${height})`);

                // 特殊处理循环容器
                let node;
                if (nodeData.type === 'loop' && config.loopType === 'container') {
                    // 直接创建循环容器
                    const nodeId = nodeData.id;
                    const displayText = getNodeSimpleDisplayText(nodeData.type, config);
                    node = graph.insertVertex(parent, nodeId, displayText, x, y, width, height, 'loopContainer');
                } else {
                    // 创建普通节点
                    node = createNode(graph, nodeData.type, x, y, config);
                    // 应用正确的尺寸
                    const geometry = node.getGeometry();
                    if (geometry) {
                        geometry.width = width;
                        geometry.height = height;
                    }
                    // 更新显示文本为简单格式
                    const simpleText = getNodeSimpleDisplayText(nodeData.type, config);
                    node.setValue(simpleText);
                }

                nodeMap.set(nodeData.id, node);

                // 确保节点数据同步
                node.nodeData = { ...config, id: nodeData.id };
            });

            // 创建子节点
            childNodes.forEach(nodeData => {
                const parentNode = nodeMap.get(nodeData.parentId);
                if (!parentNode) {
                    console.warn(`找不到父节点: ${nodeData.parentId}`);
                    return;
                }

                // 使用JSON中的精确位置和尺寸信息
                const x = nodeData.x || 10;
                const y = nodeData.y || 10;
                const width = nodeData.width || (nodeData.type === 'condition' ? 120 : 100);
                const height = nodeData.height || (nodeData.type === 'condition' ? 80 : 40);
                const config = nodeData.config || {};

                console.log(`创建子节点: ${nodeData.id} (${nodeData.type}) 在父节点 ${nodeData.parentId} 内，位置 (${x}, ${y})，尺寸 (${width}x${height})`);

                // 直接在父容器内创建子节点
                const nodeId = nodeData.id;
                const displayText = getNodeSimpleDisplayText(nodeData.type, config);

                // 根据节点类型确定样式
                let style;
                if (nodeData.type === 'condition') {
                    style = 'condition'; // 使用菱形样式
                } else {
                    style = createNodeStyleString(nodeData.type);
                }

                const childNode = graph.insertVertex(parentNode, nodeId, displayText, x, y, width, height, style);

                nodeMap.set(nodeData.id, childNode);

                // 确保节点数据同步
                childNode.nodeData = { ...config, id: nodeData.id };
            });

            // 创建连接
            if (edges && edges.length > 0) {
                console.log('创建连接，连接数量:', edges.length);

                edges.forEach(edgeData => {
                    const sourceNode = nodeMap.get(edgeData.source);
                    const targetNode = nodeMap.get(edgeData.target);

                    if (sourceNode && targetNode) {
                        console.log(`创建连接: ${edgeData.source} -> ${edgeData.target}，父容器: ${edgeData.parentId || 'root'}`);

                        // 确定连接的父容器
                        let edgeParent = parent;
                        if (edgeData.parentId) {
                            const parentContainer = nodeMap.get(edgeData.parentId);
                            if (parentContainer) {
                                edgeParent = parentContainer;
                                console.log(`连接将创建在容器 ${edgeData.parentId} 内`);
                            }
                        }

                        // 创建连接
                        const edge = graph.insertEdge(edgeParent, edgeData.id, edgeData.label || '', sourceNode, targetNode);

                        // 应用样式
                        if (edgeData.style) {
                            console.log(`应用连接样式: ${edgeData.style}`);
                            graph.setCellStyle(edgeData.style, [edge]);
                        }

                        // 设置连接标签的位置和样式
                        if (edgeData.label) {
                            edge.setValue(edgeData.label);
                        }
                    } else {
                        console.warn(`连接失败: ${edgeData.source} -> ${edgeData.target}，找不到节点`);
                        console.warn(`源节点存在: ${!!sourceNode}, 目标节点存在: ${!!targetNode}`);
                    }
                });
            }
        }

    } finally {
        graph.getModel().endUpdate();
    }

    // 确保所有节点都可见，并适当调整视图
    const bounds = graph.getGraphBounds();
    if (bounds.width > 0 && bounds.height > 0) {
        // 添加一些边距
        const margin = 50;
        graph.fit(margin);

        // 如果图形太小，设置最小缩放
        const scale = graph.getView().getScale();
        if (scale > 1.5) {
            graph.getView().setScale(1.0);
        }
    }

    console.log('工作流导入完成，节点总数:', graph.getChildVertices(graph.getDefaultParent()).length);
}

/**
 * 导出工作流为JSON
 */
function exportWorkflowAsJSON(graph, workflowName) {
    try {
        const workflow = convertGraphToWorkflow(graph, workflowName);

        const dataStr = JSON.stringify(workflow, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${workflowName || 'workflow'}_${new Date().toISOString().slice(0, 10)}.json`;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        URL.revokeObjectURL(url);

        return workflow;
    } catch (error) {
        alert(`导出失败: ${error.message}`);
        throw error;
    }
}

/**
 * 从JSON导入工作流
 */
function importWorkflowFromJSON(graph, file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const workflowData = JSON.parse(e.target.result);

                // 验证工作流数据格式
                if (!workflowData.steps || !Array.isArray(workflowData.steps)) {
                    throw new Error('无效的工作流文件格式');
                }

                convertWorkflowToGraph(graph, workflowData);
                resolve(workflowData);
            } catch (error) {
                reject(new Error(`导入失败: ${error.message}`));
            }
        };

        reader.onerror = function () {
            reject(new Error('文件读取失败'));
        };

        reader.readAsText(file);
    });
}

/**
 * 获取图形统计信息
 */
function getGraphStatistics(graph) {
    const parent = graph.getDefaultParent();
    const vertices = graph.getChildVertices(parent);
    const edges = graph.getChildEdges(parent);

    // 统计节点类型
    const nodeTypeCount = {};
    vertices.forEach(vertex => {
        const nodeType = vertex.value?.type || 'unknown';
        nodeTypeCount[nodeType] = (nodeTypeCount[nodeType] || 0) + 1;
    });

    return {
        totalNodes: vertices.length,
        totalConnections: edges.length,
        nodeTypeCount: nodeTypeCount,
        hasStartNode: vertices.some(v => graph.getIncomingEdges(v).length === 0),
        hasEndNode: vertices.some(v => graph.getOutgoingEdges(v).length === 0)
    };
}

// 导出函数供主文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        convertGraphToWorkflow,
        buildExecutionOrder,
        convertWorkflowToGraph,
        exportWorkflowAsJSON,
        importWorkflowFromJSON,
        getGraphStatistics
    };
}

// 在浏览器环境中，将函数添加到全局作用域
if (typeof window !== 'undefined') {
    window.convertGraphToWorkflow = convertGraphToWorkflow;
    window.buildExecutionOrder = buildExecutionOrder;
    window.convertWorkflowToGraph = convertWorkflowToGraph;
    window.exportWorkflowAsJSON = exportWorkflowAsJSON;
    window.importWorkflowFromJSON = importWorkflowFromJSON;
    window.getGraphStatistics = getGraphStatistics;
}
