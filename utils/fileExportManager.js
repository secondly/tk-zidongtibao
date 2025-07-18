/**
 * 文件导出管理模块
 * 负责处理各种文件导出功能
 */

/**
 * 生成默认文件名
 * @param {string} prefix 文件名前缀
 * @returns {string} 默认文件名
 */
function generateDefaultFileName(prefix = 'workflow') {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    
    return `${prefix}-${year}-${month}-${day}T${hour}-${minute}-${second}`;
}

/**
 * 下载JSON文件
 * @param {Object} data 要导出的数据
 * @param {string} fileName 文件名（不含扩展名）
 */
function downloadJsonFile(data, fileName) {
    try {
        // 格式化JSON数据
        const jsonString = JSON.stringify(data, null, 2);
        
        // 创建Blob对象
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
        
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.json`;
        
        // 触发下载
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 清理URL对象
        URL.revokeObjectURL(url);
        
        console.log(`✅ 文件导出成功: ${fileName}.json`);
        return true;
    } catch (error) {
        console.error('❌ 文件导出失败:', error);
        return false;
    }
}

/**
 * 导出工作流数据（带文件名输入弹窗）
 * @param {Object} workflowData 工作流数据
 * @param {Object} options 配置选项
 */
function exportWorkflowWithDialog(workflowData, options = {}) {
    const {
        defaultName = generateDefaultFileName('workflow'),
        onSuccess = () => {},
        onCancel = () => {},
        onError = () => {}
    } = options;

    // 检查DialogManager是否可用
    if (typeof window.DialogManager === 'undefined') {
        console.error('❌ DialogManager 未加载，请确保 dialogManager.js 已正确引入');
        onError('弹窗管理器未加载');
        return;
    }

    // 显示文件名输入弹窗
    window.DialogManager.showFileNameDialog({
        title: '导出工作流',
        defaultName: defaultName,
        placeholder: '请输入工作流文件名',
        onConfirm: (fileName) => {
            console.log(`📤 开始导出工作流: ${fileName}`);
            
            // 添加导出时间戳到数据中
            const exportData = {
                ...workflowData,
                exportedAt: new Date().toISOString(),
                exportedBy: 'workflow-designer',
                version: workflowData.version || '1.0.0'
            };
            
            // 执行文件下载
            const success = downloadJsonFile(exportData, fileName);
            
            if (success) {
                onSuccess(fileName);
                showExportSuccessMessage(fileName);
            } else {
                onError('文件导出失败');
                showExportErrorMessage();
            }
        },
        onCancel: () => {
            console.log('📤 用户取消导出');
            onCancel();
        }
    });
}

/**
 * 显示导出成功消息
 * @param {string} fileName 文件名
 */
function showExportSuccessMessage(fileName) {
    // 创建成功提示
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        font-size: 14px;
        font-weight: 500;
        animation: slideInRight 0.3s ease-out;
    `;
    
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span>✅</span>
            <span>工作流导出成功: ${fileName}.json</span>
        </div>
    `;
    
    // 添加动画样式
    if (!document.querySelector('#toast-animations')) {
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes slideOutRight {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // 3秒后自动消失
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

/**
 * 显示导出错误消息
 */
function showExportErrorMessage() {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        font-size: 14px;
        font-weight: 500;
        animation: slideInRight 0.3s ease-out;
    `;
    
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span>❌</span>
            <span>工作流导出失败，请重试</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

/**
 * 直接导出文件（无弹窗）
 * @param {Object} workflowData 工作流数据
 * @param {string} fileName 文件名
 */
function exportWorkflowDirect(workflowData, fileName = null) {
    const finalFileName = fileName || generateDefaultFileName('workflow');
    
    const exportData = {
        ...workflowData,
        exportedAt: new Date().toISOString(),
        exportedBy: 'workflow-designer',
        version: workflowData.version || '1.0.0'
    };
    
    const success = downloadJsonFile(exportData, finalFileName);
    
    if (success) {
        showExportSuccessMessage(finalFileName);
    } else {
        showExportErrorMessage();
    }
    
    return success;
}

/**
 * 验证工作流数据
 * @param {Object} workflowData 工作流数据
 * @returns {Object} 验证结果
 */
function validateWorkflowData(workflowData) {
    if (!workflowData) {
        return { valid: false, message: '工作流数据为空' };
    }
    
    if (!workflowData.steps || !Array.isArray(workflowData.steps)) {
        return { valid: false, message: '工作流缺少有效的步骤数据' };
    }
    
    if (workflowData.steps.length === 0) {
        return { valid: false, message: '工作流没有任何步骤' };
    }
    
    return { valid: true };
}

// 导出函数
window.FileExportManager = {
    generateDefaultFileName,
    downloadJsonFile,
    exportWorkflowWithDialog,
    exportWorkflowDirect,
    validateWorkflowData,
    showExportSuccessMessage,
    showExportErrorMessage
};
