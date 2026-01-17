<script setup lang="ts">
import { FileText, GripVertical, Plus, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export interface OutlineItem {
  id: string
  title: string
  content: string
}

export interface OutlineData {
  topic: string
  items: OutlineItem[]
}

const props = defineProps<{
  modelValue: OutlineData
}>()

const emit = defineEmits<{
  (e: `update:modelValue`, value: OutlineData): void
  (e: `useOutline`, value: OutlineData): void
}>()

const outlineData = computed({
  get: () => props.modelValue,
  set: value => emit(`update:modelValue`, value),
})

const dragSourceId = ref<string | null>(null)
const dropTargetId = ref<string | null>(null)

function generateId(): string {
  return `outline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function addItem(index?: number) {
  const newItem: OutlineItem = {
    id: generateId(),
    title: ``,
    content: ``,
  }

  if (index !== undefined) {
    outlineData.value.items.splice(index + 1, 0, newItem)
  }
  else {
    outlineData.value.items.push(newItem)
  }
}

function removeItem(id: string) {
  const index = outlineData.value.items.findIndex(item => item.id === id)
  if (index !== -1) {
    outlineData.value.items.splice(index, 1)
  }
}

function handleDragStart(id: string, e: DragEvent) {
  dragSourceId.value = id
  e.dataTransfer?.setData(`text/plain`, id)
  e.dataTransfer!.effectAllowed = `move`
}

function handleDragEnd() {
  dragSourceId.value = null
  dropTargetId.value = null
}

function handleDrop(targetId: string, e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()

  const sourceId = dragSourceId.value
  if (!sourceId || sourceId === targetId) {
    dragSourceId.value = null
    dropTargetId.value = null
    return
  }

  const sourceIndex = outlineData.value.items.findIndex(item => item.id === sourceId)
  const targetIndex = outlineData.value.items.findIndex(item => item.id === targetId)

  if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
    const newItems = [...outlineData.value.items]
    const [removed] = newItems.splice(sourceIndex, 1)

    let insertIndex = targetIndex

    if (sourceIndex < targetIndex) {
      insertIndex = targetIndex - 1
    }

    newItems.splice(insertIndex, 0, removed)
    outlineData.value.items = newItems
  }

  dragSourceId.value = null
  dropTargetId.value = null
}

function handleDragOver(id: string, e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()

  if (dragSourceId.value && dragSourceId.value !== id) {
    dropTargetId.value = id
  }
}

function handleDragLeave(e: DragEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX
  const y = e.clientY

  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    dropTargetId.value = null
  }
}

function useOutline() {
  emit(`useOutline`, outlineData.value)
}
</script>

<template>
  <div class="outline-editor w-full space-y-4">
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium">题目</label>
        <Button
          variant="default"
          size="sm"
          class="gap-2"
          :disabled="!outlineData.topic || outlineData.items.length === 0"
          @click="useOutline"
        >
          <FileText class="h-4 w-4" />
          使用大纲编辑内容
        </Button>
      </div>
      <Input
        v-model="outlineData.topic"
        placeholder="请输入文章题目"
        class="text-base font-semibold"
      />
    </div>

    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium">大纲内容</label>
        <Button
          variant="outline"
          size="sm"
          @click="addItem()"
        >
          <Plus class="h-4 w-4 mr-1" />
          添加标题
        </Button>
      </div>

      <div
        v-if="outlineData.items.length === 0"
        class="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-md"
      >
        暂无大纲内容，点击"添加标题"开始创建大纲
      </div>

      <div
        v-for="(item, index) in outlineData.items"
        :key="item.id"
        class="outline-item group border border-border rounded-lg p-4 bg-card transition-all"
        :class="{
          'opacity-50': dragSourceId === item.id,
          'ring-2 ring-primary border-primary bg-primary/5': dropTargetId === item.id,
        }"
        draggable="true"
        @dragstart="handleDragStart(item.id, $event)"
        @dragend="handleDragEnd"
        @drop.stop.prevent="handleDrop(item.id, $event)"
        @dragover.stop.prevent="handleDragOver(item.id, $event)"
        @dragleave.stop.prevent="handleDragLeave($event)"
      >
        <div class="flex items-start gap-3">
          <div class="drag-handle cursor-move pt-1 text-muted-foreground hover:text-foreground transition-colors">
            <GripVertical class="h-5 w-5" />
          </div>

          <div class="flex-1 space-y-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-xs text-muted-foreground">标题 {{ index + 1 }}</span>
              </div>
              <Input
                v-model="item.title"
                placeholder="请输入标题"
                class="font-medium"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs text-muted-foreground">内容</label>
              <Textarea
                v-model="item.content"
                placeholder="请输入内容..."
                class="min-h-[80px] resize-none"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              title="在此处添加"
              @click="addItem(index)"
            >
              <Plus class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-destructive hover:text-destructive"
              title="删除"
              @click="removeItem(item.id)"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.outline-item {
  position: relative;
}

.outline-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.drag-handle {
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.outline-item[draggable='true'] {
  cursor: grab;
}

.outline-item[draggable='true']:active {
  cursor: grabbing;
}
</style>
