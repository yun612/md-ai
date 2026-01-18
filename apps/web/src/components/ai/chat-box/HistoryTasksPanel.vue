<script setup lang="ts">
import { History } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

interface Task {
  id: string
  name?: string
  description?: string
  createdAt?: Date | string
}

const props = defineProps<{
  tasks: Task[]
  currentTask?: Task | null
}>()

const emit = defineEmits<{
  (e: `selectTask`, task: Task): void
  (e: `close`): void
}>()

function formatDateTime(date: Date | string | undefined): string {
  if (!date)
    return ``
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    const hours = d.getHours().toString().padStart(2, `0`)
    const minutes = d.getMinutes().toString().padStart(2, `0`)
    return `今天 ${hours}:${minutes}`
  }
  else if (days === 1) {
    return `昨天`
  }
  else if (days < 7) {
    const weekdays = [`周日`, `周一`, `周二`, `周三`, `周四`, `周五`, `周六`]
    return weekdays[d.getDay()]
  }
  else {
    const month = (d.getMonth() + 1).toString().padStart(2, `0`)
    const day = d.getDate().toString().padStart(2, `0`)
    return `${month}-${day}`
  }
}

function handleSelectTask(task: Task) {
  emit(`selectTask`, task)
  emit(`close`)
}
</script>

<template>
  <div class="history-tasks-panel flex-1 overflow-y-auto p-4">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <History class="h-5 w-5 text-muted-foreground" />
        <h3 class="text-sm font-semibold">
          历史任务
        </h3>
      </div>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        title="关闭"
        @click="emit('close')"
      >
        <span class="text-lg">&times;</span>
      </Button>
    </div>

    <div v-if="tasks.length === 0" class="text-center text-muted-foreground text-sm py-8">
      暂无历史任务
    </div>

    <div v-else class="space-y-1">
      <Button
        v-for="task in tasks"
        :key="task.id"
        variant="ghost"
        size="sm"
        class="w-full justify-start h-auto py-2 px-3 text-sm flex-col items-start"
        :class="{ 'bg-primary/10': currentTask?.id === task.id }"
        @click="handleSelectTask(task)"
      >
        <span class="truncate font-medium w-full text-left">{{ task.name || task.description || '未命名任务' }}</span>
        <span class="text-xs text-muted-foreground mt-1">
          {{ formatDateTime(task.createdAt) }}
        </span>
      </Button>
    </div>
  </div>
</template>

<style scoped>
.history-tasks-panel {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
}

.history-tasks-panel::-webkit-scrollbar {
  width: 6px;
}

.history-tasks-panel::-webkit-scrollbar-track {
  background: transparent;
}

.history-tasks-panel::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 3px;
}

.history-tasks-panel::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

.dark .history-tasks-panel {
  scrollbar-color: rgba(107, 114, 128, 0.3) transparent;
}

.dark .history-tasks-panel::-webkit-scrollbar-thumb {
  background-color: rgba(107, 114, 128, 0.3);
}

.dark .history-tasks-panel::-webkit-scrollbar-thumb:hover {
  background-color: rgba(107, 114, 128, 0.5);
}
</style>
