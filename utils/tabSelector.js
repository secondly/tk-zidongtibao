/**
 * 标签页选择器模块
 * 用于选择要测试的目标页面，支持http/https/file协议
 */

class TabSelector {
    constructor() {
        this.modalId = 'tabSelectorModal';
    }

    /**
     * 显示标签页选择对话框
     * @returns {Promise<Object|null>} 选中的标签页对象或null
     */
    async showTabSelector() {
        try {
            // 获取所有标签页
            const tabs = await chrome.tabs.query({});
            
            // 过滤有效的标签页（包括file://协议）
            const validTabs = tabs.filter(tab => 
                tab.url && 
                !tab.url.startsWith('chrome://') && 
                !tab.url.startsWith('chrome-extension://') &&
                (tab.url.startsWith('http') || tab.url.startsWith('file://'))
            );

            if (validTabs.length === 0) {
                alert('没有找到可测试的页面。请打开一些网页或本地HTML文件。');
                return null;
            }

            return new Promise((resolve) => {
                this.createModal(validTabs, resolve);
            });
        } catch (error) {
            console.error('获取标签页列表失败:', error);
            alert('获取页面列表失败，请重试');
            return null;
        }
    }

    /**
     * 创建选择模态框
     * @param {Array} tabs 标签页列表
     * @param {Function} resolve Promise resolve函数
     */
    createModal(tabs, resolve) {
        // 移除已存在的模态框
        this.removeExistingModal();

        const modal = document.createElement('div');
        modal.id = this.modalId;
        modal.style.cssText = `
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
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 600px;
            max-height: 70vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            color: rgba(255, 255, 255, 0.9);
            transition: all 0.3s ease;
        `;

        dialog.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 15px;">选择要测试的页面</h3>
            <div id="tabList" style="margin-bottom: 15px;">
                ${tabs.map((tab, index) => this.createTabItem(tab, index)).join('')}
            </div>
            <div style="text-align: right;">
                <button id="cancelTabSelect" style="margin-right: 10px; padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer; border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            color: rgba(255, 255, 255, 0.9);
            transition: all 0.3s ease;">取消</button>
            </div>
        `;

        modal.appendChild(dialog);
        document.body.appendChild(modal);

        // 绑定事件
        this.bindEvents(modal, dialog, tabs, resolve);
    }

    /**
     * 创建标签页项目HTML
     * @param {Object} tab 标签页对象
     * @param {number} index 索引
     * @returns {string} HTML字符串
     */
    createTabItem(tab, index) {
        const title = this.escapeHtml(tab.title || '无标题');
        const url = this.escapeHtml(tab.url);
        const isLocal = tab.url.startsWith('file://');
        const icon = isLocal ? '📄' : '🌐';
        const tabId = tab.id;

        return `
            <div class="tab-item" style="
                padding: 12px;
                border: 1px solid #ddd;
                margin-bottom: 8px;
                cursor: pointer;
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                color: rgba(255, 255, 255, 0.9);
                transition: all 0.3s ease;
                transition: background-color 0.2s;
            " data-tab-index="${index}" data-tab-id="${tabId}">
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <span style="margin-right: 8px; font-size: 16px;">${icon}</span>
                    <strong style="color: #fff;">${title}</strong>
                    <small style="margin-left: auto; color: #fff; font-size: 10px;">ID: ${tabId}</small>
                </div>
                <small style="color: #fff; word-break: break-all;">${url}</small>
                ${isLocal ? '<div style="margin-top: 4px;"><span style="background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 3px; font-size: 11px;">本地文件</span></div>' : ''}
            </div>
        `;
    }

    /**
     * 绑定事件监听器
     * @param {HTMLElement} modal 模态框元素
     * @param {HTMLElement} dialog 对话框元素
     * @param {Array} tabs 标签页列表
     * @param {Function} resolve Promise resolve函数
     */
    bindEvents(modal, dialog, tabs, resolve) {
        // 添加鼠标悬停效果
        const tabItems = dialog.querySelectorAll('.tab-item');
        tabItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(255, 255, 255, 0.30)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'rgba(255, 255, 255, 0.25)';
            });
        });

        // 绑定点击事件
        dialog.addEventListener('click', (e) => {
            const tabDiv = e.target.closest('[data-tab-index]');
            if (tabDiv) {
                const index = parseInt(tabDiv.dataset.tabIndex);
                this.closeModal();
                resolve(tabs[index]);
            }
        });

        // 取消按钮
        const cancelBtn = document.getElementById('cancelTabSelect');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeModal();
                resolve(null);
            });
        }

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
                resolve(null);
            }
        });

        // ESC键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                resolve(null);
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    }

    /**
     * 移除已存在的模态框
     */
    removeExistingModal() {
        const existingModal = document.getElementById(this.modalId);
        if (existingModal) {
            existingModal.remove();
        }
    }

    /**
     * 关闭模态框
     */
    closeModal() {
        this.removeExistingModal();
    }

    /**
     * HTML转义
     * @param {string} text 要转义的文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TabSelector;
}

if (typeof window !== 'undefined') {
    window.TabSelector = TabSelector;
}
