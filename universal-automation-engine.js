/**
 * 通用自动化操作引擎
 * 支持基本的循环和各种操作类型
 */

console.log('📦 universal-automation-engine.js 脚本开始执行');

// 直接定义类，不做重复检查
console.log('🔄 开始定义 UniversalAutomationEngine 类...');

class UniversalAutomationEngine {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.pausePromise = null;
        this.pauseResolve = null;
        this.currentExecution = null;
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
        this.onLog = null;
        this.executionStats = {
            totalSteps: 0,
            completedSteps: 0,
            successCount: 0,
            errorCount: 0,
            startTime: null,
            endTime: null,
            currentMainLoop: 0,
            totalMainLoops: 0,
            currentSubOperation: 0,
            totalSubOperations: 0,
            currentOperation: '等待执行...'
        };
    }

    /**
     * 暂停执行
     */
    pause() {
        console.log('🔧 [DEBUG] 高级引擎 pause() 被调用');
        console.log('🔧 [DEBUG] 高级引擎当前状态:', {
            isRunning: this.isRunning,
            isPaused: this.isPaused
        });
        if (this.isRunning && !this.isPaused) {
            this.isPaused = true;
            console.log('🔧 [DEBUG] 高级引擎暂停状态设置为:', this.isPaused);
            this.log('⏸️ 执行已暂停', 'warning');
            this.updateProgress({
                isPaused: true,
                currentOperation: '执行已暂停'
            });
            console.log('🔧 [DEBUG] 高级引擎暂停设置完成');
        } else {
            console.log('🔧 [DEBUG] 高级引擎暂停条件不满足，跳过暂停');
        }
    }

    /**
     * 继续执行
     */
    resume() {
        console.log('🔧 [DEBUG] 高级引擎 resume() 被调用');
        console.log('🔧 [DEBUG] 高级引擎当前状态:', {
            isRunning: this.isRunning,
            isPaused: this.isPaused
        });
        if (this.isRunning && this.isPaused) {
            this.isPaused = false;
            console.log('🔧 [DEBUG] 高级引擎暂停状态设置为:', this.isPaused);
            this.log('▶️ 继续执行', 'info');
            this.updateProgress({
                isPaused: false,
                currentOperation: '继续执行中...'
            });
            if (this.pauseResolve) {
                console.log('🔧 [DEBUG] 高级引擎解决暂停Promise');
                this.pauseResolve();
                this.pauseResolve = null;
                this.pausePromise = null;
                console.log('🔧 [DEBUG] 高级引擎暂停Promise已清理');
            }
            console.log('🔧 [DEBUG] 高级引擎继续设置完成');
        } else {
            console.log('🔧 [DEBUG] 高级引擎继续条件不满足，跳过继续');
        }
    }

    /**
     * 检查是否需要暂停，如果需要则等待继续
     */
    async checkPause() {
        console.log('🔧 [DEBUG] 高级引擎 checkPause 被调用，当前暂停状态:', this.isPaused);
        if (this.isPaused) {
            console.log('🔧 [DEBUG] 高级引擎检测到暂停状态，开始等待...');
            if (!this.pausePromise) {
                console.log('🔧 [DEBUG] 高级引擎创建新的暂停Promise');
                this.pausePromise = new Promise(resolve => {
                    this.pauseResolve = resolve;
                });
            }
            console.log('🔧 [DEBUG] 高级引擎等待暂停Promise解决...');
            await this.pausePromise;
            console.log('🔧 [DEBUG] 高级引擎暂停Promise已解决，继续执行');
        }
    }

    /**
     * 执行自动化流程
     * @param {Object} workflow - 工作流配置
     */
    async execute(workflow) {
        if (this.isRunning) {
            throw new Error('自动化引擎正在运行中');
        }

        this.isRunning = true;
        this.isPaused = false;
        this.resetStats();
        this.executionStats.startTime = new Date();

        try {
            this.log('🚀 开始执行通用自动化流程', 'info');
            this.log(`📋 工作流: ${workflow.name || '未命名工作流'}`, 'info');

            // 计算总步骤数
            this.executionStats.totalSteps = this.calculateTotalSteps(workflow.steps);
            this.log(`📊 预计执行 ${this.executionStats.totalSteps} 个步骤`, 'info');

            // 初始化进度
            this.updateProgress({
                isRunning: true,
                isPaused: false,
                startTime: this.executionStats.startTime,
                totalSteps: this.executionStats.totalSteps,
                completedSteps: 0,
                currentOperation: '开始执行工作流...'
            });

            // 执行工作流步骤
            await this.executeSteps(workflow.steps, []);

            this.executionStats.endTime = new Date();
            const duration = (this.executionStats.endTime - this.executionStats.startTime) / 1000;
            
            this.log(`🎉 自动化流程执行完成！`, 'success');
            this.log(`📊 统计: 成功 ${this.executionStats.successCount}, 失败 ${this.executionStats.errorCount}, 耗时 ${duration.toFixed(1)}秒`, 'info');

            if (this.onComplete) {
                this.onComplete(this.executionStats);
            }

        } catch (error) {
            this.executionStats.endTime = new Date();
            this.log(`💥 自动化流程执行失败: ${error.message}`, 'error');
            
            if (this.onError) {
                this.onError(error);
            }
        } finally {
            this.isRunning = false;
            this.isPaused = false;
            this.pausePromise = null;
            this.pauseResolve = null;

            // 更新最终状态
            this.updateProgress({
                isRunning: false,
                isPaused: false,
                currentOperation: '执行完成'
            });
        }
    }

    /**
     * 停止执行
     */
    stop() {
        this.isRunning = false;
        this.log('🛑 正在停止自动化执行...', 'warning');
    }

    /**
     * 执行步骤序列
     * @param {Array} steps - 步骤数组
     * @param {Array} loopContext - 循环上下文
     */
    async executeSteps(steps, loopContext = []) {
        for (let i = 0; i < steps.length; i++) {
            if (!this.isRunning) {
                throw new Error('执行已被停止');
            }

            // 检查是否需要暂停
            await this.checkPause();

            const step = steps[i];
            const stepContext = [...loopContext, i];

            // 更新当前操作
            this.updateProgress({
                currentOperation: `执行步骤: ${step.name || step.type}`
            });

            try {
                await this.executeStep(step, stepContext);
                this.executionStats.successCount++;
                this.executionStats.completedSteps++;

                // 更新进度
                this.updateProgress({
                    completedSteps: this.executionStats.completedSteps
                });
            } catch (error) {
                this.executionStats.errorCount++;
                this.log(`❌ 步骤执行失败: ${error.message}`, 'error');
                
                // 根据错误处理策略决定是否继续
                if (step.errorHandling === 'stop') {
                    throw error;
                } else if (step.errorHandling === 'skip') {
                    this.log(`⏭️ 跳过当前步骤，继续执行`, 'warning');
                    continue;
                }
                // 默认继续执行
            }

            this.executionStats.completedSteps++;
            this.reportProgress();
        }
    }

    /**
     * 执行单个步骤
     * @param {Object} step - 步骤配置
     * @param {Array} context - 执行上下文
     */
    async executeStep(step, context) {
        // 在执行每个步骤前检查暂停状态
        await this.checkPause();

        const stepName = step.name || `步骤${context.join('.')}`;
        this.log(`🎯 执行 ${stepName}: ${step.type}`, 'info');

        switch (step.type) {
            case 'click':
                await this.executeClickStep(step);
                break;
            case 'input':
                await this.executeInputStep(step);
                break;
            case 'wait':
                await this.executeWaitStep(step);
                break;
            case 'smartWait':
                await this.executeSmartWaitStep(step);
                break;
            case 'loop':
                await this.executeGenericLoopStep(step, context);
                break;

            case 'custom':
                await this.executeCustomStep(step);
                break;
            default:
                throw new Error(`不支持的步骤类型: ${step.type}`);
        }

        // 步骤后等待
        if (step.postDelay) {
            await this.sleep(step.postDelay);
        }
    }

    /**
     * 执行点击步骤
     */
    async executeClickStep(step) {
        console.log('🔧 [DEBUG] 高级引擎 executeClickStep 开始执行');

        // 在执行具体操作前检查暂停状态
        await this.checkPause();

        console.log('🔧 [DEBUG] 高级引擎查找元素:', step.locator.value);
        const element = await this.findElement(step.locator);

        console.log('🔧 [DEBUG] 高级引擎准备点击元素');
        await this.clickElement(element);
        this.log(`👆 已点击元素: ${step.locator.value}`, 'success');
    }

    /**
     * 执行输入步骤
     */
    async executeInputStep(step) {
        console.log('🔧 [DEBUG] 高级引擎 executeInputStep 开始执行');

        // 在执行具体操作前检查暂停状态
        await this.checkPause();

        console.log('🔧 [DEBUG] 高级引擎查找输入元素:', step.locator.value);
        const element = await this.findElement(step.locator);

        // 清空现有内容
        if (step.clearFirst) {
            element.value = '';
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }

        console.log('🔧 [DEBUG] 高级引擎准备输入文本:', step.text);
        // 输入文本
        element.value = step.text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        this.log(`⌨️ 已输入文本: "${step.text}"`, 'success');
    }

    /**
     * 执行等待步骤
     */
    async executeWaitStep(step) {
        console.log('🔧 [DEBUG] 高级引擎 executeWaitStep 开始执行');

        // 在执行具体操作前检查暂停状态
        await this.checkPause();

        const duration = step.duration || 1000;
        this.log(`⏱️ 等待 ${duration}ms`, 'info');

        // 使用支持暂停的等待方法
        await this.sleepWithPauseCheck(duration);
    }

    /**
     * 执行智能等待步骤
     */
    async executeSmartWaitStep(step) {
        console.log('🔧 [DEBUG] 高级引擎 executeSmartWaitStep 开始执行');

        // 在执行具体操作前检查暂停状态
        await this.checkPause();

        const timeout = step.timeout || 30000;
        const interval = step.interval || 500;
        const description = step.description || '元素出现';

        this.log(`🔍 智能等待: ${description} (最大${timeout/1000}秒)`, 'info');

        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (!this.isRunning) {
                throw new Error('执行已被停止');
            }

            // 在等待循环中检查暂停状态
            await this.checkPause();

            try {
                const element = await this.findElement(step.locator);
                if (element) {
                    this.log(`✅ ${description} - 等待完成`, 'success');
                    return element;
                }
            } catch (error) {
                // 继续等待
            }

            await this.sleepWithPauseCheck(interval);
        }

        throw new Error(`${description} - 等待超时 (${timeout/1000}秒)`);
    }

    /**
     * 执行循环步骤
     */
    async executeGenericLoopStep(step, context) {
        const loopName = step.name || `循环${context.join('.')}`;

        // 映射设计器的循环类型到执行引擎的类型
        let loopType = step.loopType || 'parentLoop';
        if (loopType === 'self') {
            loopType = 'simpleLoop';
        } else if (loopType === 'container') {
            loopType = 'parentLoop';
        }

        this.log(`🔄 开始执行${loopType === 'simpleLoop' ? '简单' : '父级'}循环: ${loopName}`, 'info');
        console.log('🔍 [DEBUG] 循环类型映射:', {
            originalType: step.loopType,
            mappedType: loopType
        });

        console.log('🔍 [DEBUG] 完整step对象:', {
            name: step.name,
            type: step.type,
            loopType: step.loopType,
            operationDelay: step.operationDelay,
            actionDelay: step.actionDelay,
            loopDelay: step.loopDelay,
            isVirtualList: step.isVirtualList,
            locator: step.locator,
            subOperations: step.subOperations?.length || 0,
            allKeys: Object.keys(step)
        });

        // 检查是否为虚拟列表模式
        console.log('🔍 [DEBUG] 检查虚拟列表模式:', {
            isVirtualList: step.isVirtualList,
            stepType: typeof step.isVirtualList,
            stepKeys: Object.keys(step),
            virtualListContainer: step.virtualListContainer,
            virtualListTitleLocator: step.virtualListTitleLocator
        });

        if (step.isVirtualList) {
            this.log(`📜 检测到虚拟列表模式，开始智能遍历`, 'info');
            console.log('🔍 [DEBUG] 虚拟列表配置:', {
                container: step.virtualListContainer,
                titleLocator: step.virtualListTitleLocator,
                scrollDistance: step.virtualListScrollDistance,
                waitTime: step.virtualListWaitTime,
                maxRetries: step.virtualListMaxRetries
            });
            await this.executeVirtualListLoop(step, context);
            return;
        } else {
            console.log('🔍 [DEBUG] 未检测到虚拟列表模式，使用普通循环');
        }

        // 获取目标元素
        const elements = await this.findElements(step.locator);
        if (elements.length === 0) {
            throw new Error(`未找到循环元素: ${step.locator.value}`);
        }

        // 计算循环范围
        const startIndex = step.startIndex || 0;
        const endIndex = step.endIndex === -1 ? elements.length - 1 : (step.endIndex || elements.length - 1);
        const actualEndIndex = Math.min(endIndex, elements.length - 1);

        this.log(`📊 找到 ${elements.length} 个元素，处理范围: ${startIndex} - ${actualEndIndex}`, 'info');

        // 更新主循环总数
        const totalMainLoops = actualEndIndex - startIndex + 1;
        this.updateProgress({
            totalMainLoops: totalMainLoops,
            currentMainLoop: 0
        });

        // 执行循环
        for (let i = startIndex; i <= actualEndIndex; i++) {
            if (!this.isRunning) {
                throw new Error('执行已被停止');
            }

            // 检查是否需要暂停
            await this.checkPause();

            const currentLoop = i - startIndex + 1;
            this.log(`🎯 处理第 ${i + 1} 个元素 (${currentLoop}/${totalMainLoops})`, 'info');

            // 更新主循环进度
            this.updateProgress({
                currentMainLoop: currentLoop,
                currentOperation: `处理第 ${currentLoop}/${totalMainLoops} 个主循环元素`
            });

            try {
                const element = elements[i];

                if (loopType === 'simpleLoop') {
                    // Type B: 简单元素循环
                    console.log('🔍 [DEBUG] 执行简单循环操作');
                    await this.executeSimpleLoopAction(element, step);
                    console.log('🔍 [DEBUG] 简单循环操作完成');
                } else if (loopType === 'parentLoop') {
                    // Type A: 父级循环（带子操作）
                    console.log('🔍 [DEBUG] 执行父级循环操作');
                    await this.executeParentLoopWithSubOperations(element, step);
                    console.log('🔍 [DEBUG] 父级循环操作完成');
                } else {
                    console.log('🔍 [DEBUG] 未知的循环类型:', loopType);
                }

            } catch (error) {
                this.log(`❌ 第 ${i + 1} 个元素处理失败: ${error.message}`, 'error');

                if (step.errorHandling === 'stop') {
                    throw error;
                } else {
                    this.log(`⚠️ 跳过错误，继续处理下一个元素`, 'warning');
                    continue;
                }
            }
        }

        this.log(`✅ 循环执行完成，共处理 ${actualEndIndex - startIndex + 1} 个元素`, 'success');
    }





    /**
     * 执行父级循环（Type A - Parent Loop with Sub-operations）
     * 每个父元素包含多个子操作，按顺序执行
     */
    async executeParentLoop(step, context) {
        // 查找父级元素
        const parentElements = await this.findElements(step.locator);
        const totalElements = parentElements.length;

        if (totalElements === 0) {
            throw new Error(`父级循环目标元素未找到: ${step.locator.value}`);
        }

        this.log(`📋 找到 ${totalElements} 个父级元素`, 'info');

        // 计算循环范围
        const startIndex = Math.max(0, step.startIndex || 0);
        const endIndex = step.endIndex >= 0 ? Math.min(step.endIndex, totalElements - 1) : totalElements - 1;
        const skipIndices = step.skipIndices || [];

        this.log(`🎯 父级循环范围: ${startIndex} 到 ${endIndex}`, 'info');

        // 执行父级循环
        for (let i = startIndex; i <= endIndex; i++) {
            if (!this.isRunning) {
                throw new Error('执行已被停止');
            }

            if (skipIndices.includes(i)) {
                this.log(`⏭️ 跳过父级元素索引 ${i}`, 'info');
                continue;
            }

            this.log(`🎯 处理第 ${i + 1}/${totalElements} 个父级元素`, 'info');

            try {
                // 点击父级元素（如产品卡片）
                await this.clickElement(parentElements[i]);
                this.log(`✅ 已点击第 ${i + 1} 个父级元素`, 'info');

                // 等待页面加载/弹窗出现
                if (step.waitAfterClick) {
                    await this.sleep(step.waitAfterClick);
                }

                // 执行子操作序列
                if (step.steps && step.steps.length > 0) {
                    this.log(`🔧 开始执行第 ${i + 1} 个父级元素的子操作`, 'info');
                    await this.executeSteps(step.steps, [...context, 'parentLoop', i]);
                    this.log(`✅ 第 ${i + 1} 个父级元素的子操作执行完成`, 'success');
                }

                // 返回操作（如果配置了返回步骤）
                if (step.returnSteps && step.returnSteps.length > 0) {
                    this.log(`🔙 执行返回操作`, 'info');
                    await this.executeSteps(step.returnSteps, [...context, 'return', i]);
                }

                this.log(`✅ 第 ${i + 1} 个父级元素处理完成`, 'success');

            } catch (error) {
                this.log(`❌ 第 ${i + 1} 个父级元素处理失败: ${error.message}`, 'error');

                if (step.errorHandling === 'stop') {
                    throw error;
                }
                // 继续下一个父级元素
            }

            // 循环间隔
            const delay = step.loopDelay || step.operationDelay;
            if (delay && i < endIndex) {
                await this.sleep(delay);
            }
        }
    }

    /**
     * 执行简单循环（Type B - Simple Element Loop）
     * 对多个元素执行相同的单一操作
     */
    async executeSimpleLoop(step) {
        // 查找目标元素
        const elements = await this.findElements(step.locator);
        const totalElements = elements.length;

        if (totalElements === 0) {
            throw new Error(`简单循环目标元素未找到: ${step.locator.value}`);
        }

        this.log(`📋 找到 ${totalElements} 个目标元素`, 'info');

        // 计算循环范围
        const startIndex = Math.max(0, step.startIndex || 0);
        const endIndex = step.endIndex >= 0 ? Math.min(step.endIndex, totalElements - 1) : totalElements - 1;
        const skipIndices = step.skipIndices || [];

        this.log(`🎯 简单循环范围: ${startIndex} 到 ${endIndex}`, 'info');

        // 确定要执行的操作类型
        const actionType = step.actionType || 'click'; // 默认为点击
        this.log(`🔧 循环操作类型: ${actionType}`, 'info');

        // 执行简单循环
        for (let i = startIndex; i <= endIndex; i++) {
            if (!this.isRunning) {
                throw new Error('执行已被停止');
            }

            if (skipIndices.includes(i)) {
                this.log(`⏭️ 跳过元素索引 ${i}`, 'info');
                continue;
            }

            this.log(`🎯 处理第 ${i + 1}/${totalElements} 个元素`, 'info');

            try {
                // 执行指定的操作
                switch (actionType) {
                    case 'click':
                        await this.clickElement(elements[i]);
                        break;
                    case 'input':
                        if (step.inputText) {
                            await this.inputText(elements[i], step.inputText);
                        }
                        break;
                    case 'check':
                        if (elements[i].type === 'checkbox' && !elements[i].checked) {
                            await this.clickElement(elements[i]);
                        }
                        break;
                    case 'uncheck':
                        if (elements[i].type === 'checkbox' && elements[i].checked) {
                            await this.clickElement(elements[i]);
                        }
                        break;
                    default:
                        throw new Error(`不支持的简单循环操作类型: ${actionType}`);
                }

                this.log(`✅ 第 ${i + 1} 个元素${actionType}操作完成`, 'success');

            } catch (error) {
                this.log(`❌ 第 ${i + 1} 个元素操作失败: ${error.message}`, 'error');

                if (step.errorHandling === 'stop') {
                    throw error;
                }
                // 继续下一个元素
            }

            // 操作间隔
            const delay = step.actionDelay || step.operationDelay;
            if (delay && i < endIndex) {
                await this.sleep(delay);
            }
        }
    }



    /**
     * 执行自定义步骤
     */
    async executeCustomStep(step) {
        if (typeof step.handler === 'function') {
            await step.handler(this);
            this.log(`🔧 自定义步骤执行完成`, 'success');
        } else {
            throw new Error('自定义步骤缺少处理函数');
        }
    }

    /**
     * 查找单个元素
     */
    async findElement(locator) {
        let element;
        
        switch (locator.strategy) {
            case 'css':
                element = document.querySelector(locator.value);
                break;
            case 'xpath':
                const result = document.evaluate(locator.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                element = result.singleNodeValue;
                break;
            case 'id':
                element = document.getElementById(locator.value);
                break;
            case 'className':
                element = document.getElementsByClassName(locator.value)[0];
                break;
            case 'tagName':
                element = document.getElementsByTagName(locator.value)[0];
                break;
            case 'text':
                // 精确文本匹配，使用遍历方式避免XPath转义问题
                const textElements = Array.from(document.querySelectorAll('*')).filter(el =>
                    el.textContent && el.textContent.trim() === locator.value.trim()
                );
                element = textElements[0] || null;
                break;
            case 'contains':
                // 包含文本匹配，使用遍历方式避免XPath转义问题
                const containsElements = Array.from(document.querySelectorAll('*')).filter(el =>
                    el.textContent && el.textContent.includes(locator.value)
                );
                element = containsElements[0] || null;
                break;
            default:
                throw new Error(`不支持的定位策略: ${locator.strategy}`);
        }

        if (!element) {
            throw new Error(`元素未找到: ${locator.strategy}=${locator.value}`);
        }

        return element;
    }

    /**
     * 查找多个元素
     */
    async findElements(locator) {
        let elements = [];
        
        switch (locator.strategy) {
            case 'css':
                elements = Array.from(document.querySelectorAll(locator.value));
                break;
            case 'xpath':
                const result = document.evaluate(locator.value, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                for (let i = 0; i < result.snapshotLength; i++) {
                    elements.push(result.snapshotItem(i));
                }
                break;
            case 'id':
                const idElement = document.getElementById(locator.value);
                if (idElement) elements = [idElement];
                break;
            case 'className':
                elements = Array.from(document.getElementsByClassName(locator.value));
                break;
            case 'tagName':
                elements = Array.from(document.getElementsByTagName(locator.value));
                break;
            case 'text':
                // 精确文本匹配，使用遍历方式避免XPath转义问题
                elements = Array.from(document.querySelectorAll('*')).filter(el =>
                    el.textContent && el.textContent.trim() === locator.value.trim()
                );
                break;
            case 'contains':
                // 包含文本匹配，使用遍历方式避免XPath转义问题
                elements = Array.from(document.querySelectorAll('*')).filter(el =>
                    el.textContent && el.textContent.includes(locator.value)
                );
                break;
            default:
                throw new Error(`不支持的定位策略: ${locator.strategy}`);
        }

        return elements;
    }

    /**
     * 点击元素
     */
    async clickElement(element) {
        if (!element) {
            throw new Error('元素不存在');
        }

        // 滚动到元素可见
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(300);

        // 触发点击事件
        element.click();
        await this.sleep(200);
    }

    /**
     * 输入文本到元素
     */
    async inputText(element, text) {
        if (!element) {
            throw new Error('元素不存在');
        }

        // 滚动到元素可见
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(300);

        // 清空现有内容
        element.focus();
        element.select();
        await this.sleep(100);

        // 输入文本
        element.value = text;

        // 触发输入事件
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        await this.sleep(200);
    }

    /**
     * 计算总步骤数
     */
    calculateTotalSteps(steps) {
        let total = 0;
        for (const step of steps) {
            total++;
            if (step.type === 'loop' && step.steps) {
                // 估算循环步骤数（假设平均循环3次）
                total += this.calculateTotalSteps(step.steps) * 3;
            }
        }
        return total;
    }

    /**
     * 重置统计信息
     */
    resetStats() {
        this.executionStats = {
            totalSteps: 0,
            completedSteps: 0,
            successCount: 0,
            errorCount: 0,
            startTime: null,
            endTime: null
        };
    }

    /**
     * 报告进度
     */
    reportProgress() {
        if (this.onProgress) {
            this.onProgress({
                ...this.executionStats,
                progress: this.executionStats.totalSteps > 0 ? 
                    (this.executionStats.completedSteps / this.executionStats.totalSteps) * 100 : 0
            });
        }
    }

    /**
     * 日志输出
     */
    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            message,
            level
        };

        console.log(`[${timestamp}] ${message}`);
        
        if (this.onLog) {
            this.onLog(logEntry);
        }
    }

    /**
     * 延迟函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 支持暂停检查的延迟函数
     */
    async sleepWithPauseCheck(ms) {
        console.log(`🔧 [DEBUG] 高级引擎开始等待 ${ms}ms（支持暂停）`);
        const startTime = Date.now();
        while (Date.now() - startTime < ms) {
            // 每100ms检查一次暂停状态
            await this.checkPause();
            const remainingTime = ms - (Date.now() - startTime);
            await this.sleep(Math.min(100, remainingTime));
        }
        console.log(`🔧 [DEBUG] 高级引擎等待完成`);
    }

    /**
     * 执行单个操作 (兼容性方法)
     */
    async performAction(config) {
        this.log(`🎯 执行单个操作: ${config.type || 'unknown'}`);

        try {
            // 创建临时工作流来执行单个操作
            const tempWorkflow = {
                name: 'Single Action',
                steps: [config]
            };

            const result = await this.execute(tempWorkflow);
            this.log(`✅ 单个操作执行成功`);
            return result;

        } catch (error) {
            this.log(`❌ 单个操作执行失败: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 等待元素出现 (兼容性方法)
     */
    async waitForElement(selector, timeout = 30000) {
        this.log(`⏳ 等待元素: ${selector}`);

        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) {
                this.log(`✅ 元素已找到: ${selector}`);
                return element;
            }
            await this.sleep(100);
        }

        const error = new Error(`等待元素超时: ${selector}`);
        this.log(`❌ ${error.message}`, 'error');
        throw error;
    }

    /**
     * 执行简单循环操作 (Type B)
     * 对单个元素执行指定的操作
     */
    async executeSimpleLoopAction(element, step) {
        const actionType = step.actionType || 'click';

        this.log(`🔧 执行简单操作: ${actionType}`, 'info');

        switch (actionType) {
            case 'click':
                await this.clickElement(element);
                this.log(`👆 点击元素`, 'success');
                break;

            case 'input':
                const inputText = step.inputText || '';
                element.value = inputText;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                this.log(`⌨️ 输入文本: "${inputText}"`, 'success');
                break;

            case 'check':
                if (!element.checked) {
                    element.checked = true;
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    this.log(`☑️ 勾选复选框`, 'success');
                } else {
                    this.log(`ℹ️ 复选框已勾选`, 'info');
                }
                break;

            case 'uncheck':
                if (element.checked) {
                    element.checked = false;
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    this.log(`☐ 取消勾选复选框`, 'success');
                } else {
                    this.log(`ℹ️ 复选框已取消勾选`, 'info');
                }
                break;

            case 'hover':
                element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                this.log(`🖱️ 悬停元素`, 'success');
                break;

            case 'focus':
                element.focus();
                this.log(`🎯 聚焦元素`, 'success');
                break;

            default:
                throw new Error(`不支持的简单循环操作类型: ${actionType}`);
        }

        // 操作后等待（简单循环延迟）
        const delay = step.actionDelay || step.operationDelay;
        console.log('🔍 [DEBUG] 简单循环延迟检查:', {
            actionDelay: step.actionDelay,
            operationDelay: step.operationDelay,
            finalDelay: delay
        });

        if (delay) {
            this.log(`⏳ 简单循环延迟 ${delay}ms`, 'info');
            console.log('🔍 [DEBUG] 开始延迟等待...');
            await this.sleep(delay);
            console.log('🔍 [DEBUG] 延迟等待完成');
        } else {
            console.log('🔍 [DEBUG] 没有配置延迟，跳过等待');
        }
    }

    /**
     * 执行父级循环带子操作 (Type A)
     * 点击父级元素后执行配置的子操作序列
     */
    async executeParentLoopWithSubOperations(element, step) {
        this.log(`🎯 开始处理父级元素`, 'info');

        try {
            // 1. 点击父级元素
            await this.clickElement(element);
            this.log(`👆 已点击父级元素`, 'success');

            // 2. 等待页面响应
            if (step.waitAfterClick) {
                this.log(`⏳ 等待页面响应 ${step.waitAfterClick}ms`, 'info');
                await this.sleep(step.waitAfterClick);
            }

            // 3. 执行子操作序列
            if (step.subOperations && step.subOperations.length > 0) {
                this.log(`🔧 开始执行 ${step.subOperations.length} 个子操作`, 'info');

                // 更新子操作总数
                this.updateProgress({
                    totalSubOperations: step.subOperations.length,
                    currentSubOperation: 0
                });

                for (let i = 0; i < step.subOperations.length; i++) {
                    if (!this.isRunning) {
                        throw new Error('执行已被停止');
                    }

                    // 检查是否需要暂停
                    await this.checkPause();

                    const subOp = step.subOperations[i];
                    const currentSubOp = i + 1;
                    this.log(`🎯 执行子操作 ${currentSubOp}: ${subOp.name || subOp.type}`, 'info');

                    // 更新子操作进度
                    this.updateProgress({
                        currentSubOperation: currentSubOp,
                        currentOperation: `执行子操作 ${currentSubOp}/${step.subOperations.length}: ${subOp.name || subOp.type}`
                    });

                    try {
                        await this.executeSubOperation(subOp, element);
                    } catch (error) {
                        this.log(`❌ 子操作 ${currentSubOp} 失败: ${error.message}`, 'error');
                        if (step.errorHandling === 'stop') {
                            throw error;
                        }
                    }

                    // 子操作间等待
                    if (subOp.delay) {
                        await this.sleep(subOp.delay);
                    }
                }

                // 清除子操作进度
                this.updateProgress({
                    totalSubOperations: 0,
                    currentSubOperation: 0
                });

                this.log(`✅ 所有子操作执行完成`, 'success');
            }

            // 4. 执行返回操作（如果配置了）
            if (step.returnOperation) {
                this.log(`🔙 执行返回操作`, 'info');
                await this.executeSubOperation(step.returnOperation);
            }

            // 5. 容器循环延迟（所有子操作完成后）
            const delay = step.loopDelay || step.operationDelay;
            if (delay) {
                this.log(`⏳ 容器循环延迟 ${delay}ms`, 'info');
                await this.sleep(delay);
            }

        } catch (error) {
            this.log(`❌ 父级循环处理失败: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 执行子操作
     * 支持各种类型的自动化操作
     */
    async executeSubOperation(operation, parentElement = null) {
        // 在执行每个子操作前检查暂停状态
        await this.checkPause();

        this.log(`🔍 执行子操作: ${operation.type} - ${operation.locator?.value || '无定位器'}`, 'info');

        switch (operation.type) {
            case 'click':
                let clickElement;
                if (parentElement && operation.locator.strategy === 'css') {
                    // 只有CSS选择器才能在父级元素内查找
                    clickElement = parentElement.querySelector(operation.locator.value);
                    if (!clickElement) {
                        // 如果在父级元素内找不到，尝试全局查找
                        clickElement = await this.findElement(operation.locator);
                        this.log(`🔍 在父级元素内未找到，使用全局查找`, 'warning');
                    } else {
                        this.log(`🔍 在父级元素内找到目标`, 'info');
                    }
                } else {
                    // 对于非CSS选择器或没有父级元素的情况，直接全局查找
                    clickElement = await this.findElement(operation.locator);
                }
                await this.clickElement(clickElement);
                this.log(`👆 子操作-点击: ${operation.locator.value}`, 'success');
                break;

            case 'input':
                let inputElement;
                if (parentElement && operation.locator.strategy === 'css') {
                    // 只有CSS选择器才能在父级元素内查找
                    inputElement = parentElement.querySelector(operation.locator.value);
                    if (!inputElement) {
                        inputElement = await this.findElement(operation.locator);
                    }
                } else {
                    inputElement = await this.findElement(operation.locator);
                }
                inputElement.value = operation.text || '';
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                this.log(`⌨️ 子操作-输入: "${operation.text}"`, 'success');
                break;

            case 'wait':
                const duration = operation.duration || 1000;
                this.log(`⏱️ 子操作-等待: ${duration}ms`, 'info');
                await this.sleep(duration);
                break;

            case 'waitForElement':
                this.log(`🔍 子操作-等待元素: ${operation.locator.value}`, 'info');
                await this.waitForElement(operation.locator, operation.timeout || 30000);
                break;

            case 'check':
                let checkElement;
                if (parentElement && operation.locator.strategy === 'css') {
                    // 只有CSS选择器才能在父级元素内查找
                    checkElement = parentElement.querySelector(operation.locator.value);
                    if (!checkElement) {
                        checkElement = await this.findElement(operation.locator);
                    }
                } else {
                    checkElement = await this.findElement(operation.locator);
                }
                if (!checkElement.checked) {
                    checkElement.checked = true;
                    checkElement.dispatchEvent(new Event('change', { bubbles: true }));
                    this.log(`☑️ 子操作-勾选复选框`, 'success');
                }
                break;

            case 'select':
                let selectElement;
                if (parentElement && operation.locator.strategy === 'css') {
                    // 只有CSS选择器才能在父级元素内查找
                    selectElement = parentElement.querySelector(operation.locator.value);
                    if (!selectElement) {
                        selectElement = await this.findElement(operation.locator);
                    }
                } else {
                    selectElement = await this.findElement(operation.locator);
                }
                selectElement.value = operation.value || '';
                selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                this.log(`📋 子操作-选择选项: ${operation.value}`, 'success');
                break;

            case 'autoLoop':
                this.log(`🔁 子操作-自循环开始: ${operation.locator.value}`, 'info');
                await this.executeSubOperationAutoLoop(operation, parentElement);
                break;

            default:
                throw new Error(`不支持的子操作类型: ${operation.type}`);
        }
    }

    /**
     * 执行子操作中的自循环
     * 找到所有匹配元素并依次执行指定操作
     */
    async executeSubOperationAutoLoop(operation, parentElement = null) {
        this.log(`🔁 开始执行子操作自循环: ${operation.locator.value}`, 'info');

        // 查找所有匹配的元素
        let elements;
        if (parentElement && operation.locator.strategy === 'css') {
            // 只有CSS选择器才能在父级元素内查找
            elements = Array.from(parentElement.querySelectorAll(operation.locator.value));
            if (elements.length === 0) {
                // 如果在父级元素内找不到，尝试全局查找
                elements = await this.findElements(operation.locator);
                this.log(`🔍 在父级元素内未找到，使用全局查找`, 'warning');
            } else {
                this.log(`🔍 在父级元素内找到 ${elements.length} 个目标`, 'info');
            }
        } else {
            // 对于非CSS选择器或没有父级元素的情况，直接全局查找
            elements = await this.findElements(operation.locator);
        }

        if (elements.length === 0) {
            throw new Error(`自循环未找到匹配元素: ${operation.locator.value}`);
        }

        // 计算处理范围
        const startIndex = operation.startIndex || 0;
        const endIndex = operation.endIndex === -1 ? elements.length - 1 : (operation.endIndex || elements.length - 1);
        const actualEndIndex = Math.min(endIndex, elements.length - 1);

        this.log(`📊 自循环找到 ${elements.length} 个元素，处理范围: ${startIndex} - ${actualEndIndex}`, 'info');

        // 获取操作类型和配置
        const actionType = operation.actionType || 'click';
        const actionDelay = operation.actionDelay || 200;
        const errorHandling = operation.errorHandling || 'continue';

        // 依次处理每个元素
        let successCount = 0;
        let errorCount = 0;

        for (let i = startIndex; i <= actualEndIndex; i++) {
            if (!this.isRunning) {
                throw new Error('执行已被停止');
            }

            // 检查是否需要暂停
            await this.checkPause();

            this.log(`🎯 自循环处理第 ${i + 1}/${actualEndIndex + 1} 个元素`, 'info');

            try {
                const element = elements[i];

                // 添加绿色执行进度高亮
                this.highlightExecutionProgress(element);

                await this.executeAutoLoopAction(element, operation, actionType);
                successCount++;

                this.log(`✅ 第 ${i + 1} 个元素${actionType}操作完成`, 'success');

                // 操作间隔
                if (actionDelay > 0 && i < actualEndIndex) {
                    await this.sleep(actionDelay);
                }

                // 清除执行进度高亮
                this.clearExecutionProgress(element);

            } catch (error) {
                errorCount++;

                const element = elements[i];
                this.log(`❌ 第 ${i + 1} 个元素操作失败: ${error.message}`, 'error');

                // 清除执行进度高亮（即使失败也要清除）
                this.clearExecutionProgress(element);

                if (errorHandling === 'stop') {
                    throw new Error(`自循环在第 ${i + 1} 个元素处停止: ${error.message}`);
                }
                // 继续处理下一个元素
            }
        }

        this.log(`🎉 自循环执行完成: 成功 ${successCount} 个，失败 ${errorCount} 个`, 'success');
    }

    /**
     * 执行自循环中的单个元素操作
     */
    async executeAutoLoopAction(element, operation, actionType) {
        switch (actionType) {
            case 'click':
                await this.clickElement(element);
                break;

            case 'input':
                const inputText = operation.inputText || '';
                element.value = inputText;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                break;

            default:
                throw new Error(`不支持的自循环操作类型: ${actionType}`);
        }
    }

    /**
     * 高亮元素
     */
    highlightElement(element, type = 'processing') {
        if (!element) return;

        // 保存原始样式
        if (!element._originalStyle) {
            element._originalStyle = {
                outline: element.style.outline || '',
                backgroundColor: element.style.backgroundColor || '',
                transition: element.style.transition || ''
            };
        }

        // 设置高亮样式
        element.style.transition = 'all 0.3s ease';

        switch (type) {
            case 'processing':
                element.style.outline = '3px solid #3498db';
                element.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
                break;
            case 'success':
                element.style.outline = '3px solid #27ae60';
                element.style.backgroundColor = 'rgba(39, 174, 96, 0.1)';
                break;
            case 'error':
                element.style.outline = '3px solid #e74c3c';
                element.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
                break;
        }

        // 滚动到元素可见
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /**
     * 清除元素高亮
     */
    clearElementHighlight(element) {
        if (!element || !element._originalStyle) return;

        // 恢复原始样式
        element.style.outline = element._originalStyle.outline;
        element.style.backgroundColor = element._originalStyle.backgroundColor;
        element.style.transition = element._originalStyle.transition;

        // 清除保存的样式
        delete element._originalStyle;
    }

    /**
     * 高亮执行进度（绿色）
     */
    highlightExecutionProgress(element) {
        if (!element) return;

        this.log('🟢 添加执行进度高亮', 'info');

        // 保存原始样式（如果还没保存的话）
        if (!element._executionOriginalStyle) {
            element._executionOriginalStyle = {
                outline: element.style.outline || '',
                backgroundColor: element.style.backgroundColor || '',
                transition: element.style.transition || '',
                zIndex: element.style.zIndex || ''
            };
        }

        // 设置执行进度高亮样式（绿色）
        element.style.transition = 'all 0.3s ease';
        element.style.outline = '3px solid #27ae60';
        element.style.backgroundColor = 'rgba(39, 174, 96, 0.1)';
        element.style.zIndex = '10000'; // 比测试高亮更高的层级

        // 标记为执行进度高亮
        element._isExecutionHighlighted = true;

        // 滚动到当前元素
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    }

    /**
     * 清除执行进度高亮
     */
    clearExecutionProgress(element) {
        if (!element || !element._executionOriginalStyle) return;

        this.log('🧹 清除执行进度高亮', 'info');

        // 恢复原始样式
        element.style.outline = element._executionOriginalStyle.outline;
        element.style.backgroundColor = element._executionOriginalStyle.backgroundColor;
        element.style.transition = element._executionOriginalStyle.transition;
        element.style.zIndex = element._executionOriginalStyle.zIndex;

        // 清除标记和保存的样式
        delete element._executionOriginalStyle;
        delete element._isExecutionHighlighted;
    }

    /**
     * 更新执行进度
     */
    updateProgress(progressData) {
        // 更新内部统计
        Object.assign(this.executionStats, progressData);

        // 调用进度回调
        if (this.onProgress) {
            this.onProgress({
                ...this.executionStats,
                ...progressData
            });
        }
    }

    /**
     * 转义XPath字符串中的特殊字符
     * @param {string} str - 输入字符串
     * @returns {string} - 转义后的字符串
     */
    escapeXPathString(str) {
        if (str.includes('"') && str.includes("'")) {
            // 处理同时包含单引号和双引号的情况
            let parts = str.split('"');
            return `concat("${parts.join('", \'"\', "')}")`;
        }

        // 使用不存在于字符串中的引号类型
        if (str.includes('"')) {
            return `'${str}'`;
        }

        return `"${str}"`;
    }

    /**
     * 执行虚拟列表循环
     * 智能遍历虚拟列表，自动滚动并点击所有未处理的项目
     */
    async executeVirtualListLoop(step, context) {
        const loopName = step.name || `虚拟列表循环${context.join('.')}`;
        this.log(`📜 开始执行虚拟列表循环: ${loopName}`, 'info');

        // 验证配置
        if (!step.virtualListContainer || !step.virtualListContainer.value) {
            throw new Error('虚拟列表容器定位配置缺失');
        }
        if (!step.virtualListTitleLocator || !step.virtualListTitleLocator.value) {
            throw new Error('虚拟列表标题定位配置缺失');
        }

        // 获取容器元素
        const containerElements = await this.findElements(step.virtualListContainer);
        if (containerElements.length === 0) {
            throw new Error(`未找到虚拟列表容器: ${step.virtualListContainer.value}`);
        }
        const container = containerElements[0];
        this.log(`📦 找到虚拟列表容器`, 'info');

        // 初始化状态
        const processedTitles = new Set();
        const scrollDistance = step.virtualListScrollDistance || 100;
        const waitTime = step.virtualListWaitTime || 1000;
        const maxRetries = step.virtualListMaxRetries || 10;
        let retryCount = 0;
        let noNewItemsCount = 0;
        let totalProcessed = 0;

        this.log(`⚙️ 配置: 滚动距离=${scrollDistance}px, 等待时间=${waitTime}ms, 最大重试=${maxRetries}`, 'info');

        while (retryCount < maxRetries && noNewItemsCount < 3) {
            if (!this.isRunning) {
                throw new Error('执行已被停止');
            }

            await this.checkPause();

            try {
                // 收集当前可见的标题
                const visibleTitles = await this.collectVisibleTitles(step.virtualListTitleLocator);
                this.log(`👀 当前可见 ${visibleTitles.length} 个标题`, 'info');

                // 查找第一个未处理的标题
                const unprocessedTitle = visibleTitles.find(title => !processedTitles.has(title.text));

                if (unprocessedTitle) {
                    this.log(`🎯 处理标题: "${unprocessedTitle.text}"`, 'info');

                    try {
                        // 点击对应的按钮（使用循环操作的定位器）
                        await this.clickVirtualListItem(unprocessedTitle, step);

                        // 标记为已处理
                        processedTitles.add(unprocessedTitle.text);
                        totalProcessed++;
                        noNewItemsCount = 0;

                        this.log(`✅ 已处理: "${unprocessedTitle.text}" (总计: ${totalProcessed})`, 'success');

                        // 更新进度
                        this.updateProgress({
                            currentOperation: `虚拟列表处理: ${totalProcessed} 项已完成`
                        });

                        // 操作后等待
                        if (step.operationDelay) {
                            this.log(`⏳ 操作延迟 ${step.operationDelay}ms`, 'info');
                            await this.sleep(step.operationDelay);
                        }

                        // 处理完一个项目后立即滚动
                        const beforeScroll = container.scrollTop;
                        this.log(`📜 处理完项目后滚动容器 ${scrollDistance}px (当前位置: ${beforeScroll})`, 'info');
                        container.scrollTop += scrollDistance;
                        const afterScroll = container.scrollTop;
                        this.log(`📜 滚动完成，位置: ${beforeScroll} → ${afterScroll}`, 'info');

                        // 等待新内容渲染
                        this.log(`⏳ 等待新内容渲染 ${waitTime}ms`, 'info');
                        await this.sleep(waitTime);

                    } catch (clickError) {
                        this.log(`❌ 点击失败: "${unprocessedTitle.text}" - ${clickError.message}`, 'error');

                        // 标记红色边框
                        try {
                            unprocessedTitle.element.style.border = '2px solid red';
                            setTimeout(() => {
                                if (unprocessedTitle.element.style) {
                                    unprocessedTitle.element.style.border = '';
                                }
                            }, 3000);
                        } catch (e) {
                            // 忽略样式设置错误
                        }

                        // 仍然标记为已处理，避免重复尝试
                        processedTitles.add(unprocessedTitle.text);

                        // 即使失败也要滚动，继续处理下一个
                        this.log(`📜 点击失败后滚动容器 ${scrollDistance}px`, 'info');
                        container.scrollTop += scrollDistance;
                        await this.sleep(waitTime);
                    }

                } else {
                    noNewItemsCount++;
                    this.log(`ℹ️ 当前可见项目都已处理 (连续 ${noNewItemsCount}/3 次)`, 'info');

                    // 即使没有新项目也要滚动，尝试加载更多内容
                    this.log(`📜 尝试滚动加载更多内容 ${scrollDistance}px`, 'info');
                    container.scrollTop += scrollDistance;

                    // 等待新内容渲染
                    await this.sleep(waitTime);
                }

                retryCount++;

            } catch (error) {
                this.log(`❌ 虚拟列表处理出错: ${error.message}`, 'error');
                retryCount++;

                if (retryCount >= maxRetries) {
                    throw new Error(`虚拟列表处理失败，已达到最大重试次数: ${error.message}`);
                }

                // 短暂等待后重试
                await this.sleep(1000);
            }
        }

        this.log(`🎉 虚拟列表循环完成，共处理 ${totalProcessed} 个项目`, 'success');
    }

    /**
     * 收集当前可见的标题元素
     */
    async collectVisibleTitles(titleLocator) {
        const titleElements = await this.findElements(titleLocator);
        const visibleTitles = [];

        for (const element of titleElements) {
            // 检查元素是否在视口中可见（放宽条件，只要部分可见即可）
            const rect = element.getBoundingClientRect();
            const isVisible = rect.bottom > 0 && rect.top < window.innerHeight &&
                            rect.right > 0 && rect.left < window.innerWidth;

            if (isVisible && element.innerText && element.innerText.trim()) {
                visibleTitles.push({
                    text: element.innerText.trim(),
                    element: element
                });
            }
        }

        return visibleTitles;
    }

    /**
     * 点击虚拟列表项对应的按钮
     */
    async clickVirtualListItem(titleInfo, step) {
        // 从标题元素开始，查找对应的可点击按钮
        // 使用循环操作的定位器来找到按钮
        const buttonElements = await this.findElements(step.locator);

        this.log(`🔍 找到 ${buttonElements.length} 个可点击按钮，正在匹配标题: "${titleInfo.text}"`, 'info');

        // 尝试找到与当前标题相关的按钮
        // 策略1：查找同一个父容器内的按钮
        let targetButton = null;

        // 首先尝试在标题元素的父容器中查找按钮
        let currentElement = titleInfo.element;
        for (let level = 0; level < 5; level++) { // 最多向上查找5层
            if (!currentElement || !currentElement.parentElement) break;
            currentElement = currentElement.parentElement;

            // 在当前容器内查找按钮
            for (const button of buttonElements) {
                if (currentElement.contains(button)) {
                    targetButton = button;
                    this.log(`✅ 在第${level + 1}层父容器中找到匹配按钮`, 'info');
                    break;
                }
            }
            if (targetButton) break;
        }

        // 策略2：如果没找到，使用距离匹配
        if (!targetButton) {
            this.log(`🔍 使用距离匹配策略查找按钮`, 'info');
            let minDistance = Infinity;

            const titleRect = titleInfo.element.getBoundingClientRect();
            const titleCenterX = titleRect.left + titleRect.width / 2;
            const titleCenterY = titleRect.top + titleRect.height / 2;

            for (const button of buttonElements) {
                const buttonRect = button.getBoundingClientRect();

                // 只考虑可见的按钮
                if (buttonRect.width === 0 || buttonRect.height === 0) continue;

                const buttonCenterX = buttonRect.left + buttonRect.width / 2;
                const buttonCenterY = buttonRect.top + buttonRect.height / 2;

                // 计算距离
                const distance = Math.sqrt(
                    Math.pow(titleCenterX - buttonCenterX, 2) +
                    Math.pow(titleCenterY - buttonCenterY, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    targetButton = button;
                }
            }

            if (targetButton) {
                this.log(`✅ 通过距离匹配找到按钮，距离: ${Math.round(minDistance)}px`, 'info');
            }
        }

        if (!targetButton) {
            throw new Error(`未找到与标题 "${titleInfo.text}" 对应的按钮`);
        }

        // 滚动到按钮可见位置
        targetButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(200); // 等待滚动完成

        // 点击按钮
        await this.clickElement(targetButton);
    }
} // 结束类定义

// 将类绑定到全局对象
window.UniversalAutomationEngine = UniversalAutomationEngine;

// 导出支持
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UniversalAutomationEngine;
}

// 确保在浏览器环境中设置到window对象
if (typeof window !== 'undefined') {
    window.UniversalAutomationEngine = UniversalAutomationEngine;
    console.log('✅ UniversalAutomationEngine 已设置到window对象');
}

console.log('✅ UniversalAutomationEngine 类已成功定义');
console.log('🔍 类型检查:', typeof window.UniversalAutomationEngine);

// 测试实例化
try {
    const testInstance = new UniversalAutomationEngine();
    console.log('✅ 测试实例化成功:', typeof testInstance);
} catch (error) {
    console.error('❌ 测试实例化失败:', error);
}


console.log('📦 universal-automation-engine.js 脚本执行完成');

// 延迟检查，看看是否有其他脚本清除了window对象
setTimeout(() => {
    console.log('🔍 [DEBUG] 延迟检查引擎状态:', {
        exists: !!window.UniversalAutomationEngine,
        type: typeof window.UniversalAutomationEngine
    });
}, 100);

setTimeout(() => {
    console.log('🔍 [DEBUG] 再次延迟检查引擎状态:', {
        exists: !!window.UniversalAutomationEngine,
        type: typeof window.UniversalAutomationEngine
    });
}, 300);

// 通知content script引擎已加载
window.postMessage({
    type: 'AUTOMATION_ENGINE_LOADED',
    engine: 'UniversalAutomationEngine'
}, '*');
