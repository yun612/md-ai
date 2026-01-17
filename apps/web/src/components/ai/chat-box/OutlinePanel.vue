<script setup lang="ts">
import type { OutlineData, OutlineItem } from './OutlineEditor.vue'
import { useStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useHtmlEditorStore } from '@/components/editor/html-editor/useHtmlEditorStore'
import { useEditorStore } from '@/stores/editor'
import OutlineEditor from './OutlineEditor.vue'

const props = defineProps<{
  input?: string
  sendMessage?: () => void
}>()
const emit = defineEmits<{
  (e: `useOutline`, outline: OutlineData): void
  (e: `showOutline`): void
}>()
const editorStore = useEditorStore()
const htmlEditorStore = useHtmlEditorStore()
const { editor } = storeToRefs(editorStore)
const { isHtmlMode } = storeToRefs(htmlEditorStore)
const htmlEditor = computed(() => htmlEditorStore.htmlEditor)

const outlineData = useStorage<OutlineData>(`ai_outline_data`, {
  topic: `示例：如何写好一篇公众号文章`,
  items: [
    {
      id: `1`,
      title: `引言：吸引读者注意`,
      content: `用一个引人入胜的开头，可以是故事、问题或数据，抓住读者的注意力。`,
    },
    {
      id: `2`,
      title: `正文：核心内容展开`,
      content: `详细阐述主题，使用案例、数据、观点等支撑内容，保持逻辑清晰。`,
    },
    {
      id: `3`,
      title: `总结：强化观点`,
      content: `总结全文要点，给出行动建议或思考方向，让读者有所收获。`,
    },
  ],
})

function parseOutlineFromContent(content: string) {
  try {
    const jsonBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*"outline"[\s\S]*\})\s*```/)
    if (jsonBlockMatch) {
      const jsonStr = jsonBlockMatch[1]
      const parsed = JSON.parse(jsonStr)
      if (parsed.outline) {
        applyOutlineData(parsed.outline)
        return
      }
    }

    const jsonMatch = content.match(/\{[\s\S]*"outline"[\s\S]*\}/)
    if (jsonMatch) {
      const jsonStr = jsonMatch[0]
      const parsed = JSON.parse(jsonStr)
      if (parsed.outline) {
        applyOutlineData(parsed.outline)
        return
      }
    }

    try {
      const parsed = JSON.parse(content.trim())
      if (parsed.outline) {
        applyOutlineData(parsed.outline)
      }
    }
    catch {
    }
  }
  catch (e) {
    console.error(`解析大纲数据失败:`, e)
  }
}

function applyOutlineData(outlineResult: OutlineData) {
  try {
    if (!outlineResult || !outlineResult.items || !Array.isArray(outlineResult.items)) {
      return
    }

    const processedItems: OutlineItem[] = outlineResult.items.map((item, index) => ({
      id: item.id || `outline-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      title: item.title || `标题 ${index + 1}`,
      content: item.content || ``,
    }))

    outlineData.value = {
      topic: outlineResult.topic || `未指定主题`,
      items: processedItems,
    }

    emit(`showOutline`)
  }
  catch (e) {
    console.error(`应用大纲数据失败:`, e)
  }
}

function handleUseOutline(outline: OutlineData) {
  try {
    if (!outline || !outline.items || outline.items.length === 0) {
      console.error(`大纲数据为空`)
      return
    }

    let markdownContent = `# ${outline.topic}\n\n`

    outline.items.forEach((item, index) => {
      markdownContent += `## ${index + 1}. ${item.title}\n\n`
      if (item.content && item.content.trim()) {
        markdownContent += `${item.content}\n\n`
      }
      else {
        markdownContent += `<!-- TODO: 补充 ${item.title} 的内容 -->\n\n`
      }
    })

    const currentEditor = (isHtmlMode?.value) ? htmlEditor?.value : editor?.value

    if (currentEditor) {
      const currentContent = currentEditor.state.doc.toString()
      const insertPosition = currentContent.length

      const prefix = currentContent.trim() ? `\n\n` : ``

      currentEditor.dispatch({
        changes: {
          from: insertPosition,
          insert: prefix + markdownContent,
        },
        selection: { anchor: insertPosition + prefix.length + markdownContent.length },
      })
    }
    else {
      editorStore.importContent(markdownContent)
    }

    emit(`useOutline`, outline)
  }
  catch (e) {
    console.error(`使用大纲失败:`, e)
  }
}

defineExpose({
  parseOutlineFromContent,
  applyOutlineData,
  outlineData,
})
</script>

<template>
  <div class="outline-panel flex-1 overflow-y-auto p-4">
    <OutlineEditor v-model="outlineData" @use-outline="handleUseOutline" />
  </div>
</template>
