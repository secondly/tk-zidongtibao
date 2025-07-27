/**
 * 弹窗配置管理模块
 * 负责工作流配置的加载、选择、编辑和删除
 */

import {
  debugLog,
  updateExecutionStatus,
  getElement,
  validateWorkflow,
} from "../../shared/popup/popup-utils.js";
import { EXECUTION_STATUS } from "../../shared/popup/popup-constants.js";
import {
  getWorkflowsFromStorage,
  saveWorkflowsToStorage,
} from "./popup-storage.js";
import { setCurrentWorkflow, getCurrentWorkflow } from "./popup-core.js";

/**
 * 加载保存的工作流列表
 */
export function loadSavedWorkflows() {
  debugLog("开始加载保存的工作流列表...");
  console.log("🔍 [DEBUG] loadSavedWorkflows 被调用");

  try {
    // 尝试从多个可能的存储位置加载数据
    let workflows = getWorkflowsFromStorage();
    console.log("🔍 [DEBUG] 从主存储获取:", workflows);

    // 如果主存储为空，尝试从设计器存储位置获取
    if (!workflows || workflows.length === 0) {
      console.log("🔍 [DEBUG] 主存储为空，尝试从设计器存储获取...");
      const designerData = localStorage.getItem("mxgraph_workflows");
      if (designerData) {
        try {
          const designerWorkflows = JSON.parse(designerData);
          if (
            Array.isArray(designerWorkflows) &&
            designerWorkflows.length > 0
          ) {
            console.log("🔍 [DEBUG] 从设计器存储找到数据:", designerWorkflows);
            workflows = designerWorkflows;

            // 同步到主存储
            saveWorkflowsToStorage(workflows);
            console.log("✅ 已同步设计器数据到主存储");
          }
        } catch (error) {
          console.warn("解析设计器存储数据失败:", error);
        }
      }
    }

    console.log("🔍 [DEBUG] 最终工作流数据:", workflows);
    debugLog(`找到 ${workflows.length} 个保存的工作流`);

    // 渲染配置选择框
    renderConfigSelect(workflows);

    if (workflows.length === 0) {
      updateExecutionStatus(
        EXECUTION_STATUS.WARNING,
        "没有找到保存的工作流配置"
      );
    } else {
      updateExecutionStatus(
        EXECUTION_STATUS.IDLE,
        `找到 ${workflows.length} 个配置`
      );
    }
  } catch (error) {
    console.error("加载工作流列表失败:", error);
    updateExecutionStatus(EXECUTION_STATUS.ERROR, "加载配置失败");
  }
}

/**
 * 渲染配置下拉选择框
 * @param {Array} workflows - 工作流列表
 */
export function renderConfigSelect(workflows) {
  debugLog("开始渲染配置选择框，工作流数量:", workflows ? workflows.length : 0);
  console.log("🔍 [DEBUG] renderConfigSelect 被调用，参数:", workflows);

  const configSelect = getElement("#configSelect");
  console.log("🔍 [DEBUG] configSelect 元素:", configSelect);

  if (!configSelect) {
    console.error(
      '❌ 配置选择框元素未找到，检查HTML中是否存在id="configSelect"的元素'
    );
    return;
  }

  // 清空现有选项
  configSelect.innerHTML = '<option value="">请选择一个配置...</option>';
  console.log("🔍 [DEBUG] 已清空选择框，设置默认选项");

  // 验证工作流数据
  if (!workflows) {
    console.warn("⚠️ workflows 参数为 null 或 undefined");
    debugLog("没有工作流数据");
    return;
  }

  if (!Array.isArray(workflows)) {
    console.error("❌ workflows 不是数组类型:", typeof workflows, workflows);
    debugLog("工作流数据格式错误");
    return;
  }

  if (workflows.length === 0) {
    console.log("ℹ️ 工作流数组为空");
    debugLog("没有工作流可显示");
    return;
  }

  console.log("🔍 [DEBUG] 开始添加工作流选项...");
  let addedCount = 0;

  // 添加工作流选项
  workflows.forEach((workflow, index) => {
    console.log(`🔍 [DEBUG] 处理工作流 ${index}:`, workflow);

    if (!workflow) {
      console.warn(`⚠️ 工作流 ${index} 为空`);
      return;
    }

    if (!workflow.name) {
      console.warn(`⚠️ 工作流 ${index} 缺少名称:`, workflow);
      return;
    }

    try {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = `${workflow.name} (${
        workflow.steps?.length || 0
      }步)`;

      // 添加额外信息作为title
      if (workflow.description) {
        option.title = workflow.description;
      }

      configSelect.appendChild(option);
      addedCount++;
      console.log(`✅ 已添加工作流选项: ${workflow.name}`);
    } catch (error) {
      console.error(`❌ 添加工作流选项失败 ${index}:`, error);
    }
  });

  console.log(`🔍 [DEBUG] 渲染完成，共添加 ${addedCount} 个选项`);
  debugLog(`已渲染 ${addedCount} 个配置选项`);

  // 验证渲染结果
  const totalOptions = configSelect.options.length;
  console.log(`🔍 [DEBUG] 选择框总选项数: ${totalOptions} (包含默认选项)`);

  if (totalOptions === 1) {
    console.warn("⚠️ 只有默认选项，没有添加任何工作流选项");
  }
}

