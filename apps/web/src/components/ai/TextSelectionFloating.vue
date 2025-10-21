<script setup lang="ts">
import {
  Copy,
  Edit3,
  FileText,
  Languages,
  Sparkles,
  X,
  Zap,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Button } from '@/components/ui/button'

interface FloatingAction {
  id: string
  label: string
  icon: any
  action: (text: string) => void
  color?: string
}

interface Props {
  visible: boolean
  selectedText: string
  position: { x: number, y: number }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  action: [action: string, text: string]
}>()

const floatingRef = ref<HTMLElement>()
const isProcessing = ref(false)
const processingAction = ref<string | null>(null)

const actions: FloatingAction[] = [
  {
    id: `copy`,
    label: `复制`,
    icon: Copy,
    action: (text: string) => handleCopy(text),
    color: `text-gray-600 hover:text-gray-800`,
  },
  {
    id: `polish`,
    label: `润色`,
    icon: Sparkles,
    action: (text: string) => handlePolish(text),
    color: `text-purple-600 hover:text-purple-800`,
  },
  {
    id: `rewrite`,
    label: `重写`,
    icon: Edit3,
    action: (text: string) => handleRewrite(text),
    color: `text-blue-600 hover:text-blue-800`,
  },
  {
    id: `summarize`,
    label: `总结`,
    icon: FileText,
    action: (text: string) => handleSummarize(text),
    color: `text-green-600 hover:text-green-800`,
  },
  {
    id: `translate`,
    label: `翻译`,
    icon: Languages,
    action: (text: string) => handleTranslate(text),
    color: `text-orange-600 hover:text-orange-800`,
  },
  {
    id: `expand`,
    label: `扩展`,
    icon: Zap,
    action: (text: string) => handleExpand(text),
    color: `text-red-600 hover:text-red-800`,
  },
]

const displayPosition = computed(() => {
  if (!props.visible)
    return { x: -9999, y: -9999 }

  // 简化位置计算，直接使用传入的位置
  let x = props.position.x
  let y = props.position.y - 50 // 显示在选中文本上方50px

  // 简单的边界检查
  const viewportWidth = window.innerWidth

  if (x < 10)
    x = 10
  if (x > viewportWidth - 300)
    x = viewportWidth - 300
  if (y < 10)
    y = props.position.y + 30 // 显示在下方

  return { x, y }
})

function handleCopy(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    emit(`action`, `copy`, text)
    emit(`close`)
  }).catch((err) => {
    console.error(`复制失败:`, err)
  })
}

function handlePolish(text: string) {
  setProcessing(`polish`)
  emit(`action`, `polish`, text)
  setTimeout(() => {
    setProcessing(null)
    emit(`close`)
  }, 1000)
}

function handleRewrite(text: string) {
  setProcessing(`rewrite`)
  emit(`action`, `rewrite`, text)
  setTimeout(() => {
    setProcessing(null)
    emit(`close`)
  }, 1000)
}

function handleSummarize(text: string) {
  setProcessing(`summarize`)
  emit(`action`, `summarize`, text)
  setTimeout(() => {
    setProcessing(null)
    emit(`close`)
  }, 1000)
}

function handleTranslate(text: string) {
  setProcessing(`translate`)
  emit(`action`, `translate`, text)
  setTimeout(() => {
    setProcessing(null)
    emit(`close`)
  }, 1000)
}

function handleExpand(text: string) {
  setProcessing(`expand`)
  emit(`action`, `expand`, text)
  setTimeout(() => {
    setProcessing(null)
    emit(`close`)
  }, 1000)
}

function setProcessing(action: string | null) {
  processingAction.value = action
  isProcessing.value = action !== null
}

function handleClose() {
  emit(`close`)
}

// 点击外部关闭
function handleClickOutside(event: MouseEvent) {
  if (floatingRef.value && !floatingRef.value.contains(event.target as Node)) {
    // 检查是否点击在选中的文本上
    const selection = window.getSelection()
    const text = selection?.toString().trim()

    if (!text || text.length === 0) {
      emit(`close`)
    }
  }
}

// 监听滚动事件，滚动时隐藏悬浮框
function handleScroll() {
  emit(`close`)
}

onMounted(() => {
  document.addEventListener(`click`, handleClickOutside)
  window.addEventListener(`scroll`, handleScroll, true) // 使用capture模式监听所有滚动
})

onUnmounted(() => {
  document.removeEventListener(`click`, handleClickOutside)
  window.removeEventListener(`scroll`, handleScroll, true)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="floatingRef"
      class="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 flex items-center gap-1 transition-all duration-200 transform"
      :class="visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'"
      :style="{
        left: `${displayPosition.x}px`,
        top: `${displayPosition.y}px`,
        zIndex: 99999,
      }"
    >
      <!-- 处理状态显示 -->
      <div
        v-if="isProcessing"
        class="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300"
      >
        <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span>{{ actions.find(a => a.id === processingAction)?.label }}中...</span>
      </div>

      <!-- 操作按钮 -->
      <template v-else>
        <Button
          v-for="action in actions"
          :key="action.id"
          variant="ghost"
          size="sm"
          class="h-8 px-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
          :class="action.color"
          @click="action.action(selectedText)"
        >
          <component :is="action.icon" class="w-3 h-3 mr-1" />
          {{ action.label }}
        </Button>

        <!-- 关闭按钮 -->
        <Button
          variant="ghost"
          size="sm"
          class="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          @click="handleClose"
        >
          <X class="w-3 h-3" />
        </Button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
/* 确保悬浮框在最顶层 */
.fixed {
  z-index: 99999 !important;
}

/* 动画效果 */
.transition-all {
  transition: all 0.2s ease-in-out;
}

/* 处理状态动画 */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
