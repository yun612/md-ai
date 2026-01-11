<script setup lang="ts">
import imageCompression from 'browser-image-compression'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Image,
  Italic,
  Palette,
  Sparkles,
  TypeOutline,
  Underline,
  X,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useAIConfigStore } from '@/stores/aiConfig'
import { toBase64 } from '@/utils'
import { fileUpload } from '@/utils/file'
import AiRefineInput from './AiRefineInput.vue'
import { usePreviewStyleStore } from './usePreviewStyleStore'

const props = defineProps<{
  htmlContent: string
}>()

const previewRef = ref<HTMLDivElement>()
const selectedElement = ref<HTMLElement | null>(null)
const contextMenuOpen = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const previewStyleStore = usePreviewStyleStore()
const selectedText = ref(``)
const aiChatOpen = ref(false)
const isAiRefining = ref(false)
const aiConfigStore = useAIConfigStore()
const { endpoint, model, apiKey, temperature, maxToken, type } = storeToRefs(aiConfigStore)

watchEffect(() => {
  if (previewRef.value) {
    previewRef.value.innerHTML = props.htmlContent
    nextTick(() => {
      previewStyleStore.applyStyles()
      setupElementSelection()
    })
  }
})

let mouseUpHandler: ((e: MouseEvent) => void) | null = null
let mouseDownHandler: ((e: MouseEvent) => void) | null = null
let selectionCheckTimer: ReturnType<typeof setTimeout> | null = null
let isSelecting = false

function setupElementSelection() {
  if (!previewRef.value) {
    return
  }

  if (mouseUpHandler) {
    previewRef.value.removeEventListener(`mouseup`, mouseUpHandler)
  }
  if (mouseDownHandler) {
    previewRef.value.removeEventListener(`mousedown`, mouseDownHandler)
  }

  if (selectionCheckTimer) {
    clearTimeout(selectionCheckTimer)
    selectionCheckTimer = null
  }

  mouseDownHandler = () => {
    isSelecting = true
    if (selectionCheckTimer) {
      clearTimeout(selectionCheckTimer)
    }
  }

  mouseUpHandler = () => {
    isSelecting = false
    if (selectionCheckTimer) {
      clearTimeout(selectionCheckTimer)
    }
    selectionCheckTimer = setTimeout(() => {
      checkTextSelection()
    }, 50)
  }

  previewRef.value.addEventListener(`mousedown`, mouseDownHandler)
  previewRef.value.addEventListener(`mouseup`, mouseUpHandler)
}

function checkTextSelection() {
  if (isSelecting) {
    return
  }

  const selection = window.getSelection()

  console.log(`selection`, selection)
  if (!selection || selection.rangeCount === 0) {
    if (contextMenuOpen.value) {
      contextMenuOpen.value = false
      selectedText.value = ``
      clearSelection()
    }
    return
  }

  const selectedTextContent = selection.toString().trim()
  if (selectedTextContent.length === 0) {
    if (contextMenuOpen.value) {
      contextMenuOpen.value = false
      selectedText.value = ``
      clearSelection()
    }
    return
  }

  if (selectedText.value === selectedTextContent && contextMenuOpen.value) {
    return
  }

  selectedText.value = selectedTextContent

  try {
    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer
    const element = container.nodeType === Node.TEXT_NODE
      ? container.parentElement
      : container as HTMLElement

    if (element && previewRef.value?.contains(element)) {
      const rect = range.getBoundingClientRect()

      if (rect.width === 0 && rect.height === 0) {
        return
      }

      const menuWidth = 200
      const menuHeight = 400

      let x = rect.left + rect.width / 2
      let y = rect.top - menuHeight - 10

      if (x - menuWidth / 2 < 10) {
        x = menuWidth / 2 + 10
      }
      if (x + menuWidth / 2 > window.innerWidth - 10) {
        x = window.innerWidth - menuWidth / 2 - 10
      }

      if (y < 10) {
        y = rect.bottom + 10
      }

      contextMenuPosition.value = { x, y }
      selectElement(element)
      contextMenuOpen.value = true
    }
    else {
      if (contextMenuOpen.value) {
        contextMenuOpen.value = false
        clearSelection()
      }
    }
  }
  catch (e) {
    console.error(`Error in checkTextSelection:`, e)
  }
}

