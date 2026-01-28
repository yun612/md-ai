<script setup lang="ts">
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { html } from '@codemirror/lang-html'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { theme as cmTheme } from '@md/shared/editor'
import { usePostStore } from '@/stores/post'
import { useUIStore } from '@/stores/ui'
import { useHtmlEditorStore } from './useHtmlEditorStore'

const props = defineProps<{
  initialContent?: string
}>()

const emit = defineEmits<{
  contentChange: [content: string]
}>()

const editorContainer = ref<HTMLDivElement>()
const htmlEditorStore = useHtmlEditorStore()
const postStore = usePostStore()
const uiStore = useUIStore()
const { isDark } = storeToRefs(uiStore)

let editorView: EditorView | null = null

const themeCompartment = new Compartment()

// 本地替代图片
const FALLBACK_IMAGE_URL = `/images/sunflower.jpg`

// 替换所有外部图片为本地图片
function replaceExternalImages(html: string): string {
  if (!html)
    return html

  let processedHtml = html

  // 1. 替换 <img> 标签的 src 属性（排除 base64）
  processedHtml = processedHtml.replace(
    /<img([^>]*?)src=["']([^"']+)["']([^>]*)>/gi,
    (match, before, src, after) => {
      if (src.startsWith(`data:image/`)) {
        return match
      }
      console.log(`[粘贴时替换图片]`, src, `→`, FALLBACK_IMAGE_URL)
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
      console.log(`[粘贴时替换背景图片]`, url, `→`, FALLBACK_IMAGE_URL)
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
      return `background: ${before}url("${FALLBACK_IMAGE_URL}")${after}`
    },
  )

  return processedHtml
}

function getInitialContent(): string {
  if (props.initialContent) {
    return props.initialContent
  }
  const currentPost = postStore.currentPost
  if (currentPost?.content) {
    return currentPost.content
  }
  return getDefaultHtmlTemplate()
}

onMounted(() => {
  if (!editorContainer.value)
    return

  const initialContent = getInitialContent()
  htmlEditorStore.setHtmlContent(initialContent)

  const startState = EditorState.create({
    doc: initialContent,
    extensions: [
      html(),
      themeCompartment.of(cmTheme(isDark.value)),
      keymap.of([...defaultKeymap, indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const content = update.state.doc.toString()
          htmlEditorStore.setHtmlContent(content)
          emit(`contentChange`, content)
        }
      }),
      EditorView.lineWrapping,
      EditorView.domEventHandlers({
        paste(event, view) {
          // 获取粘贴的文本内容
          const pastedText = event.clipboardData?.getData(`text/html`)
            || event.clipboardData?.getData(`text/plain`)

          if (pastedText) {
            // 替换外部图片
            const processedText = replaceExternalImages(pastedText)

            // 如果有替换，阻止默认行为并插入处理后的内容
            if (processedText !== pastedText) {
              event.preventDefault()

              const { from, to } = view.state.selection.main
              view.dispatch({
                changes: { from, to, insert: processedText },
                selection: { anchor: from + processedText.length },
              })

              return true
            }
          }

          return false
        },
      }),
    ],
  })

  editorView = new EditorView({
    state: startState,
    parent: editorContainer.value,
  })

  // 保存编辑器实例到 store
  htmlEditorStore.htmlEditor = editorView

  // 监听格式切换事件
  const handleModeChange = (event: Event) => {
    const customEvent = event as CustomEvent
    const { mode, content } = customEvent.detail
    if (mode === `html` && content && editorView) {
      // 更新编辑器内容
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: content },
      })
    }
  }

  window.addEventListener(`editor-mode-changed`, handleModeChange)

  onUnmounted(() => {
    window.removeEventListener(`editor-mode-changed`, handleModeChange)
  })
})

watch(isDark, (newIsDark) => {
  if (editorView) {
    editorView.dispatch({
      effects: themeCompartment.reconfigure(cmTheme(newIsDark)),
    })
  }
})

onUnmounted(() => {
  editorView?.destroy()
  htmlEditorStore.htmlEditor = null
})

function getDefaultHtmlTemplate(): string {
  return `<section style="width:100%;display:inline-block;background:#e3f2fd;padding:20px;text-align:center;width:33%;box-sizing:border-box;">第一栏</section>
<section style="width:100%;display:inline-block;background:#f3e5f5;padding:20px;text-align:center;width:33%;box-sizing:border-box;">第二栏</section>
<section style="width:100%;display:inline-block;background:#ff0;padding:20px;text-align:center;width:34%;box-sizing:border-box;">第三栏</section>`
}

defineExpose({
  getContent: () => editorView?.state.doc.toString() || ``,
  setContent: (content: string) => {
    if (editorView) {
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: content },
      })
    }
  },
})
</script>

<template>
  <div
    ref="editorContainer"
    class="html-editor-container h-full"
  />
</template>

<style scoped>
.html-editor-container {
  font-size: 14px;
  line-height: 1.6;
  border-radius: 12px;
  overflow: hidden;
  background: hsl(var(--background));
  transition: all 0.3s ease;
}

.html-editor-container :deep(.cm-editor) {
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
}

.html-editor-container :deep(.cm-scroller) {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.7;
  padding: 16px;
}

.html-editor-container :deep(.cm-content) {
  padding: 8px 0;
}

.html-editor-container :deep(.cm-gutters) {
  border-radius: 12px 0 0 12px;
  border-right: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.3);
}

.html-editor-container :deep(.cm-activeLineGutter) {
  background: hsl(var(--primary) / 0.1);
}

.html-editor-container :deep(.cm-activeLine) {
  background: hsl(var(--primary) / 0.05);
}

/* 选中文本样式 */
.html-editor-container :deep(.cm-selectionBackground) {
  background: hsl(var(--primary) / 0.2) !important;
}

/* 滚动条样式 */
.html-editor-container :deep(.cm-scroller)::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.html-editor-container :deep(.cm-scroller)::-webkit-scrollbar-track {
  background: transparent;
}

.html-editor-container :deep(.cm-scroller)::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 4px;
}

.html-editor-container :deep(.cm-scroller)::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}
</style>
