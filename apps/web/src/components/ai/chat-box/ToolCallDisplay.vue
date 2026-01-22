<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  toolName: string
  input: any
}

const props = defineProps<Props>()

const isExpanded = ref(false)

const fullInputString = computed(() => {
  if (!props.input)
    return ``
  if (typeof props.input === `string`)
    return props.input
  try {
    return JSON.stringify(props.input, null, 2)
  }
  catch (e) {
    return String(props.input)
  }
})

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="border border-border/50 rounded-md bg-muted/30">
    <!-- 标题栏 -->
    <div class="flex items-center gap-2 p-2">
      <div class="text-xs font-medium text-primary">
        {{ toolName }}
      </div>
    </div>

    <!-- JSON内容区域 -->
    <div class="border-t border-border/30">
      <div
        class="cursor-pointer transition-all duration-200"
        :class="isExpanded ? '' : 'overflow-hidden'"
        @click="toggleExpand"
      >
        <pre
          class="text-xs bg-muted/50 p-2 rounded-b-md overflow-x-auto whitespace-pre-wrap break-words"
          :class="isExpanded ? '' : 'line-clamp-2'"
          :style="isExpanded ? '' : { maxHeight: '3rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }"
        >{{ fullInputString || '...' }}</pre>
      </div>
      <div
        v-if="fullInputString.length > 100"
        class="text-[10px] text-muted-foreground/60 px-2 pb-1 text-center cursor-pointer hover:text-muted-foreground transition-colors"
        @click="toggleExpand"
      >
        {{ isExpanded ? '点击收缩' : '点击展开' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
