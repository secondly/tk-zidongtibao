/**
 * 内容脚本自动化执行模块
 * 负责工作流执行、步骤处理、循环控制等自动化功能
 */

/**
 * 执行通用自动化工作流
 * @param {object} workflow - 工作流配置
 * @returns {Promise<object>} - 执行结果
 */
async function executeUniversalWorkflow(workflow) {
  try {
    console.log("🚀 开始执行工作流:", workflow.name);
    
    // 直接调用content.js中的executeSimplifiedWorkflow函数
    if (typeof window.executeSimplifiedWorkflow === 'function') {
      return await window.executeSimplifiedWorkflow(workflow);
    } else {
      throw new Error("executeSimplifiedWorkflow函数未找到");
    }
  } catch (error) {
    console.error("❌ 工作流执行失败:", error);
    throw error;
  }
}

/**
 * 根据连接关系构建正确的执行顺序（简化版）
 */
function buildExecutionOrderSimplified(steps, connections = []) {
  console.log("🔄 开始构建执行顺序...");

  if (!connections || connections.length === 0) {
    console.log("⚠️ 没有连接信息，按原顺序执行步骤");
    return steps;
  }

  const stepMap = new Map();
  steps.forEach((step) => stepMap.set(step.id, step));

  const graph = new Map();
  const inDegree = new Map();

  steps.forEach((step) => {
    graph.set(step.id, []);
    inDegree.set(step.id, 0);
  });

  connections.forEach((conn) => {
    if (stepMap.has(conn.source) && stepMap.has(conn.target)) {
      graph.get(conn.source).push(conn.target);
      inDegree.set(conn.target, inDegree.get(conn.target) + 1);
    }
  });

  const result = [];
  const queue = [];

  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const currentId = queue.shift();
    const currentStep = stepMap.get(currentId);

    if (currentStep) {
      result.push(currentStep);
      const neighbors = graph.get(currentId) || [];
      neighbors.forEach((neighborId) => {
        inDegree.set(neighborId, inDegree.get(neighborId) - 1);
        if (inDegree.get(neighborId) === 0) {
          queue.push(neighborId);
        }
      });
    }
  }

  if (result.length !== steps.length) {
    steps.forEach((step) => {
      if (!result.find((s) => s.id === step.id)) {
        result.push(step);
      }
    });
  }

  console.log(`✅ 执行顺序构建完成，共 ${result.length} 个步骤`);
  return result;
}

// executeSimplifiedWorkflow 函数已移至 content.js 中，避免重复定义

// loadUniversalAutomationEngine 函数已删除，因为不再使用高级引擎

// 简单的步骤执行函数
async function executeClickStep(step) {
  console.log("🔧 [DEBUG] executeClickStep 开始执行");

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  if (!step.locator) {
    throw new Error("缺少定位器");
  }

  console.log("🔧 [DEBUG] 查找元素:", step.locator);
  console.log("🔧 [DEBUG] 定位策略:", step.locator.strategy);
  console.log("🔧 [DEBUG] 定位值:", step.locator.value);

  // 检查定位器的完整性
  if (!step.locator.strategy) {
    // 尝试从旧格式转换
    if (step.locator.type) {
      console.log("🔄 检测到旧格式定位器，进行转换");
      step.locator.strategy = step.locator.type;
    } else {
      throw new Error("定位器缺少策略(strategy)字段");
    }
  }

  if (!step.locator.value) {
    throw new Error("定位器缺少值(value)字段");
  }

  const element = await window.ContentCore.findElementByStrategy(
    step.locator.strategy,
    step.locator.value
  );
  if (!element) {
    throw new Error(
      `找不到元素: ${step.locator.strategy}=${step.locator.value}`
    );
  }

  console.log("🔧 [DEBUG] 找到目标元素，准备执行点击操作");
  console.log("🔧 [DEBUG] 元素信息:", {
    tagName: element.tagName,
    id: element.id,
    className: element.className,
    textContent: element.textContent?.substring(0, 50) + "...",
  });

  // 滚动到元素位置
  console.log("🔧 [DEBUG] 滚动到目标元素");
  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });

  // 等待滚动完成
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 高亮显示元素
  console.log("🔧 [DEBUG] 高亮显示目标元素");
  window.ContentCore.highlightElement(element, "click");

  // 设置自动清除高亮
  setTimeout(() => {
    window.ContentCore.clearElementHighlight(element);
  }, 2000);

  // 检查元素是否可见和可点击
  const rect = element.getBoundingClientRect();
  const isVisible =
    rect.width > 0 &&
    rect.height > 0 &&
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth;

  console.log("🔧 [DEBUG] 元素可见性检查:", {
    isVisible,
    rect: {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
    },
  });

  // 执行点击
  console.log("🔧 [DEBUG] 执行点击操作");
  element.click();

  // 等待点击效果
  await new Promise((resolve) => setTimeout(resolve, 200));

  console.log(`✅ 点击元素完成: ${step.locator.value}`);
}

async function executeInputStep(step) {
  console.log("🔧 [DEBUG] executeInputStep 开始执行");

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  const text = step.text || step.inputText || "";

  if (!step.locator) {
    throw new Error("缺少定位器");
  }

  console.log("🔧 [DEBUG] 查找输入元素:", step.locator);

  // 检查定位器的完整性
  if (!step.locator.strategy) {
    // 尝试从旧格式转换
    if (step.locator.type) {
      console.log("🔄 检测到旧格式定位器，进行转换");
      step.locator.strategy = step.locator.type;
    } else {
      throw new Error("定位器缺少策略(strategy)字段");
    }
  }

  if (!step.locator.value) {
    throw new Error("定位器缺少值(value)字段");
  }

  const element = await window.ContentCore.findElementByStrategy(
    step.locator.strategy,
    step.locator.value
  );
  if (!element) {
    throw new Error(
      `找不到元素: ${step.locator.strategy}=${step.locator.value}`
    );
  }

  console.log("🔧 [DEBUG] 找到输入元素，准备输入文本:", text);
  console.log("🔧 [DEBUG] 输入元素信息:", {
    tagName: element.tagName,
    type: element.type,
    id: element.id,
    className: element.className,
  });

  // 滚动到元素位置
  console.log("🔧 [DEBUG] 滚动到输入元素");
  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });

  // 等待滚动完成
  await new Promise((resolve) => setTimeout(resolve, 300));

  // 高亮显示元素
  console.log("🔧 [DEBUG] 高亮显示输入元素");
  window.ContentCore.highlightElement(element, "input");

  // 设置自动清除高亮
  setTimeout(() => {
    window.ContentCore.clearElementHighlight(element);
  }, 2000);

  // 聚焦元素
  element.focus();

  // 清空现有内容（如果需要）
  if (step.clearFirst !== false) {
    element.value = "";
  }

  // 输入文本
  console.log("🔧 [DEBUG] 执行文本输入");
  element.value = text;

  // 触发输入事件
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));

  // 等待输入效果
  await new Promise((resolve) => setTimeout(resolve, 200));

  console.log(`✅ 输入文本完成: "${text}"`);
}

