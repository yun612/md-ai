/**
 * HTML 元素工具函数
 *
 * 提供统一的元素定位和验证逻辑
 */

/**
 * 验证元素是否有有效的 ID
 *
 * @param element 要验证的元素
 * @returns 如果有有效ID返回 true，否则返回 false
 */
export function hasValidElementId(element: HTMLElement): boolean {
  return Boolean(element.id && element.id !== `html-output`)
}

/**
 * 获取元素的有效 ID
 *
 * @param element 要获取 ID 的元素
 * @returns 元素的 ID，如果没有有效ID则返回 null
 */
export function getElementId(element: HTMLElement): string | null {
  return hasValidElementId(element) ? element.id : null
}

/**
 * 在源代码 HTML 中通过 ID 定位元素
 *
 * @param element 预览 DOM 中的元素
 * @param sourceContainer 源代码 DOM 容器
 * @returns 找到的元素，如果找不到则返回 null
 */
export function findElementByIdInSource(
  element: HTMLElement,
  sourceContainer: HTMLElement,
): HTMLElement | null {
  const elementId = getElementId(element)

  if (!elementId) {
    console.warn(`元素没有有效的 ID`)
    return null
  }

  const targetElement = sourceContainer.querySelector(`#${elementId}`) as HTMLElement

  if (!targetElement) {
    console.warn(`在源代码中找不到 ID 为 ${elementId} 的元素`)
    return null
  }

  return targetElement
}

/**
 * 生成元素的 CSS 选择器（用于预览样式）
 *
 * @param element 要生成选择器的元素
 * @returns CSS 选择器字符串，格式为 `#html-output #elementId`
 */
export function generateElementSelector(element: HTMLElement): string {
  const elementId = getElementId(element)

  if (!elementId) {
    console.warn(`元素没有有效的 ID，使用通配符选择器`)
    return `#html-output *`
  }

  return `#html-output #${elementId}`
}
