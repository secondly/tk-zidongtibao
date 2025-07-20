/**
 * 工作流设计器工作流管理模块
 * 负责工作流的导入、导出、保存和加载功能
 */

/**
 * 工作流管理器
 */
export class DesignerWorkflowManager {
    constructor(designer) {
        this.designer = designer;
        this.graph = designer.graph;
    }

    /**
     * 从localStorage加载工作流数据
     */
    loadWorkflowFromStorage() {
        try {
            // 首先检查是否有编辑模式的临时数据
            const tempEditData = localStorage.getItem('temp_edit_workflow');
            console.log('🔍 检查编辑模式临时数据:', tempEditData);

            if (tempEditData) {
                const editData = JSON.parse(tempEditData);
                console.log('🎨 检测到编辑模式数据:', editData);
                console.log('🔍 编辑数据详情:');
                console.log('  - 模式:', editData.mode);
                console.log('  - 时间戳:', editData.timestamp);
                console.log('  - 工作流:', editData.workflow);

                if (editData.mode === 'edit' && editData.workflow) {
                    console.log('🔄 加载编辑模式工作流:', editData.workflow.name);
                    console.log('🔍 工作流步骤数量:', editData.workflow.steps ? editData.workflow.steps.length : 0);
                    console.log('🔍 工作流步骤详情:', editData.workflow.steps);

                    // 转换并导入工作流数据
                    console.log('📥 开始导入工作流数据...');
                    this.importWorkflowData(editData.workflow);
                    console.log('✅ 工作流数据导入完成');

                    // 设置编辑模式标记
                    this.designer.editMode = true;
                    this.designer.originalWorkflow = editData.workflow;

                    this.designer.updateStatus(`编辑模式: ${editData.workflow.name}`);

                    // 更新窗口标题
                    document.title = `工作流设计器 - 编辑: ${editData.workflow.name}`;

                    return; // 编辑模式优先，不再检查其他数据
                }
            }

            // 检查是否有常规的localStorage数据
            const data = localStorage.getItem('mxgraph_workflow');
            if (data) {
                this.importWorkflowData(JSON.parse(data));
                this.designer.updateStatus('工作流已从本地存储加载');
            } else {
                this.designer.updateStatus('欢迎使用工作流设计器');
            }
        } catch (error) {
            console.error('加载工作流失败:', error);
            this.designer.updateStatus('加载工作流失败: ' + error.message);
        }
    }

