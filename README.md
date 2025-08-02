# 网页自动操作助手

这是一个通用的浏览器扩展，允许用户创建和执行自定义的网页自动化操作流程，特别适合重复性工作的自动化。

## 新增功能

- **自定义操作流程**：通过 UI 界面添加和配置任意数量的操作步骤
- **多种元素定位策略**：支持通过 ID、Class、CSS 选择器、XPath、文本内容等多种方式定位元素
- **动态步骤管理**：可以随时添加、删除和调整操作步骤
- **清晰的执行反馈**：实时显示每个步骤的执行状态
- **🪟 多窗口管理**：支持新窗口打开、切换、关闭等多窗口自动化操作

## 支持的定位方式

- **ID 选择器**：通过元素的 ID 精确定位，如`my-button`
- **Class 选择器**：通过元素的 Class 类名定位，如`btn-primary`
- **CSS 选择器**：使用完整的 CSS 选择器定位，如`div.container > button:first-child`
- **XPath 表达式**：使用 XPath 语法定位，如`//div[@id='main']//button[contains(text(), '提交')]`
- **精确文本**：通过元素的精确文本内容定位，如`提交表单`
- **包含文本**：通过元素包含的文本内容定位，如`提交`（会匹配包含"提交"的任何元素）

## 使用方法

1. 点击扩展图标打开配置界面
2. 点击"添加步骤"按钮创建操作步骤
3. 为每个步骤选择定位方式并输入相应的定位值
4. 配置完所有步骤后，点击"执行操作"按钮
5. 扩展将按顺序执行所有步骤，并显示实时进度

### 示例用途

- 自动填写表单和提交
- 自动点击网页上的特定按钮或链接
- 自动执行一系列导航和操作步骤
- 在电商网站上自动添加商品

## 安装步骤

### Chrome 浏览器

1. 下载或克隆此项目
2. 准备好图标文件（参见 icons 目录中的 README.md）
3. 打开 Chrome 浏览器，访问 `chrome://extensions/`
4. 开启右上角的"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择此项目的根目录

### Firefox 浏览器

1. 下载或克隆此项目
2. 准备好图标文件（参见 icons 目录中的 README.md）
3. 打开 Firefox 浏览器，访问 `about:debugging#/runtime/this-firefox`
4. 点击"临时载入附加组件"
5. 选择此项目中的 manifest.json 文件

### Edge 浏览器

1. 下载或克隆此项目
2. 准备好图标文件（参见 icons 目录中的 README.md）
3. 打开 Edge 浏览器，访问 `edge://extensions/`
4. 开启左下角的"开发人员模式"
5. 点击"加载解压缩的扩展"
6. 选择此项目的根目录

## 技术说明

此扩展使用 WebExtensions API 构建，主要组件包括：

- Popup UI (popup/): 用户配置界面，允许添加和管理步骤
- Content Script (content/): 在网页上执行的脚本，实现元素定位和操作
- Background Script (background/): 协调通信和管理执行流程

## 🪟 多窗口管理功能

### 功能概述

新窗口管理功能允许自动化工作流在多个浏览器窗口之间无缝切换和操作，支持以下场景：

- 点击按钮打开新窗口，在新窗口中执行操作
- 在新窗口完成操作后关闭窗口，返回主窗口继续执行
- 支持多层窗口嵌套（新窗口中再打开新窗口）
- 智能窗口状态管理和错误恢复

### 支持的窗口操作

#### 1. 新窗口操作 (opensNewWindow)
```json
{
  "type": "click",
  "opensNewWindow": true,
  "locator": {
    "strategy": "css",
    "value": "#open-new-window-btn"
  },
  "newWindowTimeout": 10000,
  "windowReadyTimeout": 30000
}
```

#### 2. 关闭窗口操作 (closeWindow)
```json
{
  "type": "closeWindow",
  "action": "closeWindow",
  "closeTarget": "current",
  "returnToPrevious": true
}
```

#### 3. 切换窗口操作 (switchWindow)
```json
{
  "type": "switchWindow",
  "action": "switchWindow",
  "targetWindow": "main"
}
```

### 使用示例

#### 基础新窗口工作流
1. 在主窗口填写表单
2. 点击按钮打开新窗口（配置 `opensNewWindow: true`）
3. 在新窗口中执行操作
4. 关闭新窗口返回主窗口
5. 在主窗口继续后续操作

#### 复杂多窗口工作流
1. 主窗口 → 新窗口A
2. 新窗口A → 新窗口B
3. 在新窗口B中操作
4. 关闭新窗口B → 返回新窗口A
5. 在新窗口A中继续操作
6. 关闭新窗口A → 返回主窗口

### 配置参数说明

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `opensNewWindow` | boolean | 标记该操作会打开新窗口 | false |
| `newWindowTimeout` | number | 等待新窗口创建的超时时间(ms) | 10000 |
| `windowReadyTimeout` | number | 等待新窗口页面加载完成的超时时间(ms) | 30000 |
| `closeTarget` | string | 关闭目标：'current', 'specific', 'all' | 'current' |
| `targetWindow` | string | 切换目标：'main', 'previous', 'specific' | 'main' |

### 测试页面

项目提供了完整的测试页面来验证多窗口功能：

- `test-new-window-functionality.html` - 主窗口测试页面
- `test-new-window-target.html` - 新窗口目标页面
- `examples/new-window-workflow-example.json` - 示例工作流配置

### 技术实现

多窗口管理功能基于以下核心组件：

- **WindowManager** (`modules/window/window-manager.js`) - 窗口状态管理
- **ActionExecutor** (`modules/window/action-executor.js`) - 页面操作执行
- **WindowStepTypes** (`modules/window/window-step-types.js`) - 步骤类型定义
- **Background Script** 增强 - 支持多窗口协调和通信

## 进一步开发

未来规划的功能：

- 保存和加载操作配置
- 添加更多元素操作类型（输入文本、悬停、拖拽等）
- 添加条件判断和循环功能
- 支持等待元素出现、页面加载等特殊步骤
- 添加录制功能，可视化选择元素
- 增强多窗口管理（窗口标签页管理、窗口间数据传递）
