<script setup lang="ts">
import { Bot, ChevronDownIcon, Eye, EyeOff, Menu, Palette, SlidersHorizontal } from 'lucide-vue-next'
import { HtmlMarkdownConverter, useHtmlEditorStore } from '@/components/editor/html-editor'
import { usePreviewStyleStore } from '@/components/editor/html-editor/usePreviewStyleStore'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDisplayStore } from '@/stores/display'
import { useEditorStore } from '@/stores/editor'
import { useExportStore } from '@/stores/export'
import { useRenderStore } from '@/stores/render'
import { useThemeStore } from '@/stores/theme'
import { useUIStore } from '@/stores/ui'
import { addPrefix, generatePureHTML, processClipboardContent } from '@/utils'
import FormatDropdown from './FormatDropdown.vue'
import Statistic from './Statistic.vue'

const emit = defineEmits([`startCopy`, `endCopy`])

const editorStore = useEditorStore()
const themeStore = useThemeStore()
const renderStore = useRenderStore()
const uiStore = useUIStore()
const exportStore = useExportStore()
const displayStore = useDisplayStore()
const aiConfigStore = useAIConfigStore()
const htmlEditorStore = useHtmlEditorStore()
const previewStyleStore = usePreviewStyleStore()

const { editor } = storeToRefs(editorStore)
const { output } = storeToRefs(renderStore)
const { primaryColor } = storeToRefs(themeStore)
const { isOpenRightSlider, isOpenAIPanel } = storeToRefs(uiStore)
const { toggleAIPanel } = uiStore
const { isHtmlMode, htmlContent, showHtmlEditor } = storeToRefs(htmlEditorStore)
const {
  type: aiServiceType,
  endpoint,
  model,
  apiKey,
  maxToken,
} = storeToRefs(aiConfigStore)

const providerMap: Record<string, NonNullable<ModelConfig[`agentModel`]>[`provider`]> = {
  doubao: `doubao`,
  google: `google`,
  minimax: `minimax`,
  openrouter: `openrouter`,
}

const modelConfig = computed<ModelConfig>(() => ({
  agentModel: {
    provider: providerMap[aiServiceType.value] || `openrouter`,
    apiKey: apiKey.value,
    baseUrl: endpoint.value,
    modelName: model.value,
    maxTokens: maxToken.value,
  },
}))

const taskDialogOpen = ref(false)
const taskInstruction = ref(`请根据当前文章内容生成一段摘要。`)
const taskOutput = ref(``)
const taskReasoning = ref<string[]>([])
const taskRunning = ref(false)
const lastTaskError = ref<string | null>(null)

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

// 处理格式切换
function handleModeChanged(mode: `markdown` | `html`, convertedContent?: string) {
  if (convertedContent) {
    if (mode === `html`) {
      // Markdown 切换到 HTML，传递转换后的 HTML 内容
      nextTick(() => {
        // 触发编辑器更新事件
        const event = new CustomEvent(`editor-mode-changed`, {
          detail: { mode, content: convertedContent },
        })
        window.dispatchEvent(event)
      })
    }
    else {
      // HTML 切换到 Markdown，更新编辑器内容
      editorStore.setContent(convertedContent)
      nextTick(() => {
        editorRefresh()
      })
    }
  }
}

// 对话框状态
const aboutDialogVisible = ref(false)
const fundDialogVisible = ref(false)
const editorStateDialogVisible = ref(false)

// 处理帮助菜单事件
function handleOpenAbout() {
  aboutDialogVisible.value = true
}

function handleOpenFund() {
  fundDialogVisible.value = true
}

function handleOpenEditorState() {
  editorStateDialogVisible.value = true
}

const copyMode = useStorage(addPrefix(`copyMode`), `txt`)

const { copy: copyContent } = useClipboard({
  legacy: true,
})

const delay = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))

const normalizeErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

async function writeClipboardItems(items: ClipboardItem[]) {
  if (!navigator.clipboard?.write) {
    throw new Error(`Clipboard API not available.`)
  }

  await delay(0)
  await navigator.clipboard.write(items)
}