function selectElement(element: HTMLElement) {
  clearSelection()
  selectedElement.value = element
  if (!element.getAttribute(`data-element-id`)) {
    element.setAttribute(`data-element-id`, `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  }
  // 应用渐变高亮效果 - 只使用 outline 和 box-shadow，不影响背景色
  element.style.outline = `2px solid rgba(59, 130, 246, 0.6)`
  element.style.outlineOffset = `2px`
  element.style.boxShadow = `0 0 0 4px rgba(147, 51, 234, 0.2), inset 0 0 0 2px rgba(59, 130, 246, 0.1)`
  element.style.transition = `all 0.3s ease-out`
  element.setAttribute(`data-selected`, `true`)
}

function clearSelection() {
  if (selectedElement.value) {
    selectedElement.value.style.outline = ``
    selectedElement.value.style.outlineOffset = ``
    selectedElement.value.style.boxShadow = ``
    selectedElement.value.style.transition = ``
    selectedElement.value.removeAttribute(`data-selected`)
  }
  selectedElement.value = null
}

function applyStyle(styles: Record<string, string>) {
  if (!selectedElement.value)
    return

  const selector = previewStyleStore.generateSelector(selectedElement.value)
  const existingOverride = previewStyleStore.getStyleForElement(selectedElement.value)

  if (existingOverride) {
    previewStyleStore.updateStyleOverride(existingOverride.id, styles)
  }
  else {
    previewStyleStore.addStyleOverride(selector, styles)
  }
}

async function handleAddBackgroundImage() {
  contextMenuOpen.value = false
  if (!selectedElement.value)
    return

  const input = document.createElement(`input`)
  input.type = `file`
  input.accept = `image/*`
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file)
      return

    try {
      const useCompression = localStorage.getItem(`useCompression`) === `true`
      let processedFile = file
      if (useCompression) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        }
        processedFile = await imageCompression(file, options)
      }

      const base64Content = await toBase64(processedFile)
      const url = await fileUpload(base64Content, processedFile)
      applyStyle({
        backgroundImage: `url(${url})`,
        backgroundSize: `cover`,
        backgroundPosition: `center`,
        backgroundRepeat: `no-repeat`,
      })
      toast.success(`背景图已添加`)
    }
    catch (err) {
      toast.error((err as any).message || `上传失败`)
    }
  }
  input.click()
}

function handleChangeToHeading(level: number) {
  contextMenuOpen.value = false
  if (!selectedElement.value)
    return

  const newTag = `h${level}`
  const newElement = document.createElement(newTag)
  newElement.innerHTML = selectedElement.value.innerHTML
  newElement.className = selectedElement.value.className

  Array.from(selectedElement.value.attributes).forEach((attr) => {
    if (attr.name !== `data-selected`) {
      newElement.setAttribute(attr.name, attr.value)
    }
  })

  selectedElement.value.parentNode?.replaceChild(newElement, selectedElement.value)
  selectedElement.value = newElement

  applyStyle({
    fontSize: `${48 - level * 4}px`,
    fontWeight: `bold`,
    margin: `0.5em 0`,
  })

  if (previewRef.value && newElement.parentNode) {
    nextTick(() => {
      setupElementSelection()
      const updatedElement = previewRef.value?.querySelector(newElement.tagName.toLowerCase())
      if (updatedElement) {
        selectElement(updatedElement as HTMLElement)
      }
    })
  }
}

function handleChangeTextStyle(style: string) {
  contextMenuOpen.value = false
  if (!selectedElement.value)
    return

  const styles: Record<string, string> = {}
  switch (style) {
    case `bold`:
      styles.fontWeight = `bold`
      break
    case `italic`:
      styles.fontStyle = `italic`
      break
    case `underline`:
      styles.textDecoration = `underline`
      break
    case `large`:
      styles.fontSize = `1.5em`
      break
    case `small`:
      styles.fontSize = `0.875em`
      break
    case `center`:
      styles.textAlign = `center`
      break
    case `left`:
      styles.textAlign = `left`
      break
    case `right`:
      styles.textAlign = `right`
      break
  }

  applyStyle(styles)
}

function handleChangeColor() {
  contextMenuOpen.value = false
  if (!selectedElement.value)
    return

  const input = document.createElement(`input`)
  input.type = `color`

  const currentColor = getComputedStyle(selectedElement.value).color
  if (currentColor && currentColor !== `rgba(0, 0, 0, 0)`) {
    const rgb = currentColor.match(/\d+/g)
    if (rgb && rgb.length >= 3) {
      const hex = `#${rgb.map((x) => {
        const hex = Number.parseInt(x).toString(16)
        return hex.length === 1 ? `0${hex}` : hex
      }).join(``)}`
      input.value = hex
    }
  }

  input.onchange = (e) => {
    const color = (e.target as HTMLInputElement).value
    applyStyle({ color })
    toast.success(`文字颜色已修改为 ${color}`)
  }

  input.oninput = (e) => {
    const color = (e.target as HTMLInputElement).value
    applyStyle({ color })
  }

  input.click()
}

function handleChangeBackgroundColor() {
  contextMenuOpen.value = false
  if (!selectedElement.value)
    return

  const input = document.createElement(`input`)
  input.type = `color`

  const currentBgColor = getComputedStyle(selectedElement.value).backgroundColor
  if (currentBgColor && currentBgColor !== `rgba(0, 0, 0, 0)`) {
    const rgb = currentBgColor.match(/\d+/g)
    if (rgb && rgb.length >= 3) {
      const hex = `#${rgb.map((x) => {
        const hex = Number.parseInt(x).toString(16)
        return hex.length === 1 ? `0${hex}` : hex
      }).join(``)}`
      input.value = hex
    }
  }

  input.onchange = (e) => {
    const color = (e.target as HTMLInputElement).value
    applyStyle({ backgroundColor: color })
    toast.success(`背景颜色已修改为 ${color}`)
  }

  input.oninput = (e) => {
    const color = (e.target as HTMLInputElement).value
    applyStyle({ backgroundColor: color })
  }

  input.click()
}

function handleRemoveStyle() {
  contextMenuOpen.value = false
  if (!selectedElement.value)
    return

  const existingOverride = previewStyleStore.getStyleForElement(selectedElement.value)
  if (existingOverride) {
    previewStyleStore.removeStyleOverride(existingOverride.id)
    toast.success(`样式已移除`)
  }
}

async function handleAiRefine(requirement: string, previousRequirements: string[]) {
  if (!selectedElement.value)
    return

  isAiRefining.value = true
  contextMenuOpen.value = false

  try {
    const element = selectedElement.value
    const elementText = element.textContent || ``
    const elementTag = element.tagName.toLowerCase()
    const computedStyle = window.getComputedStyle(element)
    const currentStyles = {
      color: computedStyle.color,
      fontSize: computedStyle.fontSize,
      fontWeight: computedStyle.fontWeight,
      fontStyle: computedStyle.fontStyle,
      textAlign: computedStyle.textAlign,
      backgroundColor: computedStyle.backgroundColor,
    }

    const contextInfo = `
选中的元素信息：
- 标签：${elementTag}
- 文本内容：${elementText.substring(0, 200)}${elementText.length > 200 ? `...` : ``}
- 当前样式：
  * 颜色：${currentStyles.color}
  * 字号：${currentStyles.fontSize}
  * 字重：${currentStyles.fontWeight}
  * 字体样式：${currentStyles.fontStyle}
  * 对齐方式：${currentStyles.textAlign}
  * 背景色：${currentStyles.backgroundColor}
`

    const previousReqText = previousRequirements.length > 0
      ? `\n之前的修改要求：\n${previousRequirements.map((r, i) => `${i + 1}. ${r}`).join(`\n`)}\n`
      : ``

    const systemPrompt = `你是一名专业的 HTML 内容编辑助手。用户会选中一个 HTML 元素，并提供修改要求。你需要：
1. 理解用户的需求
2. 根据需求修改元素的文本内容或样式
3. 返回修改后的内容，格式为 JSON：
   {
     "text": "修改后的文本内容（如果需要修改文本）",
     "styles": {
       "color": "颜色值（如果需要修改颜色）",
       "fontSize": "字号（如果需要修改字号）",
       "fontWeight": "字重（如果需要修改字重）",
       "fontStyle": "字体样式（如果需要修改）",
       "textAlign": "对齐方式（如果需要修改）",
       "backgroundColor": "背景色（如果需要修改）"
     },
     "tag": "标签名（如果需要修改标签，如 h1, h2, p 等）"
   }
注意：只返回需要修改的字段，不需要修改的字段不要包含在 JSON 中。`

    const userMessage = `${contextInfo}${previousReqText}\n用户要求：${requirement}\n\n请根据要求修改这个元素，返回 JSON 格式的修改结果。`

    const messages = [
      { role: `system`, content: systemPrompt },
      { role: `user`, content: userMessage },
    ]

    const payload = {
      model: model.value,
      messages,
      temperature: temperature.value,
      max_tokens: maxToken.value,
      stream: false,
    }

    const headers: Record<string, string> = {
      'Content-Type': `application/json`,
    }
    if (apiKey.value && type.value !== `default`) {
      headers.Authorization = `Bearer ${apiKey.value}`
    }

    const url = new URL(endpoint.value)
    if (!url.pathname.endsWith(`/chat/completions`)) {
      url.pathname = url.pathname.replace(/\/?$/, `/chat/completions`)
    }

    const res = await window.fetch(url.toString(), {
      method: `POST`,
      headers,
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(`响应错误：${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    const aiResponse = data.choices?.[0]?.message?.content || ``

    let result
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      }
      else {
        throw new Error(`未找到 JSON 格式的响应`)
      }
    }
    catch {
      throw new Error(`AI 返回的格式不正确，请重试`)
    }

    if (result.text !== undefined) {
      element.textContent = result.text
    }

    if (result.tag && result.tag !== elementTag) {
      const newElement = document.createElement(result.tag)
      newElement.textContent = element.textContent || ``
      newElement.className = element.className
      Array.from(element.attributes).forEach((attr) => {
        if (attr.name !== `data-selected`) {
          newElement.setAttribute(attr.name, attr.value)
        }
      })
      element.parentNode?.replaceChild(newElement, element)
      selectedElement.value = newElement
    }

    if (result.styles && Object.keys(result.styles).length > 0) {
      applyStyle(result.styles)
    }

    toast.success(`AI 修改完成`)
    aiChatOpen.value = false
  }
  catch (error: any) {
    console.error(`AI 修改失败:`, error)
    toast.error(error.message || `AI 修改失败，请重试`)
  }
  finally {
    isAiRefining.value = false
  }
}

function handleOpenAiChat() {
  contextMenuOpen.value = false
  aiChatOpen.value = true
}

onMounted(() => {
  previewStyleStore.applyStyles()

  const closeMenuHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest(`.custom-context-menu`) && !target.closest(`#html-output`) && !target.closest(`.ai-refine-input`)) {
      const selection = window.getSelection()
      if (selection && selection.toString().trim().length === 0) {
        contextMenuOpen.value = false
        clearSelection()
      }
    }
  }

  document.addEventListener(`click`, closeMenuHandler)

  onUnmounted(() => {
    document.removeEventListener(`click`, closeMenuHandler)
  })
})

onUnmounted(() => {
  if (mouseUpHandler && previewRef.value) {
    previewRef.value.removeEventListener(`mouseup`, mouseUpHandler)
  }
  if (mouseDownHandler && previewRef.value) {
    previewRef.value.removeEventListener(`mousedown`, mouseDownHandler)
  }
  if (selectionCheckTimer) {
    clearTimeout(selectionCheckTimer)
  }
  clearSelection()
})
</script>

<template>
  <div>
    <div
      id="html-output"
      ref="previewRef"
      class="html-preview-panel html-preview-content h-full overflow-y-auto bg-background relative p-4 w-full"
    />
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 scale-90 -translate-y-2"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 scale-100 translate-y-0"
        leave-to-class="opacity-0 scale-90 -translate-y-2"
      >
        <div
          v-if="contextMenuOpen"
          class="floating-style-toolbar fixed z-[200]"
          :style="{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
            transform: 'translateX(-50%)',
          }"
          @click.stop
          @contextmenu.prevent.stop
        >
          <!-- 基础样式组 -->
          <div class="toolbar-group">
            <button
              class="toolbar-btn"
              title="加粗"
              @click="handleChangeTextStyle('bold')"
            >
              <Bold :size="20" />
            </button>
            <button
              class="toolbar-btn"
              title="斜体"
              @click="handleChangeTextStyle('italic')"
            >
              <Italic :size="20" />
            </button>
            <button
              class="toolbar-btn"
              title="下划线"
              @click="handleChangeTextStyle('underline')"
            >
              <Underline :size="20" />
            </button>
          </div>

          <div class="toolbar-divider" />

          <!-- 格式组 -->
          <div class="toolbar-group">
            <button
              class="toolbar-btn"
              title="改为标题1"
              @click="handleChangeToHeading(1)"
            >
              <span class="text-xs font-semibold">H1</span>
            </button>
            <button
              class="toolbar-btn"
              title="改为标题2"
              @click="handleChangeToHeading(2)"
            >
              <span class="text-xs font-semibold">H2</span>
            </button>
            <button
              class="toolbar-btn"
              title="改为标题3"
              @click="handleChangeToHeading(3)"
            >
              <span class="text-xs font-semibold">H3</span>
            </button>
          </div>

          <div class="toolbar-divider" />

          <!-- 字号组 -->
          <div class="toolbar-group">
            <button
              class="toolbar-btn"
              title="增大字号"
              @click="handleChangeTextStyle('large')"
            >
              <TypeOutline :size="20" class="scale-125" />
            </button>
            <button
              class="toolbar-btn"
              title="减小字号"
              @click="handleChangeTextStyle('small')"
            >
              <TypeOutline :size="20" class="scale-75" />
            </button>
          </div>

          <div class="toolbar-divider" />

          <!-- 对齐组 -->
          <div class="toolbar-group">
            <button
              class="toolbar-btn"
              title="左对齐"
              @click="handleChangeTextStyle('left')"
            >
              <AlignLeft :size="20" />
            </button>
            <button
              class="toolbar-btn"
              title="居中"
              @click="handleChangeTextStyle('center')"
            >
              <AlignCenter :size="20" />
            </button>
            <button
              class="toolbar-btn"
              title="右对齐"
              @click="handleChangeTextStyle('right')"
            >
              <AlignRight :size="20" />
            </button>
          </div>

          <div class="toolbar-divider" />

          <!-- 颜色和样式组 -->
          <div class="toolbar-group">
            <button
              class="toolbar-btn"
              title="文字颜色"
              @click="handleChangeColor"
            >
              <Palette :size="20" />
            </button>
            <button
              class="toolbar-btn"
              title="背景颜色"
              @click="handleChangeBackgroundColor"
            >
              <Highlighter :size="20" />
            </button>
            <button
              class="toolbar-btn"
              title="添加背景图"
              @click="handleAddBackgroundImage"
            >
              <Image :size="20" />
            </button>
          </div>

          <div class="toolbar-divider" />

          <!-- AI 和其他组 -->
          <div class="toolbar-group">
            <button
              class="toolbar-btn toolbar-btn-primary"
              title="AI 修改"
              @click="handleOpenAiChat"
            >
              <Sparkles :size="20" />
            </button>
            <button
              class="toolbar-btn toolbar-btn-danger"
              title="移除样式"
              @click="handleRemoveStyle"
            >
              <X :size="20" />
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="aiChatOpen"
        class="fixed z-[300] bg-white rounded-lg shadow-xl border border-gray-200 p-4"
        :style="{
          left: `${contextMenuPosition.x}px`,
          top: `${contextMenuPosition.y + 20}px`,
          transform: 'translateX(-50%)',
          minWidth: '400px',
          maxWidth: '600px',
        }"
        @click.stop
      >
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-800">
            AI 修改选中内容
          </h3>
          <button
            class="text-gray-400 hover:text-gray-600 transition-colors"
            @click="aiChatOpen = false"
          >
            <X :size="16" />
          </button>
        </div>
        <AiRefineInput
          :selected-element="selectedElement"
          :selected-text="selectedText"
          placeholder="例如：让这段文字更简洁、改为标题样式、调整颜色为蓝色..."
          :disabled="isAiRefining"
          :on-submit="handleAiRefine"
          @status-change="(val) => isAiRefining = val"
        />
      </div>
    </Teleport>
  </div>
</template>

    <style scoped>
.html-preview-panel {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
    'Helvetica Neue', sans-serif;
}

.html-preview-content {
  max-width: 100%;
  word-wrap: break-word;
}

.html-preview-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.html-preview-content :deep(pre) {
  overflow-x: auto;
  padding: 1em;
  background: #f5f5f5;
  border-radius: 4px;
}

.html-preview-content :deep(code) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

/* 浮动工具栏样式 */
.floating-style-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 2px 6px rgba(0, 0, 0, 0.08);
  pointer-events: auto;
  user-select: none;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .floating-style-toolbar {
    background: rgba(26, 26, 26, 0.95);
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.4),
      0 2px 6px rgba(0, 0, 0, 0.3);
  }
}

/* 工具栏分组 */
.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* 分隔线 */
.toolbar-divider {
  width: 1px;
  height: 24px;
  background: rgba(0, 0, 0, 0.1);
  margin: 0 4px;
}

@media (prefers-color-scheme: dark) {
  .toolbar-divider {
    background: rgba(255, 255, 255, 0.1);
  }
}

/* 工具栏按钮 */
.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: rgba(0, 0, 0, 0.7);
  transition: all 0.2s ease-out;
  position: relative;
  overflow: hidden;
}

