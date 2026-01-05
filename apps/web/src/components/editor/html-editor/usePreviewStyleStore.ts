import { useDebounceFn, useStorage } from '@vueuse/core'
import { addPrefix } from '@/utils'

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

  function generateSelector(element: HTMLElement): string {
    if (selectorCache.has(element)) {
      return selectorCache.get(element)!
    }

    try {
      if (element.id && element.id !== `html-output`) {
        const selector = `#html-output #${element.id}`
        selectorCache.set(element, selector)
        return selector
      }

      const path: string[] = []
      let current: HTMLElement | null = element
      const htmlOutput = element.closest(`#html-output`)

      if (!htmlOutput) {
        throw new Error(`Element is not within #html-output`)
      }

      while (current && current !== htmlOutput && current !== document.body) {
        let selector = current.tagName.toLowerCase()

        if (current.className && typeof current.className === `string`) {
          const classes = Array.from(current.classList || [])
            .filter(cls =>
              !cls.startsWith(`md-`)
              && !cls.startsWith(`preview-`)
              && cls !== `html-preview-content`,
            )
          if (classes.length > 0) {
            selector += `.${classes.join(`.`)}`
          }
        }

        const parent = current.parentElement
        if (parent) {
          const siblings = Array.from(parent.children)
            .filter(el => el.tagName === current!.tagName)
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1
            selector += `:nth-of-type(${index})`
          }
        }

        path.unshift(selector)
        current = current.parentElement
      }

      const finalSelector = `#html-output ${path.join(` > `)}`
      selectorCache.set(element, finalSelector)
      return finalSelector
    }
    catch (error) {
      console.warn(`Failed to generate selector:`, error)
      return `#html-output *`
    }
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