    /**
     * 加载工作流文件
     */
    loadWorkflow() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadWorkflowFromFile(file);
            }
        };

        input.click();
    }

    /**
     * 从文件加载工作流
     */
    loadWorkflowFromFile(file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // 转换并导入工作流数据
                this.importWorkflowData(data);

                this.designer.updateStatus(`工作流已从文件 "${file.name}" 加载`);
            } catch (error) {
                console.error('加载工作流文件失败:', error);
                this.designer.updateStatus('加载文件失败: ' + error.message);
                alert('加载文件失败: ' + error.message);
            }
        };

        reader.readAsText(file);
    }

    /**
     * 导入工作流数据
     */
    importWorkflowData(data) {
        try {
            console.log('📥 importWorkflowData 开始，接收到的数据:', data);
            console.log('🔍 数据类型:', typeof data);
            console.log('🔍 数据结构:', Object.keys(data));
            console.log('🔍 步骤数据:', data.steps);

            // 使用模块中的转换函数
            console.log('🔄 调用 convertWorkflowToGraph...');
            convertWorkflowToGraph(this.graph, data);
            console.log('✅ convertWorkflowToGraph 完成');

            // 清空节点配置并重新构建（包括容器内的子节点）
            this.designer.nodeConfigs.clear();

            // 递归重建所有节点配置
            const rebuildConfigs = (container) => {
                const children = this.graph.getChildVertices(container);
                children.forEach(cell => {
                    if (cell.nodeData && typeof cell.nodeData === 'object') {
                        this.designer.nodeConfigs.set(cell.id, cell.nodeData);
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
                    this.designer.nodeConfigs.set(cell.id, cell.nodeData);
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

                    // 递归处理子节点
                    rebuildConfigs(cell);
                }
            });

            console.log(`✅ 节点配置重建完成，总计 ${this.designer.nodeConfigs.size} 个节点`);

            // 更新节点计数
            this.designer.updateNodeCount();

            // 刷新显示
            this.graph.refresh();

        } catch (error) {
            console.error('❌ 导入工作流数据失败:', error);
            console.error('错误详情:', error.stack);
            throw error;
        }
    }

    /**
     * 导出工作流数据
     */
    exportWorkflowData() {
        try {
            console.log('📤 开始导出工作流数据...');

            // 使用模块中的转换函数
            const workflowData = convertGraphToWorkflow(this.graph, '导出的工作流');

            console.log('✅ 工作流数据导出完成:', workflowData);
            return workflowData;

        } catch (error) {
            console.error('❌ 导出工作流数据失败:', error);
            throw error;
        }
    }

    /**
     * 保存工作流（带对话框）
     */
    saveWorkflowWithDialog() {
        try {
            const workflowData = this.exportWorkflowData();
            if (!workflowData || !workflowData.steps || workflowData.steps.length === 0) {
                alert('请先创建工作流步骤再保存');
                return;
            }

            // 检查是否为编辑模式
            if (this.designer.editMode && this.designer.originalWorkflow) {
                console.log('🎨 编辑模式保存，原工作流:', this.designer.originalWorkflow.name);

                // 编辑模式：保持原名称或允许用户修改
                const currentName = this.designer.originalWorkflow.name || '未命名工作流';
                const workflowName = prompt('工作流名称 (留空保持原名称):', currentName);

                if (workflowName === null) {
                    this.designer.updateStatus('保存已取消');
                    return;
                }

                const finalName = workflowName.trim() || currentName;
                workflowData.name = finalName;
                workflowData.createdAt = this.designer.originalWorkflow.createdAt || new Date().toISOString();
                workflowData.updatedAt = new Date().toISOString();

                // 保存编辑结果到临时存储，供弹窗读取
                const tempKey = 'temp_edit_workflow';
                const tempData = JSON.parse(localStorage.getItem(tempKey) || '{}');
                tempData.workflow = workflowData;
                tempData.updated = true;
                tempData.timestamp = Date.now();
                localStorage.setItem(tempKey, JSON.stringify(tempData));

                this.designer.updateStatus(`✅ 工作流 "${finalName}" 编辑完成！请关闭设计器窗口以应用更改。`);

                console.log('✅ 编辑模式保存完成，数据已准备好供弹窗读取');
                return;
            }

            // 非编辑模式的常规保存逻辑
            const workflowName = prompt('请输入工作流名称:', workflowData.name || '新工作流');
            if (!workflowName) {
                this.designer.updateStatus('保存已取消');
                return;
            }

            const trimmedName = workflowName.trim();
            if (!trimmedName) {
                alert('工作流名称不能为空');
                return;
            }

            // 获取现有工作流列表
            let savedWorkflows = [];
            try {
                const existing = localStorage.getItem('automationWorkflows');
                if (existing) {
                    savedWorkflows = JSON.parse(existing);
                }
            } catch (error) {
                console.error('读取现有工作流失败:', error);
                savedWorkflows = [];
            }

            // 确保是数组
            if (!Array.isArray(savedWorkflows)) {
                console.warn('现有工作流数据格式异常，重置为空数组');
                savedWorkflows = [];
            }

            console.log('📋 当前保存的工作流数量:', savedWorkflows.length);
            console.log('📋 现有工作流列表:', savedWorkflows.map(w => w.name));

            // 检查是否已存在同名工作流
            const existingIndex = savedWorkflows.findIndex(w => w.name === trimmedName);
            if (existingIndex >= 0) {
                if (!confirm(`工作流 "${trimmedName}" 已存在，是否覆盖？`)) {
                    this.designer.updateStatus('保存已取消');
                    return;
                }
            }

            // 设置工作流元数据
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

            // 触发存储事件，通知其他窗口
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'automationWorkflows',
                newValue: JSON.stringify(savedWorkflows),
                url: window.location.href
            }));

            this.designer.updateStatus(`✅ 工作流 "${trimmedName}" 保存成功！`);
            console.log('✅ 工作流保存完成');

        } catch (error) {
            console.error('❌ 保存工作流失败:', error);
            this.designer.updateStatus('保存失败: ' + error.message);
            alert('保存失败: ' + error.message);
        }
    }

    /**
     * 保存工作流到本地存储
     */
    saveWorkflow() {
        try {
            const data = this.exportWorkflowData();
            localStorage.setItem('mxgraph_workflow', JSON.stringify(data));
            this.designer.updateStatus('工作流已保存到本地存储');
        } catch (error) {
            console.error('保存工作流失败:', error);
            this.designer.updateStatus('保存失败: ' + error.message);
        }
    }

    /**
     * 导出工作流到文件
     */
    exportData() {
        try {
            const workflowData = this.exportWorkflowData();

            if (!workflowData || !workflowData.steps || workflowData.steps.length === 0) {
                alert('请先创建工作流步骤再导出');
                return;
            }

            // 使用文件导出管理器
            if (typeof exportWorkflowToFile === 'function') {
                exportWorkflowToFile(workflowData);
            } else {
                // 降级方案：直接下载
                this.downloadWorkflowFile(workflowData);
            }

        } catch (error) {
            console.error('导出工作流失败:', error);
            this.designer.updateStatus('导出失败: ' + error.message);
            alert('导出失败: ' + error.message);
        }
    }

    /**
     * 下载工作流文件
     */
    downloadWorkflowFile(workflowData) {
        const dataStr = JSON.stringify(workflowData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${workflowData.name || 'workflow'}.json`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.designer.updateStatus('工作流已导出');
    }

    /**
     * 清空画布
     */
    clearCanvas() {
        if (confirm('确定要清空画布吗？此操作不可撤销。')) {
            this.graph.removeCells(this.graph.getChildVertices(this.graph.getDefaultParent()));
            this.designer.nodeConfigs.clear();
            this.designer.updateNodeCount();
            this.designer.updateStatus('画布已清空');
        }
    }

    /**
     * 创建新工作流
     */
    newWorkflow() {
        if (this.graph.getChildVertices(this.graph.getDefaultParent()).length > 0) {
            if (!confirm('当前有未保存的工作流，确定要创建新工作流吗？')) {
                return;
            }
        }

        this.clearCanvas();
        this.designer.editMode = false;
        this.designer.originalWorkflow = null;
        document.title = '工作流设计器';
        this.designer.updateStatus('已创建新工作流');
    }

    /**
     * 获取工作流统计信息
     */
    getWorkflowStats() {
        const vertices = this.graph.getChildVertices(this.graph.getDefaultParent());
        const edges = this.graph.getChildEdges(this.graph.getDefaultParent());

        // 递归计算所有节点
        let totalNodes = 0;
        const countNodes = (container) => {
            const children = this.graph.getChildVertices(container);
            totalNodes += children.length;
            children.forEach(child => {
                if (this.graph.isSwimlane(child)) {
                    countNodes(child);
                }
            });
        };

        countNodes(this.graph.getDefaultParent());

        return {
            totalNodes: totalNodes,
            topLevelNodes: vertices.length,
            connections: edges.length,
            configurations: this.designer.nodeConfigs.size
        };
    }

    /**
     * 验证工作流完整性
     */
    validateWorkflow() {
        const stats = this.getWorkflowStats();
        const issues = [];

        if (stats.totalNodes === 0) {
            issues.push('工作流为空，请添加至少一个节点');
        }

        // 检查未配置的节点
        const vertices = this.graph.getChildVertices(this.graph.getDefaultParent());
        vertices.forEach(cell => {
            const config = this.designer.nodeConfigs.get(cell.id);
            if (!config) {
                issues.push(`节点 ${cell.value} 缺少配置`);
            } else if (config.type !== 'wait' && (!config.locator || !config.locator.value)) {
                issues.push(`节点 ${config.name || cell.value} 缺少定位器配置`);
            }
        });

        return {
            isValid: issues.length === 0,
            issues: issues,
            stats: stats
        };
    }
}