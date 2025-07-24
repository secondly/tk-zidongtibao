/**
 * 工作流设计器工作流管理模块
 * 负责工作流的导入导出、保存加载、数据转换等功能
 */

class DesignerWorkflow {
  constructor(core) {
    this.core = core;
    // 使用属性访问器，确保总是获取最新的图形实例
    Object.defineProperty(this, 'graph', {
      get: () => this.core.graph
    });
    Object.defineProperty(this, 'nodeConfigs', {
      get: () => this.core.nodeConfigs
    });
  }

  exportWorkflowData() {
    try {
      // 检查图形实例是否存在
      if (!this.graph) {
        throw new Error("图形实例未初始化");
      }
      
      const parent = this.graph.getDefaultParent();
      const vertices = this.graph.getChildVertices(parent);
      const edges = this.graph.getChildEdges(parent);

      console.log("🔄 开始导出工作流数据");
      console.log(`📊 节点数量: ${vertices.length}`);

      // 构建步骤数据
      const steps = [];
      const stepMap = new Map(); // 用于映射cell.id到步骤索引

      // 处理所有节点
      vertices.forEach((vertex, index) => {
        const config = this.nodeConfigs.get(vertex.id) || vertex.nodeData || {};
        const geometry = vertex.getGeometry();

        console.log(`📝 处理节点 ${index + 1}:`, {
          id: vertex.id,
          type: config.type,
          name: config.name,
          position: { x: geometry.x, y: geometry.y },
        });

        const step = {
          id: vertex.id,
          type: config.type || "unknown",
          name: config.name || `步骤${index + 1}`,
          x: geometry.x,
          y: geometry.y,
          width: geometry.width,
          height: geometry.height,
          ...config, // 包含所有配置信息
        };

        // 特殊处理循环容器
        if (this.graph.isSwimlane(vertex)) {
          step.isContainer = true;
          step.loopType = config.loopType || "container";

          // 获取容器内的子节点
          const children = this.graph.getChildVertices(vertex);
          console.log(`🔍 循环容器 ${vertex.id} 当前包含 ${children.length} 个子节点`);

          if (children.length > 0) {
            step.subOperations = [];
            children.forEach((child, childIndex) => {
              const childConfig = this.nodeConfigs.get(child.id) || child.nodeData || {};
              const childGeometry = child.getGeometry();

              console.log(`🔍 处理子节点 ${childIndex + 1}: ${child.id} (${childConfig.type || 'unknown'})`);
              console.log(`  - nodeConfigs中的配置:`, this.nodeConfigs.get(child.id));
              console.log(`  - nodeData中的配置:`, child.nodeData);

              // 只有当子节点有有效配置时才添加到subOperations
              if (childConfig.type) {
                const subOperation = {
                  id: child.id,
                  type: childConfig.type,
                  name: childConfig.name || "子操作",
                  x: childGeometry.x,
                  y: childGeometry.y,
                  width: childGeometry.width,
                  height: childGeometry.height,
                  ...childConfig,
                };
                step.subOperations.push(subOperation);
                console.log(`✅ 已添加子操作:`, subOperation);
              } else {
                console.warn(`⚠️ 跳过无效的子节点 ${child.id}，缺少类型配置`);
              }
            });

            console.log(`🔄 循环容器最终包含 ${step.subOperations.length} 个有效子操作`);
          } else {
            step.subOperations = [];
            console.log(`🔄 循环容器为空，没有子操作`);
          }
        }

        steps.push(step);
        stepMap.set(vertex.id, index);
      });

      // 处理连线关系 - 使用与workflowConverter.js一致的格式
      const connections = [];

      // 递归收集所有连接（包括容器内的连接）
      const collectConnections = (container, parentId = null) => {
        const containerEdges = this.graph.getChildEdges(container);
        containerEdges.forEach(edge => {
          const source = edge.getTerminal(true);
          const target = edge.getTerminal(false);

          if (source && target) {
            const sourceId = source.nodeData?.id || source.id;
            const targetId = target.nodeData?.id || target.id;

            if (sourceId && targetId) {
              const connection = {
                id: edge.id,
                source: sourceId,
                target: targetId,
                label: edge.getValue() || '',
                style: edge.getStyle() || null,
                parentId: parentId
              };

              connections.push(connection);
              console.log(`🔗 连线: ${sourceId} -> ${targetId}，父容器: ${parentId || 'root'}`);
            }
          }
        });

        // 递归处理子容器
        const childVertices = this.graph.getChildVertices(container);
        childVertices.forEach(child => {
          if (child.nodeData?.type === 'loop' && child.nodeData?.loopType === 'container') {
            collectConnections(child, child.nodeData?.id || child.id);
          }
        });
      };

      // 收集顶层连接
      collectConnections(parent);
      console.log(`📊 连线收集完成，连线数量: ${connections.length}`);

      const workflowData = {
        name: "未命名工作流",
        description: "",
        version: "1.0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: steps,
        connections: connections,
        metadata: {
          nodeCount: vertices.length,
          connectionCount: connections.length,
          exportedAt: new Date().toISOString(),
          exportedBy: "mxGraph工作流设计器",
        },
      };

      console.log("✅ 工作流数据导出完成:", workflowData);
      return workflowData;
    } catch (error) {
      console.error("❌ 导出工作流数据失败:", error);
      throw error;
    }
  }

