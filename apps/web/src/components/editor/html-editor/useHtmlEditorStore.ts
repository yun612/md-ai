import type { EditorView } from '@codemirror/view'
import { useStorage } from '@vueuse/core'
import { addPrefix } from '@/utils'

export type EditMode = `markdown` | `html`

export const useHtmlEditorStore = defineStore(`htmlEditor`, () => {
  const editMode = useStorage<EditMode>(addPrefix(`edit_mode`), `html`)

  const htmlContent = ref(``)
  const markdownContent = ref(``)
  const htmlEditor = ref<EditorView | null>(null)
  const showHtmlEditor = useStorage(addPrefix(`show_html_editor`), true)

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

  function toggleHtmlEditor() {
    showHtmlEditor.value = !showHtmlEditor.value
  }

  function setHtmlContent(content: string) {
    htmlContent.value = content
  }

  function setMarkdownContent(content: string) {
    markdownContent.value = content
  }

  return {
    editMode,
    htmlContent,
    markdownContent,
    htmlEditor,
    showHtmlEditor,
    isHtmlMode,
    isMarkdownMode,
    switchToHtml,
    switchToMarkdown,
    toggleEditMode,
    toggleHtmlEditor,
    setHtmlContent,
    setMarkdownContent,
  }
})