/**
 * 选择配置
 * @param {number} index - 配置索引
 */
export function selectConfig(index) {
  debugLog(`选择配置，索引: ${index}`);

  try {
    const savedWorkflows = getWorkflowsFromStorage();

    if (!savedWorkflows || savedWorkflows.length === 0) {
      updateExecutionStatus(EXECUTION_STATUS.WARNING, "没有可用的配置");
      return;
    }

    const selectedWorkflow = savedWorkflows[index];
    if (!selectedWorkflow) {
      updateExecutionStatus(EXECUTION_STATUS.ERROR, "选择的配置不存在");
      return;
    }

    // 验证工作流数据
    if (!validateWorkflow(selectedWorkflow)) {
      updateExecutionStatus(EXECUTION_STATUS.ERROR, "配置数据格式无效");
      return;
    }

    // 设置当前工作流
    setCurrentWorkflow(selectedWorkflow);

    // 更新UI显示
    updateCurrentConfigDisplay();

    // 启用执行按钮
    enableExecuteButton();

    // 触发配置选择事件（包含流程预览更新）
    const event = new CustomEvent("configSelected", {
      detail: { workflow: selectedWorkflow, index: index },
    });
    window.dispatchEvent(event);

    updateExecutionStatus(
      EXECUTION_STATUS.IDLE,
      `已选择配置: ${selectedWorkflow.name}`
    );
    debugLog("配置选择完成:", selectedWorkflow.name);
  } catch (error) {
    console.error("选择配置失败:", error);
    updateExecutionStatus(EXECUTION_STATUS.ERROR, "选择配置失败");
  }
}

/**
 * 处理下拉选择框变化
 * @param {Event} event - 选择事件
 */
export function handleConfigSelectChange(event) {
  debugLog("配置选择框发生变化");

  const selectedIndex = event.target.value;
  if (selectedIndex === "") {
    // 清除当前选择
    setCurrentWorkflow(null);
    hideCurrentConfigDisplay();
    clearFlowPreview();
    disableExecuteButton();
    updateExecutionStatus(EXECUTION_STATUS.IDLE, "请选择一个配置");
    return;
  }

  // 选择指定配置
  selectConfig(parseInt(selectedIndex));
}

/**
 * 刷新配置列表
 */
export function refreshConfigList() {
  debugLog("手动刷新配置列表...");
  console.log("🔄 开始刷新配置列表...");

  try {
    // 保存当前选中的配置索引
    const currentIndex = getSelectedConfigIndex();
    console.log("🔍 当前选中索引:", currentIndex);

    // 强制同步所有存储位置的数据
    syncAllStorageData();

    // 重新加载工作流列表
    loadSavedWorkflows();

    // 如果之前有选中的配置，尝试恢复选择
    if (currentIndex !== null) {
      const configSelect = getElement("#configSelect");
      if (configSelect && configSelect.options[currentIndex + 1]) {
        configSelect.selectedIndex = currentIndex + 1;
        selectConfig(currentIndex);
        console.log("✅ 已恢复选中的配置");
      }
    }

    updateExecutionStatus(EXECUTION_STATUS.IDLE, "配置列表已刷新");
    debugLog("配置列表刷新完成");
  } catch (error) {
    console.error("刷新配置列表失败:", error);
    updateExecutionStatus(EXECUTION_STATUS.ERROR, "刷新失败");
  }
}

/**
 * 同步所有存储位置的数据
 */