  importWorkflowData(data) {
    try {
      console.log("📥 开始导入工作流数据:", data);

      if (!data) {
        throw new Error("工作流数据为空");
      }

      // 检查图形实例是否存在
      if (!this.graph) {
        throw new Error("图形实例未初始化");
      }

      // 清空当前画布
      const vertices = this.graph.getChildVertices(this.graph.getDefaultParent());
      if (vertices && vertices.length > 0) {
        this.graph.removeCells(vertices);
      }
      this.nodeConfigs.clear();

      // 检查数据格式
      let steps = [];
      let connections = [];

      if (data.steps && Array.isArray(data.steps)) {
        steps = data.steps;
        connections = data.connections || [];
        console.log("📊 标准格式数据 - 步骤数:", steps.length);
      } else if (data.nodes && Array.isArray(data.nodes)) {
        // 兼容旧格式
        steps = data.nodes;
        connections = data.edges || data.connections || [];
        console.log("📊 兼容格式数据 - 节点数:", steps.length);
      } else {
        throw new Error("无效的工作流数据格式");
      }

      const parent = this.graph.getDefaultParent();
      const cellMap = new Map(); // 映射步骤ID到mxGraph cell

      this.graph.getModel().beginUpdate();
      try {
        // 创建节点
        steps.forEach((step, index) => {
          console.log(`📝 创建节点 ${index + 1}:`, step);

          const nodeType = step.type || "unknown";
          const x = step.x || 100 + index * 150;
          const y = step.y || 100;
          const width = step.width || 120;
          const height = step.height || 60;

          let cell;

          // 检查是否为循环容器
          if (step.isContainer || step.loopType === "container") {
            console.log("🔄 创建循环容器:", step.name);
            // 创建循环容器，使用保存的尺寸或默认尺寸
            const containerWidth = step.width || 200;
            const containerHeight = step.height || 150;
            cell = this.graph.insertVertex(
              parent,
              step.id,
              step.name || "循环容器",
              x,
              y,
              containerWidth,
              containerHeight,
              "loopContainer"
            );

            // 创建子操作
            if (step.subOperations && Array.isArray(step.subOperations)) {
              step.subOperations.forEach((subOp, subIndex) => {
                console.log(`📝 创建子操作 ${subIndex + 1}:`, subOp);
                const subCell = this.graph.insertVertex(
                  cell,
                  subOp.id,
                  subOp.name || `子操作${subIndex + 1}`,
                  subOp.x || 20,
                  subOp.y || 50 + subIndex * 80,
                  subOp.width || 100,
                  subOp.height || 50,
                  subOp.type || "click"
                );

                // 保存子操作配置
                this.nodeConfigs.set(subOp.id, subOp);
                subCell.nodeData = subOp;
                cellMap.set(subOp.id, subCell);
              });
            }
          } else {
            // 创建普通节点
            cell = this.graph.insertVertex(
              parent,
              step.id,
              step.name || `步骤${index + 1}`,
              x,
              y,
              width,
              height,
              nodeType
            );
          }

          // 保存节点配置
          this.nodeConfigs.set(step.id, step);
          cell.nodeData = step;
          cellMap.set(step.id, cell);

          console.log(`✅ 节点创建完成: ${step.id}`);
        });

        // 创建连线
        console.log(`🔗 开始创建 ${connections.length} 个连线`);
        console.log("📋 可用的节点映射:", Array.from(cellMap.keys()));
        
        connections.forEach((conn, index) => {
          console.log(`🔗 创建连线 ${index + 1}:`, conn);

          let sourceCell, targetCell;

          // 支持多种连线格式
          if (conn.fromId && conn.toId) {
            // 方式1: 通过节点ID查找
            sourceCell = cellMap.get(conn.fromId);
            targetCell = cellMap.get(conn.toId);
            console.log(`📍 通过ID查找: ${conn.fromId} -> ${conn.toId}`);
            console.log(`📍 找到的节点: ${!!sourceCell} -> ${!!targetCell}`);
          } else if (typeof conn.from === "number" && typeof conn.to === "number") {
            // 方式2: 基于索引的连线
            const sourceStep = steps[conn.from];
            const targetStep = steps[conn.to];
            console.log(`📍 通过索引查找: ${conn.from} -> ${conn.to}`);
            console.log(`📍 对应步骤: ${sourceStep?.id} -> ${targetStep?.id}`);
            
            if (sourceStep && targetStep) {
              sourceCell = cellMap.get(sourceStep.id);
              targetCell = cellMap.get(targetStep.id);
              console.log(`📍 找到的节点: ${!!sourceCell} -> ${!!targetCell}`);
            }
          } else if (conn.source && conn.target) {
            // 方式3: 兼容旧格式 (source/target)
            sourceCell = cellMap.get(conn.source);
            targetCell = cellMap.get(conn.target);
            console.log(`📍 通过source/target查找: ${conn.source} -> ${conn.target}`);
            console.log(`📍 找到的节点: ${!!sourceCell} -> ${!!targetCell}`);
          } else if (conn.sourceId && conn.targetId) {
            // 方式4: 兼容其他格式 (sourceId/targetId)
            sourceCell = cellMap.get(conn.sourceId);
            targetCell = cellMap.get(conn.targetId);
            console.log(`📍 通过sourceId/targetId查找: ${conn.sourceId} -> ${conn.targetId}`);
            console.log(`📍 找到的节点: ${!!sourceCell} -> ${!!targetCell}`);
          } else {
            console.warn(`⚠️ 不支持的连线格式:`, conn);
            console.warn(`📋 连线对象的所有属性:`, Object.keys(conn));
          }

          if (sourceCell && targetCell) {
            const label = conn.label || "";
            let style = conn.style || "";

            // 设置条件判断连线样式（兼容旧格式）
            if (conn.conditionResult !== undefined) {
              style = conn.conditionResult ? "conditionTrue" : "conditionFalse";
            }

            // 确定连线的父容器
            let edgeParent = parent;
            if (conn.parentId) {
              const parentContainer = cellMap.get(conn.parentId);
              if (parentContainer) {
                edgeParent = parentContainer;
                console.log(`  连线将创建在容器 ${conn.parentId} 内`);
              } else {
                console.warn(`  找不到父容器 ${conn.parentId}，使用根容器`);
              }
            }

            try {
              const edge = this.graph.insertEdge(
                edgeParent,
                conn.id || null,
                label,
                sourceCell,
                targetCell,
                style
              );

              if (edge) {
                console.log(`✅ 连线创建完成: ${sourceCell.id} -> ${targetCell.id}，父容器: ${conn.parentId || 'root'}`);
              } else {
                console.error(`❌ 连线创建失败，insertEdge返回null`);
              }
            } catch (error) {
              console.error(`❌ 连线创建异常:`, error);
            }
          } else {
            console.warn(`⚠️ 连线创建失败，找不到源或目标节点:`);
            console.warn(`  - 连线配置:`, conn);
            console.warn(`  - 源节点存在:`, !!sourceCell);
            console.warn(`  - 目标节点存在:`, !!targetCell);
            console.warn(`  - 可用节点ID:`, Array.from(cellMap.keys()));
          }
        });
      } finally {
        this.graph.getModel().endUpdate();
      }

      // 适应画布大小
      this.graph.fit();

      // 更新状态
      this.core.updateNodeCount();
      this.core.updateStatus(
        `工作流导入完成: ${steps.length}个节点, ${connections.length}个连线`
      );

      console.log("✅ 工作流数据导入完成");
    } catch (error) {
      console.error("❌ 导入工作流数据失败:", error);
      this.core.updateStatus("导入失败: " + error.message);
      throw error;
    }
  }