async function executeWaitStep(step) {
  console.log("🔧 [DEBUG] executeWaitStep 开始执行");

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  const duration = step.duration || step.waitTime || 1000;
  console.log(`⏳ 等待 ${duration}ms`);

  // 在等待过程中也要支持暂停
  const startTime = Date.now();
  while (Date.now() - startTime < duration) {
    // 每100ms检查一次暂停状态
    if (window.simplifiedExecutionControl) {
      await window.simplifiedExecutionControl.checkPause();
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(100, duration - (Date.now() - startTime)))
    );
  }

  console.log(`✅ 等待完成`);
}

async function executeSmartWaitStep(step) {
  console.log("🔧 [DEBUG] executeSmartWaitStep 开始执行");

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  if (!step.locator) {
    throw new Error("智能等待缺少定位器");
  }

  console.log("🔧 [DEBUG] 智能等待定位器:", step.locator);

  // 检查定位器的完整性
  if (!step.locator.strategy) {
    // 尝试从旧格式转换
    if (step.locator.type) {
      console.log("🔄 检测到旧格式智能等待定位器，进行转换");
      step.locator.strategy = step.locator.type;
    } else {
      throw new Error("智能等待定位器缺少策略(strategy)字段");
    }
  }

  if (!step.locator.value) {
    throw new Error("智能等待定位器缺少值(value)字段");
  }

  const timeout = step.timeout || 30000;
  const checkInterval = step.checkInterval || 500;
  const attributeName = step.attributeName || "";
  const comparisonType = step.comparisonType || "equals";
  const expectedValue = step.expectedValue || "";

  if (!attributeName) {
    throw new Error("智能等待缺少属性名称");
  }

  console.log(
    `🔍 等待属性: ${attributeName} ${comparisonType} "${expectedValue}" - ${step.locator.strategy}=${step.locator.value}, 超时: ${timeout}ms`
  );
  console.log(
    `⚙️ 属性条件: ${attributeName} ${comparisonType} "${expectedValue}"`
  );

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    // 检查暂停状态
    if (window.simplifiedExecutionControl) {
      await window.simplifiedExecutionControl.checkPause();
    }

    try {
      const conditionMet = await checkAttributeConditionCA(
        step.locator,
        attributeName,
        comparisonType,
        expectedValue
      );
      if (conditionMet) {
        console.log(
          `✅ 等待属性成功: ${attributeName} ${comparisonType} "${expectedValue}"`
        );
        return;
      }
    } catch (error) {
      // 如果是暂停导致的错误，重新抛出
      if (error.message === "查找已暂停") {
        throw error;
      }
      // 其他错误（包括超时）继续等待
    }

    // 使用异步等待避免阻塞主线程
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(() => setTimeout(resolve, checkInterval));
      } else {
        setTimeout(resolve, checkInterval);
      }
    });
  }

  throw new Error(
    `等待属性超时: ${attributeName} ${comparisonType} "${expectedValue}" 未在 ${timeout}ms 内满足`
  );
}

/**
 * 检查属性条件是否满足（Content Automation版）
 */
async function checkAttributeConditionCA(
  locator,
  attributeName,
  comparisonType,
  expectedValue
) {
  try {
    const element = await window.ContentCore.findElementByStrategy(
      locator.strategy,
      locator.value,
      100
    );

    if (!element) {
      return false;
    }

    // 获取属性值
    const actualValue = element.getAttribute(attributeName);

    // 如果属性不存在，返回false
    if (actualValue === null) {
      return false;
    }

    // 根据比较方式进行判断
    switch (comparisonType) {
      case "equals":
        return actualValue === expectedValue;
      case "contains":
        return actualValue.includes(expectedValue);
      default:
        return actualValue === expectedValue;
    }
  } catch (error) {
    return false;
  }
}

/**
 * 检查等待条件是否满足（Content Automation版）
 */
async function checkWaitConditionCA(locator, waitCondition, attributeName) {
  try {
    const element = await window.ContentCore.findElementByStrategy(
      locator.strategy,
      locator.value,
      100
    );

    switch (waitCondition) {
      case "appear":
        return element !== null;

      case "disappear":
        return false; // 如果找到了元素，说明还没消失

      case "visible":
        if (!element) return false;
        return isElementVisibleCA(element);

      case "hidden":
        if (!element) return false;
        return !isElementVisibleCA(element);

      case "attributeAppear":
        if (!element || !attributeName) return false;
        return element.hasAttribute(attributeName);

      default:
        return element !== null;
    }
  } catch (error) {
    switch (waitCondition) {
      case "disappear":
        return true; // 元素不存在，说明已消失
      default:
        return false;
    }
  }
}

/**
 * 检查元素是否可见（Content Automation版）
 */
function isElementVisibleCA(element) {
  if (!element) return false;

  // 检查offsetParent
  if (element.offsetParent === null) {
    const style = getComputedStyle(element);
    if (style.position !== "fixed") {
      return false;
    }
  }

  // 检查CSS属性
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  if (parseFloat(style.opacity) === 0) {
    return false;
  }

  // 检查尺寸
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }

  return true;
}

// 执行拖拽步骤
async function executeDragStep(step) {
  console.log("🔧 [DEBUG] executeDragStep 开始执行");

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  if (!step.locator) {
    throw new Error("拖拽步骤缺少定位器配置");
  }

  console.log("🔧 [DEBUG] 拖拽定位器:", step.locator);
  console.log("🔧 [DEBUG] 拖拽距离:", {
    horizontal: step.horizontalDistance || 0,
    vertical: step.verticalDistance || 0,
  });

  // 查找目标元素
  const element = await window.ContentCore.findElementByStrategy(
    step.locator.strategy,
    step.locator.value
  );
  if (!element) {
    throw new Error(
      `找不到拖拽目标元素: ${step.locator.strategy}=${step.locator.value}`
    );
  }

  console.log("🔧 [DEBUG] 找到拖拽目标元素，准备执行拖拽操作");

  // 滚动到元素位置
  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });

  // 等待滚动完成
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 高亮显示元素
  window.ContentCore.highlightElement(element, "drag");

  // 获取元素的中心位置
  const rect = element.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  // 计算目标位置
  const horizontalDistance = step.horizontalDistance || 0;
  const verticalDistance = step.verticalDistance || 0;
  const endX = startX + horizontalDistance;
  const endY = startY + verticalDistance;

  console.log(`🖱️ 拖拽路径: (${startX}, ${startY}) -> (${endX}, ${endY})`);

  // 执行拖拽操作
  await performDragOperation(element, startX, startY, endX, endY, step);

  // 清除高亮
  setTimeout(() => {
    window.ContentCore.clearElementHighlight(element);
  }, 2000);

  console.log(
    `✅ 拖拽操作完成: 水平${horizontalDistance}px, 垂直${verticalDistance}px`
  );
}

