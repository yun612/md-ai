import { useStorage } from '@vueuse/core'
import { addPrefix } from '@/utils'

export interface StyleOverride {
  selector: string
  styles: Record<string, string>
  id: string
}

export const usePreviewStyleStore = defineStore(`previewStyle`, () => {
  const styleOverrides = useStorage<StyleOverride[]>(addPrefix(`preview_style_overrides`), [])

  function addStyleOverride(selector: string, styles: Record<string, string>) {
    const id = `override-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    styleOverrides.value.push({
      selector,
      styles,
      id,
    })
    applyStyles()
    return id
  }

  function updateStyleOverride(id: string, styles: Record<string, string>) {
    const override = styleOverrides.value.find(o => o.id === id)
    if (override) {
      override.styles = { ...override.styles, ...styles }
      applyStyles()
    }
  }

  function removeStyleOverride(id: string) {
    const index = styleOverrides.value.findIndex(o => o.id === id)
    if (index > -1) {
      styleOverrides.value.splice(index, 1)
      applyStyles()
    }
  }

  function clearAllOverrides() {
    styleOverrides.value = []
    applyStyles()
  }

  function applyStyles() {
    const styleId = `preview-style-overrides`
    let styleElement = document.getElementById(styleId) as HTMLStyleElement

    if (!styleElement) {
      styleElement = document.createElement(`style`)
      styleElement.id = styleId
      document.head.appendChild(styleElement)
    }

    const cssRules = styleOverrides.value.map((override) => {
      const styleString = Object.entries(override.styles)
        .map(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, `-$1`).toLowerCase()
          return `  ${cssKey}: ${value} !important;`
        })
        .join(`\n`)
      return `${override.selector} {\n${styleString}\n}`
    }).join(`\n\n`)

    styleElement.textContent = cssRules
  }

  function getStyleForElement(element: HTMLElement): StyleOverride | null {
    const elementSelector = generateSelector(element)
    const override = styleOverrides.value.find((o) => {
      try {
        const htmlOutput = element.closest(`#html-output`)
        if (!htmlOutput)
          return false
        const matched = htmlOutput.querySelector(o.selector)
        return matched === element
      }
      catch {
        return o.selector === elementSelector
      }
    })
    return override || null
  }

  function generateSelector(element: HTMLElement): string {
    if (element.id && element.id !== `html-output`) {
      return `#html-output #${element.id}`
    }

    const path: string[] = []
    let current: HTMLElement | null = element
    const htmlOutput = element.closest(`#html-output`)

    while (current && current !== htmlOutput && current !== document.body) {
      let selector = current.tagName.toLowerCase()

      if (current.className && typeof current.className === `string`) {
        const classes = Array.from(current.classList || [])
          .filter(cls => !cls.startsWith(`md-`) && !cls.startsWith(`preview-`) && cls !== `html-preview-content`)
          .join(`.`)
        if (classes) {
          selector += `.${classes.split(` `).join(`.`)}`
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

    return `#html-output ${path.join(` > `)}`
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
