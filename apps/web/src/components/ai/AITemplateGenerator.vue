<script setup lang="ts">
import {
  BookOpen,
  Briefcase,
  Eye,
  FileText,
  Loader2,
  Newspaper,
  Package,
  Share2,
  Sparkles,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { useDisplayStore, useStore } from '@/stores'

const displayStore = useDisplayStore()
const store = useStore()
const { output } = storeToRefs(store)

// 模板类型定义
const templateTypes = [
  {
    id: `article`,
    name: `文章`,
    icon: FileText,
    description: `适合博客文章、技术文章`,
  },
  {
    id: `product`,
    name: `产品介绍`,
    icon: Package,
    description: `产品展示、功能介绍`,
  },
  {
    id: `news`,
    name: `新闻稿`,
    icon: Newspaper,
    description: `新闻发布、公告`,
  },
  {
    id: `tutorial`,
    name: `教程`,
    icon: BookOpen,
    description: `操作指南、学习教程`,
  },
  {
    id: `social`,
    name: `社交媒体`,
    icon: Share2,
    description: `朋友圈、微博内容`,
  },
  {
    id: `business`,
    name: `商务`,
    icon: Briefcase,
    description: `商业计划、报告`,
  },
]

// 设计风格定义
const designStyles = [
  {
    id: `modern`,
    name: `现代简约`,
    preview: `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);`,
  },
  {
    id: `classic`,
    name: `经典商务`,
    preview: `background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);`,
  },
  {
    id: `minimal`,
    name: `极简主义`,
    preview: `background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);`,
  },
  {
    id: `creative`,
    name: `创意设计`,
    preview: `background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);`,
  },
  {
    id: `professional`,
    name: `专业风格`,
    preview: `background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);`,
  },
]

// 配色方案定义
const colorSchemes = [
  {
    id: `blue`,
    name: `蓝色系`,
    colors: `background: linear-gradient(90deg, #3b82f6, #1d4ed8, #1e40af);`,
  },
  {
    id: `green`,
    name: `绿色系`,
    colors: `background: linear-gradient(90deg, #10b981, #059669, #047857);`,
  },
  {
    id: `purple`,
    name: `紫色系`,
    colors: `background: linear-gradient(90deg, #8b5cf6, #7c3aed, #6d28d9);`,
  },
  {
    id: `orange`,
    name: `橙色系`,
    colors: `background: linear-gradient(90deg, #f59e0b, #d97706, #b45309);`,
  },
  {
    id: `pink`,
    name: `粉色系`,
    colors: `background: linear-gradient(90deg, #ec4899, #db2777, #be185d);`,
  },
  {
    id: `gray`,
    name: `灰色系`,
    colors: `background: linear-gradient(90deg, #6b7280, #4b5563, #374151);`,
  },
]

// 响应式数据
const selectedType = ref(`article`)
const selectedStyle = ref(`modern`)
const selectedColorScheme = ref(`blue`)
const topic = ref(``)
const isGenerating = ref(false)

// 计算属性
const canGenerate = computed(() => topic.value.trim().length > 0)

// AI模板生成
async function generateAITemplate() {
  if (!canGenerate.value)
    return

  isGenerating.value = true

  try {
    const selectedTypeObj = templateTypes.find(t => t.id === selectedType.value)
    const selectedStyleObj = designStyles.find(s => s.id === selectedStyle.value)
    const selectedColorObj = colorSchemes.find(c => c.id === selectedColorScheme.value)

    const prompt = `
请生成一个${selectedTypeObj?.name}类型的${selectedStyleObj?.name}风格模板，主题是"${topic.value}"。

要求：
1. 生成完整的HTML模板，包含丰富的样式和布局
2. 使用${selectedColorObj?.name}配色方案
3. 包含现代化的设计元素：渐变背景、阴影、圆角、动画等
4. 确保内容结构清晰，视觉美观，适合在线展示
5. 内容要围绕"${topic.value}"这个主题展开
6. 使用现代网页设计理念，确保响应式布局
7. 包含多种视觉元素：卡片、按钮、图标、分割线等

请严格按照以下格式返回：
\`\`\`html
[完整的HTML模板代码]
\`\`\`

\`\`\`css
[完整的CSS样式代码，包含动画和响应式设计]
\`\`\`
`

    // 打开AI聊天面板并发送请求
    displayStore.toggleAIDialog(true)

    // 等待一下确保面板打开
    await new Promise(resolve => setTimeout(resolve, 100))

    // 找到输入框并填入内容
    const textarea = document.querySelector(`textarea[placeholder*="说些什么"]`) as HTMLTextAreaElement
    if (textarea) {
      textarea.value = prompt
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)

      // 模拟点击发送按钮
      const sendButton = document.querySelector(`button[class*="bg-blue-500"]`) as HTMLButtonElement
      if (sendButton) {
        sendButton.click()
      }
    }
  }
  catch (error) {
    console.error(`生成模板失败:`, error)
  }
  finally {
    isGenerating.value = false
  }
}