// 执行增强的拖拽操作（支持HTML5拖拽元素）
async function performEnhancedDragOperation(
  element,
  startX,
  startY,
  endX,
  endY,
  step
) {
  const dragSpeed = step.dragSpeed || 100;
  const waitAfterDrag = step.waitAfterDrag || 1000;

  console.log("🖱️ 开始增强拖拽操作");

  // 方法1: 尝试直接移动元素位置
  const originalPosition = element.style.position;
  const originalLeft = element.style.left;
  const originalTop = element.style.top;
  const originalTransform = element.style.transform;

  try {
    // 设置元素为相对定位以便移动
    if (!originalPosition || originalPosition === "static") {
      element.style.position = "relative";
    }

    // 计算移动距离
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    console.log(`🖱️ 移动元素: deltaX=${deltaX}px, deltaY=${deltaY}px`);

    // 添加移动动画
    element.style.transition = `transform ${dragSpeed}ms ease-out`;
    element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    // 等待动画完成
    await new Promise((resolve) => setTimeout(resolve, dragSpeed));

    // 触发拖拽事件以确保兼容性
    const dragStartEvent = new DragEvent("dragstart", {
      bubbles: true,
      cancelable: true,
      clientX: startX,
      clientY: startY,
    });
    element.dispatchEvent(dragStartEvent);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const dragEndEvent = new DragEvent("dragend", {
      bubbles: true,
      cancelable: true,
      clientX: endX,
      clientY: endY,
    });
    element.dispatchEvent(dragEndEvent);

    console.log("🖱️ 增强拖拽操作完成");

    // 等待指定时间后恢复原始状态
    await new Promise((resolve) => setTimeout(resolve, waitAfterDrag));

    // 恢复原始样式
    element.style.transition = "";
    element.style.transform = originalTransform;
    element.style.position = originalPosition;
    element.style.left = originalLeft;
    element.style.top = originalTop;
  } catch (error) {
    console.error("🖱️ 增强拖拽操作失败:", error);
    // 恢复原始样式
    element.style.transition = "";
    element.style.transform = originalTransform;
    element.style.position = originalPosition;
    element.style.left = originalLeft;
    element.style.top = originalTop;
    throw error;
  }
}

// 执行具体的拖拽操作
async function performDragOperation(element, startX, startY, endX, endY, step) {
  const dragSpeed = step.dragSpeed || 100;
  const waitAfterDrag = step.waitAfterDrag || 1000;

  // 1. 触发 mousedown 事件
  const mouseDownEvent = new MouseEvent("mousedown", {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: startX,
    clientY: startY,
    button: 0,
    buttons: 1,
  });
  element.dispatchEvent(mouseDownEvent);
  console.log("🖱️ 已触发 mousedown 事件");

  // 等待一小段时间
  await new Promise((resolve) => setTimeout(resolve, dragSpeed));

  // 2. 触发 mousemove 事件（分步移动以模拟真实拖拽）
  const distance = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
  const steps = Math.min(Math.max(Math.floor(distance / 10), 1), 20); // 限制步数在1-20之间

  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    const currentX = startX + (endX - startX) * progress;
    const currentY = startY + (endY - startY) * progress;

    const mouseMoveEvent = new MouseEvent("mousemove", {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: currentX,
      clientY: currentY,
      button: 0,
      buttons: 1,
    });

    // 在document上触发mousemove事件
    document.dispatchEvent(mouseMoveEvent);

    // 短暂等待以模拟真实拖拽速度
    await new Promise((resolve) => setTimeout(resolve, dragSpeed / steps));
  }

  console.log("🖱️ 已完成 mousemove 事件序列");

  // 3. 触发 mouseup 事件
  const mouseUpEvent = new MouseEvent("mouseup", {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: endX,
    clientY: endY,
    button: 0,
    buttons: 0,
  });
  document.dispatchEvent(mouseUpEvent);
  console.log("🖱️ 已触发 mouseup 事件");

  // 等待拖拽完成
  await new Promise((resolve) => setTimeout(resolve, waitAfterDrag));
}