function fallbackCopyUsingExecCommand(htmlContent: string) {
  const selection = window.getSelection()

  if (!selection) {
    return false
  }

  const tempContainer = document.createElement(`div`)
  tempContainer.innerHTML = htmlContent
  tempContainer.style.position = `fixed`
  tempContainer.style.left = `-9999px`
  tempContainer.style.top = `0`
  tempContainer.style.opacity = `0`
  tempContainer.style.pointerEvents = `none`
  tempContainer.style.setProperty(`background-color`, `#ffffff`, `important`)
  tempContainer.style.setProperty(`color`, `#000000`, `important`)

  document.body.appendChild(tempContainer)

  const htmlElement = document.documentElement
  const wasDark = htmlElement.classList.contains(`dark`)
  let successful = false

  try {
    if (wasDark) {
      htmlElement.classList.remove(`dark`)
    }

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

    if (wasDark) {
      htmlElement.classList.add(`dark`)
    }
  }

  return successful
}

// 复制到微信公众号
async function copy() {
  // 如果是 Markdown 源码，直接复制并返回
  if (copyMode.value === `md`) {
    const mdContent = editor.value?.state.doc.toString() || ``
    await copyContent(mdContent)
    toast.success(`已复制 Markdown 源码到剪贴板。`)
    return
  }

  // 如果是 HTML 模式，复制 HTML 内容（包含应用的样式）
  if (isHtmlMode.value) {
    const htmlOutputElement = document.getElementById(`html-output`)

    if (!htmlOutputElement) {
      toast.error(`未找到预览区域，请刷新页面后重试。`)
      return
    }

    // 克隆元素以便内联样式
    const clonedElement = htmlOutputElement.cloneNode(true) as HTMLElement

    // 将用户修改的样式内联到对应的元素中
    const styleOverrides = previewStyleStore.styleOverrides
    styleOverrides.forEach((override) => {
      try {
        // 移除 #html-output 前缀来匹配克隆元素中的选择器
        const selector = override.selector.replace(/^#html-output\s*/, ``)
        const elements = selector ? clonedElement.querySelectorAll(selector) : []

        elements.forEach((el) => {
          const htmlEl = el as HTMLElement
          const existingStyle = htmlEl.getAttribute(`style`) || ``

          // 将样式对象转换为内联样式字符串
          const newStyles = Object.entries(override.styles)
            .map(([key, value]) => {
              const kebabKey = key.replace(/([A-Z])/g, `-$1`).toLowerCase()
              return `${kebabKey}: ${value}`
            })
            .join(`; `)

          // 合并现有样式和新样式
          const combinedStyle = existingStyle
            ? `${existingStyle}; ${newStyles}`
            : newStyles

          htmlEl.setAttribute(`style`, combinedStyle)
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
      catch (error) {
        await copyContent(htmlContentWithStyles)
        toast.success(`已复制内容到剪贴板。`)
      }
    }
    return
  }

  // 以下处理非 Markdown 的复制流程
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
            throw new TypeError(`ClipboardItem is not supported in this browser.`)
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
            toast.error(`复制失败，请联系开发者。${normalizeErrorMessage(error)}`)
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

      // 输出提示
      toast.success(
        copyMode.value === `html`
          ? `已复制 HTML 源码，请进行下一步操作。`
          : `已复制渲染后的内容到剪贴板，可直接到公众号后台粘贴。`,
      )
      window.dispatchEvent(
        new CustomEvent(`copyToMp`, {
          detail: {
            content: output.value,
          },
        }),
      )
      editorRefresh()
      emit(`endCopy`)
    })
  }, 350)
}
</script>

<template>
  <header
    class="header-container h-15 flex flex-wrap items-center justify-between px-5 relative"
  >
    <!-- 桌面端左侧菜单 -->
    <div class="space-x-2 hidden md:flex items-center">
      <Menubar class="menubar border-0">
        <FileDropdown @open-editor-state="handleOpenEditorState" />
        <FormatDropdown />
        <EditDropdown />
        <StyleDropdown />
        <HelpDropdown @open-about="handleOpenAbout" @open-fund="handleOpenFund" />
      </Menubar>
      <HtmlMarkdownConverter class="ml-2" @mode-changed="handleModeChanged" />
    </div>

    <!-- 移动端汉堡菜单按钮 -->
    <div class="md:hidden">
      <Menubar class="menubar border-0 p-0">
        <MenubarMenu>
          <MenubarTrigger class="p-0">
            <Button variant="outline" size="icon">
              <Menu class="size-4" />
            </Button>
          </MenubarTrigger>
          <MenubarContent align="start">
            <FileDropdown :as-sub="true" @open-editor-state="handleOpenEditorState" />
            <FormatDropdown :as-sub="true" />
            <EditDropdown :as-sub="true" />
            <StyleDropdown :as-sub="true" />
            <HelpDropdown :as-sub="true" @open-about="handleOpenAbout" @open-fund="handleOpenFund" />
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>

    <!-- 右侧操作区 -->
    <div class="space-x-2 flex flex-wrap items-center">
      <!-- 阅读时间统计 -->
      <Statistic />

      <!-- 复制按钮组 -->
      <div
        class="bg-background space-x-1 text-background-foreground flex items-center border rounded-md"
      >
        <Button variant="ghost" class="shadow-none text-sm px-2 md:px-4" @click="copy">
          复制
        </Button>
        <Separator orientation="vertical" class="h-5" />
        <DropdownMenu v-model="copyMode">
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="px-2 shadow-none">
              <ChevronDownIcon class="text-secondary-foreground h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" :align-offset="-5" class="w-[220px]">
            <DropdownMenuRadioGroup v-model="copyMode">
              <DropdownMenuRadioItem value="txt">
                公众号格式
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="html">
                HTML 格式
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="html-without-style">
                <span class="whitespace-nowrap">HTML 格式（无样式）</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="html-and-style">
                <span class="whitespace-nowrap">HTML 格式（兼容样式）</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="md">
                MD 格式
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <!-- 文章信息（移动端隐藏） -->
      <PostInfo class="hidden md:inline-flex" />

      <!-- 编辑器设置按钮 -->
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="outline" size="icon" class="mr-1">
            <SlidersHorizontal class="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end">
          <ThemeCustomizer />
        </PopoverContent>
      </Popover>

      <!-- AI助手面板 -->
      <Button
        variant="outline"
        size="icon"
        :class="{ 'bg-primary text-primary-foreground': isOpenAIPanel }"
        @click="toggleAIPanel()"
      >
        <Bot class="size-4" />
      </Button>

      <!-- HTML编辑器切换按钮 -->
      <Button
        v-if="isHtmlMode"
        variant="outline"
        size="icon"
        @click="htmlEditorStore.toggleHtmlEditor()"
      >
        <EyeOff v-if="showHtmlEditor" class="size-4" />
        <Eye v-else class="size-4" />
      </Button>

      <!-- 样式面板 -->
      <Button
        variant="outline"
        size="icon"
        @click="isOpenRightSlider = !isOpenRightSlider"
      >
        <Palette class="size-4" />
      </Button>
    </div>
  </header>

  <!-- 对话框组件，嵌套菜单无法正常挂载，需要提取层级 -->
  <AboutDialog :visible="aboutDialogVisible" @close="aboutDialogVisible = false" />
  <FundDialog :visible="fundDialogVisible" @close="fundDialogVisible = false" />
  <EditorStateDialog :visible="editorStateDialogVisible" @close="editorStateDialogVisible = false" />
  <AIImageGeneratorPanel v-model:open="displayStore.aiImageDialogVisible" />
</template>

<style lang="less" scoped>
.menubar {
  user-select: none;
}

kbd {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  border: 1px solid #a8a8a8;
  padding: 1px 4px;
  border-radius: 2px;
}

@media (max-width: 768px) {
  .menubar {
    flex-direction: column;
    align-items: flex-start;
    width: 100%;

    > * {
      width: 100%;
      justify-content: flex-start;
    }
  }
}
</style>
