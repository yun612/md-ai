<script setup lang="ts">
import { Bot, Copy, Eye, EyeOff, FileText, HelpCircle, Palette, SlidersHorizontal, Sparkles } from 'lucide-vue-next'
import { useHtmlEditorStore } from '@/components/editor/html-editor'
import { usePreviewStyleStore } from '@/components/editor/html-editor/usePreviewStyleStore'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDisplayStore } from '@/stores/display'
import { useEditorStore } from '@/stores/editor'
import { useExportStore } from '@/stores/export'
import { useRenderStore } from '@/stores/render'
import { useThemeStore } from '@/stores/theme'
import { useUIStore } from '@/stores/ui'
import { addPrefix, generatePureHTML, processClipboardContent } from '@/utils'

const emit = defineEmits([`startCopy`, `endCopy`, `toggleTemplateGallery`])

const editorStore = useEditorStore()
const themeStore = useThemeStore()
const renderStore = useRenderStore()
const uiStore = useUIStore()
const exportStore = useExportStore()
const displayStore = useDisplayStore()
const htmlEditorStore = useHtmlEditorStore()
const previewStyleStore = usePreviewStyleStore()

const { editor } = storeToRefs(editorStore)
const { output } = storeToRefs(renderStore)
const { primaryColor } = storeToRefs(themeStore)
const { isOpenRightSlider, isOpenAIPanel, isOpenPostSlider } = storeToRefs(uiStore)
const { toggleAIPanel, togglePostSlider } = uiStore
const { isHtmlMode, showHtmlEditor } = storeToRefs(htmlEditorStore)

const activePanel = ref<string | null>(null)

// 处理『文档管理』按钮点击
function handleDocumentClick() {
  const isCurrentlyActive = activePanel.value === `document`

  // 关闭模板库
  if (activePanel.value === `template`)
    emit(`toggleTemplateGallery`)

  // 切换文档管理面板和激活状态
  if (isCurrentlyActive) {
    activePanel.value = null
    if (isOpenPostSlider.value)
      togglePostSlider()
  }
  else {
    activePanel.value = `document`
    if (!isOpenPostSlider.value)
      togglePostSlider()
  }
}

// 处理『精美模板』按钮点击
function handleTemplateClick() {
  const isCurrentlyActive = activePanel.value === `template`

  // 关闭文档管理
  if (activePanel.value === `document` && isOpenPostSlider.value)
    togglePostSlider()

  // 更新激活状态并触发模板库切换
  activePanel.value = isCurrentlyActive ? null : `template`
  emit(`toggleTemplateGallery`)
}

// 处理『隐藏代码』按钮点击
function handleCodeToggleClick() {
  // 关闭文档管理
  if (activePanel.value === `document` && isOpenPostSlider.value)
    togglePostSlider()

  // 关闭模板库
  if (activePanel.value === `template`)
    emit(`toggleTemplateGallery`)

  // 清除激活状态
  activePanel.value = null

  // 切换编辑器显示状态
  htmlEditorStore.toggleHtmlEditor()
}

// Editor refresh function
function editorRefresh() {
  themeStore.updateCodeTheme()
  const raw = editorStore.getContent()
  renderStore.render(raw, {
    isCiteStatus: themeStore.isCiteStatus,
    legend: themeStore.legend,
    isUseIndent: themeStore.isUseIndent,
    isUseJustify: themeStore.isUseJustify,
    isCountStatus: themeStore.isCountStatus,
    isMacCodeBlock: themeStore.isMacCodeBlock,
    isShowLineNumber: themeStore.isShowLineNumber,
  })
}

const copyMode = useStorage(addPrefix(`copyMode`), `txt`)
const { copy: copyContent } = useClipboard({ legacy: true })

const delay = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))
const normalizeErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

async function writeClipboardItems(items: ClipboardItem[]) {
  if (!navigator.clipboard?.write) {
    throw new Error(`Clipboard API not available.`)
  }
  await delay(0)
  await navigator.clipboard.write(items)
}

function fallbackCopyUsingExecCommand(htmlContentStr: string) {
  const selection = window.getSelection()
  if (!selection)
    return false

  const tempContainer = document.createElement(`div`)
  tempContainer.innerHTML = htmlContentStr
  tempContainer.style.cssText = `position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;background-color:#fff!important;color:#000!important`
  document.body.appendChild(tempContainer)

  const htmlElement = document.documentElement
  const wasDark = htmlElement.classList.contains(`dark`)
  let successful = false

  try {
    if (wasDark)
      htmlElement.classList.remove(`dark`)
    const range = document.createRange()
    range.selectNodeContents(tempContainer)
    selection.removeAllRanges()
    selection.addRange(range)
    successful = document.execCommand(`copy`)
  }
  catch {
    successful = false
  }
  finally {
    selection.removeAllRanges()
    tempContainer.remove()
    if (wasDark)
      htmlElement.classList.add(`dark`)
  }
  return successful
}