// 执行条件判断步骤
async function executeConditionStep(step) {
  console.log(`🧪 执行条件判断步骤:`, step);

  const locator = step.locator;
  if (!locator) {
    throw new Error("条件判断步骤缺少定位器配置");
  }

  console.log("🔧 [DEBUG] 条件判断定位器:", locator);

  // 检查定位器的完整性
  if (!locator.strategy) {
    // 尝试从旧格式转换
    if (locator.type) {
      console.log("🔄 检测到旧格式条件定位器，进行转换");
      locator.strategy = locator.type;
    } else {
      throw new Error("条件判断定位器缺少策略(strategy)字段");
    }
  }

  if (!locator.value) {
    throw new Error("条件判断定位器缺少值(value)字段");
  }

  // 查找元素
  const element = findSingleElement(locator.strategy, locator.value);
  if (!element) {
    throw new Error(
      `条件判断失败: 找不到元素 (${locator.strategy}: ${locator.value})`
    );
  }

  // 高亮元素
  window.ContentCore.highlightElement(element, "processing");

  // 执行条件判断
  let conditionResult = false;
  let actualValue = "";
  const expectedValue = step.expectedValue || "";
  const attributeName = step.attributeName || "";

  try {
    // 获取实际值
    switch (step.conditionType) {
      case "attribute":
        actualValue = element.getAttribute(attributeName) || "";
        break;
      case "text":
        actualValue = element.textContent || "";
        break;
      case "class":
        actualValue = element.className || "";
        break;
      case "style":
        actualValue = getComputedStyle(element)[attributeName] || "";
        break;
      case "value":
        actualValue = element.value || "";
        break;
      case "exists":
        conditionResult = true; // 元素已找到
        break;
      case "visible":
        conditionResult = element.offsetParent !== null;
        break;
    }

    // 执行比较
    if (step.conditionType !== "exists" && step.conditionType !== "visible") {
      switch (step.comparisonType) {
        case "equals":
          conditionResult = actualValue === expectedValue;
          break;
        case "notEquals":
          conditionResult = actualValue !== expectedValue;
          break;
        case "contains":
          conditionResult = actualValue.includes(expectedValue);
          break;
        case "notContains":
          conditionResult = !actualValue.includes(expectedValue);
          break;
        case "startsWith":
          conditionResult = actualValue.startsWith(expectedValue);
          break;
        case "endsWith":
          conditionResult = actualValue.endsWith(expectedValue);
          break;
        case "isEmpty":
          conditionResult = actualValue === "";
          break;
        case "isNotEmpty":
          conditionResult = actualValue !== "";
          break;
        case "hasAttribute":
          conditionResult = element.hasAttribute(attributeName);
          break;
        case "notHasAttribute":
          conditionResult = !element.hasAttribute(attributeName);
          break;
      }
    }

    // 显示结果
    if (conditionResult) {
      window.ContentCore.highlightElement(element, "success");
      console.log(
        `✅ 条件判断通过: ${step.conditionType} ${step.comparisonType} "${expectedValue}" (实际值: "${actualValue}")`
      );
    } else {
      window.ContentCore.highlightElement(element, "error");
      console.log(
        `❌ 条件判断失败: ${step.conditionType} ${step.comparisonType} "${expectedValue}" (实际值: "${actualValue}")`
      );
      throw new Error(
        `条件判断失败: 期望 ${step.conditionType} ${step.comparisonType} "${expectedValue}"，实际值为 "${actualValue}"`
      );
    }

    // 等待一下让用户看到结果
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    window.ContentCore.highlightElement(element, "error");
    throw error;
  }
}

async function executeLoopStep(step) {
  if (!step.locator) {
    throw new Error("缺少循环定位器");
  }

  console.log("🔧 [DEBUG] 循环步骤完整配置:", step);
  console.log("🔧 [DEBUG] 循环步骤定位器:", step.locator);
  console.log("🔧 [DEBUG] 敏感词检测配置:", step.sensitiveWordDetection);

  // 检查定位器的完整性
  if (!step.locator.strategy) {
    // 尝试从旧格式转换
    if (step.locator.type) {
      console.log("🔄 检测到旧格式循环定位器，进行转换");
      step.locator.strategy = step.locator.type;
    } else {
      throw new Error("循环定位器缺少策略(strategy)字段");
    }
  }

  if (!step.locator.value) {
    throw new Error("循环定位器缺少值(value)字段");
  }

  const elements = await window.ContentCore.findElementsByStrategy(
    step.locator.strategy,
    step.locator.value
  );
  if (elements.length === 0) {
    throw new Error(
      `找不到循环元素: ${step.locator.strategy}=${step.locator.value}`
    );
  }

  const startIndex = step.startIndex || 0;
  const endIndex =
    step.endIndex === -1
      ? elements.length - 1
      : step.endIndex || elements.length - 1;
  const actualEndIndex = Math.min(endIndex, elements.length - 1);

  console.log(
    `🔄 开始执行${step.loopType}循环: ${elements.length} 个元素，范围 ${startIndex}-${actualEndIndex}`
  );

  for (let i = startIndex; i <= actualEndIndex; i++) {
    console.log(`🔧 [DEBUG] 循环第 ${i + 1} 个元素前检查暂停状态`);

    // 在每个循环迭代前检查暂停状态
    if (window.simplifiedExecutionControl) {
      await window.simplifiedExecutionControl.checkPause();
    }

    const element = elements[i];
    console.log(`🎯 处理第 ${i + 1}/${elements.length} 个元素`);

    // 敏感词检测
    console.log(`🔧 [DEBUG] 检查敏感词检测配置 - 第 ${i + 1} 个元素:`, {
      hasSensitiveWordDetection: !!step.sensitiveWordDetection,
      isEnabled: step.sensitiveWordDetection?.enabled,
      enabledType: typeof step.sensitiveWordDetection?.enabled,
      enabledValue: step.sensitiveWordDetection?.enabled,
      sensitiveWords: step.sensitiveWordDetection?.sensitiveWords,
      stepType: step.type,
      stepId: step.id,
    });

    // 更严格的条件检查
    const hasValidSensitiveWordConfig =
      step.sensitiveWordDetection &&
      (step.sensitiveWordDetection.enabled === true ||
        step.sensitiveWordDetection.enabled === "true") &&
      step.sensitiveWordDetection.sensitiveWords &&
      step.sensitiveWordDetection.sensitiveWords.trim().length > 0;

    console.log(
      `🔧 [DEBUG] 敏感词检测条件判断结果:`,
      hasValidSensitiveWordConfig
    );

    if (hasValidSensitiveWordConfig) {
      console.log(`🔍 开始敏感词检测 - 第 ${i + 1} 个元素`);

      try {
        // 检查敏感词检测模块是否加载
        if (!window.SensitiveWordDetector) {
          console.error("❌ SensitiveWordDetector 模块未加载");
          throw new Error("敏感词检测模块未加载");
        }

        // 创建敏感词检测器实例
        const detector = new window.SensitiveWordDetector();

        // 检查是否应该跳过当前元素
        const skipResult = await detector.checkShouldSkipElement(
          element,
          step.sensitiveWordDetection
        );

        if (skipResult.shouldSkip) {
          console.log(`🚫 跳过第 ${i + 1} 个元素: ${skipResult.reason}`);

          // 高亮显示被跳过的元素
          if (window.ContentCore) {
            window.ContentCore.highlightElement(element, "skip");
            setTimeout(() => {
              window.ContentCore.clearElementHighlight(element);
            }, 1500);
          }

          // 跳过当前循环，继续下一个
          continue;
        } else {
          console.log(`✅ 第 ${i + 1} 个元素通过敏感词检测`);
        }
      } catch (error) {
        console.error(`❌ 敏感词检测失败 - 第 ${i + 1} 个元素:`, error);
        // 检测失败时继续执行，避免影响正常流程
      }
    }

    // 记录当前页面滚动位置
    const scrollBefore = {
      x: window.pageXOffset || document.documentElement.scrollLeft,
      y: window.pageYOffset || document.documentElement.scrollTop,
    };
    console.log("🔧 [DEBUG] 操作前页面滚动位置:", scrollBefore);

    try {
      if (step.loopType === "simpleLoop") {
        // 简单循环：执行单一操作
        await executeSimpleLoopAction(element, step);
      } else if (step.loopType === "container") {
        // 容器循环：直接在容器内执行子操作，不点击容器本身
        await executeContainerLoopAction(element, step);
      } else {
        // 父级循环：点击后执行子操作
        await executeParentLoopAction(element, step);
      }

      // 记录操作后的滚动位置
      const scrollAfter = {
        x: window.pageXOffset || document.documentElement.scrollLeft,
        y: window.pageYOffset || document.documentElement.scrollTop,
      };
      console.log("🔧 [DEBUG] 操作后页面滚动位置:", scrollAfter);

      if (
        scrollBefore.y !== scrollAfter.y ||
        scrollBefore.x !== scrollAfter.x
      ) {
        console.log("✅ 页面滚动已发生，滚动距离:", {
          deltaX: scrollAfter.x - scrollBefore.x,
          deltaY: scrollAfter.y - scrollBefore.y,
        });
      }

      // 循环间隔（支持暂停）
      if (step.loopDelay) {
        console.log(`🔧 [DEBUG] 循环延迟开始: ${step.loopDelay}ms`);
        const delayStartTime = Date.now();
        while (Date.now() - delayStartTime < step.loopDelay) {
          // 在延迟期间检查暂停状态
          if (window.simplifiedExecutionControl) {
            await window.simplifiedExecutionControl.checkPause();
          }
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              Math.min(100, step.loopDelay - (Date.now() - delayStartTime))
            )
          );
        }
        console.log(`🔧 [DEBUG] 循环延迟完成`);
      }
    } catch (error) {
      console.error(`❌ 第 ${i + 1} 个元素处理失败:`, error);
      if (step.errorHandling === "stop") {
        throw error;
      }
    }
  }

  console.log(`✅ 循环执行完成`);
}

