/**
 * 右键菜单管理模块
 * 负责步骤节点的右键菜单显示和操作处理
 */

class ContextMenuManager {
    constructor() {
        this.contextMenu = null;
        this.currentStepId = null;
        this.actionHandlers = new Map();
        this.isMenuVisible = false;
    }

    /**
     * 初始化右键菜单
     * @param {string} menuElementId - 菜单元素ID
     */
    initialize(menuElementId = 'stepContextMenu') {
        this.contextMenu = document.getElementById(menuElementId);
        if (!this.contextMenu) {
            console.error('右键菜单元素未找到:', menuElementId);
            return false;
        }

        this.setupEventListeners();
        console.log('✅ 右键菜单已初始化');
        return true;
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 点击菜单项
        this.contextMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action && this.currentStepId) {
                this.handleMenuAction(action, this.currentStepId);
            }
            this.hideMenu();
        });

        // 点击其他地方隐藏菜单
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideMenu();
            }
        });

        // 滚动时隐藏菜单
        document.addEventListener('scroll', () => {
            this.hideMenu();
        });

        // ESC键隐藏菜单
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMenuVisible) {
                this.hideMenu();
            }
        });
    }

    /**
     * 显示右键菜单
     * @param {Event} event - 鼠标事件
     * @param {string} stepId - 步骤ID
     */
    showMenu(event, stepId) {
        if (!this.contextMenu) {
            console.error('右键菜单未初始化');
            return;
        }

        event.preventDefault();
        
        this.currentStepId = stepId;
        
        // 设置菜单位置
        this.contextMenu.style.left = event.pageX + 'px';
        this.contextMenu.style.top = event.pageY + 'px';
        this.contextMenu.style.display = 'block';
        this.isMenuVisible = true;

        // 确保菜单不超出视窗
        this.adjustMenuPosition(event);
        
        console.log('📋 显示右键菜单，步骤ID:', stepId);
    }

    /**
     * 调整菜单位置，确保不超出视窗
     * @param {Event} event - 鼠标事件
     */
    adjustMenuPosition(event) {
        const rect = this.contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 水平位置调整
        if (rect.right > viewportWidth) {
            this.contextMenu.style.left = (event.pageX - rect.width) + 'px';
        }

        // 垂直位置调整
        if (rect.bottom > viewportHeight) {
            this.contextMenu.style.top = (event.pageY - rect.height) + 'px';
        }
    }

    /**
     * 隐藏右键菜单
     */
    hideMenu() {
        if (this.contextMenu) {
            this.contextMenu.style.display = 'none';
            this.isMenuVisible = false;
        }
        this.currentStepId = null;
    }

    /**
     * 注册菜单操作处理器
     * @param {string} action - 操作类型
     * @param {function} handler - 处理函数
     */
    registerActionHandler(action, handler) {
        this.actionHandlers.set(action, handler);
        console.log(`✅ 已注册菜单操作处理器: ${action}`);
    }

    /**
     * 处理菜单操作
     * @param {string} action - 操作类型
     * @param {string} stepId - 步骤ID
     */
    handleMenuAction(action, stepId) {
        const handler = this.actionHandlers.get(action);
        if (handler && typeof handler === 'function') {
            try {
                handler(stepId);
                console.log(`✅ 执行菜单操作: ${action}, 步骤ID: ${stepId}`);
            } catch (error) {
                console.error(`❌ 执行菜单操作失败: ${action}`, error);
            }
        } else {
            console.warn(`⚠️ 未找到操作处理器: ${action}`);
        }
    }

    /**
     * 为步骤元素添加右键菜单支持
     * @param {HTMLElement} stepElement - 步骤元素
     * @param {string} stepId - 步骤ID
     */
    attachToElement(stepElement, stepId) {
        if (!stepElement) {
            console.error('步骤元素不存在');
            return;
        }

        stepElement.addEventListener('contextmenu', (e) => {
            this.showMenu(e, stepId);
        });

        // 添加数据属性标记
        stepElement.dataset.hasContextMenu = 'true';
        stepElement.dataset.stepId = stepId;
    }

    /**
     * 批量为多个步骤元素添加右键菜单支持
     * @param {Array} stepElements - 步骤元素数组
     */
    attachToMultipleElements(stepElements) {
        stepElements.forEach(({ element, stepId }) => {
            this.attachToElement(element, stepId);
        });
        console.log(`✅ 已为 ${stepElements.length} 个步骤元素添加右键菜单支持`);
    }

    /**
     * 移除步骤元素的右键菜单支持
     * @param {HTMLElement} stepElement - 步骤元素
     */
    detachFromElement(stepElement) {
        if (!stepElement) return;

        // 移除事件监听器（需要保存原始函数引用才能正确移除）
        stepElement.removeAttribute('data-has-context-menu');
        stepElement.removeAttribute('data-step-id');
    }

    /**
     * 更新菜单项状态
     * @param {string} action - 操作类型
     * @param {boolean} enabled - 是否启用
     */
    updateMenuItemState(action, enabled) {
        if (!this.contextMenu) return;

        const menuItem = this.contextMenu.querySelector(`[data-action="${action}"]`);
        if (menuItem) {
            menuItem.style.opacity = enabled ? '1' : '0.5';
            menuItem.style.pointerEvents = enabled ? 'auto' : 'none';
        }
    }

    /**
     * 获取菜单状态
     */
    getMenuState() {
        return {
            isVisible: this.isMenuVisible,
            currentStepId: this.currentStepId,
            registeredActions: Array.from(this.actionHandlers.keys())
        };
    }

    /**
     * 销毁右键菜单管理器
     */
    destroy() {
        this.hideMenu();
        this.actionHandlers.clear();
        this.contextMenu = null;
        this.currentStepId = null;
        this.isMenuVisible = false;
        console.log('🗑️ 右键菜单管理器已销毁');
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContextMenuManager;
}

if (typeof window !== 'undefined') {
    window.ContextMenuManager = ContextMenuManager;
}
