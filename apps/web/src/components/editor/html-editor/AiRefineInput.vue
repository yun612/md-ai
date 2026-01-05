<script setup lang="ts">
import { ChevronDown, ChevronUp, History, Send, Sparkles } from 'lucide-vue-next'

interface Props {
  placeholder?: string
  disabled?: boolean
  selectedElement?: HTMLElement | null
  selectedText?: string
  onSubmit?: (requirement: string, previousRequirements: string[]) => Promise<void> | void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: `例如：让这段文字更简洁、改为标题样式、调整颜色...`,
  disabled: false,
})

const emit = defineEmits<{
  statusChange: [isSubmitting: boolean]
}>()

const requirement = ref(``)
const isSubmitting = ref(false)
const history = ref<string[]>([])
const showHistory = ref(false)

async function handleSubmit() {
  if (!requirement.value.trim() || isSubmitting.value || props.disabled)
    return

  const currentRequirement = requirement.value.trim()
  isSubmitting.value = true
  emit(`statusChange`, true)

  try {
    if (props.onSubmit) {
      const result = props.onSubmit(currentRequirement, history.value)
      if (result instanceof Promise) {
        await result
      }
    }
    history.value.push(currentRequirement)
    requirement.value = ``
  }
  catch (error) {
    console.error(`AI 修改失败:`, error)
  }
  finally {
    isSubmitting.value = false
    emit(`statusChange`, false)
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === `Enter` && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    handleSubmit()
  }
}
</script>

<template>
  <div class="ai-refine-input bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 border border-purple-200">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <Sparkles size="{16}" class="text-purple-600" />
        <h3 class="text-sm font-semibold text-gray-800">
          AI 修改
        </h3>
        <span class="text-xs text-gray-500 hidden sm:inline">（Ctrl+Enter 提交）</span>
      </div>
      <button
        v-if="history.length > 0"
        class="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition-colors"
        @click="showHistory = !showHistory"
      >
        <History size="{14}" />
        <span class="hidden sm:inline">历史 ({{ history.length }})</span>
        <span class="sm:hidden">{{ history.length }}</span>
        <ChevronUp v-if="showHistory" size="{14}" />
        <ChevronDown v-else size="{14}" />
      </button>
    </div>

    <div v-if="showHistory && history.length > 0" class="mb-3 p-2 bg-white rounded border border-purple-100 max-h-32 overflow-y-auto">
      <div class="text-xs text-gray-500 mb-1">
        之前的修改要求：
      </div>
      <ul class="space-y-1">
        <li v-for="(req, idx) in history" :key="idx" class="text-xs text-gray-700 flex items-start gap-1">
          <span class="text-purple-400 flex-shrink-0">{{ idx + 1 }}.</span>
          <span class="break-all">{{ req }}</span>
        </li>
      </ul>
    </div>

    <div class="flex gap-2 items-center">
      <div class="flex-1 relative">
        <input
          v-model="requirement"
          type="text"
          :placeholder="placeholder"
          :disabled="isSubmitting || disabled"
          class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white"
          :class="{
            'animate-gradient-x bg-gradient-to-r from-purple-100 via-purple-200 to-purple-100 bg-[length:200%_100%]': isSubmitting,
          }"
          @keydown="handleKeyDown"
        >
      </div>
      <button
        :disabled="!requirement.trim() || isSubmitting || disabled"
        class="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed bg-purple-500 text-white hover:bg-purple-600 active:scale-95"
        title="提交 (Ctrl+Enter)"
        @click="handleSubmit"
      >
        <Send size="{16}" :class="{ 'animate-pulse': isSubmitting }" />
      </button>
    </div>
  </div>
</template>

<style scoped>
@keyframes gradient-x {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.animate-gradient-x {
  animation: gradient-x 2s ease infinite;
}
</style>