async function executeSimpleLoopAction(element, step) {
  console.log("🔧 [DEBUG] executeSimpleLoopAction 开始执行");

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  const actionType = step.actionType || "click";
  console.log(`🔧 执行简单操作: ${actionType}`);

  switch (actionType) {
    case "click":
      console.log(`🔧 [DEBUG] 准备点击循环元素`);
      console.log("🔧 [DEBUG] 循环元素信息:", {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        textContent: element.textContent?.substring(0, 50) + "...",
      });

      // 滚动到元素位置
      console.log("🔧 [DEBUG] 滚动到循环目标元素");
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });

      // 等待滚动完成
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 高亮显示元素
      console.log("🔧 [DEBUG] 高亮显示循环目标元素");
      window.ContentCore.highlightElement(element, "loop");

      // 设置自动清除高亮
      setTimeout(() => {
        window.ContentCore.clearElementHighlight(element);
      }, 1500);

      // 检查元素可见性
      const rect = element.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      console.log("🔧 [DEBUG] 循环元素可见性:", {
        isVisible,
        rect: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
        },
      });

      // 执行点击
      console.log("🔧 [DEBUG] 执行循环元素点击");
      element.click();

      // 等待点击效果
      await new Promise((resolve) => setTimeout(resolve, 200));

      console.log(`👆 循环点击元素完成`);
      break;
    case "input":
      const inputText = step.inputText || "";
      element.value = inputText;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      console.log(`⌨️ 输入文本: "${inputText}"`);
      break;
    case "check":
      if (!element.checked) {
        element.checked = true;
        element.dispatchEvent(new Event("change", { bubbles: true }));
        console.log(`☑️ 勾选复选框`);
      }
      break;
    case "uncheck":
      if (element.checked) {
        element.checked = false;
        element.dispatchEvent(new Event("change", { bubbles: true }));
        console.log(`☐ 取消勾选复选框`);
      }
      break;
    default:
      throw new Error(`不支持的简单循环操作类型: ${actionType}`);
  }

  // 操作后等待（支持暂停）
  if (step.actionDelay) {
    console.log(`🔧 [DEBUG] 操作后延迟开始: ${step.actionDelay}ms`);
    const delayStartTime = Date.now();
    while (Date.now() - delayStartTime < step.actionDelay) {
      // 在延迟期间检查暂停状态
      if (window.simplifiedExecutionControl) {
        await window.simplifiedExecutionControl.checkPause();
      }
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.min(100, step.actionDelay - (Date.now() - delayStartTime))
        )
      );
    }
    console.log(`🔧 [DEBUG] 操作后延迟完成`);
  }
}

