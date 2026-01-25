<script setup lang="ts">
/**
 * HtmlPreviewCore - HTML 预览核心组件
 * 抽象出 HTML 预览的核心渲染逻辑
 * 可被 HtmlPreviewPanel 和 HtmlSandboxPanel 复用
 */

const props = withDefaults(defineProps<{
  htmlContent: string
  readonly?: boolean
  showToolbar?: boolean
  highlightModified?: boolean
  modifiedSections?: string[]
  modifiedAttr?: string
  modifiedClass?: string
}>(), {
  readonly: false,
  showToolbar: true,
  highlightModified: false,
  modifiedSections: () => [],
  modifiedAttr: `data-sandbox-modified`,
  modifiedClass: `sandbox-modified-section`,
})

const emit = defineEmits<{
  scroll: [event: Event]
  elementSelect: [element: HTMLElement | null]
  contentChange: [content: string]
}>()

const previewRef = ref<HTMLDivElement>()

// 暴露 ref 给父组件
defineExpose({
  previewRef,
  scrollTo: (top: number) => {
    if (previewRef.value) {
      previewRef.value.scrollTop = top
    }
  },
  getScrollTop: () => previewRef.value?.scrollTop ?? 0,
  getElement: () => previewRef.value,
})

// 更新内容
watchEffect(() => {
  if (previewRef.value && props.htmlContent) {
    previewRef.value.innerHTML = props.htmlContent

    // 如果需要高亮修改区域
    if (props.highlightModified) {
      nextTick(() => {
        applyModifiedStyles()
      })
    }
  }
})

// 应用修改标记样式
function applyModifiedStyles() {
  if (!previewRef.value)
    return

  // 查找所有带有修改标记的元素
  const modifiedElements = previewRef.value.querySelectorAll(`[${props.modifiedAttr}]`)
  modifiedElements.forEach((el) => {
    el.classList.add(props.modifiedClass)
  })

  // 同时根据 modifiedSections 列表添加标记
  props.modifiedSections.forEach((sectionId) => {
    const element = previewRef.value?.querySelector(`[data-element-id="${sectionId}"]`)
    if (element) {
      element.setAttribute(props.modifiedAttr, `true`)
      element.classList.add(props.modifiedClass)
    }
  })
}

// 处理滚动事件
function handleScroll(e: Event) {
  emit(`scroll`, e)
}

// 监听内容变化（通过 MutationObserver）
let observer: MutationObserver | null = null

onMounted(() => {
  if (previewRef.value && !props.readonly) {
    observer = new MutationObserver(() => {
      if (previewRef.value) {
        emit(`contentChange`, previewRef.value.innerHTML)
      }
    })

    observer.observe(previewRef.value, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    })
  }
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <div
    ref="previewRef"
    class="html-preview-core"
    :class="{
      'is-readonly': readonly,
      'highlight-modified': highlightModified,
    }"
    @scroll="handleScroll"
  />
</template>

<style scoped>
.html-preview-core {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  background: hsl(var(--background));
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
    'Helvetica Neue', sans-serif;
}

.html-preview-core.is-readonly {
  user-select: text;
  pointer-events: auto;
}

/* 滚动条样式 */
.html-preview-core::-webkit-scrollbar {
  width: 6px;
}

.html-preview-core::-webkit-scrollbar-track {
  background: transparent;
}

.html-preview-core::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 3px;
}

.html-preview-core::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* 内容样式 */
.html-preview-core :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

.html-preview-core :deep(pre) {
  overflow-x: auto;
  padding: 1em;
  background: hsl(var(--muted));
  border-radius: 8px;
}

.html-preview-core :deep(code) {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
}

/* 修改标记样式 */
.html-preview-core.highlight-modified :deep(.sandbox-modified-section) {
  position: relative;
  outline: 2px dashed rgba(251, 191, 36, 0.8) !important;
  outline-offset: 4px;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%) !important;
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: sandboxPulse 2s ease-in-out infinite;
}

.html-preview-core.highlight-modified :deep(.sandbox-modified-section)::before {
  content: '已修改';
  position: absolute;
  top: -10px;
  right: -10px;
  font-size: 10px;
  padding: 3px 8px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: white;
  border-radius: 6px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);
  z-index: 10;
}

@keyframes sandboxPulse {
  0%,
  100% {
    outline-color: rgba(251, 191, 36, 0.6);
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.2);
  }
  50% {
    outline-color: rgba(251, 191, 36, 1);
    box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1);
  }
}

/* 深色模式 */
.dark .html-preview-core {
  scrollbar-color: rgba(107, 114, 128, 0.3) transparent;
}

.dark .html-preview-core::-webkit-scrollbar-thumb {
  background-color: rgba(107, 114, 128, 0.3);
}

.dark .html-preview-core::-webkit-scrollbar-thumb:hover {
  background-color: rgba(107, 114, 128, 0.5);
}

.dark .html-preview-core.highlight-modified :deep(.sandbox-modified-section) {
  outline-color: rgba(251, 191, 36, 0.9) !important;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%) !important;
}
</style>
