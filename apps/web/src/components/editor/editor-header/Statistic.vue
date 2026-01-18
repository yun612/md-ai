<script setup lang="ts">
import { useRenderStore } from '@/stores/render'

const renderStore = useRenderStore()
const { readingTime } = storeToRefs(renderStore)
</script>

<template>
  <div class="border rounded-md px-3 py-1.5 text-xs">
    <div class="space-x-2">
      <span>{{ readingTime.chars }} 个字符</span>
      <span>阅读大约需 {{ readingTime.minutes }} 分钟</span>
      <span>{{ readingTime.sections }} 个板块</span>
    </div>
    <div v-if="readingTime.colors.length > 0" class="mt-2">
      <div class="relative w-full h-6 rounded-md overflow-hidden flex">
        <div
          v-for="(item, index) in readingTime.colors"
          :key="index"
          class="h-full group relative"
          :style="{ width: `${item.percentage}%`, backgroundColor: item.color }"
        >
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center bg-black/50 text-white text-[10px] whitespace-nowrap px-1">
            <span>{{ item.percentage }}% | {{ item.color }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