async function executeContainerLoopAction(element, step) {
  console.log("🔧 [DEBUG] executeContainerLoopAction 开始执行 - 容器循环模式");

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  console.log(`📦 开始处理容器元素，不点击容器本身`);
  console.log("🔧 [DEBUG] 容器元素信息:", {
    tagName: element.tagName,
    id: element.id,
    className: element.className,
    textContent: element.textContent?.substring(0, 50) + "...",
  });

  // 高亮显示容器元素
  window.ContentCore.highlightElement(element, "loop");
  setTimeout(() => {
    window.ContentCore.clearElementHighlight(element);
  }, 2000);

  // 滚动到容器元素位置，确保可见
  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });

  // 等待滚动完成
  await new Promise((resolve) => setTimeout(resolve, 300));

  // 直接执行子操作序列，不点击容器元素
  if (step.subOperations && step.subOperations.length > 0) {
    console.log(`🔧 开始在容器内执行 ${step.subOperations.length} 个子操作`);

    for (let i = 0; i < step.subOperations.length; i++) {
      const subOp = step.subOperations[i];
      console.log(
        `🎯 执行容器内子操作 ${i + 1}: ${subOp.type} - ${subOp.locator?.value || subOp.locator
        }`
      );

      try {
        // 传递容器元素上下文给子操作
        await executeSubOperation(subOp, element);
      } catch (error) {
        console.error(`❌ 容器内子操作 ${i + 1} 失败:`, error);
        if (step.errorHandling === "stop") {
          throw error;
        }
      }

      // 子操作间等待
      if (subOp.delay || subOp.waitAfterClick) {
        const waitTime = subOp.delay || subOp.waitAfterClick || 500;
        console.log(`⏳ 子操作间等待 ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    console.log(`✅ 容器内所有子操作执行完成`);
  } else {
    console.log(`📦 容器循环没有配置子操作，执行直接操作`);

    // 获取操作类型
    const actionType = step.actionType || step.operationType || "click";
    console.log(`🔧 执行操作类型: ${actionType}`);

    // 执行指定的操作
    switch (actionType) {
      case "click":
        element.click();
        console.log(`👆 已点击容器元素`);
        break;
      case "input":
        if (step.inputText) {
          element.value = step.inputText;
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          console.log(`📝 已输入文本: ${step.inputText}`);
        }
        break;
      case "hover":
        element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        console.log(`🖱️ 已悬停元素`);
        break;
      default:
        console.log(`⚠️ 不支持的操作类型: ${actionType}`);
    }
  }

  // 操作延迟
  if (step.operationDelay) {
    console.log(`🔧 [DEBUG] 容器操作延迟开始: ${step.operationDelay}ms`);
    const delayStartTime = Date.now();
    while (Date.now() - delayStartTime < step.operationDelay) {
      // 在延迟期间检查暂停状态
      if (window.simplifiedExecutionControl) {
        await window.simplifiedExecutionControl.checkPause();
      }
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.min(100, step.operationDelay - (Date.now() - delayStartTime))
        )
      );
    }
    console.log(`🔧 [DEBUG] 容器操作延迟完成`);
  }
}

async function executeParentLoopAction(element, step) {
  console.log("🔧 [DEBUG] executeParentLoopAction 开始执行");

  // 在执行具体操作前检查暂停状态
  if (window.simplifiedExecutionControl) {
    await window.simplifiedExecutionControl.checkPause();
  }

  console.log(`🎯 开始处理父级元素`);

  // 1. 点击父级元素
  console.log(`🔧 [DEBUG] 准备点击父级元素`);
  element.click();
  console.log(`👆 已点击父级元素`);

  // 2. 等待页面响应
  if (step.waitAfterClick) {
    console.log(`⏳ 等待页面响应 ${step.waitAfterClick}ms`);
    await new Promise((resolve) => setTimeout(resolve, step.waitAfterClick));
  }

  // 3. 执行子操作序列
  if (step.subOperations && step.subOperations.length > 0) {
    console.log(`🔧 开始执行 ${step.subOperations.length} 个子操作`);

    for (let i = 0; i < step.subOperations.length; i++) {
      const subOp = step.subOperations[i];
      console.log(
        `🎯 执行子操作 ${i + 1}: ${subOp.type} - ${subOp.locator?.value || subOp.locator
        }`
      );

      try {
        // 传递父级元素上下文给子操作
        await executeSubOperation(subOp, element);
      } catch (error) {
        console.error(`❌ 子操作 ${i + 1} 失败:`, error);
        if (step.errorHandling === "stop") {
          throw error;
        }
      }

      // 子操作间等待
      if (subOp.delay) {
        await new Promise((resolve) => setTimeout(resolve, subOp.delay));
      }
    }

    console.log(`✅ 所有子操作执行完成`);
  }
}

async function executeSubOperation(operation, parentElement = null) {
  console.log(`🔍 执行子操作: ${operation.type}`, operation.locator);

  switch (operation.type) {
    case "click":
      let clickElement;
      if (parentElement) {
        console.log(
          `🔧 [DEBUG] 尝试在父级元素内查找: ${operation.locator.strategy}=${operation.locator.value}`
        );
        console.log(
          `🔧 [DEBUG] 父级容器信息: ${parentElement.tagName}.${parentElement.className}`
        );

        // 对于容器循环，需要找到正确的表格行容器
        let containerElement = parentElement;
        if (parentElement.tagName === "BUTTON") {
          // 如果父级元素是按钮，需要向上查找到表格行
          containerElement =
            parentElement.closest("tr") ||
            parentElement.closest(".core-table-tr");
          console.log(
            `🔧 [DEBUG] 按钮父级，向上查找表格行容器: ${containerElement
              ? containerElement.tagName + "." + containerElement.className
              : "未找到"
            }`
          );
        }

        // 尝试在容器元素内查找，支持多种选择器策略
        try {
          switch (operation.locator.strategy) {
            case "css":
              clickElement = containerElement
                ? containerElement.querySelector(operation.locator.value)
                : parentElement.querySelector(operation.locator.value);
              break;
            case "id":
              // 对于ID选择器，在父级元素内查找
              clickElement = parentElement.querySelector(
                `#${operation.locator.value}`
              );
              break;
            case "xpath":
              // 对于XPath，需要在父级元素的上下文中执行
              const xpathResult = document.evaluate(
                operation.locator.value,
                parentElement,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              );
              clickElement = xpathResult.singleNodeValue;
              break;
            case "text":
              // 在父级元素内查找包含特定文本的元素
              const textElements = parentElement.querySelectorAll("*");
              for (const el of textElements) {
                if (
                  el.textContent &&
                  el.textContent.trim() === operation.locator.value.trim()
                ) {
                  clickElement = el;
                  break;
                }
              }
              break;
            case "contains":
              // 在父级元素内查找包含文本的元素
              const containsElements = parentElement.querySelectorAll("*");
              for (const el of containsElements) {
                if (
                  el.textContent &&
                  el.textContent.includes(operation.locator.value)
                ) {
                  clickElement = el;
                  break;
                }
              }
              break;
          }

          if (clickElement) {
            console.log(
              `🎯 在父级元素内找到目标: ${operation.locator.strategy}=${operation.locator.value}`
            );
          } else {
            console.log(`🔍 在父级元素内未找到，尝试全局查找`);
          }
        } catch (error) {
          console.warn(`🔧 [DEBUG] 父级元素内查找失败:`, error);
        }
      }

      // 如果在父级元素内没找到，或者没有父级元素，则进行全局查找
      if (!clickElement) {
        console.log(
          `🌐 使用全局查找: ${operation.locator.strategy}=${operation.locator.value}`
        );
        clickElement = await window.ContentCore.findElementByStrategy(
          operation.locator.strategy,
          operation.locator.value
        );
      }

      if (!clickElement) {
        throw new Error(
          `找不到点击目标元素: ${operation.locator.strategy}=${operation.locator.value}`
        );
      }

      // 高亮显示找到的元素
      window.ContentCore.highlightElement(clickElement, "click");

      // 滚动到元素位置
      clickElement.scrollIntoView({ behavior: "smooth", block: "center" });
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 执行点击
      clickElement.click();
      console.log(`👆 子操作-点击完成: ${operation.locator.value}`);

      // 清除高亮
      setTimeout(() => {
        window.ContentCore.clearElementHighlight(clickElement);
      }, 1000);

      break;

    case "input":
      let inputElement;
      if (parentElement && operation.locator?.strategy === "css") {
        // 只有CSS选择器才能在父级元素内查找
        inputElement = parentElement.querySelector(operation.locator.value);
        if (!inputElement) {
          inputElement = await window.ContentCore.findElementByStrategy(
            operation.locator.strategy,
            operation.locator.value
          );
        }
      } else {
        inputElement = await window.ContentCore.findElementByStrategy(
          operation.locator.strategy,
          operation.locator.value
        );
      }
      inputElement.value = operation.text || "";
      inputElement.dispatchEvent(new Event("input", { bubbles: true }));
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
      console.log(`⌨️ 子操作-输入: "${operation.text}"`);
      break;

    case "wait":
      const duration = operation.duration || 1000;
      console.log(`⏱️ 子操作-等待: ${duration}ms`);
      await new Promise((resolve) => setTimeout(resolve, duration));
      break;

    case "waitForElement":
      console.log(`🔍 子操作-等待元素: ${operation.locator.value}`);
      const timeout = operation.timeout || 30000;
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        try {
          const waitElement = await window.ContentCore.findElementByStrategy(
            operation.locator.strategy,
            operation.locator.value,
            100
          );
          if (waitElement) {
            console.log(`✅ 元素已出现: ${operation.locator.value}`);
            break;
          }
        } catch (error) {
          // 继续等待
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      break;

    case "check":
      let checkElement;
      if (parentElement && operation.locator?.strategy === "css") {
        checkElement = parentElement.querySelector(operation.locator.value);
        if (!checkElement) {
          checkElement = await window.ContentCore.findElementByStrategy(
            operation.locator.strategy,
            operation.locator.value
          );
        }
      } else {
        checkElement = await window.ContentCore.findElementByStrategy(
          operation.locator.strategy,
          operation.locator.value
        );
      }
      if (!checkElement.checked) {
        checkElement.checked = true;
        checkElement.dispatchEvent(new Event("change", { bubbles: true }));
        console.log(`☑️ 子操作-勾选复选框`);
      }
      break;

    case "select":
      let selectElement;
      if (parentElement && operation.locator?.strategy === "css") {
        selectElement = parentElement.querySelector(operation.locator.value);
        if (!selectElement) {
          selectElement = await window.ContentCore.findElementByStrategy(
            operation.locator.strategy,
            operation.locator.value
          );
        }
      } else {
        selectElement = await window.ContentCore.findElementByStrategy(
          operation.locator.strategy,
          operation.locator.value
        );
      }
      selectElement.value = operation.value || "";
      selectElement.dispatchEvent(new Event("change", { bubbles: true }));
      console.log(`📋 子操作-选择选项: ${operation.value}`);
      break;

    case "autoLoop":
      console.log(`🔁 子操作-自循环开始: ${operation.locator.value}`);
      await executeSubOperationAutoLoop(operation, parentElement);
      break;

    case "loop":
      console.log(`🔁 子操作-循环开始: ${operation.locator.value}`);
      if (
        operation.loopType === "self" ||
        operation.loopType === "simpleLoop"
      ) {
        // 自循环，等同于autoLoop
        await executeSubOperationAutoLoop(operation, parentElement);
      } else {
        // 其他循环类型，递归调用executeLoopStep
        await executeLoopStep(operation);
      }
      break;

    case "drag":
      console.log(`🖱️ 子操作-拖拽开始: ${operation.locator.value}`);
      let dragElement;
      if (parentElement && operation.locator?.strategy === "css") {
        // 首先尝试在父级元素内查找
        console.log(`🔍 在父级容器内查找拖拽元素: ${operation.locator.value}`);
        console.log(
          `🔍 父级容器信息: ${parentElement.tagName}.${parentElement.className}`
        );

        // 对于容器循环，需要找到正确的表格行容器
        let containerElement = parentElement;
        if (parentElement.tagName === "BUTTON") {
          // 如果父级元素是按钮，需要向上查找到表格行
          containerElement =
            parentElement.closest("tr") ||
            parentElement.closest(".core-table-tr");
          console.log(
            `🔍 按钮父级，向上查找表格行容器: ${containerElement
              ? containerElement.tagName + "." + containerElement.className
              : "未找到"
            }`
          );
        }

        if (containerElement) {
          dragElement = containerElement.querySelector(operation.locator.value);
          if (dragElement) {
            console.log(
              `🔍 在容器内找到拖拽目标: ${dragElement.id || dragElement.className
              }`
            );
          } else {
            console.log(`🔍 在容器内未找到拖拽目标，使用全局查找`);
            dragElement = await window.ContentCore.findElementByStrategy(
              operation.locator.strategy,
              operation.locator.value
            );
          }
        } else {
          console.log(`🔍 未找到有效容器，使用全局查找`);
          dragElement = await window.ContentCore.findElementByStrategy(
            operation.locator.strategy,
            operation.locator.value
          );
        }
      } else {
        dragElement = await window.ContentCore.findElementByStrategy(
          operation.locator.strategy,
          operation.locator.value
        );
      }

      if (!dragElement) {
        throw new Error(`未找到拖拽目标元素: ${operation.locator.value}`);
      }

      // 执行拖拽操作
      const rect = dragElement.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const endX = startX + (operation.horizontalDistance || 0);
      const endY = startY + (operation.verticalDistance || 0);

      console.log(
        `🖱️ 拖拽详情: 从(${startX}, ${startY}) 到 (${endX}, ${endY}), 距离: ${operation.horizontalDistance || 0
        }px, ${operation.verticalDistance || 0}px`
      );

      // 更新状态反馈 - 拖拽开始
      if (window.updateStatus) {
        window.updateStatus(
          `🖱️ 开始拖拽: ${dragElement.id || "拖拽元素"} (${operation.horizontalDistance || 0
          }px, ${operation.verticalDistance || 0}px)`,
          "info"
        );
      }

      // 添加拖拽前的视觉高亮
      const originalStyle = dragElement.style.cssText;
      dragElement.style.border = "3px solid #ff6b6b";
      dragElement.style.boxShadow = "0 0 10px rgba(255, 107, 107, 0.5)";

      // 检查是否是HTML5拖拽元素
      if (dragElement.draggable) {
        console.log("🖱️ 检测到HTML5拖拽元素，使用增强拖拽方法");
        await performEnhancedDragOperation(
          dragElement,
          startX,
          startY,
          endX,
          endY,
          {
            dragSpeed: operation.dragSpeed || 100,
            waitAfterDrag: operation.waitAfterDrag || 1000,
          }
        );
      } else {
        console.log("🖱️ 使用标准鼠标事件拖拽");
        await performDragOperation(dragElement, startX, startY, endX, endY, {
          dragSpeed: operation.dragSpeed || 100,
          waitAfterDrag: operation.waitAfterDrag || 1000,
        });
      }

      // 恢复原始样式
      dragElement.style.cssText = originalStyle;

      // 更新状态反馈 - 拖拽完成
      if (window.updateStatus) {
        window.updateStatus(
          `✅ 拖拽完成: ${dragElement.id || "拖拽元素"}`,
          "success"
        );
      }
      console.log(`✅ 子操作-拖拽完成`);
      break;

    default:
      throw new Error(`不支持的子操作类型: ${operation.type}`);
  }
}

