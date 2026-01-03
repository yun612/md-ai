import { useStorage } from '@vueuse/core'
import { addPrefix } from '@/utils'

export type EditMode = `markdown` | `html`

export const useHtmlEditorStore = defineStore(`htmlEditor`, () => {
  const editMode = useStorage<EditMode>(addPrefix(`edit_mode`), `markdown`)

  const htmlContent = ref(``)

  const isHtmlMode = computed(() => editMode.value === `html`)
  const isMarkdownMode = computed(() => editMode.value === `markdown`)

  function switchToHtml() {
    editMode.value = `html`
  }

  function switchToMarkdown() {
    editMode.value = `markdown`
  }

  function toggleEditMode() {
    editMode.value = editMode.value === `markdown` ? `html` : `markdown`
  }

  function setHtmlContent(content: string) {
    htmlContent.value = content
  }

  return {
    editMode,
    htmlContent,
    isHtmlMode,
    isMarkdownMode,
    switchToHtml,
    switchToMarkdown,
    toggleEditMode,
    setHtmlContent,
  }
})
