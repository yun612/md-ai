<script setup lang="ts">
import { Check, X } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { useHtmlEditorStore } from './useHtmlEditorStore'
import { SANDBOX_MODIFIED_ATTR, SANDBOX_MODIFIED_CLASS, useHtmlSandboxStore } from './useHtmlSandboxStore'

const htmlSandboxStore = useHtmlSandboxStore()
const htmlEditorStore = useHtmlEditorStore()
const { sandboxContent, modifiedSections, isActive } = storeToRefs(htmlSandboxStore)

const previewRef = ref<HTMLDivElement>()

// 监听 sandboxContent 变化，更新预览
watchEffect(() => {
  if (previewRef.value && sandboxContent.value) {
    // 先设置内容
    previewRef.value.innerHTML = sandboxContent.value

    // 然后为修改过的 section 添加样式标记
    nextTick(() => {
      applyModifiedStyles()
    })
  }
})

// 应用修改标记样式
function applyModifiedStyles() {
  if (!previewRef.value)
    return

  // 查找所有带有修改标记的元素
  const modifiedElements = previewRef.value.querySelectorAll(`[${SANDBOX_MODIFIED_ATTR}]`)
  modifiedElements.forEach((el) => {
    el.classList.add(SANDBOX_MODIFIED_CLASS)
  })

  // 同时根据 modifiedSections 列表添加标记
  modifiedSections.value.forEach((sectionId) => {
    const element = previewRef.value?.querySelector(`[data-element-id="${sectionId}"]`)
    if (element) {
      element.setAttribute(SANDBOX_MODIFIED_ATTR, `true`)
      element.classList.add(SANDBOX_MODIFIED_CLASS)
    }
  })
}

// 应用 Sandbox 内容到编辑器
function handleApply() {
  htmlSandboxStore.applySandboxToEditor((content: string) => {
    htmlEditorStore.setHtmlContent(content)
    // 同时更新 HTML 编辑器的内容
    if (htmlEditorStore.htmlEditor) {
      htmlEditorStore.htmlEditor.dispatch({
        changes: {
          from: 0,
          to: htmlEditorStore.htmlEditor.state.doc.length,
          insert: content,
        },
      })
    }
  })
  toast.success(`已应用 Sandbox 修改到编辑器`)
}

// 丢弃 Sandbox 内容
function handleDiscard() {
  htmlSandboxStore.closeSandbox()
  toast.info(`已丢弃 Sandbox 修改`)
}
</script>

<template>
  <div v-if="isActive" class="html-sandbox-panel h-full flex flex-col border-l bg-background">
    <!-- 头部工具栏 -->
    <div class="sandbox-header flex items-center justify-between border-b px-3 py-2">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted-foreground">Sandbox 预览</span>
        <span
          v-if="modifiedSections.length > 0"
          class="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
        >
          {{ modifiedSections.length }} 处修改
        </span>
      </div>
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          class="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
          title="应用修改"
          @click="handleApply"
        >
          <Check class="h-4 w-4 mr-1" />
          应用
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          title="丢弃修改"
          @click="handleDiscard"
        >
          <X class="h-4 w-4 mr-1" />
          丢弃
        </Button>
      </div>
    </div>

    <!-- 预览区域 -->
    <div class="sandbox-preview-container flex-1 overflow-y-auto p-4">
      <div
        id="sandbox-output"
        ref="previewRef"
        class="sandbox-preview-content h-full w-full"
      />
    </div>
  </div>
</template>

<style scoped>
.html-sandbox-panel {
  min-width: 300px;
  font-family:
    'Inter',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    'Roboto',
    'Oxygen',
    'Ubuntu',
    'Cantarell',
    'Fira Sans',
    'Droid Sans',
    'Helvetica Neue',
    sans-serif;
  border-radius: 12px;
  overflow: hidden;
}

.sandbox-header {
  min-height: 48px;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.05));
  backdrop-filter: blur(8px);
}

.sandbox-preview-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
  border-radius: 0 0 12px 12px;
}

.sandbox-preview-container::-webkit-scrollbar {
  width: 6px;
}

.sandbox-preview-container::-webkit-scrollbar-track {
  background: transparent;
}

.sandbox-preview-container::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 3px;
}

.sandbox-preview-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

.sandbox-preview-content {
  max-width: 100%;
  word-wrap: break-word;
  border-radius: 8px;
}

.sandbox-preview-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

.sandbox-preview-content :deep(pre) {
  overflow-x: auto;
  padding: 1em;
  background: hsl(var(--muted));
  border-radius: 8px;
}

.sandbox-preview-content :deep(code) {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
}

/* 修改标记样式 */
.sandbox-preview-content :deep(.sandbox-modified-section) {
  position: relative;
  outline: 2px dashed rgba(251, 191, 36, 0.8) !important;
  outline-offset: 4px;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%) !important;
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sandbox-preview-content :deep(.sandbox-modified-section)::before {
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

/* 深色模式 */
.dark .sandbox-header {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
}

.dark .sandbox-preview-content :deep(.sandbox-modified-section) {
  outline-color: rgba(251, 191, 36, 0.9) !important;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%) !important;
}

/* 修改区域的动画效果 */
.sandbox-preview-content :deep(.sandbox-modified-section) {
  animation: sandboxPulse 2s ease-in-out infinite;
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

/* 按钮悬停效果 */
.sandbox-header :deep(button) {
  transition: all 0.2s ease;
}

.sandbox-header :deep(button:hover) {
  transform: translateY(-1px);
}
</style>