export function syncAllStorageData() {
  console.log("🔄 开始同步所有存储数据...");

  try {
    // 收集所有可能位置的工作流数据
    const sources = [
      { key: "automationWorkflows", name: "主存储" },
      { key: "mxgraph_workflows", name: "设计器存储" },
    ];

    let allWorkflows = [];
    let latestTimestamp = 0;
    let latestSource = null;

    sources.forEach((source) => {
      const data = localStorage.getItem(source.key);
      if (data) {
        try {
          const workflows = JSON.parse(data);
          if (Array.isArray(workflows) && workflows.length > 0) {
            console.log(`📦 ${source.name} 找到 ${workflows.length} 个工作流`);

            // 找到最新的数据源
            const timestamp = workflows.reduce((max, w) => {
              const wTime = new Date(w.updatedAt || w.createdAt || 0).getTime();
              return Math.max(max, wTime);
            }, 0);

            if (timestamp > latestTimestamp) {
              latestTimestamp = timestamp;
              latestSource = source;
              allWorkflows = workflows;
            }
          }
        } catch (error) {
          console.warn(`解析 ${source.name} 数据失败:`, error);
        }
      }
    });

    if (allWorkflows.length > 0 && latestSource) {
      console.log(`✅ 使用 ${latestSource.name} 的数据作为主数据源`);

      // 同步到所有存储位置
      sources.forEach((source) => {
        localStorage.setItem(source.key, JSON.stringify(allWorkflows));
      });

      console.log("✅ 数据同步完成");
    } else {
      console.log("ℹ️ 没有找到任何工作流数据");
    }
  } catch (error) {
    console.error("同步存储数据失败:", error);
  }
}

/**
 * 更新当前配置显示
 */
function updateCurrentConfigDisplay() {
  const currentConfig = getElement("#currentConfig");
  const currentWorkflow = getCurrentWorkflow();

  if (!currentConfig || !currentWorkflow) return;

  // 显示配置信息容器
  currentConfig.style.display = "block";

  // 只更新配置信息部分，保留操作按钮
  const configInfo = currentConfig.querySelector(".config-info");
  if (configInfo) {
    configInfo.innerHTML = `
            <div class="config-name" style="font-weight: 600; color: #333; margin-bottom: 4px;">
                ${currentWorkflow.name}
            </div>
            <div class="config-stats" style="font-size: 13px; color: #666;">
                ${currentWorkflow.steps?.length || 0} 个步骤
                ${
                  currentWorkflow.description
                    ? ` - ${currentWorkflow.description}`
                    : ""
                }
            </div>
        `;
  } else {
    // 如果没有找到config-info元素，重新创建完整结构
    currentConfig.innerHTML = `
            <div class="config-info" style="font-size: 13px; color: #666;">
                <div class="config-name" style="font-weight: 600; color: #333; margin-bottom: 4px;">
                    ${currentWorkflow.name}
                </div>
                <div class="config-stats">
                    ${currentWorkflow.steps?.length || 0} 个步骤
                    ${
                      currentWorkflow.description
                        ? ` - ${currentWorkflow.description}`
                        : ""
                    }
                </div>
            </div>
            <!-- 配置操作按钮 -->
            <div class="config-actions" style="display: flex; gap: 8px; margin-top: 12px;">
                <button class="btn btn-sm" id="editConfigBtn"
                    style="flex: 1; background: #ff6b6b; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    编辑
                </button>
                <button class="btn btn-sm" id="deleteConfigBtn"
                    style="flex: 1; background: #ff6b6b; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    删除
                </button>
            </div>
        `;

    // 重新绑定事件监听器
    const editBtn = getElement("#editConfigBtn");
    const deleteBtn = getElement("#deleteConfigBtn");

    if (editBtn) {
      editBtn.addEventListener("click", editCurrentConfig);
    }
    if (deleteBtn) {
      deleteBtn.addEventListener("click", deleteCurrentConfig);
    }
  }

  debugLog("当前配置显示已更新");
}

/**
 * 隐藏当前配置显示
 */
function hideCurrentConfigDisplay() {
  const currentConfig = getElement("#currentConfig");
  if (currentConfig) {
    currentConfig.style.display = "none";
  }
}

/**
 * 启用执行按钮
 */
function enableExecuteButton() {
  const executeBtn = getElement("#executeBtn");
  if (executeBtn) {
    executeBtn.disabled = false;
    debugLog("执行按钮已启用");
  }
}

/**
 * 禁用执行按钮
 */
function disableExecuteButton() {
  const executeBtn = getElement("#executeBtn");
  if (executeBtn) {
    executeBtn.disabled = true;
    debugLog("执行按钮已禁用");
  }
}

/**
 * 清除流程图预览
 */
