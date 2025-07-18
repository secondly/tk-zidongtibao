# 开发规范和规则

- 代码重构规则：单个文件不得超过1500行，需要按功能模块拆分到utils/或modules/文件夹，使用描述性命名
- 浏览器插件面板布局：左侧配置管理，右侧流程图预览（只读），右键菜单测试功能，底部执行状态。代码必须分模块，禁止大文件。
- 修复浏览器插件JavaScript错误的关键点：1) 移除HTML元素后需要同步删除相关的JavaScript函数调用；2) showStatus函数需要适配新的状态显示方式；3) 添加缺失的函数实现如updateWorkflowInfo、renderSteps等；4) 确保localStorage键名在插件面板和设计器之间保持一致
- 修复浏览器插件JavaScript错误的完整步骤：1) 移除重复的脚本引用避免类重复声明；2) 移除HTML中的内联事件处理器(onclick)改用addEventListener；3) 添加workflowManager全局变量并在DOMContentLoaded中初始化；4) 为所有按钮添加详细的事件监听器绑定和错误日志；5) 实现缺失的函数如closeModal、testSelectedNode等
- 模块化管理的正确方式：1) 移除utils文件中的全局变量自动创建，只暴露类到window；2) 在主文件中创建实例并声明全局变量；3) 移除主文件中重复的函数实现，使用utils中的版本；4) 通过window对象暴露utils中的函数供全局使用；5) 避免在多个文件中声明相同的变量或函数
- 清理未定义函数调用的方法：1) 当移除某个功能时，需要同时移除对应的函数调用；2) 使用搜索功能查找所有相关的函数调用；3) 面板折叠功能被移除后，initializePanelToggle()调用也应该被删除；4) 定期检查控制台错误，及时发现和修复未定义的函数引用
- 浏览器插件系统三个关键问题的修复方案：1) 设计器保存功能增强：添加saveWorkflowWithDialog()函数，包含名称输入对话框、重复检查、成功提示和storage事件触发；2) 跨窗口数据同步：统一使用'automationWorkflows'键，移除重复的storage监听器，添加同步状态提示；3) 流程预览显示：实现renderFlowPreview()使用mxGraph渲染只读预览，包含降级到简单Canvas预览的机制
- 插件面板流程预览问题修复：1) 在plugin-automation-popup.html中添加mxGraph库引用；2) 增强renderFlowPreview函数的错误处理和调试信息；3) 添加mxClient浏览器支持检查；4) 实现mxGraph不可用时的Canvas降级预览；5) 在selectConfig函数中添加详细的调试日志来追踪数据流
- 插件面板预览和刷新功能修复：1) 修复mxGraph路径为js/mxClient.min.js；2) 添加刷新配置按钮，包含🔄图标和加载状态；3) 实现refreshConfigList()函数，支持手动刷新配置列表；4) 改进简单Canvas预览，支持不同步骤类型的颜色区分和圆角矩形样式；5) 添加空状态显示和详细的调试日志
- localStorage读取问题修复：1) 移除重复的loadSavedWorkflows函数定义，统一使用'automationWorkflows'键名；2) 增强getWorkflowsFromStorage、loadSavedWorkflows、renderConfigSelect函数的调试日志；3) 添加debugLocalStorage()函数检查localStorage中的所有数据；4) 在页面加载和刷新按钮点击时调用调试函数；5) 确保配置列表能正确从localStorage读取并显示
- 插件面板预览显示问题修复：1) 增强selectConfig函数显示详细的工作流数据信息；2) 修复mxGraph全局变量引用，使用window.mxGraph；3) 增强renderWorkflowInPreview函数的调试日志；4) 暂时强制使用简单Canvas预览模式进行测试；5) 确保工作流数据格式正确传递到预览函数
- 插件面板使用设计器相同渲染逻辑修复：1) 替换renderWorkflowInPreview函数，使用设计器的convertWorkflowToGraph函数；2) 添加workflowConverter.js、mxGraphConfig.js、mxGraphOperations.js依赖；3) 实现降级机制，当convertWorkflowToGraph不可用时使用简化版本；4) 确保插件面板和设计器使用完全相同的mxGraph渲染逻辑
- 插件面板Canvas改为div容器修复：1) HTML中将canvas元素替换为div#flowGraphContainer；2) JavaScript中修改所有引用从flowCanvas改为flowGraphContainer；3) 删除Canvas相关函数(resizeCanvas, clearCanvas等)，改用mxGraph原生方法；4) mxGraph必须使用div容器而不是canvas元素才能正确渲染
- 插件面板样式和交互功能完全对齐设计器：1) 复制设计器的setupStyles函数到setupPreviewStyles，包含所有节点类型样式、循环容器样式、条件判断菱形样式；2) 添加平移缩放功能：mxPanningHandler、网格显示、鼠标滚轮缩放；3) 使用相同的连接线样式和颜色配置；4) 确保预览模式支持交互但禁用编辑
- 插件面板移除缩放按钮并添加滚轮缩放：1) 移除HTML中的三个缩放控制按钮(zoomIn, zoomOut, resetZoom)；2) 删除JavaScript中的initializeZoomControls函数；3) 添加鼠标滚轮缩放事件监听，支持mxEvent.addMouseWheelListener和降级方案wheel事件；4) 缩放范围限制在0.1-3.0倍，滚轮向上放大向下缩小
- 设计器集成Chrome扩展功能：1) 修改testLocator函数使用chrome.tabs.sendMessage API测试目标页面；2) 添加ensureContentScriptLoaded函数确保content script加载；3) 保留本地测试作为降级方案；4) 全局testLocator函数调用设计器实例的方法；5) 设计器现在可以在新窗口中测试目标页面的元素定位器
- 修复设计器Chrome扩展访问问题：1) 删除重复的openWorkflowDesigner函数，保留使用chrome.runtime.getURL的版本；2) 设计器现在通过chrome-extension://协议打开，而不是file://协议；3) 添加Chrome扩展环境检查的调试信息；4) 确保设计器作为Chrome扩展的一部分运行，可以访问chrome.tabs API
- 设计器改回弹窗方式并添加页面选择功能：1) 恢复window.open弹窗方式打开设计器，使用chrome.runtime.getURL获取扩展URL；2) 添加showTabSelector方法，让用户选择要测试的目标页面；3) 过滤掉扩展页面和特殊页面，只显示http/https网页；4) 创建模态对话框显示所有可用标签页供用户选择；5) 解决了无法确定测试目标页面的问题
- 修复CSP违规错误：1) 移除内联事件处理器onmouseover和onmouseout；2) 使用标准的addEventListener添加mouseenter和mouseleave事件；3) 为tab-item添加CSS类名而不是内联样式事件；4) 符合Chrome扩展的Content Security Policy要求，避免script-src-self违规
- 修复循环操作定位器测试问题：1) 问题是testLocator函数查找错误的元素ID（locatorType/locatorValue vs editLocatorStrategy/editLocatorValue）；2) 添加智能元素查找逻辑，优先查找设计器界面ID，然后查找编辑界面ID，最后在容器内模糊查找；3) 支持多种界面环境，确保测试按钮在不同上下文中都能正常工作
- 模块化定位器测试功能：1) 创建TabSelector模块支持选择测试页面，包括file://本地文件；2) 创建LocatorTester模块处理定位器测试逻辑；3) 修改plugin-automation-popup.js使用新模块，解决"请先选择定位策略和输入定位值"错误；4) 支持http/https/file协议页面测试；5) 实现模块化开发，减少主文件代码量
- 条件判断节点测试功能存在假阳性问题：测试按钮显示找到元素但实际执行失败，需要确保测试结果的真实性和与执行环境的一致性
- 设计器测试环境与插件执行环境不一致：相同定位器在设计器中测试通过但在插件执行时失败，需要统一两个环境的元素查找逻辑
- 条件判断节点测试功能存在假阳性问题：测试按钮显示找到元素但实际执行失败，需要确保测试结果的真实性和与执行环境的一致性
- 设计器测试环境与插件执行环境不一致：相同定位器在设计器中测试通过但在插件执行时失败，需要统一两个环境的元素查找逻辑
- 用户发现两个关键问题：1) 暂停后仍在检测元素，2) 执行时倒计时消失且页面阻塞无法交互。根本原因是JavaScript主线程被同步轮询阻塞，需要异步化元素查找并统一暂停状态管理