// 执行子操作中的自循环
async function executeSubOperationAutoLoop(operation, parentElement = null) {
  console.log(`🔁 开始执行子操作自循环: ${operation.locator.value}`);

  // 查找所有匹配的元素
  let elements;
  if (parentElement && operation.locator?.strategy === "css") {
    // 只有CSS选择器才能在父级元素内查找
    elements = Array.from(
      parentElement.querySelectorAll(operation.locator.value)
    );
    if (elements.length === 0) {
      // 如果在父级元素内找不到，尝试全局查找
      elements = await window.ContentCore.findElementsByStrategy(
        operation.locator.strategy,
        operation.locator.value
      );
      console.log(`🔍 在父级元素内未找到，使用全局查找`);
    } else {
      console.log(`🔍 在父级元素内找到 ${elements.length} 个目标`);
    }
  } else {
    // 对于非CSS选择器或没有父级元素的情况，直接全局查找
    elements = await window.ContentCore.findElementsByStrategy(
      operation.locator.strategy,
      operation.locator.value
    );
  }

  if (elements.length === 0) {
    throw new Error(`自循环未找到匹配元素: ${operation.locator.value}`);
  }

  // 计算处理范围
  const startIndex = operation.startIndex || 0;
  const endIndex =
    operation.endIndex === -1
      ? elements.length - 1
      : operation.endIndex || elements.length - 1;
  const actualEndIndex = Math.min(endIndex, elements.length - 1);

  console.log(
    `📊 自循环找到 ${elements.length} 个元素，处理范围: ${startIndex} - ${actualEndIndex}`
  );

  // 获取操作类型和配置
  const actionType = operation.actionType || operation.operationType || "click";
  const actionDelay = operation.actionDelay || operation.operationDelay || 200;
  const errorHandling = operation.errorHandling || "continue";

  // 依次处理每个元素
  let successCount = 0;
  let errorCount = 0;

  for (let i = startIndex; i <= actualEndIndex; i++) {
    console.log(`🎯 自循环处理第 ${i + 1}/${actualEndIndex + 1} 个元素`);

    try {
      const element = elements[i];

      // 添加绿色执行进度高亮
      window.ContentCore.highlightExecutionProgress(element);

      await executeAutoLoopAction(element, operation, actionType);
      successCount++;

      console.log(`✅ 第 ${i + 1} 个元素${actionType}操作完成`);

      // 操作间隔
      if (actionDelay > 0 && i < actualEndIndex) {
        await new Promise((resolve) => setTimeout(resolve, actionDelay));
      }

      // 清除执行进度高亮
      window.ContentCore.clearExecutionProgress(element);
    } catch (error) {
      errorCount++;

      const element = elements[i];
      console.error(`❌ 第 ${i + 1} 个元素操作失败:`, error);

      // 清除执行进度高亮（即使失败也要清除）
      window.ContentCore.clearExecutionProgress(element);

      if (errorHandling === "stop") {
        throw new Error(`自循环在第 ${i + 1} 个元素处停止: ${error.message}`);
      }
      // 继续处理下一个元素
    }
  }

  console.log(
    `🎉 自循环执行完成: 成功 ${successCount} 个，失败 ${errorCount} 个`
  );
}