// 复制到微信公众号
async function copy() {
  if (copyMode.value === `md`) {
    const mdContent = editor.value?.state.doc.toString() || ``
    await copyContent(mdContent)
    toast.success(`已复制 Markdown 源码到剪贴板。`)
    return
  }

  if (isHtmlMode.value) {
    const htmlOutputElement = document.getElementById(`html-output`)
    if (!htmlOutputElement) {
      toast.error(`未找到预览区域，请刷新页面后重试。`)
      return
    }

    const clonedElement = htmlOutputElement.cloneNode(true) as HTMLElement
    const styleOverrides = previewStyleStore.styleOverrides
    styleOverrides.forEach((override) => {
      try {
        const selector = override.selector.replace(/^#html-output\s*/, ``)
        const elements = selector ? clonedElement.querySelectorAll(selector) : []
        elements.forEach((el) => {
          const htmlEl = el as HTMLElement
          const existingStyle = htmlEl.getAttribute(`style`) || ``
          const newStyles = Object.entries(override.styles)
            .map(([key, value]) => `${key.replace(/([A-Z])/g, `-$1`).toLowerCase()}: ${value}`)
            .join(`; `)
          htmlEl.setAttribute(`style`, existingStyle ? `${existingStyle}; ${newStyles}` : newStyles)
        })
      }
      catch (error) {
        console.warn(`Failed to apply style override:`, error, override)
      }
    })

    const htmlContentWithStyles = clonedElement.innerHTML
    if (copyMode.value === `html`) {
      await copyContent(htmlContentWithStyles)
      toast.success(`已复制 HTML 源码到剪贴板。`)
    }
    else {
      try {
        const plainText = clonedElement.textContent || ``
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([htmlContentWithStyles], { type: `text/html` }),
          'text/plain': new Blob([plainText], { type: `text/plain` }),
        })
        await navigator.clipboard.write([clipboardItem])
        toast.success(`已复制渲染后的内容到剪贴板，可直接到公众号后台粘贴。`)
      }
      catch {
        await copyContent(htmlContentWithStyles)
        toast.success(`已复制内容到剪贴板。`)
      }
    }
    return
  }

  emit(`startCopy`)
  setTimeout(() => {
    nextTick(async () => {
      await processClipboardContent(primaryColor.value)
      const clipboardDiv = document.getElementById(`output`)
      if (!clipboardDiv) {
        toast.error(`未找到复制输出区域，请刷新页面后重试。`)
        editorRefresh()
        emit(`endCopy`)
        return
      }

      clipboardDiv.focus()
      window.getSelection()?.removeAllRanges()
      const temp = clipboardDiv.innerHTML

      if (copyMode.value === `txt`) {
        try {
          if (typeof ClipboardItem === `undefined`) {
            throw new TypeError(`ClipboardItem is not supported.`)
          }
          const plainText = clipboardDiv.textContent || ``
          const clipboardItem = new ClipboardItem({
            'text/html': new Blob([temp], { type: `text/html` }),
            'text/plain': new Blob([plainText], { type: `text/plain` }),
          })
          await writeClipboardItems([clipboardItem])
        }
        catch (error) {
          const fallbackSucceeded = fallbackCopyUsingExecCommand(temp)
          if (!fallbackSucceeded) {
            clipboardDiv.innerHTML = output.value
            window.getSelection()?.removeAllRanges()
            editorRefresh()
            toast.error(`复制失败: ${normalizeErrorMessage(error)}`)
            emit(`endCopy`)
            return
          }
        }
      }

      clipboardDiv.innerHTML = output.value
      if (copyMode.value === `html`) {
        await copyContent(temp)
      }
      else if (copyMode.value === `html-without-style`) {
        await copyContent(await generatePureHTML(editor.value!.state.doc.toString()))
      }
      else if (copyMode.value === `html-and-style`) {
        await copyContent(exportStore.editorContent2HTML())
      }

      toast.success(copyMode.value === `html` ? `已复制 HTML 源码。` : `已复制渲染后的内容，可直接粘贴到公众号。`)
      window.dispatchEvent(new CustomEvent(`copyToMp`, { detail: { content: output.value } }))
      editorRefresh()
      emit(`endCopy`)
    })
  }, 350)
}

function handleModeChanged(mode: `markdown` | `html`, convertedContent?: string) {
  if (convertedContent) {
    if (mode === `html`) {
      nextTick(() => {
        window.dispatchEvent(new CustomEvent(`editor-mode-changed`, { detail: { mode, content: convertedContent } }))
      })
    }
    else {
      editorStore.setContent(convertedContent)
      nextTick(() => editorRefresh())
    }
  }
}

const aboutDialogVisible = ref(false)
function handleOpenAbout() {
  aboutDialogVisible.value = true
}

