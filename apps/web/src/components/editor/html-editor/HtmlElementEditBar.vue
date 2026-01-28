<script setup lang="ts">
import imageCompression from 'browser-image-compression'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
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

const FALLBACK_IMAGE_URL = `/images/sunflower.jpg`

// 动画相关状态
const isTransitioning = ref(false)
const transitionDuration = 200 // 动画持续时间(ms)
let transitionTimer: ReturnType<typeof setTimeout> | null = null

watchEffect(() => {
  if (previewRef.value) {
    const processedHtml = replaceExternalImages(props.htmlContent)
    previewRef.value.innerHTML = processedHtml
    nextTick(() => {
      previewStyleStore.applyStyles()
      setupElementSelection()
    })
  }
})

let mouseUpHandler: ((e: MouseEvent) => void) | null = null
let mouseDownHandler: ((e: MouseEvent) => void) | null = null
let mouseMoveHandler: ((e: MouseEvent) => void) | null = null
let clickHandler: ((e: MouseEvent) => void) | null = null
let selectionCheckTimer: ReturnType<typeof setTimeout> | null = null
let isSelecting = false
let hoverTimer: ReturnType<typeof setTimeout> | null = null

// 替换所有外部图片为本地图片
function replaceExternalImages(html: string): string {
  if (!html)
    return html

  let processedHtml = html
  let replacedCount = 0

  // 1. 替换 <img> 标签的 src 属性（排除 base64）
  processedHtml = processedHtml.replace(
    /<img([^>]*?)src=["']([^"']+)["']([^>]*)>/gi,
    (match, before, src, after) => {
      // 保留 base64 图片
      if (src.startsWith(`data:image/`)) {
        return match
      }
      replacedCount++
      return `<img${before}src="${FALLBACK_IMAGE_URL}"${after}>`
    },
  )

  // 2. 替换 CSS background-image（排除 base64）
  processedHtml = processedHtml.replace(
    /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
    (match, url) => {
      if (url.startsWith(`data:image/`)) {
        return match
      }
      replacedCount++
      return `background-image: url("${FALLBACK_IMAGE_URL}")`
    },
  )

  // 3. 替换 style 属性中的 background 简写（排除 base64）
  processedHtml = processedHtml.replace(
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    /background:\s*([^;}"']*?)url\(["']?([^"')]+)["']?\)([^;}"']*)/gi,
    (match, before, url, after) => {
      if (url.startsWith(`data:image/`)) {
        return match
      }
      replacedCount++
      return `background: ${before}url("${FALLBACK_IMAGE_URL}")${after}`
    },
  )

  if (replacedCount > 0) {
    console.log(`[图片替换] 已替换 ${replacedCount} 张外部图片`)
  }

  return processedHtml
}

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
  if (mouseMoveHandler) {
    previewRef.value.removeEventListener(`mousemove`, mouseMoveHandler)
  }
  if (clickHandler) {
    previewRef.value.removeEventListener(`click`, clickHandler)
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

  mouseMoveHandler = (e: MouseEvent) => {
    // 清除之前的悬停计时器
    if (hoverTimer) {
      clearTimeout(hoverTimer)
    }

    // 延迟100ms后检查元素，避免过度敏感的响应
    hoverTimer = setTimeout(() => {
      handleElementHover(e)
    }, 100)
  }

  clickHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement

    // 如果正在选择文本或AI聊天已打开，不处理点击
    if (isSelecting || aiChatOpen.value) {
      return
    }

    // 查找可编辑的HTML元素
    let element: HTMLElement | null = target
    while (element && element !== previewRef.value) {
      // 检查元素是否可编辑：有文本内容或者是img/video等媒体元素
      const hasTextContent = element.textContent?.trim() && element.textContent.trim().length > 0
      const isMediaElement = [`IMG`, `VIDEO`, `AUDIO`, `CANVAS`, `SVG`, `IFRAME`].includes(element.tagName)

      if (hasTextContent || isMediaElement) {
        // 检查鼠标位置是否在该元素内
        const rect = element.getBoundingClientRect()
        if (e.clientX >= rect.left && e.clientX <= rect.right
          && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          // 获取工具栏的实际高度
          const estimatedToolbarHeight = 52
          const toolbarVerticalPadding = 10
          const toolbarHorizontalPadding = 20
          const estimatedToolbarWidth = 380

          // 计算工具栏位置
          let x = rect.left + rect.width / 2
          let y = rect.top - estimatedToolbarHeight - toolbarVerticalPadding

          // 检查可用空间
          const spaceAbove = rect.top - toolbarVerticalPadding
          const spaceBelow = window.innerHeight - rect.bottom - toolbarVerticalPadding

          // 如果上方空间不足且下方空间充足，则显示在元素下方
          if (spaceAbove < estimatedToolbarHeight && spaceBelow > estimatedToolbarHeight) {
            y = rect.bottom + toolbarVerticalPadding
          }

          // 确保工具栏不会超出屏幕横向边界
          const minX = toolbarHorizontalPadding + estimatedToolbarWidth / 2
          const maxX = window.innerWidth - toolbarHorizontalPadding - estimatedToolbarWidth / 2

          if (x < minX)
            x = minX
          if (x > maxX)
            x = maxX

          // 设置工具栏位置
          contextMenuPosition.value = { x, y }
          selectElement(element, true)
          contextMenuOpen.value = true
          selectedText.value = element.textContent || ``
          return
        }
      }
      element = element.parentElement
    }
  }

  previewRef.value.addEventListener(`mousedown`, mouseDownHandler)
  previewRef.value.addEventListener(`mouseup`, mouseUpHandler)
  previewRef.value.addEventListener(`mousemove`, mouseMoveHandler)
  previewRef.value.addEventListener(`click`, clickHandler)
}

