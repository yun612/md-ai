import { useDebounceFn, useStorage } from '@vueuse/core'
import { addPrefix } from '@/utils'
import { generateElementSelector } from './htmlElementUtils'

export interface StyleOverride {
  selector: string
  styles: Record<string, string>
  id: string
  createdAt?: number
  updatedAt?: number
}

const STYLE_ELEMENT_ID = `preview-style-overrides`
const selectorCache = new WeakMap<HTMLElement, string>()

function generateId(prefix = `override`): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, `-$1`).toLowerCase()
}

function stylesToCss(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([key, value]) => `  ${camelToKebab(key)}: ${value} !important;`)
    .join(`\n`)
}

export const usePreviewStyleStore = defineStore(`previewStyle`, () => {
  const styleOverrides = useStorage<StyleOverride[]>(
    addPrefix(`preview_style_overrides`),
    [],
  )

  const debouncedApplyStyles = useDebounceFn(() => {
    applyStyles()
  }, 16)

  function applyStyles() {
    let styleElement = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement

    if (!styleElement) {
      styleElement = document.createElement(`style`)
      styleElement.id = STYLE_ELEMENT_ID
      document.head.appendChild(styleElement)
    }

    try {
      const cssRules = styleOverrides.value
        .map((override) => {
          const styleString = stylesToCss(override.styles)
          return `${override.selector} {\n${styleString}\n}`
        })
        .join(`\n\n`)

      styleElement.textContent = cssRules
    }
    catch (error) {
      console.error(`Failed to apply styles:`, error)
    }
  }

  function addStyleOverride(selector: string, styles: Record<string, string>) {
    const id = generateId()
    const now = Date.now()
    styleOverrides.value.push({
      selector,
      styles,
      id,
      createdAt: now,
      updatedAt: now,
    })
    debouncedApplyStyles()
    return id
  }

  function updateStyleOverride(
    id: string,
    styles: Record<string, string>,
  ) {
    const override = styleOverrides.value.find(o => o.id === id)
    if (override) {
      override.styles = { ...override.styles, ...styles }
      override.updatedAt = Date.now()
      debouncedApplyStyles()
      return true
    }
    return false
  }

  function removeStyleOverride(id: string) {
    const index = styleOverrides.value.findIndex(o => o.id === id)
    if (index > -1) {
      styleOverrides.value.splice(index, 1)
      debouncedApplyStyles()
      return true
    }
    return false
  }

  function clearAllOverrides() {
    styleOverrides.value = []
    applyStyles()
  }

  function getStyleForElement(element: HTMLElement): StyleOverride | null {
    if (!element?.isConnected) {
      return null
    }

    const elementSelector = generateSelector(element)
    const htmlOutput = element.closest(`#html-output`)

    if (!htmlOutput) {
      return null
    }

    return styleOverrides.value.find((override) => {
      try {
        const matched = htmlOutput.querySelector(override.selector)
        return matched === element || override.selector === elementSelector
      }
      catch {
        return override.selector === elementSelector
      }
    }) || null
  }

  /**
   * 生成 CSS 选择器用于定位元素
   *
   * 使用 ID 定位：所有元素都有唯一 ID（由外部逻辑保证）
   *
   * @param element 要定位的元素
   * @returns CSS 选择器字符串，格式为 `#html-output #elementId`
   */
  function generateSelector(element: HTMLElement): string {
    // 使用缓存避免重复计算
    if (selectorCache.has(element)) {
      return selectorCache.get(element)!
    }

    const selector = generateElementSelector(element)
    selectorCache.set(element, selector)
    return selector
  }

  return {
    styleOverrides,
    addStyleOverride,
    updateStyleOverride,
    removeStyleOverride,
    clearAllOverrides,
    getStyleForElement,
    generateSelector,
    applyStyles,
  }
})