  async saveWorkflowWithDialog() {
    try {
      const workflowData = this.exportWorkflowData();

      if (!workflowData.steps || workflowData.steps.length === 0) {
        this.core.updateStatus("请先创建工作流步骤");
        return;
      }

      // 检查是否为编辑模式
      if (this.core.editMode && this.core.originalWorkflow) {
        console.log("🎨 编辑模式保存，原工作流:", this.core.originalWorkflow.name);

        // 编辑模式下，默认使用原工作流名称
        const currentName = this.core.originalWorkflow.name;

        // 询问是否要修改名称
        const workflowName = prompt(
          "工作流名称 (留空保持原名称):",
          currentName
        );

        if (workflowName === null) {
          this.core.updateStatus("保存已取消");
          return;
        }

        const finalName = workflowName.trim() || currentName;

        // 更新工作流数据
        workflowData.name = finalName;
        workflowData.updatedAt = new Date().toISOString();
        workflowData.createdAt =
          this.core.originalWorkflow.createdAt || new Date().toISOString();

        // 保存编辑结果到临时存储，供弹窗读取
        const tempKey = "temp_edit_workflow";
        const tempData = JSON.parse(localStorage.getItem(tempKey) || "{}");
        tempData.workflow = workflowData;
        tempData.updated = true;
        tempData.timestamp = Date.now();
        localStorage.setItem(tempKey, JSON.stringify(tempData));

        // 同时保存到设计器专用存储
        localStorage.setItem("mxgraph_workflow", JSON.stringify(workflowData));

        // 立即更新主存储中的工作流列表
        try {
          console.log("🔄 立即更新主存储中的工作流数据...");
          const savedWorkflows = JSON.parse(localStorage.getItem("automationWorkflows") || "[]");

          // 查找并更新对应的工作流
          const workflowIndex = savedWorkflows.findIndex(w => w.name === this.core.originalWorkflow.name);
          if (workflowIndex >= 0) {
            savedWorkflows[workflowIndex] = workflowData;
            localStorage.setItem("automationWorkflows", JSON.stringify(savedWorkflows));
            localStorage.setItem("mxgraph_workflows", JSON.stringify(savedWorkflows));
            console.log("✅ 主存储已更新，工作流索引:", workflowIndex);

            // 触发storage事件，通知插件面板立即更新
            window.dispatchEvent(new StorageEvent("storage", {
              key: "automationWorkflows",
              newValue: JSON.stringify(savedWorkflows),
              url: window.location.href,
            }));
            console.log("✅ 已触发storage事件通知插件面板");
          } else {
            console.warn("⚠️ 在主存储中未找到对应的工作流:", this.core.originalWorkflow.name);
          }
        } catch (error) {
          console.error("❌ 更新主存储失败:", error);
        }

        this.core.updateStatus(
          `✅ 工作流 "${finalName}" 保存成功！更改已立即生效。`
        );

        console.log("✅ 编辑模式保存完成，数据已立即同步到所有存储位置");
        return;
      }

      // 非编辑模式的常规保存逻辑
      // 获取现有的工作流列表
      let savedWorkflows = [];
      try {
        const existing = localStorage.getItem("automationWorkflows");
        if (existing) {
          savedWorkflows = JSON.parse(existing);
        }
      } catch (error) {
        console.error("读取现有工作流失败:", error);
      }

      // 获取当前工作流名称（如果有的话）
      const currentName = workflowData.name || "";

      // 弹出输入对话框
      const workflowName = prompt(
        "请输入工作流名称:",
        currentName || "新建工作流"
      );

      if (!workflowName || !workflowName.trim()) {
        this.core.updateStatus("保存已取消");
        return;
      }

      const trimmedName = workflowName.trim();

      // 检查是否已存在同名工作流
      const existingIndex = savedWorkflows.findIndex(
        (w) => w.name === trimmedName
      );
      if (existingIndex >= 0) {
        if (!confirm(`工作流 "${trimmedName}" 已存在，是否覆盖？`)) {
          this.core.updateStatus("保存已取消");
          return;
        }
      }

      // 更新工作流数据
      workflowData.name = trimmedName;
      workflowData.updatedAt = new Date().toISOString();
      if (!workflowData.createdAt) {
        workflowData.createdAt = new Date().toISOString();
      }

      // 保存到工作流列表
      if (existingIndex >= 0) {
        savedWorkflows[existingIndex] = workflowData;
        console.log("✅ 更新现有工作流:", trimmedName);
      } else {
        savedWorkflows.push(workflowData);
        console.log("✅ 添加新工作流:", trimmedName);
      }

      // 保存到插件面板可以读取的存储位置
      localStorage.setItem("automationWorkflows", JSON.stringify(savedWorkflows));
      
      // 同时保存到设计器专用存储（用于设计器内部的加载功能）
      localStorage.setItem("mxgraph_workflow", JSON.stringify(workflowData));
      localStorage.setItem("mxgraph_workflows", JSON.stringify(savedWorkflows));

      // 显示成功提示
      this.core.updateStatus(`✅ 工作流 "${trimmedName}" 保存成功！`);

      // 触发storage事件，通知插件面板更新
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "automationWorkflows",
          newValue: JSON.stringify(savedWorkflows),
          url: window.location.href,
        })
      );

      console.log("✅ 工作流保存完成，已同步到插件面板");

      console.log("✅ 工作流保存完成，已通知插件面板同步");
    } catch (error) {
      console.error("❌ 保存工作流失败:", error);
      this.core.updateStatus("保存失败: " + error.message);
      alert("保存失败: " + error.message);
    }
  }

  saveWorkflow() {
    try {
      const data = this.exportWorkflowData();
      localStorage.setItem("mxgraph_workflow", JSON.stringify(data));
      this.core.updateStatus("工作流已保存到本地存储");
    } catch (error) {
      console.error("保存失败:", error);
      this.core.updateStatus("保存失败: " + error.message);
    }
  }

  loadWorkflow() {
    try {
      const data = localStorage.getItem("mxgraph_workflow");
      if (data) {
        this.importWorkflowData(JSON.parse(data));
        this.core.updateStatus("工作流已从本地存储加载");
      } else {
        this.core.updateStatus("未找到保存的工作流");
      }
    } catch (error) {
      console.error("加载失败:", error);
      this.core.updateStatus("加载失败: " + error.message);
    }
  }

  loadWorkflowFromFile() {
    // 创建文件输入元素
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.display = "none";

    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          console.log("📁 加载的工作流数据:", data);
          console.log("📊 数据结构检查:", {
            hasSteps: !!(data.steps && Array.isArray(data.steps)),
            stepsCount: data.steps ? data.steps.length : 0,
            hasConnections: !!(
              data.connections && Array.isArray(data.connections)
            ),
            connectionsCount: data.connections ? data.connections.length : 0,
            hasNodes: !!(data.nodes && Array.isArray(data.nodes)),
            nodesCount: data.nodes ? data.nodes.length : 0,
            dataKeys: Object.keys(data),
          });

          this.importWorkflowData(data);
          this.core.updateStatus(`工作流已从文件 "${file.name}" 加载`);
        } catch (error) {
          console.error("文件解析失败:", error);
          this.core.updateStatus("文件格式错误: " + error.message);
          alert("文件格式错误，请选择有效的工作流JSON文件");
        }
      };

      reader.onerror = () => {
        this.core.updateStatus("文件读取失败");
        alert("文件读取失败，请重试");
      };

      reader.readAsText(file);

      // 清理文件输入元素
      document.body.removeChild(fileInput);
    });

    // 添加到DOM并触发点击
    document.body.appendChild(fileInput);
    fileInput.click();
  }

  exportData() {
    try {
      // 检查FileExportManager是否可用
      if (typeof window.FileExportManager === "undefined") {
        console.error("❌ FileExportManager 未加载，回退到原始导出方式");
        this.exportDataFallback();
        return;
      }

      // 获取工作流数据
      const workflowData = this.exportWorkflowData();

      // 验证工作流数据
      const validation =
        window.FileExportManager.validateWorkflowData(workflowData);
      if (!validation.valid) {
        this.core.updateStatus(`导出失败: ${validation.message}`);
        return;
      }

      // 生成默认文件名（基于工作流名称或时间戳）
      const workflowName = workflowData.name || "未命名工作流";
      const defaultName = window.FileExportManager.generateDefaultFileName(
        workflowName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_")
      );

      // 使用模块化导出管理器
      window.FileExportManager.exportWorkflowWithDialog(workflowData, {
        defaultName: defaultName,
        onSuccess: (fileName) => {
          this.core.updateStatus(`✅ 工作流已成功导出: ${fileName}.json`);
          console.log(`✅ 工作流导出成功: ${fileName}.json`);
        },
        onCancel: () => {
          this.core.updateStatus("导出已取消");
          console.log("📤 用户取消导出操作");
        },
        onError: (errorMessage) => {
          this.core.updateStatus(`❌ 导出失败: ${errorMessage}`);
          console.error("❌ 导出失败:", errorMessage);
        },
      });
    } catch (error) {
      console.error("❌ 导出过程中发生错误:", error);
      this.core.updateStatus("导出失败: " + error.message);
      // 回退到原始导出方式
      this.exportDataFallback();
    }
  }

  // 原始导出方式（作为回退方案）
  exportDataFallback() {
    try {
      const data = this.exportWorkflowData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // 生成带时间戳的文件名
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      a.download = `workflow-${timestamp}.json`;

      a.click();
      URL.revokeObjectURL(url);
      this.core.updateStatus(`工作流数据已导出为 ${a.download}`);
    } catch (error) {
      console.error("回退导出失败:", error);
      this.core.updateStatus("导出失败: " + error.message);
    }
  }

  // 从localStorage加载工作流数据
  loadWorkflowFromStorage() {
    // 检查图形实例是否已初始化
    if (!this.graph) {
      console.warn("图形实例未初始化，跳过工作流加载");
      return;
    }
    
    try {
      // 首先检查是否有编辑模式的临时数据
      const tempEditData = localStorage.getItem("temp_edit_workflow");
      console.log("🔍 检查编辑模式临时数据:", tempEditData);

      if (tempEditData) {
        const editData = JSON.parse(tempEditData);
        console.log("🎨 检测到编辑模式数据:", editData);
        console.log("🔍 编辑数据详情:");
        console.log("  - 模式:", editData.mode);
        console.log("  - 时间戳:", editData.timestamp);
        console.log("  - 工作流:", editData.workflow);

        if (editData.mode === "edit" && editData.workflow) {
          console.log("🔄 加载编辑模式工作流:", editData.workflow.name);
          console.log(
            "🔍 工作流步骤数量:",
            editData.workflow.steps ? editData.workflow.steps.length : 0
          );
          console.log("🔍 工作流步骤详情:", editData.workflow.steps);

          // 转换并导入工作流数据
          console.log("📥 开始导入工作流数据...");
          this.importWorkflowData(editData.workflow);
          console.log("✅ 工作流数据导入完成");

          // 设置编辑模式标记
          this.core.editMode = true;
          this.core.originalWorkflow = editData.workflow;

          this.core.updateStatus(`编辑模式: ${editData.workflow.name}`);

          // 更新窗口标题
          document.title = `工作流设计器 - 编辑: ${editData.workflow.name}`;

          return; // 编辑模式优先，不再检查其他数据
        } else {
          console.warn("⚠️ 编辑模式数据格式不正确");
          console.log("  - mode:", editData.mode);
          console.log("  - workflow存在:", !!editData.workflow);
        }
      } else {
        console.log("ℹ️ 没有找到编辑模式临时数据");
      }

      // 检查常规的工作流数据
      const workflowData = localStorage.getItem("designer_workflow_data");
      if (workflowData) {
        const workflow = JSON.parse(workflowData);
        console.log("🔄 从localStorage加载工作流数据:", workflow);

        // 转换并导入工作流数据
        this.importWorkflowData(workflow);

        this.core.updateStatus(`已加载工作流: ${workflow.name}`);

        // 清除localStorage中的数据，避免重复加载
        localStorage.removeItem("designer_workflow_data");
      } else {
        console.log("ℹ️ 没有找到待加载的工作流数据");
      }
    } catch (error) {
      console.error("❌ 从localStorage加载工作流数据失败:", error);
      this.core.updateStatus("加载工作流数据失败: " + error.message);
    }
  }

  // 保存工作流数据到localStorage供插件面板同步
  saveWorkflowToStorage() {
    try {
      const workflowData = this.exportWorkflowData();
      if (workflowData && workflowData.steps && workflowData.steps.length > 0) {
        // 获取现有的工作流列表
        let savedWorkflows = [];
        try {
          const existing = localStorage.getItem("automationWorkflows");
          if (existing) {
            savedWorkflows = JSON.parse(existing);
          }
        } catch (error) {
          console.error("读取现有工作流失败:", error);
        }

        // 检查是否已存在同名工作流
        const existingIndex = savedWorkflows.findIndex(
          (w) => w.name === workflowData.name
        );
        if (existingIndex >= 0) {
          // 更新现有工作流
          savedWorkflows[existingIndex] = workflowData;
          console.log("✅ 更新现有工作流:", workflowData.name);
        } else {
          // 添加新工作流
          savedWorkflows.push(workflowData);
          console.log("✅ 添加新工作流:", workflowData.name);
        }

        // 保存到localStorage，使用与插件面板相同的键
        localStorage.setItem(
          "automationWorkflows",
          JSON.stringify(savedWorkflows)
        );
        console.log("✅ 工作流数据已保存到localStorage供插件面板同步");
        this.core.updateStatus("工作流已同步到插件面板");
      } else {
        console.log("⚠️ 没有工作流数据需要保存");
        this.core.updateStatus("请先创建工作流步骤");
      }
    } catch (error) {
      console.error("❌ 保存工作流数据到localStorage失败:", error);
      this.core.updateStatus("保存工作流数据失败: " + error.message);
    }
  }

  // 执行状态更新功能
  updateExecutionStatus(text, progress = 0) {
    // 更新状态文本
    this.core.updateStatus(text);

    // 如果有进度条元素，更新进度
    const progressBar = document.getElementById("executionProgress");
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }

    // 更新执行状态显示
    const statusElement = document.getElementById("executionStatus");
    if (statusElement) {
      statusElement.textContent = text;
    }
  }

  updateExecutionUI() {
    // 更新执行相关的UI元素
    const executeBtn = document.getElementById("executeWorkflow");
    const pauseBtn = document.getElementById("pauseWorkflow");
    const stopBtn = document.getElementById("stopWorkflow");

    if (this.core.executionState.isRunning) {
      if (executeBtn) executeBtn.disabled = true;
      if (pauseBtn) pauseBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = false;
    } else {
      if (executeBtn) executeBtn.disabled = false;
      if (pauseBtn) pauseBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = true;
    }
  }

  resumeWorkflow() {
    // 恢复工作流执行的逻辑
    console.log("恢复工作流执行");
    this.core.executionState.isPaused = false;
    this.updateExecutionUI();
    this.core.updateStatus("工作流已恢复执行");
  }

  stopWorkflow() {
    // 停止工作流执行的逻辑
    console.log("停止工作流执行");
    this.core.executionState.isRunning = false;
    this.core.executionState.isPaused = false;
    this.core.executionState.currentNodeIndex = 0;
    this.updateExecutionUI();
    this.core.updateStatus("工作流已停止");
  }

  /**
   * 调试循环容器状态的专用函数
   * 在浏览器控制台中调用 window.designerWorkflow.debugLoopContainers() 来使用
   */
  debugLoopContainers() {
    console.log('=== 循环容器调试信息 ===');

    if (!this.graph) {
      console.log('❌ 图形实例未初始化');
      return;
    }

    const parent = this.graph.getDefaultParent();
    const vertices = this.graph.getChildVertices(parent);

    vertices.forEach((vertex, index) => {
      const config = this.nodeConfigs.get(vertex.id) || vertex.nodeData || {};

      if (this.graph.isSwimlane(vertex) || config.type === 'loop') {
        console.log(`\n🔄 循环容器 ${index + 1}: ${vertex.id}`);
        console.log('  - 配置:', config);
        console.log('  - 是否为Swimlane:', this.graph.isSwimlane(vertex));

        const children = this.graph.getChildVertices(vertex);
        console.log(`  - 图形中的子节点数量: ${children.length}`);

        children.forEach((child, childIndex) => {
          const childConfig = this.nodeConfigs.get(child.id) || child.nodeData || {};
          console.log(`    子节点 ${childIndex + 1}: ${child.id}`);
          console.log(`      - 类型: ${childConfig.type || 'unknown'}`);
          console.log(`      - 名称: ${childConfig.name || 'unnamed'}`);
          console.log(`      - nodeConfigs中存在: ${this.nodeConfigs.has(child.id)}`);
          console.log(`      - nodeData存在: ${!!child.nodeData}`);
        });

        // 模拟导出时的处理
        const exportedSubOps = [];
        children.forEach(child => {
          const childConfig = this.nodeConfigs.get(child.id) || child.nodeData || {};
          if (childConfig.type) {
            exportedSubOps.push({
              id: child.id,
              type: childConfig.type,
              name: childConfig.name || "子操作"
            });
          }
        });
        console.log(`  - 导出时会包含的子操作数量: ${exportedSubOps.length}`);
        console.log(`  - 导出的子操作:`, exportedSubOps);
      }
    });

    console.log('=== 调试信息结束 ===');
  }
}

// 导出工作流管理类
window.DesignerWorkflow = DesignerWorkflow;