function handleElementHover(e: MouseEvent) {
  const target = e.target as HTMLElement

  // 如果正在选择文本或AI聊天已打开，不处理悬停
  if (isSelecting || aiChatOpen.value) {
    return
  }

  // 查找可编辑的HTML元素
  let element: HTMLElement | null = target
  while (element && element !== previewRef.value) {
    // 检查元素是否可编辑：有文本内容或者是img/video等媒体元素
    const hasTextContent = element.textContent?.trim() && element.textContent.trim().length > 0
    const isMediaElement = [`IMG`, `VIDEO`, `AUDIO`, `CANVAS`, `SVG`, `IFRAME`].includes(element.tagName)

    if (hasTextContent || isMediaElement) {
      // 检查鼠标位置是否在该元素内
      const rect = element.getBoundingClientRect()
      if (e.clientX >= rect.left && e.clientX <= rect.right
        && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        // 只显示高亮边框，不显示工具栏
        if (selectedElement.value !== element || !contextMenuOpen.value) {
          addHoverHighlight(element)
        }
        return
      }
    }
    element = element.parentElement
  }

  // 如果没有悬停在任何元素上，清除hover高亮
  removeHoverHighlight()
}

// 添加悬停高亮（不选中元素）
let hoveredElement: HTMLElement | null = null

function addHoverHighlight(element: HTMLElement) {
  // 如果已经有选中的元素且工具栏打开，不覆盖
  if (selectedElement.value && contextMenuOpen.value) {
    return
  }

  removeHoverHighlight()
  hoveredElement = element

  // 检查是否是媒体元素，使用更明显的高亮效果
  const isMediaElement = [`IMG`, `VIDEO`, `AUDIO`, `CANVAS`, `SVG`, `IFRAME`].includes(element.tagName)

  if (isMediaElement) {
    // 媒体元素：使用更粗、更明显的轮廓
    element.style.outline = `2px solid rgba(59, 130, 246, 0.5)`
    element.style.outlineOffset = `0px`
  }
  else {
    // 文本元素：使用柔和效果
    element.style.outline = `2px solid rgba(59, 130, 246, 0.4)`
    element.style.outlineOffset = `2px`
  }

  element.style.transition = `all 0.2s ease-out`
  element.setAttribute(`data-hover`, `true`)
}

function removeHoverHighlight() {
  if (hoveredElement) {
    hoveredElement.style.outline = ``
    hoveredElement.style.outlineOffset = ``
    hoveredElement.style.transition = ``
    hoveredElement.removeAttribute(`data-hover`)
    hoveredElement = null
  }
}

function checkTextSelection() {
  if (isSelecting) {
    return
  }

  const selection = window.getSelection()

  console.log(`selection`, selection)

  // 如果没有文本选择
  if (!selection || selection.rangeCount === 0 || selection.toString().trim().length === 0) {
    // 不要关闭工具栏，因为可能是通过点击元素打开的
    // 只清空选中的文本内容
    selectedText.value = ``
    return
  }

  const selectedTextContent = selection.toString().trim()

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
  }
  catch (e) {
    console.error(`Error in checkTextSelection:`, e)
  }
}

