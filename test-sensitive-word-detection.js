/**
 * 敏感词检测功能测试脚本
 * 可以在浏览器控制台中运行此脚本来测试敏感词检测功能
 */

// 测试敏感词检测功能
function testSensitiveWordDetection() {
  console.log('🔍 开始测试敏感词检测功能...');

  // 1. 测试敏感词检测器类
  if (typeof SensitiveWordDetector === 'undefined') {
    console.error('❌ SensitiveWordDetector 类未定义');
    return;
  }

  const detector = new SensitiveWordDetector();
  
  // 2. 测试敏感词设置
  detector.setSensitiveWords('广告,推广,营销,spam');
  console.log('✅ 敏感词设置完成');

  // 3. 测试文本检测
  const testTexts = [
    '这是一个正常的内容',
    '这是一个广告内容',
    '专业的营销策略',
    'This is spam content',
    '高质量的学习资源'
  ];

  testTexts.forEach((text, index) => {
    const result = detector.detectSensitiveWords(text);
    console.log(`测试文本 ${index + 1}: "${text}"`);
    console.log(`  检测结果: ${result.hasSensitiveWord ? '包含敏感词' : '正常'}`);
    if (result.hasSensitiveWord) {
      console.log(`  匹配的敏感词: ${result.matchedWords.join(', ')}`);
    }
  });

  // 4. 测试页面元素检测
  const testElements = document.querySelectorAll('.list-item');
  if (testElements.length > 0) {
    console.log(`\n🔍 测试页面元素检测 (找到 ${testElements.length} 个元素):`);
    
    testElements.forEach(async (element, index) => {
      const config = {
        enabled: true,
        sensitiveWords: '广告,推广,营销,spam',
        locatorStrategy: 'css',
        locatorValue: '.item-content'
      };

      try {
        const result = await detector.checkShouldSkipElement(element, config);
        console.log(`元素 ${index + 1}:`);
        console.log(`  应该跳过: ${result.shouldSkip}`);
        if (result.shouldSkip) {
          console.log(`  原因: ${result.reason}`);
        }
      } catch (error) {
        console.error(`元素 ${index + 1} 检测失败:`, error);
      }
    });
  } else {
    console.log('⚠️ 页面中没有找到 .list-item 元素，请在测试页面中运行此脚本');
  }

  console.log('\n✅ 敏感词检测功能测试完成');
}

// 测试配置保存和加载
function testConfigSaveLoad() {
  console.log('🔧 测试配置保存和加载...');

  // 模拟配置对象
  const testConfig = {
    type: 'loop',
    loopType: 'container',
    sensitiveWordDetection: {
      enabled: true,
      sensitiveWords: '测试,广告,推广',
      locatorStrategy: 'css',
      locatorValue: '.test-content'
    }
  };

  console.log('原始配置:', testConfig);

  // 测试配置序列化
  const serialized = JSON.stringify(testConfig);
  console.log('序列化配置:', serialized);

  // 测试配置反序列化
  const deserialized = JSON.parse(serialized);
  console.log('反序列化配置:', deserialized);

  // 验证敏感词检测配置
  if (deserialized.sensitiveWordDetection) {
    console.log('✅ 敏感词检测配置保存和加载正常');
    console.log('  启用状态:', deserialized.sensitiveWordDetection.enabled);
    console.log('  敏感词列表:', deserialized.sensitiveWordDetection.sensitiveWords);
    console.log('  定位策略:', deserialized.sensitiveWordDetection.locatorStrategy);
    console.log('  定位值:', deserialized.sensitiveWordDetection.locatorValue);
  } else {
    console.error('❌ 敏感词检测配置丢失');
  }
}

// 测试表单元素绑定
function testFormBinding() {
  console.log('🔧 测试表单元素绑定...');

  const elements = {
    checkbox: document.getElementById('enableSensitiveWordDetection'),
    textarea: document.getElementById('sensitiveWords'),
    strategy: document.getElementById('sensitiveWordLocatorStrategy'),
    value: document.getElementById('sensitiveWordLocatorValue'),
    testButton: document.querySelector('#sensitiveWordConfig .test-locator-btn')
  };

  Object.entries(elements).forEach(([name, element]) => {
    if (element) {
      console.log(`✅ ${name} 元素找到:`, element.tagName, element.id || element.className);
    } else {
      console.error(`❌ ${name} 元素未找到`);
    }
  });

  // 测试复选框状态
  if (elements.checkbox) {
    console.log('复选框当前状态:', elements.checkbox.checked);
  }

  // 测试文本区域内容
  if (elements.textarea) {
    console.log('敏感词列表当前内容:', elements.textarea.value);
  }
}

// 运行所有测试
function runAllTests() {
  console.log('🚀 开始运行敏感词检测功能完整测试...\n');
  
  try {
    testSensitiveWordDetection();
    console.log('\n' + '='.repeat(50) + '\n');
    
    testConfigSaveLoad();
    console.log('\n' + '='.repeat(50) + '\n');
    
    testFormBinding();
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log('🎉 所有测试完成！');
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 导出测试函数
window.testSensitiveWordDetection = testSensitiveWordDetection;
window.testConfigSaveLoad = testConfigSaveLoad;
window.testFormBinding = testFormBinding;
window.runAllTests = runAllTests;

console.log('📋 敏感词检测测试脚本已加载');
console.log('可用的测试函数:');
console.log('  - testSensitiveWordDetection(): 测试敏感词检测功能');
console.log('  - testConfigSaveLoad(): 测试配置保存和加载');
console.log('  - testFormBinding(): 测试表单元素绑定');
console.log('  - runAllTests(): 运行所有测试');
console.log('');
console.log('使用方法: 在控制台中输入 runAllTests() 运行完整测试');