function clearFlowPreview() {
  // 触发清除预览事件
  const event = new CustomEvent("clearPreview");
  window.dispatchEvent(event);
}

/**
 * 获取当前选中的配置索引
 * @returns {number|null} 配置索引或null
 */
function getSelectedConfigIndex() {
  const configSelect = getElement("#configSelect");
  if (configSelect && configSelect.value !== "") {
    return parseInt(configSelect.value);
  }
  return null;
}

/**
 * 初始化配置操作按钮事件监听器
 */
export function initializeConfigActionListeners() {
  debugLog("初始化配置操作按钮事件监听器");

  // 编辑配置按钮
  const editConfigBtn = getElement("#editConfigBtn");
  if (editConfigBtn) {
    editConfigBtn.addEventListener("click", editCurrentConfig);
  }

  // 删除配置按钮
  const deleteConfigBtn = getElement("#deleteConfigBtn");
  if (deleteConfigBtn) {
    deleteConfigBtn.addEventListener("click", deleteCurrentConfig);
  }

  // 刷新配置按钮
  const refreshConfigBtn = getElement("#refreshConfigBtn");
  if (refreshConfigBtn) {
    refreshConfigBtn.addEventListener("click", refreshConfigList);
  }

  // 打开设计器按钮
  const openDesignerBtn = getElement("#openDesignerBtn");
  if (openDesignerBtn) {
    openDesignerBtn.addEventListener("click", handleOpenDesigner);
  }

  // 导入配置按钮
  const importBtn = getElement("#importBtn");
  if (importBtn) {
    importBtn.addEventListener("click", handleImportConfig);
  }

  // 清除缓存按钮
  const clearCacheBtn = getElement("#clearCacheBtn");
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener("click", handleClearCache);
  }

  // 诊断按钮
  const diagnoseBtn = getElement("#diagnoseBtn");
  if (diagnoseBtn) {
    diagnoseBtn.addEventListener("click", handleDiagnose);
  }

  // 配置选择框变化事件
  const configSelect = getElement("#configSelect");
  if (configSelect) {
    configSelect.addEventListener("change", handleConfigSelectChange);
  }

  // 监听工作流数据更新事件（来自storage监听器）
  window.addEventListener("workflowsUpdated", (event) => {
    console.log("🔄 收到工作流数据更新事件，自动刷新配置列表");
    debugLog("工作流数据已更新，刷新配置列表");

    // 保存当前选中的配置
    const currentIndex = getSelectedConfigIndex();

    // 重新加载配置列表
    loadSavedWorkflows();

    // 尝试恢复选择
    if (currentIndex !== null) {
      setTimeout(() => {
        const configSelect = getElement("#configSelect");
        if (configSelect && configSelect.options[currentIndex + 1]) {
          configSelect.selectedIndex = currentIndex + 1;
          selectConfig(currentIndex);
          console.log("✅ 已恢复选中的配置");
        }
      }, 100);
    }
  });

  debugLog("配置操作事件监听器已设置");
}

/**
 * 编辑当前配置
 */
function editCurrentConfig() {
  const currentWorkflow = getCurrentWorkflow();

  if (!currentWorkflow) {
    updateExecutionStatus(EXECUTION_STATUS.WARNING, "请先选择一个配置");
    return;
  }

  debugLog("准备编辑配置:", currentWorkflow.name);

  try {
    // 打开设计器并传递工作流数据
    openDesignerWithWorkflow(currentWorkflow);
    updateExecutionStatus(EXECUTION_STATUS.IDLE, "正在打开设计器...");
  } catch (error) {
    console.error("打开设计器失败:", error);
    updateExecutionStatus(EXECUTION_STATUS.ERROR, "打开设计器失败");
  }
}

/**
 * 删除当前配置
 */
