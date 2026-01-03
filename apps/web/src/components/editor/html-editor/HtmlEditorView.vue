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
  return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        /* 在这里定义你的 CSS 样式 */
        .hero-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px;
          border-radius: 15px;
          color: white;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        
        .hero-title {
          font-size: 32px;
          font-weight: bold;
          margin: 0 0 10px 0;
        }
        
        .hero-subtitle {
          font-size: 18px;
          opacity: 0.9;
          margin: 0;
        }
        
        .content-section {
          padding: 20px;
          margin: 20px 0;
        }
        
        .feature-card {
          display: inline-block;
          width: 30%;
          padding: 20px;
          margin: 10px 1%;
          background: #f8f9fa;
          border-radius: 8px;
          vertical-align: top;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .feature-title {
          color: #667eea;
          font-size: 20px;
          font-weight: bold;
          margin: 0 0 10px 0;
        }
        
        .feature-text {
          color: #333;
          line-height: 1.6;
          margin: 0;
        }
      </style>
    </head>
    <body>
      <!-- Hero Section -->
      <div class="hero-section">
        <h1 class="hero-title">欢迎使用 HTML 编辑模式</h1>
        <p class="hero-subtitle">自由发挥，创作更丰富的样式效果</p >
      </div>
      
      <!-- Content Section -->
      <div class="content-section">
        <h2>功能特点</h2>
        
        <div class="feature-card">
          <h3 class="feature-title">完全自定义</h3>
          <p class="feature-text">使用 HTML + CSS 实现任何你想要的样式效果</p >
        </div>
        
        <div class="feature-card">
          <h3 class="feature-title">自动转换</h3>
          <p class="feature-text">复制时会自动转换为行内样式，兼容微信公众号</p >
        </div>
        
        <div class="feature-card">
          <h3 class="feature-title">实时预览</h3>
          <p class="feature-text">右侧实时预览效果，所见即所得</p >
        </div>
      </div>
      
      <div class="content-section">
        <h2>开始创作吧！</h2>
        <p>删除这些示例内容，开始编写你自己的 HTML + CSS 代码。</p >
      </div>
    </body>
    </html>`
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