function selectElement(element: HTMLElement, animate = true) {
  // 如果有正在进行的过渡动画，先清除
  if (transitionTimer) {
    clearTimeout(transitionTimer)
    isTransitioning.value = false
  }

  // 清除hover高亮
  removeHoverHighlight()

  clearSelection()

  // 在位置变化前添加过渡效果
  if (animate && contextMenuOpen.value) {
    isTransitioning.value = true
    transitionTimer = setTimeout(() => {
      isTransitioning.value = false
      transitionTimer = null
    }, transitionDuration)
  }

  selectedElement.value = element
  if (!element.getAttribute(`data-element-id`)) {
    element.setAttribute(`data-element-id`, `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  }

  // 为元素添加切换闪烁效果
  element.classList.add(`element-flash`)
  setTimeout(() => {
    element.classList.remove(`element-flash`)
  }, 400)

  // 检查是否是媒体元素，使用更明显的高亮效果
  const isMediaElement = [`IMG`, `VIDEO`, `AUDIO`, `CANVAS`, `SVG`, `IFRAME`].includes(element.tagName)

  if (isMediaElement) {
    // 媒体元素：使用更粗、更明显的轮廓
    element.style.outline = `4px solid rgba(59, 130, 246, 0.9)`
    element.style.outlineOffset = `0px`
    element.style.boxShadow = `0 0 0 8px rgba(147, 51, 234, 0.4), 0 0 20px rgba(59, 130, 246, 0.6), inset 0 0 0 4px rgba(255, 255, 255, 0.8)`
  }
  else {
    // 文本元素：使用原有的柔和效果
    element.style.outline = `2px solid rgba(59, 130, 246, 0.6)`
    element.style.outlineOffset = `2px`
    element.style.boxShadow = `0 0 0 4px rgba(147, 51, 234, 0.2), inset 0 0 0 2px rgba(59, 130, 246, 0.1)`
  }

  element.style.transition = `all 0.3s ease-out`
  element.setAttribute(`data-selected`, `true`)
}

function clearSelection() {
  if (selectedElement.value) {
    selectedElement.value.style.outline = ``
    selectedElement.value.style.outlineOffset = ``
    selectedElement.value.style.boxShadow = ``
    selectedElement.value.style.transition = ``
    selectedElement.value.classList.remove(`element-flash`)
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
    // 点击工具栏、预览区域或AI输入框时，不关闭工具栏
    if (!target.closest(`.floating-style-toolbar`) && !target.closest(`#html-output`) && !target.closest(`.ai-refine-input`)) {
      // 只有点击外部区域时才关闭
      contextMenuOpen.value = false
      clearSelection()
      removeHoverHighlight()
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
  if (mouseMoveHandler && previewRef.value) {
    previewRef.value.removeEventListener(`mousemove`, mouseMoveHandler)
  }
  if (clickHandler && previewRef.value) {
    previewRef.value.removeEventListener(`click`, clickHandler)
  }
  if (selectionCheckTimer) {
    clearTimeout(selectionCheckTimer)
  }
  if (hoverTimer) {
    clearTimeout(hoverTimer)
  }
  removeHoverHighlight()
  clearSelection()
})
</script>

<template>
  <div class="h-full w-full">
    <div
      id="html-output"
      ref="previewRef"
      class="html-preview-panel html-preview-content h-full w-full overflow-y-auto bg-background relative p-4"
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
          :class="{ 'transition-all duration-300 ease-out': isTransitioning, 'will-change-transform': isTransitioning, 'toolbar-switching': isTransitioning }"
          :style="{
            'left': `${contextMenuPosition.x}px`,
            'top': `${contextMenuPosition.y}px`,
            'transform': 'translateX(-50%)',
            '--tw-scale-x': isTransitioning ? '0.95' : '1',
            '--tw-scale-y': isTransitioning ? '0.95' : '1',
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

/* 工具栏切换时的动画效果 */
.toolbar-switching {
  animation: toolbarBounce 0.3s ease-out;
}

@keyframes toolbarBounce {
  0% {
    transform: translateX(-50%) scale(0.95);
    opacity: 0.8;
  }
  50% {
    transform: translateX(-50%) scale(1.05);
    opacity: 1;
  }
  100% {
    transform: translateX(-50%) scale(1);
    opacity: 1;
  }
}

/* 元素切换时的闪光效果 */
.element-flash {
  animation: elementFlash 0.4s ease-out;
}

@keyframes elementFlash {
  0% {
    outline-color: rgba(251, 191, 36, 0.8);
    box-shadow:
      0 0 0 6px rgba(251, 191, 36, 0.3),
      inset 0 0 0 2px rgba(251, 191, 36, 0.2);
  }
  100% {
    outline-color: rgba(59, 130, 246, 0.6);
    box-shadow:
      0 0 0 4px rgba(147, 51, 234, 0.2),
      inset 0 0 0 2px rgba(59, 130, 246, 0.1);
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