// 立即预览功能 - 生成示例模板
function previewTemplate() {
  if (!canGenerate.value)
    return

  const selectedTypeObj = templateTypes.find(t => t.id === selectedType.value)
  const selectedStyleObj = designStyles.find(s => s.id === selectedStyle.value)
  const selectedColorObj = colorSchemes.find(c => c.id === selectedColorScheme.value)

  // 根据选择的类型和风格生成示例模板
  const template = generateSampleTemplate(
    selectedTypeObj?.name || `文章`,
    selectedStyleObj?.name || `现代简约`,
    selectedColorObj?.name || `蓝色系`,
    topic.value,
  )

  // 直接应用到预览区域
  applyTemplateToPreview(template.html, template.css)
}

// 生成示例模板
function generateSampleTemplate(type: string, style: string, color: string, topic: string) {
  const colorMap = {
    蓝色系: { primary: `#3b82f6`, secondary: `#1d4ed8`, accent: `#60a5fa` },
    绿色系: { primary: `#10b981`, secondary: `#059669`, accent: `#34d399` },
    紫色系: { primary: `#8b5cf6`, secondary: `#7c3aed`, accent: `#a78bfa` },
    橙色系: { primary: `#f59e0b`, secondary: `#d97706`, accent: `#fbbf24` },
    粉色系: { primary: `#ec4899`, secondary: `#db2777`, accent: `#f472b6` },
    灰色系: { primary: `#6b7280`, secondary: `#4b5563`, accent: `#9ca3af` },
  }

  const colors = colorMap[color as keyof typeof colorMap] || colorMap[`蓝色系`]

  const html = `
    <div class="ai-template">
      <header class="template-header">
        <div class="header-content">
          <h1 class="main-title">${topic}</h1>
          <p class="subtitle">${type} · ${style}风格</p>
        </div>
      </header>
      
      <main class="template-content">
        <section class="hero-section">
          <div class="hero-content">
            <h2>欢迎了解${topic}</h2>
            <p>这是一个关于${topic}的${type}，采用${style}设计风格，为您提供专业的内容展示。</p>
            <div class="cta-buttons">
              <button class="btn-primary">了解更多</button>
              <button class="btn-secondary">立即开始</button>
            </div>
          </div>
        </section>
        
        <section class="features-section">
          <div class="features-grid">
            <div class="feature-card">
              <div class="feature-icon">✨</div>
              <h3>专业设计</h3>
              <p>采用现代化的设计理念，确保视觉效果出众</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">🚀</div>
              <h3>高效便捷</h3>
              <p>一键生成，快速部署，节省您的时间成本</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">🎯</div>
              <h3>精准定位</h3>
              <p>针对${topic}主题，提供精准的内容解决方案</p>
            </div>
          </div>
        </section>
        
        <section class="content-section">
          <h2>详细内容</h2>
          <div class="content-grid">
            <div class="content-item">
              <h3>核心特点</h3>
              <ul>
                <li>${style}设计风格</li>
                <li>${color}配色方案</li>
                <li>响应式布局</li>
                <li>现代化交互</li>
              </ul>
            </div>
            <div class="content-item">
              <h3>应用场景</h3>
              <ul>
                <li>${type}展示</li>
                <li>内容发布</li>
                <li>品牌宣传</li>
                <li>用户引导</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      
      <footer class="template-footer">
        <p>&copy; 2024 AI生成的${type}模板</p>
      </footer>
    </div>
  `

  const css = `
    .ai-template {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      max-width: 100%;
      box-sizing: border-box;
    }
    
    .template-header {
      background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);
      color: white;
      padding: 2rem 1rem;
      text-align: center;
      position: relative;
      overflow: hidden;
      margin: 0;
      width: 100%;
      box-sizing: border-box;
    }
    
    .template-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
      opacity: 0.3;
    }
    
    .header-content {
      position: relative;
      z-index: 1;
    }
    
    .main-title {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
      line-height: 1.2;
    }
    
    .subtitle {
      font-size: 1rem;
      opacity: 0.9;
      font-weight: 300;
      margin: 0;
    }
    
    .template-content {
      max-width: 100%;
      margin: 0;
      padding: 0 1rem;
      box-sizing: border-box;
    }
    
    .hero-section {
      padding: 2rem 1rem;
      text-align: center;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      margin: 1rem 0;
      border-radius: 8px;
      box-sizing: border-box;
    }
    
    .hero-content h2 {
      font-size: 1.5rem;
      color: ${colors.primary};
      margin-bottom: 0.5rem;
      font-weight: 600;
      line-height: 1.3;
    }
    
    .hero-content p {
      font-size: 1rem;
      color: #64748b;
      margin-bottom: 1.5rem;
      max-width: 100%;
      line-height: 1.5;
    }
    
    .cta-buttons {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }
    
    .btn-primary, .btn-secondary {
      padding: 0.8rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
      box-sizing: border-box;
    }
    
    .btn-primary {
      background: ${colors.primary};
      color: white;
      box-shadow: 0 4px 14px 0 rgba(${colors.primary.replace(`#`, ``)}, 0.3);
    }
    
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px 0 rgba(${colors.primary.replace(`#`, ``)}, 0.4);
    }
    
    .btn-secondary {
      background: transparent;
      color: ${colors.primary};
      border: 2px solid ${colors.primary};
    }
    
    .btn-secondary:hover {
      background: ${colors.primary};
      color: white;
    }
    
    .features-section {
      padding: 2rem 0;
    }
    
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    
    .feature-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      text-align: center;
      transition: transform 0.3s ease;
      box-sizing: border-box;
    }
    
    .feature-card:hover {
      transform: translateY(-4px);
    }
    
    .feature-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    
    .feature-card h3 {
      font-size: 1.2rem;
      color: ${colors.primary};
      margin-bottom: 0.5rem;
      font-weight: 600;
    }
    
    .feature-card p {
      color: #64748b;
      line-height: 1.5;
      font-size: 0.9rem;
    }
    
    .content-section {
      padding: 2rem 1rem;
      background: #f8fafc;
      border-radius: 8px;
      margin: 1rem 0;
      box-sizing: border-box;
    }
    
    .content-section h2 {
      text-align: center;
      font-size: 1.5rem;
      color: ${colors.primary};
      margin-bottom: 1.5rem;
      font-weight: 600;
    }
    
    .content-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }
    
    .content-item {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      box-sizing: border-box;
    }
    
    .content-item h3 {
      font-size: 1.2rem;
      color: ${colors.primary};
      margin-bottom: 0.5rem;
      font-weight: 600;
    }
    
    .content-item ul {
      list-style: none;
      padding: 0;
    }
    
    .content-item li {
      padding: 0.3rem 0;
      color: #64748b;
      position: relative;
      padding-left: 1.2rem;
      font-size: 0.9rem;
    }
    
    .content-item li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: ${colors.primary};
      font-weight: bold;
    }
    
    .template-footer {
      background: ${colors.secondary};
      color: white;
      text-align: center;
      padding: 1.5rem 1rem;
      margin-top: 2rem;
      box-sizing: border-box;
    }
    
    .template-footer p {
      margin: 0;
      opacity: 0.9;
      font-size: 0.9rem;
    }
    
    @media (max-width: 768px) {
      .main-title {
        font-size: 1.5rem;
      }
      
      .hero-content h2 {
        font-size: 1.3rem;
      }
      
      .cta-buttons {
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }
      
      .features-grid {
        grid-template-columns: 1fr;
        gap: 0.8rem;
      }
      
      .content-grid {
        grid-template-columns: 1fr;
        gap: 0.8rem;
      }
      
      .template-content {
        padding: 0 0.5rem;
      }
      
      .template-header {
        padding: 1.5rem 0.5rem;
      }
      
      .hero-section {
        padding: 1.5rem 0.5rem;
      }
      
      .content-section {
        padding: 1.5rem 0.5rem;
      }
    }
  `

  return { html, css }
}

// 应用模板到预览区域
function applyTemplateToPreview(htmlContent: string, cssContent: string) {
  // 创建包含样式的完整HTML
  const fullHTML = `
    <style>
      ${cssContent}
    </style>
    ${htmlContent}
  `

  console.log(`生成的完整HTML:`, fullHTML)
  console.log(`CSS内容:`, cssContent)
  console.log(`HTML内容:`, htmlContent)

  // 直接设置预览区域的HTML内容
  output.value = fullHTML

  // 等待DOM更新后复制内容
  setTimeout(() => {
    copyPreviewContent()
  }, 100)
}

// 复制预览区域的内容
function copyPreviewContent() {
  const previewElement = document.querySelector(`#output`)
  if (!previewElement) {
    console.log(`预览元素未找到`)
    return
  }

  console.log(`预览元素内容:`, previewElement.innerHTML)

  try {
    // 创建临时容器，包含样式和内容
    const tempContainer = document.createElement(`div`)
    tempContainer.innerHTML = previewElement.innerHTML

    console.log(`临时容器内容:`, tempContainer.innerHTML)

    // 将样式也复制到临时容器
    const styleElement = previewElement.querySelector(`style`)
    if (styleElement) {
      console.log(`找到样式元素:`, styleElement.textContent)
      const newStyleElement = styleElement.cloneNode(true)
      tempContainer.appendChild(newStyleElement)
    }
    else {
      console.log(`未找到样式元素`)
    }

    // 将临时容器添加到页面（隐藏）
    tempContainer.style.position = `absolute`
    tempContainer.style.left = `-9999px`
    tempContainer.style.top = `-9999px`
    document.body.appendChild(tempContainer)

    // 选择临时容器的所有内容
    const range = document.createRange()
    range.selectNodeContents(tempContainer)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    // 复制选中的内容
    const success = document.execCommand(`copy`)

    // 清理
    selection?.removeAllRanges()
    document.body.removeChild(tempContainer)

    if (success) {
      console.log(`复制成功`)
      showCopySuccess()
    }
    else {
      throw new Error(`execCommand failed`)
    }
  }
  catch (error) {
    console.error(`复制失败:`, error)
    showCopyError()
  }
}

