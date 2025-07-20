/**
 * 弹窗模块常量定义
 * 包含所有模块共享的常量和配置项
 */

// 存储相关常量
export const STORAGE_KEY = 'automationWorkflows';
export const STATE_CACHE_KEY = 'automation_state_cache';
export const WORKFLOW_CACHE_KEY = 'automation_workflow_cache';

// 执行状态类型
export const EXECUTION_STATUS = {
    IDLE: 'idle',
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    ERROR: 'error',
    WARNING: 'warning'
};

// 执行状态消息
export const STATUS_MESSAGES = {
    [EXECUTION_STATUS.IDLE]: '等待执行...',
    [EXECUTION_STATUS.RUNNING]: '正在执行...',
    [EXECUTION_STATUS.PAUSED]: '已暂停',
    [EXECUTION_STATUS.COMPLETED]: '执行完成',
    [EXECUTION_STATUS.ERROR]: '执行出错',
    [EXECUTION_STATUS.WARNING]: '警告'
};

// UI相关常量
export const UI_CONSTANTS = {
    MIN_PANEL_WIDTH: 200,
    DEFAULT_PANEL_WIDTH: 300,
    ANIMATION_DURATION: 300
};

// 调试相关常量
export const DEBUG = {
    ENABLED: true,
    LOG_PREFIX: '🤖 [Popup]'
};