function toggleTemplateGallery() {
  emit(`toggleTemplateGallery`)
}
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <div class="left-nav-sidebar">
      <div class="nav-container">
        <!-- Logo / Brand -->
        <div class="nav-brand">
          <div class="brand-icon">
            <Sparkles class="size-5 text-primary" />
          </div>
        </div>

        <Separator class="my-2 opacity-30" />

        <!-- 主要导航按钮 -->
        <div class="nav-items">
          <!-- 文档管理 -->
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                class="nav-btn"
                :class="{ active: activePanel === 'document' }"
                @click="handleDocumentClick"
              >
                <FileText class="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>文档管理</p>
            </TooltipContent>
          </Tooltip>

          <!-- 模板库 -->
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                class="nav-btn"
                :class="{ active: activePanel === 'template' }"
                @click="handleTemplateClick"
              >
                <Palette class="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>精美模板</p>
            </TooltipContent>
          </Tooltip>

          <!-- HTML编辑器显示/隐藏 -->
          <Tooltip v-if="isHtmlMode">
            <TooltipTrigger as-child>
              <button
                class="nav-btn"
                @click="handleCodeToggleClick"
              >
                <EyeOff v-if="showHtmlEditor" class="size-5" />
                <Eye v-else class="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{{ showHtmlEditor ? '隐藏代码' : '显示代码' }}</p>
            </TooltipContent>
          </Tooltip>

          <Separator class="my-2 opacity-30" />

          <!-- 复制按钮 -->
          <Tooltip>
            <TooltipTrigger as-child>
              <button class="nav-btn copy-btn" @click="copy">
                <Copy class="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>复制到公众号</p>
            </TooltipContent>
          </Tooltip>

          <!-- 编辑器设置 -->
          <Popover>
            <PopoverTrigger as-child>
              <button class="nav-btn">
                <SlidersHorizontal class="size-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" class="w-80">
              <ThemeCustomizer />
            </PopoverContent>
          </Popover>
        </div>

        <!-- 底部工具 -->
        <div class="nav-footer">
          <Separator class="my-2 opacity-30" />

          <!-- AI助手 -->
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                class="nav-btn ai-btn"
                :class="{ active: isOpenAIPanel }"
                @click="toggleAIPanel()"
              >
                <Bot class="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>AI 助手</p>
            </TooltipContent>
          </Tooltip>

          <!-- 帮助 -->
          <Tooltip>
            <TooltipTrigger as-child>
              <button class="nav-btn" @click="handleOpenAbout">
                <HelpCircle class="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>帮助</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>

    <!-- 对话框组件 -->
    <AboutDialog :visible="aboutDialogVisible" @close="aboutDialogVisible = false" />
    <AIImageGeneratorPanel v-model:open="displayStore.aiImageDialogVisible" />
  </TooltipProvider>
</template>

<style scoped>
.left-nav-sidebar {
  position: fixed;
  left: 12px;
  top: 12px;
  bottom: 12px;
  width: 56px;
  z-index: 50;
  display: flex;
  flex-direction: column;
}

.nav-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px 8px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1),
    0 0 0 1px rgb(0 0 0 / 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dark .nav-container {
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.3),
    0 2px 4px -2px rgb(0 0 0 / 0.2),
    0 0 0 1px rgb(255 255 255 / 0.05);
}

.nav-container:hover {
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1),
    0 0 0 1px rgb(0 0 0 / 0.05);
}

.nav-brand {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: transparent;
  transition: all 0.2s ease;
}

.brand-icon:hover {
  transform: scale(1.05);
  background: linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.1));
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.nav-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: hsl(var(--primary));
  opacity: 0;
  border-radius: 10px;
  transition: opacity 0.2s ease;
}

.nav-btn:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
  transform: translateY(-1px);
}

.nav-btn:hover::before {
  opacity: 0.05;
}

.nav-btn:active {
  transform: translateY(0);
}

.nav-btn.active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.1);
}

.nav-btn.active::before {
  opacity: 0.1;
}

.nav-btn.copy-btn {
  background: transparent;
  color: hsl(var(--muted-foreground));
}

.nav-btn.copy-btn:hover {
  background: linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.1));
  color: hsl(var(--primary));
  transform: translateY(-2px);
  box-shadow: 0 4px 12px hsl(var(--primary) / 0.2);
}

.nav-btn.ai-btn.active {
  background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8));
  color: hsl(var(--primary-foreground));
  box-shadow: 0 4px 12px hsl(var(--primary) / 0.3);
}

.nav-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: auto;
}

/* 动画 */
@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px hsl(var(--primary) / 0);
  }
}

.nav-btn.ai-btn.active {
  animation: pulse-glow 2s infinite;
}

/* 响应式 - 移动端隐藏 */
@media (max-width: 768px) {
  .left-nav-sidebar {
    display: none;
  }
}
</style>
