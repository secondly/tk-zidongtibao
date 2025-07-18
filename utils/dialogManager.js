/**
 * 弹窗管理模块
 * 提供各种类型的弹窗功能
 */

/**
 * 显示文件名输入弹窗
 * @param {Object} options 配置选项
 * @param {string} options.title 弹窗标题
 * @param {string} options.defaultName 默认文件名
 * @param {string} options.placeholder 输入框占位符
 * @param {Function} options.onConfirm 确认回调函数
 * @param {Function} options.onCancel 取消回调函数
 */
function showFileNameDialog(options = {}) {
    const {
        title = '导出工作流',
        defaultName = '',
        placeholder = '请输入文件名',
        onConfirm = () => {},
        onCancel = () => {}
    } = options;

    // 创建弹窗遮罩
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(2px);
    `;

    // 创建弹窗主体
    const dialog = document.createElement('div');
    dialog.className = 'dialog-main';
    dialog.style.cssText = `
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        min-width: 400px;
        max-width: 500px;
        padding: 0;
        animation: dialogFadeIn 0.2s ease-out;
    `;

    // 添加动画样式
    if (!document.querySelector('#dialog-animations')) {
        const style = document.createElement('style');
        style.id = 'dialog-animations';
        style.textContent = `
            @keyframes dialogFadeIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            @keyframes dialogFadeOut {
                from {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
                to {
                    opacity: 0;
                    transform: scale(0.9) translateY(-20px);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 弹窗内容
    dialog.innerHTML = `
        <div style="padding: 24px 24px 16px 24px; border-bottom: 1px solid #e5e5e5;">
            <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #333;">${title}</h3>
        </div>
        
        <div style="padding: 20px 24px;">
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555;">文件名</label>
                <input type="text" id="fileNameInput" 
                       style="width: 100%; padding: 10px 12px; border: 2px solid #e1e5e9; border-radius: 6px; 
                              font-size: 14px; transition: border-color 0.2s; box-sizing: border-box;"
                       placeholder="${placeholder}" 
                       value="${defaultName}">
            </div>
            
            <div style="font-size: 12px; color: #666; margin-bottom: 20px;">
                <i style="margin-right: 4px;">💡</i>
                文件将保存为 JSON 格式，无需添加扩展名
            </div>
        </div>
        
        <div style="padding: 16px 24px 24px 24px; display: flex; justify-content: flex-end; gap: 12px;">
            <button id="cancelBtn" 
                    style="padding: 8px 16px; border: 1px solid #d1d5db; background: white; 
                           border-radius: 6px; cursor: pointer; font-size: 14px; color: #374151;
                           transition: all 0.2s;">
                取消
            </button>
            <button id="confirmBtn" 
                    style="padding: 8px 16px; border: none; background: #3b82f6; color: white; 
                           border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;
                           transition: all 0.2s;">
                确认导出
            </button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 获取元素引用
    const fileNameInput = dialog.querySelector('#fileNameInput');
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const confirmBtn = dialog.querySelector('#confirmBtn');

    // 输入框样式交互
    fileNameInput.addEventListener('focus', () => {
        fileNameInput.style.borderColor = '#3b82f6';
        fileNameInput.style.outline = 'none';
        fileNameInput.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
    });

    fileNameInput.addEventListener('blur', () => {
        fileNameInput.style.borderColor = '#e1e5e9';
        fileNameInput.style.boxShadow = 'none';
    });

    // 按钮悬停效果
    cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.backgroundColor = '#f9fafb';
        cancelBtn.style.borderColor = '#9ca3af';
    });

    cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.backgroundColor = 'white';
        cancelBtn.style.borderColor = '#d1d5db';
    });

    confirmBtn.addEventListener('mouseenter', () => {
        confirmBtn.style.backgroundColor = '#2563eb';
    });

    confirmBtn.addEventListener('mouseleave', () => {
        confirmBtn.style.backgroundColor = '#3b82f6';
    });

    // 关闭弹窗函数
    function closeDialog() {
        dialog.style.animation = 'dialogFadeOut 0.2s ease-in';
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 200);
    }

    // 验证文件名
    function validateFileName(fileName) {
        if (!fileName.trim()) {
            return { valid: false, message: '文件名不能为空' };
        }
        
        // 检查非法字符
        const invalidChars = /[<>:"/\\|?*]/;
        if (invalidChars.test(fileName)) {
            return { valid: false, message: '文件名包含非法字符' };
        }
        
        return { valid: true };
    }

    // 显示错误提示
    function showError(message) {
        // 移除之前的错误提示
        const existingError = dialog.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            color: #dc2626;
            font-size: 12px;
            margin-top: 4px;
            padding: 4px 8px;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 4px;
        `;
        errorDiv.textContent = message;
        
        fileNameInput.parentNode.appendChild(errorDiv);
        fileNameInput.style.borderColor = '#dc2626';
    }

    // 事件处理
    cancelBtn.addEventListener('click', () => {
        closeDialog();
        onCancel();
    });

    confirmBtn.addEventListener('click', () => {
        const fileName = fileNameInput.value.trim();
        const validation = validateFileName(fileName);
        
        if (!validation.valid) {
            showError(validation.message);
            return;
        }
        
        closeDialog();
        onConfirm(fileName);
    });

    // 回车键确认
    fileNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            confirmBtn.click();
        } else if (e.key === 'Escape') {
            cancelBtn.click();
        }
    });

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeDialog();
            onCancel();
        }
    });

    // 自动聚焦并选中文本
    setTimeout(() => {
        fileNameInput.focus();
        if (defaultName) {
            fileNameInput.select();
        }
    }, 100);
}

/**
 * 显示确认对话框
 * @param {Object} options 配置选项
 */
function showConfirmDialog(options = {}) {
    const {
        title = '确认操作',
        message = '您确定要执行此操作吗？',
        confirmText = '确认',
        cancelText = '取消',
        onConfirm = () => {},
        onCancel = () => {}
    } = options;

    // 实现确认对话框逻辑...
    // 这里可以根据需要扩展
}

/**
 * 显示消息提示
 * @param {Object} options 配置选项
 */
function showMessageDialog(options = {}) {
    const {
        title = '提示',
        message = '',
        type = 'info', // info, success, warning, error
        onClose = () => {}
    } = options;

    // 实现消息提示逻辑...
    // 这里可以根据需要扩展
}

// 导出函数
window.DialogManager = {
    showFileNameDialog,
    showConfirmDialog,
    showMessageDialog
};