// 执行自循环中的单个元素操作
async function executeAutoLoopAction(element, operation, actionType) {
  switch (actionType) {
    case "click":
      element.click();
      break;

    case "input":
      const inputText = operation.inputText || "";
      element.value = inputText;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      break;

    case "check":
      if (element.type === "checkbox" && !element.checked) {
        element.checked = true;
        element.dispatchEvent(new Event("change", { bubbles: true }));
        console.log(`☑️ 勾选复选框: ${element.id || element.name || "未命名"}`);
      } else if (element.type === "checkbox") {
        console.log(
          `ℹ️ 复选框已勾选: ${element.id || element.name || "未命名"}`
        );
      } else {
        throw new Error("check操作只能用于checkbox元素");
      }
      break;

    case "uncheck":
      if (element.type === "checkbox" && element.checked) {
        element.checked = false;
        element.dispatchEvent(new Event("change", { bubbles: true }));
        console.log(
          `☐ 取消勾选复选框: ${element.id || element.name || "未命名"}`
        );
      } else if (element.type === "checkbox") {
        console.log(
          `ℹ️ 复选框已取消勾选: ${element.id || element.name || "未命名"}`
        );
      } else {
        throw new Error("uncheck操作只能用于checkbox元素");
      }
      break;

    case "hover":
      element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      break;

    case "focus":
      element.focus();
      break;

    default:
      throw new Error(`不支持的自循环操作类型: ${actionType}`);
  }
}

// 查找单个元素（用于条件判断）
function findSingleElement(strategy, value) {
  try {
    switch (strategy) {
      case "css":
        return document.querySelector(value);
      case "xpath":
        const xpathResult = document.evaluate(
          value,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        return xpathResult.singleNodeValue;
      case "id":
        return document.getElementById(value);
      case "className":
        const elements = document.getElementsByClassName(value);
        return elements.length > 0 ? elements[0] : null;
      case "text":
        return Array.from(document.querySelectorAll("*")).find(
          (el) => el.textContent && el.textContent.trim() === value.trim()
        );
      case "contains":
        return Array.from(document.querySelectorAll("*")).find(
          (el) => el.textContent && el.textContent.includes(value)
        );
      case "tagName":
        const tagElements = document.getElementsByTagName(value);
        return tagElements.length > 0 ? tagElements[0] : null;
      default:
        throw new Error(`不支持的定位策略: ${strategy}`);
    }
  } catch (error) {
    console.error(`查找元素失败 (${strategy}: ${value}):`, error);
    return null;
  }
}

// 导出自动化功能到全局作用域
window.ContentAutomation = {
  executeUniversalWorkflow,
  executeClickStep,
  executeInputStep,
  executeWaitStep,
  executeSmartWaitStep,
  executeDragStep,
  executeConditionStep,
  executeLoopStep,
  executeSimpleLoopAction,
  executeContainerLoopAction,
  executeParentLoopAction,
  executeSubOperation,
  executeSubOperationAutoLoop,
  executeAutoLoopAction,
  findSingleElement,
};

console.log("✅ Content Automation 模块已加载");