function deleteCurrentConfig() {
  const currentWorkflow = getCurrentWorkflow();

  if (!currentWorkflow) {
    updateExecutionStatus(EXECUTION_STATUS.WARNING, "请先选择一个配置");
    return;
  }

  const confirmMessage = `确定要删除配置 "${currentWorkflow.name}" 吗？此操作不可撤销。`;
  if (!confirm(confirmMessage)) {
    return;
  }

  debugLog("准备删除配置:", currentWorkflow.name);

  try {
    const savedWorkflows = getWorkflowsFromStorage();
    const currentIndex = getSelectedConfigIndex();

    if (currentIndex === null || currentIndex >= savedWorkflows.length) {
      updateExecutionStatus(EXECUTION_STATUS.ERROR, "无法确定要删除的配置");
      return;
    }

    // 从数组中移除配置
    savedWorkflows.splice(currentIndex, 1);

    // 保存更新后的列表
    const success = saveWorkflowsToStorage(savedWorkflows);

    if (success) {
      // 清除当前选择
      setCurrentWorkflow(null);
      hideCurrentConfigDisplay();
      clearFlowPreview();

      // 刷新配置列表
      renderConfigSelect(savedWorkflows);

      // 重置选择框
      const configSelect = getElement("#configSelect");
      if (configSelect) {
        configSelect.selectedIndex = 0;
      }

      updateExecutionStatus(EXECUTION_STATUS.IDLE, "配置已删除");
      debugLog("配置删除成功");

      // 触发删除事件
      const event = new CustomEvent("configDeleted", {
        detail: { deletedWorkflow: currentWorkflow },
      });
      window.dispatchEvent(event);
    } else {
      updateExecutionStatus(EXECUTION_STATUS.ERROR, "删除配置失败");
    }
  } catch (error) {
    console.error("删除配置失败:", error);
    updateExecutionStatus(EXECUTION_STATUS.ERROR, "删除配置失败");
  }
}

/**
 * 打开设计器并传递工作流数据
 * @param {Object} workflow - 工作流数据
 */
function openDesignerWithWorkflow(workflow) {
  debugLog("准备打开设计器，工作流:", workflow);

  // 这里需要根据实际的设计器打开方式来实现
  // 可能是打开新窗口、新标签页或者模态框

  // 示例实现：打开新窗口
  const designerUrl = "workflow-designer-mxgraph.html";
  const windowFeatures = "width=1200,height=800,scrollbars=yes,resizable=yes";

  try {
    // 将工作流数据保存到设计器期望的临时存储键名
    const tempKey = "temp_edit_workflow";
    localStorage.setItem(
      tempKey,
      JSON.stringify({
        workflow: workflow,
        mode: "edit",
        timestamp: Date.now(),
      })
    );

    debugLog("已保存工作流数据到临时存储:", tempKey);
    debugLog("工作流数据:", workflow);

    // 打开设计器窗口
    const designerWindow = window.open(
      designerUrl,
      "workflowDesigner",
      windowFeatures
    );

    if (designerWindow) {
      debugLog("设计器窗口已打开");

      // 监听设计器窗口关闭，检查是否有更新的数据
      const checkInterval = setInterval(() => {
        if (designerWindow.closed) {
          clearInterval(checkInterval);
          checkForUpdatedWorkflow(tempKey);
        }
      }, 1000);
    } else {
      throw new Error("无法打开设计器窗口，可能被浏览器阻止");
    }
  } catch (error) {
    console.error("打开设计器失败:", error);
    throw error;
  }
}

/**
 * 检查更新的工作流数据
 * @param {string} tempKey - 临时存储键名
 */
function checkForUpdatedWorkflow(tempKey) {
  debugLog("检查工作流是否有更新");

  try {
    const tempData = localStorage.getItem(tempKey);
    if (tempData) {
      const data = JSON.parse(tempData);

      if (data.updated && data.workflow) {
        debugLog("检测到工作流更新，准备保存");

        // 更新工作流列表
        const savedWorkflows = getWorkflowsFromStorage();
        const currentIndex = getSelectedConfigIndex();

        if (currentIndex !== null && currentIndex < savedWorkflows.length) {
          savedWorkflows[currentIndex] = data.workflow;

          if (saveWorkflowsToStorage(savedWorkflows)) {
            // 更新当前工作流
            setCurrentWorkflow(data.workflow);
            updateCurrentConfigDisplay();

            // 刷新配置列表
            renderConfigSelect(savedWorkflows);

            updateExecutionStatus(EXECUTION_STATUS.IDLE, "配置已更新");
            debugLog("工作流更新成功");
          }
        }
      }

      // 清理临时数据
      localStorage.removeItem(tempKey);
    }
  } catch (error) {
    console.error("检查工作流更新失败:", error);
  }
}

/**
 * 处理打开设计器按钮点击
 */
function handleOpenDesigner() {
  debugLog("用户点击打开设计器按钮");

  // 总是打开空白的设计器画布，不传递任何工作流数据
  createNewWorkflow();
}

/**
 * 创建新工作流
 */
