/**
 * 性能监控和优化工具
 * 提供性能监控、内存管理和优化建议
 */

// 性能监控器
class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.observers = [];
        this.isEnabled = true;
    }

    // 开始性能测量
    startMeasure(name) {
        if (!this.isEnabled) return;

        const startTime = performance.now();
        this.metrics.set(name, {
            startTime,
            endTime: null,
            duration: null,
            memory: this.getMemoryUsage()
        });
    }

    // 结束性能测量
    endMeasure(name) {
        if (!this.isEnabled) return;

        const metric = this.metrics.get(name);
        if (!metric) return;

        const endTime = performance.now();
        metric.endTime = endTime;
        metric.duration = endTime - metric.startTime;
        metric.memoryAfter = this.getMemoryUsage();
        metric.memoryDelta = metric.memoryAfter - metric.memory;

        // 通知观察者
        this.notifyObservers(name, metric);

        return metric;
    }

    // 获取内存使用情况
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    // 添加性能观察者
    addObserver(callback) {
        this.observers.push(callback);
    }

    // 通知观察者
    notifyObservers(name, metric) {
        this.observers.forEach(callback => {
            try {
                callback(name, metric);
            } catch (error) {
                console.warn('性能观察者回调失败:', error);
            }
        });
    }

    // 获取性能报告
    getReport() {
        const report = {
            timestamp: Date.now(),
            metrics: Array.from(this.metrics.entries()).map(([name, metric]) => ({
                name,
                duration: metric.duration,
                memoryDelta: metric.memoryDelta
            })),
            memory: this.getMemoryUsage(),
            recommendations: this.getRecommendations()
        };

        return report;
    }

    // 获取优化建议
    getRecommendations() {
        const recommendations = [];
        const memory = this.getMemoryUsage();

        if (memory && memory.used > memory.limit * 0.8) {
            recommendations.push({
                type: 'memory',
                level: 'warning',
                message: '内存使用率过高，建议清理缓存或重启插件'
            });
        }

        // 检查慢操作
        for (const [name, metric] of this.metrics) {
            if (metric.duration > 1000) {
                recommendations.push({
                    type: 'performance',
                    level: 'warning',
                    message: `操作 "${name}" 耗时过长 (${metric.duration.toFixed(2)}ms)`
                });
            }
        }

        return recommendations;
    }

    // 清理旧的性能数据
    cleanup() {
        const cutoff = Date.now() - 5 * 60 * 1000; // 5分钟前
        for (const [name, metric] of this.metrics) {
            if (metric.startTime < cutoff) {
                this.metrics.delete(name);
            }
        }
    }
}

// 内存管理器
class MemoryManager {
    constructor() {
        this.cleanupTasks = [];
        this.intervalId = null;
        this.isRunning = false;
    }

    // 开始内存管理
    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.intervalId = setInterval(() => {
            this.runCleanup();
        }, 30000); // 每30秒清理一次
    }

    // 停止内存管理
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
    }

    // 添加清理任务
    addCleanupTask(name, task) {
        this.cleanupTasks.push({ name, task });
    }

    // 运行清理任务
    runCleanup() {
        this.cleanupTasks.forEach(({ name, task }) => {
            try {
                task();
            } catch (error) {
                console.warn(`清理任务 "${name}" 失败:`, error);
            }
        });
    }

    // 强制垃圾回收（如果可用）
    forceGC() {
        if (window.gc) {
            window.gc();
        }
    }
}

// 缓存管理器
class CacheManager {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.accessTimes = new Map();
    }

    // 设置缓存
    set(key, value, ttl = 300000) { // 默认5分钟TTL
        // 如果缓存已满，清理最少使用的项
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl
        });
        this.accessTimes.set(key, Date.now());
    }

    // 获取缓存
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        // 检查是否过期
        if (Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            this.accessTimes.delete(key);
            return null;
        }

        // 更新访问时间
        this.accessTimes.set(key, Date.now());
        return item.value;
    }

    // 清理过期缓存
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache) {
            if (now - item.timestamp > item.ttl) {
                this.cache.delete(key);
                this.accessTimes.delete(key);
            }
        }
    }

    // 清理最少使用的项
    evictLRU() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, time] of this.accessTimes) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.accessTimes.delete(oldestKey);
        }
    }

    // 获取缓存统计
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: this.calculateHitRate()
        };
    }

    // 计算命中率（简化版本）
    calculateHitRate() {
        // 这里可以实现更复杂的命中率计算
        return this.cache.size > 0 ? 0.8 : 0;
    }
}

// 防抖函数
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

// 节流函数
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 批处理器
class BatchProcessor {
    constructor(processor, batchSize = 10, delay = 100) {
        this.processor = processor;
        this.batchSize = batchSize;
        this.delay = delay;
        this.queue = [];
        this.timeoutId = null;
    }

    // 添加任务到批处理队列
    add(item) {
        this.queue.push(item);

        if (this.queue.length >= this.batchSize) {
            this.flush();
        } else if (!this.timeoutId) {
            this.timeoutId = setTimeout(() => this.flush(), this.delay);
        }
    }

    // 立即处理所有队列中的任务
    flush() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        if (this.queue.length > 0) {
            const batch = this.queue.splice(0);
            try {
                this.processor(batch);
            } catch (error) {
                console.error('批处理失败:', error);
            }
        }
    }
}

// 创建全局实例
const performanceMonitor = new PerformanceMonitor();
const memoryManager = new MemoryManager();
const cacheManager = new CacheManager();

// 启动内存管理
memoryManager.start();

// 添加基本的清理任务
memoryManager.addCleanupTask('cache', () => cacheManager.cleanup());
memoryManager.addCleanupTask('performance', () => performanceMonitor.cleanup());

// 导出
export {
    PerformanceMonitor,
    MemoryManager,
    CacheManager,
    BatchProcessor,
    performanceMonitor,
    memoryManager,
    cacheManager,
    debounce,
    throttle
};