.toolbar-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  opacity: 0;
  transition: opacity 0.2s ease-out;
}

.toolbar-btn:hover {
  color: rgba(0, 0, 0, 0.9);
  transform: scale(1.05);
}

.toolbar-btn:hover::before {
  opacity: 1;
}

.toolbar-btn:active {
  transform: scale(0.95);
}

/* 深色模式按钮 */
@media (prefers-color-scheme: dark) {
  .toolbar-btn {
    color: rgba(255, 255, 255, 0.7);
  }

  .toolbar-btn::before {
    background: rgba(255, 255, 255, 0.1);
  }

  .toolbar-btn:hover {
    color: rgba(255, 255, 255, 0.95);
  }
}

/* 主要按钮样式 (AI按钮) */
.toolbar-btn-primary {
  color: #8b5cf6;
}

.toolbar-btn-primary::before {
  background: rgba(139, 92, 246, 0.1);
}

.toolbar-btn-primary:hover {
  color: #7c3aed;
}

/* 危险按钮样式 (移除样式) */
.toolbar-btn-danger {
  color: #ef4444;
}

.toolbar-btn-danger::before {
  background: rgba(239, 68, 68, 0.1);
}

.toolbar-btn-danger:hover {
  color: #dc2626;
}

/* 选中元素的动画效果 */
:deep([data-selected='true']) {
  animation: pulseHighlight 2s ease-in-out infinite;
}

@keyframes pulseHighlight {
  0%,
  100% {
    outline: 2px solid rgba(59, 130, 246, 0.6);
    outline-offset: 2px;
    box-shadow:
      0 0 0 4px rgba(147, 51, 234, 0.2),
      inset 0 0 0 2px rgba(59, 130, 246, 0.1);
  }
  50% {
    outline: 2px solid rgba(59, 130, 246, 0.8);
    outline-offset: 2px;
    box-shadow:
      0 0 0 4px rgba(147, 51, 234, 0.4),
      inset 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
}
</style>

<style>
.custom-context-menu {
  z-index: 9999 !important;
  pointer-events: auto !important;
  visibility: visible !important;
  opacity: 1 !important;
  display: block !important;
  background-color: hsl(var(--popover)) !important;
  border-color: hsl(var(--border)) !important;
  color: hsl(var(--popover-foreground)) !important;
}
</style>