function createNewWorkflow() {
  debugLog("创建新工作流");

  const designerUrl = "workflow-designer-mxgraph.html";
  const windowFeatures = "width=1200,height=800,scrollbars=yes,resizable=yes";

  try {
    // 确保清理任何可能的编辑模式数据，强制新建模式
    console.log("🧹 清理编辑模式数据，确保新建模式");
    localStorage.removeItem("temp_edit_workflow");
    localStorage.removeItem("designer_workflow_data");
    localStorage.removeItem("mxgraph_workflow");

    // 打开设计器窗口（新建模式）
    const designerWindow = window.open(
      designerUrl,
      "workflowDesigner_" + Date.now(), // 使用时间戳确保每次都是新窗口
      windowFeatures
    );

    if (designerWindow) {
      debugLog("设计器窗口已打开（新建模式）");
      updateExecutionStatus(EXECUTION_STATUS.IDLE, "正在打开设计器...");

      // 监听设计器窗口关闭，检查是否有新保存的工作流
      const checkInterval = setInterval(() => {
        if (designerWindow.closed) {
          clearInterval(checkInterval);
          debugLog("设计器窗口已关闭，刷新配置列表");

          // 延迟刷新，确保数据已保存
          setTimeout(() => {
            refreshConfigList();
          }, 500);
        }
      }, 1000);
    } else {
      throw new Error("无法打开设计器窗口，可能被浏览器阻止");
    }
  } catch (error) {
    console.error("打开设计器失败:", error);
    updateExecutionStatus(EXECUTION_STATUS.ERROR, "打开设计器失败");
  }
}

/**
 * 处理导入配置按钮点击
 */
function handleImportConfig() {
  debugLog("用户点击导入配置按钮");

  // 创建文件输入元素
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";
  fileInput.style.display = "none";

  fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      importWorkflowFromFile(file);
    }
  });

  // 触发文件选择
  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
}

/**
 * 从文件导入工作流
 * @param {File} file - 工作流文件
 */
function importWorkflowFromFile(file) {
  debugLog("开始导入工作流文件:", file.name);

  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const jsonData = event.target.result;
      const workflowData = JSON.parse(jsonData);

      // 验证工作流数据
      if (!validateWorkflow(workflowData)) {
        throw new Error("工作流数据格式无效");
      }

      // 添加导入时间戳
      workflowData.importedAt = Date.now();
      workflowData.updatedAt = Date.now();

      // 如果没有创建时间，添加创建时间
      if (!workflowData.createdAt) {
        workflowData.createdAt = Date.now();
      }

      // 保存到存储
      const savedWorkflows = getWorkflowsFromStorage();
      savedWorkflows.push(workflowData);

      const success = saveWorkflowsToStorage(savedWorkflows);

      if (success) {
        // 刷新配置列表
        renderConfigSelect(savedWorkflows);

        // 自动选择导入的配置
        const configSelect = getElement("#configSelect");
        if (configSelect) {
          configSelect.selectedIndex = savedWorkflows.length; // 最后一个选项
          selectConfig(savedWorkflows.length - 1);
        }

        updateExecutionStatus(
          EXECUTION_STATUS.IDLE,
          `配置 "${workflowData.name}" 导入成功`
        );
        debugLog("工作流导入成功:", workflowData.name);
      } else {
        throw new Error("保存工作流失败");
      }
    } catch (error) {
      console.error("导入工作流失败:", error);
      updateExecutionStatus(
        EXECUTION_STATUS.ERROR,
        `导入失败: ${error.message}`
      );
      alert(`导入失败: ${error.message}`);
    }
  };

  reader.onerror = () => {
    console.error("读取文件失败");
    updateExecutionStatus(EXECUTION_STATUS.ERROR, "读取文件失败");
    alert("读取文件失败");
  };

  reader.readAsText(file);
}

/**
 * 处理清除缓存按钮点击
 */
function handleClearCache() {
  debugLog("用户点击清除缓存按钮");

  const confirmMessage =
    "确定要清除所有缓存数据吗？这将清除保存的执行状态和工作流缓存。";
  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    // 清除状态缓存
    localStorage.removeItem("automation_state_cache");
    localStorage.removeItem("automation_workflow_cache");

    updateExecutionStatus(EXECUTION_STATUS.IDLE, "缓存已清除");
    debugLog("缓存清除成功");

    // 询问是否重新加载页面
    const reloadConfirm = "缓存已清除。是否重新加载页面以完全重置状态？";
    if (confirm(reloadConfirm)) {
      window.location.reload();
    }
  } catch (error) {
    console.error("清除缓存失败:", error);
    updateExecutionStatus(EXECUTION_STATUS.ERROR, "清除缓存失败");
    alert("清除缓存失败，请检查浏览器控制台获取详细信息。");
  }
}

