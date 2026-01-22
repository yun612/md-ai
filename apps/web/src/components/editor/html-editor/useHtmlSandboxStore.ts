import { useStorage } from '@vueuse/core'
import { addPrefix } from '@/utils'
import { useDebouncedFormatter } from '@/utils/formatter'

// 用于标识被修改的 section 的属性名
export const SANDBOX_MODIFIED_ATTR = `data-sandbox-modified`
// 用于标识被修改的 section 的 CSS 类名
export const SANDBOX_MODIFIED_CLASS = `sandbox-modified-section`

export interface SandboxState {
  isActive: boolean
  content: string
  modifiedSections: string[] // 存储被修改的 section 的 ID 列表
}

export const useHtmlSandboxStore = defineStore(`htmlSandbox`, () => {
  // Sandbox 是否处于活动状态
  const isActive = ref(false)

  // Sandbox 中的 HTML 内容
  const sandboxContent = ref(``)

  // 被修改的 section ID 列表
  const modifiedSections = ref<string[]>([])

  // 是否显示 Sandbox 面板
  const showSandboxPanel = useStorage(addPrefix(`show_sandbox_panel`), false)

  const debouncedFormatter = useDebouncedFormatter((formatted) => {
    if (sandboxContent.value !== formatted) {
      sandboxContent.value = formatted
    }
  })

  watch(sandboxContent, (newContent) => {
    debouncedFormatter(newContent)
  })

  /**
   * 创建 HtmlSandbox
   * 复制当前 HTML 内容到 Sandbox 中
   * @param htmlContent 当前的 HTML 内容
   */
  function createSandbox(htmlContent: string): void {
    sandboxContent.value = htmlContent
    modifiedSections.value = []
    isActive.value = true
    showSandboxPanel.value = true
  }

  /**
   * 更新 Sandbox 内容
   * @param content 新的 HTML 内容
   */
  function updateSandboxContent(content: string): void {
    sandboxContent.value = content
  }

  /**
   * 标记一个 section 为已修改
   * @param sectionId section 的 ID
   */
  function markSectionAsModified(sectionId: string): void {
    if (!modifiedSections.value.includes(sectionId)) {
      modifiedSections.value.push(sectionId)
    }
  }

  /**
   * 获取清理后的 Sandbox 内容（移除修改标记）
   * 用于将 Sandbox 内容应用到真正的 HTML 编辑器
   */
  function getCleanContent(): string {
    // 创建一个临时 DOM 来处理内容
    const tempDiv = document.createElement(`div`)
    tempDiv.innerHTML = sandboxContent.value

    // 移除所有修改标记
    const modifiedElements = tempDiv.querySelectorAll(`[${SANDBOX_MODIFIED_ATTR}]`)
    modifiedElements.forEach((el) => {
      el.removeAttribute(SANDBOX_MODIFIED_ATTR)
      el.classList.remove(SANDBOX_MODIFIED_CLASS)
    })

    return tempDiv.innerHTML
  }

  /**
   * 应用 Sandbox 内容到真正的 HTML 编辑器
   * @param setHtmlContent 设置 HTML 内容的函数
   */
  function applySandboxToEditor(setHtmlContent: (content: string) => void): void {
    const cleanContent = getCleanContent()
    setHtmlContent(cleanContent)
    closeSandbox()
  }

  /**
   * 关闭 Sandbox，丢弃所有更改
   */
  function closeSandbox(): void {
    isActive.value = false
    showSandboxPanel.value = false
    sandboxContent.value = ``
    modifiedSections.value = []
  }

  /**
   * 切换 Sandbox 面板显示状态
   */
  function toggleSandboxPanel(): void {
    showSandboxPanel.value = !showSandboxPanel.value
  }

  /**
   * 应用 diff 结果到 Sandbox
   * @param diffResult diff 处理的结果内容
   * @param modifiedSectionIds 被修改的 section ID 列表
   */
  function applyDiffResult(diffResult: string, modifiedSectionIds?: string[]): void {
    sandboxContent.value = diffResult

    if (modifiedSectionIds) {
      modifiedSectionIds.forEach((id) => {
        markSectionAsModified(id)
      })
    }
  }

  return {
    // State
    isActive,
    sandboxContent,
    modifiedSections,
    showSandboxPanel,

    // Actions
    createSandbox,
    updateSandboxContent,
    markSectionAsModified,
    getCleanContent,
    applySandboxToEditor,
    closeSandbox,
    toggleSandboxPanel,
    applyDiffResult,
  }
})