// 显示复制成功提示
function showCopySuccess() {
  // 创建临时提示元素
  const toast = document.createElement(`div`)
  toast.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
    ">
      ✅ 模板已复制到剪贴板，可直接粘贴到微信公众号！
    </div>
  `

  document.body.appendChild(toast)

  // 3秒后移除提示
  setTimeout(() => {
    document.body.removeChild(toast)
  }, 3000)
}

// 显示复制失败提示
function showCopyError() {
  const toast = document.createElement(`div`)
  toast.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
    ">
      ❌ 复制失败，请手动复制
    </div>
  `

  document.body.appendChild(toast)

  setTimeout(() => {
    document.body.removeChild(toast)
  }, 3000)
}
</script>

<template>
  <div class="ai-template-generator p-4">
    <div class="generator-header mb-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        AI智能模板生成
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        选择类型和风格，AI自动生成专业模板
      </p>
    </div>

    <div class="template-options space-y-6">
      <!-- 模板类型选择 -->
      <div class="option-group">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          模板类型
        </label>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="type in templateTypes"
            :key="type.id"
            class="flex flex-col items-center p-3 rounded-lg border-2 transition-all" :class="[
              selectedType === type.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300',
            ]"
            @click="selectedType = type.id"
          >
            <component :is="type.icon" class="w-5 h-5 mb-1" />
            <span class="text-xs font-medium">{{ type.name }}</span>
          </button>
        </div>
      </div>

      <!-- 风格选择 -->
      <div class="option-group">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          设计风格
        </label>
        <div class="grid grid-cols-1 gap-2">
          <button
            v-for="style in designStyles"
            :key="style.id"
            class="flex items-center p-3 rounded-lg border-2 transition-all" :class="[
              selectedStyle === style.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300',
            ]"
            @click="selectedStyle = style.id"
          >
            <div
              class="w-8 h-8 rounded mr-3"
              :style="style.preview"
            />
            <span class="text-sm font-medium">{{ style.name }}</span>
          </button>
        </div>
      </div>

      <!-- 主题输入 -->
      <div class="option-group">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          内容主题
        </label>
        <input
          v-model="topic"
          placeholder="例如：人工智能、产品发布、技术教程..."
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
        >
      </div>

      <!-- 配色方案 -->
      <div class="option-group">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          配色方案
        </label>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="scheme in colorSchemes"
            :key="scheme.id"
            class="flex flex-col items-center p-2 rounded-lg border-2 transition-all" :class="[
              selectedColorScheme === scheme.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300',
            ]"
            @click="selectedColorScheme = scheme.id"
          >
            <div
              class="w-6 h-6 rounded mb-1"
              :style="scheme.colors"
            />
            <span class="text-xs">{{ scheme.name }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="generate-actions mt-6 space-y-3">
      <Button
        class="w-full"
        :disabled="!canGenerate || isGenerating"
        @click="generateAITemplate"
      >
        <Loader2 v-if="isGenerating" class="w-4 h-4 mr-2 animate-spin" />
        <Sparkles v-else class="w-4 h-4 mr-2" />
        {{ isGenerating ? '生成中...' : 'AI生成模板' }}
      </Button>

      <Button
        variant="outline"
        class="w-full"
        :disabled="!canGenerate"
        @click="previewTemplate"
      >
        <Eye class="w-4 h-4 mr-2" />
        预览并复制到剪贴板
      </Button>
    </div>
  </div>
</template>

<style scoped>
.ai-template-generator {
  max-height: 100vh;
  overflow-y: auto;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

button {
  transition: all 0.2s ease-in-out;
}

button:hover {
  transform: scale(1.05);
}

button:active {
  transform: scale(0.95);
}
</style>