/**
 * 安全发送消息到内容脚本，自动处理连接问题
 */
async function sendMessageToContentScript(tabId, message, retryCount = 1) {
  for (let i = 0; i <= retryCount; i++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (error) {
      console.log(
        `消息发送失败 (尝试 ${i + 1}/${retryCount + 1}):`,
        error.message
      );

      if (i < retryCount) {
        console.log("尝试注入内容脚本...");
        try {
          // 先检查是否已经有模块加载
          const checkResponse = await chrome.tabs.sendMessage(tabId, {
            action: "checkModules",
          });
          if (checkResponse && checkResponse.hasModules) {
            console.log("检测到模块已存在，跳过注入");
            continue; // 跳过注入，直接重试
          }

          // 先清理可能存在的模块冲突
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
              // 清理可能冲突的全局变量
              if (window.contentModulesInitialized) {
                console.log("🧹 清理现有模块...");
                delete window.contentModulesInitialized;
              }
            },
          });

          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["content/content-modular.js"],
          });

          // 等待脚本加载
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (injectError) {
          console.error("注入内容脚本失败:", injectError);
          if (i === retryCount) {
            throw new Error(`无法建立连接: ${injectError.message}`);
          }
        }
      } else {
        throw error;
      }
    }
  }
}

/**
 * 处理诊断按钮点击
 */
async function handleDiagnose() {
  debugLog("用户点击诊断按钮");

  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) {
      alert("无法获取当前标签页");
      return;
    }

    // 检查页面URL是否支持内容脚本
    if (
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("edge://") ||
      tab.url.startsWith("about:")
    ) {
      alert(
        "当前页面不支持自动化功能\n\n不支持的页面类型：\n- chrome:// 页面\n- 扩展页面\n- edge:// 页面\n- about: 页面\n\n请在普通网页上使用自动化功能。"
      );
      return;
    }

    updateExecutionStatus(EXECUTION_STATUS.RUNNING, "正在诊断自动化支持...");

    // 尝试连接内容脚本，如果失败则注入
    let response;
    try {
      // 先尝试ping内容脚本
      response = await chrome.tabs.sendMessage(tab.id, { action: "ping" });
      if (!response || !response.success) {
        throw new Error("内容脚本未响应");
      }
    } catch (error) {
      console.log("内容脚本未加载，正在注入...");
      updateExecutionStatus(EXECUTION_STATUS.RUNNING, "正在加载自动化模块...");

      try {
        // 注入内容脚本
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/content-modular.js"],
        });

        // 等待脚本加载
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 再次尝试ping
        response = await chrome.tabs.sendMessage(tab.id, { action: "ping" });
        if (!response || !response.success) {
          throw new Error("内容脚本注入后仍无法连接");
        }
      } catch (injectError) {
        console.error("注入内容脚本失败:", injectError);
        updateExecutionStatus(EXECUTION_STATUS.ERROR, "模块加载失败");
        alert(
          "自动化模块加载失败\n\n可能的原因：\n1. 页面限制了脚本执行\n2. 扩展权限不足\n3. 页面正在加载中\n\n建议：\n1. 刷新页面后重试\n2. 检查扩展权限设置\n3. 在其他网页上测试"
        );
        return;
      }
    }

    // 发送诊断请求
    response = await sendMessageToContentScript(
      tab.id,
      {
        action: "diagnose",
      },
      0
    ); // 不重试，因为前面已经确保连接成功

    if (response && response.success) {
      const diagnosis = response.diagnosis;

      // 创建诊断报告
      let report = `🔍 自动化支持诊断报告\n`;
      report += `📅 时间: ${diagnosis.timestamp}\n`;
      report += `🌐 页面: ${diagnosis.url}\n\n`;

      report += `📦 模块状态:\n`;
      report += `  - ContentCore: ${
        diagnosis.modules.contentCore ? "✅" : "❌"
      }\n`;
      report += `  - ContentAutomation: ${
        diagnosis.modules.contentAutomation ? "✅" : "❌"
      }\n`;
      report += `  - SensitiveWordDetector: ${
        diagnosis.modules.sensitiveWordDetector ? "✅" : "❌"
      }\n\n`;

      report += `🔧 关键函数:\n`;
      report += `  - executeUniversalWorkflow: ${
        diagnosis.functions.executeUniversalWorkflow ? "✅" : "❌"
      }\n`;
      report += `  - performEnhancedDragOperation: ${
        diagnosis.functions.performEnhancedDragOperation ? "✅" : "❌"
      }\n`;
      report += `  - updateStatus: ${
        diagnosis.functions.updateStatus ? "✅" : "❌"
      }\n\n`;

      report += `🌍 环境:\n`;
      report += `  - Chrome扩展: ${
        diagnosis.chromeExtension ? "✅" : "❌"
      }\n\n`;

      if (diagnosis.issues.length > 0) {
        report += `⚠️ 发现问题:\n`;
        diagnosis.issues.forEach((issue) => {
          report += `  - ${issue}\n`;
        });
        report += `\n🔧 建议: 点击"修复"按钮尝试自动修复这些问题。`;
      } else {
        report += `✅ 所有检查通过，自动化功能应该正常工作！`;
      }

      // 显示诊断结果
      const showFix = diagnosis.issues.length > 0;
      const userChoice = showFix
        ? confirm(report + "\n\n是否尝试自动修复发现的问题？")
        : alert(report);

      if (showFix && userChoice) {
        // 尝试修复
        updateExecutionStatus(EXECUTION_STATUS.RUNNING, "正在尝试修复问题...");

        const fixResponse = await chrome.tabs.sendMessage(tab.id, {
          action: "fixAutomation",
        });

        if (fixResponse && fixResponse.success) {
          updateExecutionStatus(EXECUTION_STATUS.IDLE, "修复完成，请重新测试");
          alert("修复完成！请重新测试自动化功能。");
        } else {
          updateExecutionStatus(EXECUTION_STATUS.ERROR, "修复失败");
          alert("自动修复失败，请手动检查问题。");
        }
      } else {
        updateExecutionStatus(EXECUTION_STATUS.IDLE, "诊断完成");
      }
    } else {
      updateExecutionStatus(EXECUTION_STATUS.ERROR, "诊断失败");
      alert("诊断失败：" + (response?.error || "无法连接到内容脚本"));
    }
  } catch (error) {
    console.error("诊断过程出错:", error);
    updateExecutionStatus(EXECUTION_STATUS.ERROR, "诊断出错");
    alert("诊断过程出错：" + error.message);
  }
}

