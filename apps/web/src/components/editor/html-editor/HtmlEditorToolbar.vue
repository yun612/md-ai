<script setup lang="ts">
import { FileCode, FileText } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useHtmlEditorStore } from './useHtmlEditorStore'

const emit = defineEmits<{
  modeChanged: [mode: `markdown` | `html`]
}>()
const htmlEditorStore = useHtmlEditorStore()
const { editMode, isHtmlMode } = storeToRefs(htmlEditorStore)

function handleModeSwitch(mode: `markdown` | `html`) {
  if (mode === `html`) {
    htmlEditorStore.switchToHtml()
  }
  else {
    htmlEditorStore.switchToMarkdown()
  }
  emit(`modeChanged`, mode)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="h-8 px-3"
      >
        <component
          :is="isHtmlMode ? FileCode : FileText"
          class="h-4 w-4 mr-2"
        />
        <span>{{ editMode === 'markdown' ? 'Markdown' : 'HTML' }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuItem
        :class="{ 'bg-accent': editMode === 'markdown' }"
        @click="handleModeSwitch('markdown')"
      >
        <FileText class="h-4 w-4 mr-2" />
        <div>
          <div class="font-medium">
            Markdown 模式
          </div>
          <div class="text-xs text-muted-foreground">
            使用 Markdown 语法编写
          </div>
        </div>
      </DropdownMenuItem>
      <DropdownMenuItem
        :class="{ 'bg-accent': editMode === 'html' }"
        @click="handleModeSwitch('html')"
      >
        <FileCode class="h-4 w-4 mr-2" />
        <div>
          <div class="font-medium">
            HTML 模式
          </div>
          <div class="text-xs text-muted-foreground">
            直接编写 HTML+CSS 代码
          </div>
        </div>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
