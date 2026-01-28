<script setup lang="ts">
import type { Image } from '@/utils/images/types'
import { ImageOff, Loader2, Search, X } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createImageManager } from '@/utils/images/manager'

interface Props {
  visible?: boolean
  keywords?: string
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  keywords: ``,
})

const emit = defineEmits<{
  (e: `update:visible`, value: boolean): void
  (e: `select`, image: Image): void
}>()

const searchKeywords = ref(props.keywords)
const isSearching = ref(false)
const searchResults = ref<Image[]>([])
const selectedImage = ref<Image | null>(null)
const imageManager = createImageManager({
  providers: {
  },
})

// 监听关键词变化
watch(() => props.keywords, (newVal) => {
  if (newVal) {
    searchKeywords.value = newVal
    handleSearch()
  }
})

async function handleSearch() {
  const keywords = searchKeywords.value.trim()
  if (!keywords) {
    toast.error(`请输入搜索关键词`)
    return
  }

  isSearching.value = true
  searchResults.value = []
  selectedImage.value = null

  try {
    // 搜索图片，默认获取 20 张
    const results = await imageManager.searchImages(keywords, {
      count: 20,
    })

    if (results.length === 0) {
      toast.info(`未找到相关图片，请尝试其他关键词`)
    }
    else {
      searchResults.value = results
      toast.success(`找到 ${results.length} 张图片`)
    }
  }
  catch (error) {
    console.error(`搜索图片失败:`, error)
    toast.error(`搜索图片失败，请检查网络连接或稍后重试`)
  }
  finally {
    isSearching.value = false
  }
}

function handleSelectImage(image: Image) {
  selectedImage.value = image
}

function handleConfirm() {
  if (!selectedImage.value) {
    toast.error(`请先选择一张图片`)
    return
  }

  emit(`select`, selectedImage.value)
  handleClose()
}

function handleClose() {
  emit(`update:visible`, false)
  // 重置状态
  searchKeywords.value = ``
  searchResults.value = []
  selectedImage.value = null
}

function handleKeyPress(e: KeyboardEvent) {
  if (e.key === `Enter` && !isSearching.value) {
    handleSearch()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="handleClose"
      >
        <div
          class="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col"
          @click.stop
        >
          <!-- 头部 -->
          <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              搜索图片
            </h2>
            <button
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              @click="handleClose"
            >
              <X :size="24" />
            </button>
          </div>

          <!-- 搜索栏 -->
          <div class="p-6 border-b border-gray-200 dark:border-gray-800">
            <div class="flex gap-3">
              <Input
                v-model="searchKeywords"
                placeholder="输入关键词搜索图片，例如：风景、商务、科技..."
                class="flex-1"
                :disabled="isSearching"
                @keypress="handleKeyPress"
              />
              <Button
                :disabled="isSearching || !searchKeywords.trim()"
                @click="handleSearch"
              >
                <Loader2 v-if="isSearching" :size="18" class="mr-2 animate-spin" />
                <Search v-else :size="18" class="mr-2" />
                搜索
              </Button>
            </div>
          </div>

          <!-- 搜索结果区域 -->
          <div class="flex-1 p-6 overflow-y-auto scroll-area">
            <!-- 加载状态 -->
            <div v-if="isSearching" class="flex items-center justify-center py-20">
              <div class="text-center">
                <Loader2 :size="48" class="mx-auto mb-4 animate-spin text-blue-500" />
                <p class="text-gray-500 dark:text-gray-400">
                  正在搜索图片...
                </p>
              </div>
            </div>

            <!-- 空状态 -->
            <div
              v-else-if="searchResults.length === 0"
              class="flex items-center justify-center py-20"
            >
              <div class="text-center">
                <ImageOff :size="64" class="mx-auto mb-4 text-gray-300 dark:text-gray-700" />
                <p class="text-gray-500 dark:text-gray-400">
                  输入关键词开始搜索图片
                </p>
              </div>
            </div>

            <!-- 图片网格 -->
            <div
              v-else
              class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              <div
                v-for="image in searchResults"
                :key="image.id"
                class="relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200"
                :class="[
                  selectedImage?.id === image.id
                    ? 'border-blue-500 shadow-lg scale-105'
                    : 'border-transparent hover:border-blue-300 hover:shadow-md',
                ]"
                @click="handleSelectImage(image)"
              >
                <!-- 图片 -->
                <div class="aspect-square bg-gray-100 dark:bg-gray-800">
                  <img
                    :src="image.thumbnailUrl"
                    :alt="image.title"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  >
                </div>

                <!-- 选中标记 -->
                <div
                  v-if="selectedImage?.id === image.id"
                  class="absolute inset-0 bg-blue-500/20 flex items-center justify-center"
                >
                  <div class="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg
                      class="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="3"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>

                <!-- 悬停信息 -->
                <div
                  class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  <p class="text-white text-sm font-medium line-clamp-2">
                    {{ image.title }}
                  </p>
                  <p v-if="image.author" class="text-white/80 text-xs mt-1">
                    {{ image.author }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部操作栏 -->
          <div
            v-if="searchResults.length > 0"
            class="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-800"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">
              <span v-if="selectedImage">
                已选择：{{ selectedImage.title }}
              </span>
              <span v-else>
                请选择一张图片
              </span>
            </div>
            <div class="flex gap-3">
              <Button variant="outline" @click="handleClose">
                取消
              </Button>
              <Button
                :disabled="!selectedImage"
                @click="handleConfirm"
              >
                确定
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 自定义滚动条样式 */
:deep(.scroll-area) {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
}

:deep(.scroll-area::-webkit-scrollbar) {
  width: 8px;
}

:deep(.scroll-area::-webkit-scrollbar-track) {
  background: transparent;
}

:deep(.scroll-area::-webkit-scrollbar-thumb) {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 4px;
}

:deep(.scroll-area::-webkit-scrollbar-thumb:hover) {
  background-color: rgba(156, 163, 175, 0.7);
}
</style>