/**
 * 调试配置加载问题的专用函数
 * 在浏览器控制台中调用 window.debugConfigLoading() 来使用
 */
export function debugConfigLoading() {
  console.log("=== 配置加载调试信息 ===");

  // 1. 检查HTML元素
  const configSelect = document.getElementById("configSelect");
  console.log("1. configSelect 元素:", configSelect);
  console.log("   - 是否存在:", !!configSelect);
  console.log(
    "   - 选项数量:",
    configSelect ? configSelect.options.length : "N/A"
  );
  console.log("   - 当前值:", configSelect ? configSelect.value : "N/A");

  // 2. 检查localStorage数据
  console.log("2. localStorage 数据:");
  const storageKeys = [
    "automationWorkflows",
    "mxgraph_workflows",
    "mxgraph_workflow",
    "temp_edit_workflow",
  ];
  storageKeys.forEach((key) => {
    const data = localStorage.getItem(key);
    console.log(`   - ${key}:`, data ? `${data.length}字符` : "null");
    if (data) {
      try {
        const parsed = JSON.parse(data);
        console.log(`     解析结果:`, parsed);
        if (Array.isArray(parsed)) {
          console.log(`     数组长度: ${parsed.length}`);
        }
      } catch (error) {
        console.log(`     解析失败:`, error.message);
      }
    }
  });

  // 3. 测试数据加载函数
  console.log("3. 测试数据加载:");
  try {
    const workflows = getWorkflowsFromStorage();
    console.log("   - getWorkflowsFromStorage 返回:", workflows);
    console.log("   - 数据类型:", typeof workflows);
    console.log("   - 是否为数组:", Array.isArray(workflows));
    console.log("   - 数组长度:", workflows ? workflows.length : "N/A");
  } catch (error) {
    console.log("   - getWorkflowsFromStorage 失败:", error);
  }

  // 4. 手动触发渲染
  console.log("4. 手动触发渲染:");
  try {
    loadSavedWorkflows();
    console.log("   - loadSavedWorkflows 执行完成");
  } catch (error) {
    console.log("   - loadSavedWorkflows 失败:", error);
  }

  console.log("=== 调试信息结束 ===");
}

// 将调试函数暴露到全局
if (typeof window !== "undefined") {
  window.debugConfigLoading = debugConfigLoading;
}
