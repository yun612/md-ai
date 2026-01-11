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
    ],
  })

  editorView = new EditorView({
    state: startState,
    parent: editorContainer.value,
  })

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
}

.html-editor-container :deep(.cm-editor) {
  height: 100%;
}

.html-editor-container :deep(.cm-scroller) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}
</style>
