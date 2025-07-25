/**
 * 敏感词检测调试脚本
 * 在浏览器控制台中运行此脚本来调试敏感词检测功能
 */

// 调试函数：检查模块加载状态
function checkModuleStatus() {
  console.log('🔍 检查模块加载状态...');
  
  const checks = {
    'SensitiveWordDetector': typeof window.SensitiveWordDetector !== 'undefined',
    'ContentCore': typeof window.ContentCore !== 'undefined',
    'ContentAutomation': typeof window.ContentAutomation !== 'undefined'
  };
  
  Object.entries(checks).forEach(([name, loaded]) => {
    console.log(`${loaded ? '✅' : '❌'} ${name}: ${loaded ? '已加载' : '未加载'}`);
  });
  
  return checks;
}

// 调试函数：测试敏感词检测器
function testSensitiveWordDetector() {
  console.log('🔍 测试敏感词检测器...');
  
  if (typeof window.SensitiveWordDetector === 'undefined') {
    console.error('❌ SensitiveWordDetector 未加载');
    return false;
  }
  
  try {
    const detector = new window.SensitiveWordDetector();
    detector.setSensitiveWords('广告,推广,营销,spam');
    
    const testTexts = [
      '这是一个正常的内容',
      '这是一个广告内容',
      '专业的营销策略',
      'This is spam content'
    ];
    
    testTexts.forEach((text, index) => {
      const result = detector.detectSensitiveWords(text);
      console.log(`测试 ${index + 1}: "${text}" -> ${result.hasSensitiveWord ? '包含敏感词' : '正常'}`);
      if (result.hasSensitiveWord) {
        console.log(`  匹配词: ${result.matchedWords.join(', ')}`);
      }
    });
    
    console.log('✅ 敏感词检测器测试完成');
    return true;
  } catch (error) {
    console.error('❌ 敏感词检测器测试失败:', error);
    return false;
  }
}

// 调试函数：检查表单元素
function checkFormElements() {
  console.log('🔍 检查表单元素...');
  
  const elements = {
    'enableSensitiveWordDetection': document.getElementById('enableSensitiveWordDetection'),
    'sensitiveWords': document.getElementById('sensitiveWords'),
    'sensitiveWordLocatorStrategy': document.getElementById('sensitiveWordLocatorStrategy'),
    'sensitiveWordLocatorValue': document.getElementById('sensitiveWordLocatorValue'),
    'loopSelector': document.getElementById('loopSelector'),
    'locatorType': document.getElementById('locatorType'),
    'testButton': document.querySelector('#sensitiveWordConfig .test-locator-btn')
  };
  
  Object.entries(elements).forEach(([name, element]) => {
    if (element) {
      console.log(`✅ ${name}: 找到`);
      if (element.value !== undefined) {
        console.log(`  值: "${element.value}"`);
      }
      if (element.checked !== undefined) {
        console.log(`  选中: ${element.checked}`);
      }
    } else {
      console.log(`❌ ${name}: 未找到`);
    }
  });
}

// 调试函数：模拟敏感词检测测试
function simulateSensitiveWordTest() {
  console.log('🔍 模拟敏感词检测测试...');
  
  // 检查必要元素
  const sensitiveWords = document.getElementById('sensitiveWords');
  const loopSelector = document.getElementById('loopSelector');
  
  if (!sensitiveWords || !sensitiveWords.value.trim()) {
    console.error('❌ 敏感词列表为空');
    return false;
  }
  
  if (!loopSelector || !loopSelector.value.trim()) {
    console.error('❌ 循环选择器为空');
    return false;
  }
  
  console.log('📋 配置信息:');
  console.log(`  敏感词: ${sensitiveWords.value}`);
  console.log(`  循环选择器: ${loopSelector.value}`);
  
  // 尝试查找元素
  try {
    const elements = document.querySelectorAll(loopSelector.value);
    console.log(`  找到元素: ${elements.length} 个`);
    
    if (elements.length > 0) {
      // 测试前几个元素
      const testCount = Math.min(elements.length, 5);
      console.log(`测试前 ${testCount} 个元素:`);
      
      const sensitiveWordList = sensitiveWords.value.split(',').map(w => w.trim().toLowerCase());
      
      for (let i = 0; i < testCount; i++) {
        const element = elements[i];
        const text = element.innerText || element.textContent || '';
        const textLower = text.toLowerCase();
        const matchedWords = sensitiveWordList.filter(word => textLower.includes(word));
        
        console.log(`  元素 ${i + 1}:`);
        console.log(`    文本: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
        console.log(`    结果: ${matchedWords.length > 0 ? '跳过' : '通过'}`);
        if (matchedWords.length > 0) {
          console.log(`    匹配词: ${matchedWords.join(', ')}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ 元素查找失败:', error);
    return false;
  }
}

// 主调试函数
function debugSensitiveWord() {
  console.log('🚀 开始敏感词检测调试...\n');
  
  console.log('1. 检查模块加载状态');
  const moduleStatus = checkModuleStatus();
  console.log('');
  
  console.log('2. 测试敏感词检测器');
  const detectorStatus = testSensitiveWordDetector();
  console.log('');
  
  console.log('3. 检查表单元素');
  checkFormElements();
  console.log('');
  
  console.log('4. 模拟敏感词检测测试');
  const testStatus = simulateSensitiveWordTest();
  console.log('');
  
  console.log('📊 调试结果总结:');
  console.log(`  模块加载: ${moduleStatus.SensitiveWordDetector ? '✅' : '❌'}`);
  console.log(`  检测器测试: ${detectorStatus ? '✅' : '❌'}`);
  console.log(`  模拟测试: ${testStatus ? '✅' : '❌'}`);
  
  if (moduleStatus.SensitiveWordDetector && detectorStatus && testStatus) {
    console.log('🎉 敏感词检测功能应该可以正常工作！');
  } else {
    console.log('⚠️ 敏感词检测功能可能存在问题，请检查上述失败项');
  }
}

// 导出调试函数
window.debugSensitiveWord = debugSensitiveWord;
window.checkModuleStatus = checkModuleStatus;
window.testSensitiveWordDetector = testSensitiveWordDetector;
window.checkFormElements = checkFormElements;
window.simulateSensitiveWordTest = simulateSensitiveWordTest;

console.log('🔧 敏感词检测调试脚本已加载');
console.log('使用方法: 在控制台中输入 debugSensitiveWord() 开始调试');