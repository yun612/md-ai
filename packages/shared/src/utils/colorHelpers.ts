/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => {
    const hex = x.toString(16)
    return hex.length === 1 ? `0${hex}` : hex
  }).join(``)}`
}

/**
 * Lighten a color by a percentage
 */
function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb)
    return hex

  const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * percent))
  const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * percent))
  const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * percent))

  return rgbToHex(r, g, b)
}

/**
 * Darken a color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb)
    return hex

  const r = Math.max(0, Math.round(rgb.r * (1 - percent)))
  const g = Math.max(0, Math.round(rgb.g * (1 - percent)))
  const b = Math.max(0, Math.round(rgb.b * (1 - percent)))

  return rgbToHex(r, g, b)
}

/**
 * Generate color theme variations from primary color
 * Returns null if primaryColor is invalid, so caller can fallback to template's colorTheme
 */
export function generateColorTheme(primaryColor: string): Record<string, string> | null {
  const rgb = hexToRgb(primaryColor)
  if (!rgb) {
    return null
  }

  return {
    lightGreen1: lightenColor(primaryColor, 0.85),
    lightGreen2: lightenColor(primaryColor, 0.75),
    lightGreen3: lightenColor(primaryColor, 0.6),
    lightGreen4: lightenColor(primaryColor, 0.45),
    green1: lightenColor(primaryColor, 0.3),
    green2: primaryColor,
    green3: darkenColor(primaryColor, 0.1),
    darkGreen: darkenColor(primaryColor, 0.2),
    mintGreen: lightenColor(primaryColor, 0.9),
    sageGreen: lightenColor(primaryColor, 0.7),
    limeGreen: lightenColor(primaryColor, 0.8),
    seaGreen: lightenColor(primaryColor, 0.5),
    forestGreen: darkenColor(primaryColor, 0.15),
    text: `rgba(0,0,0,.9)`,
    textLight: `rgba(0,0,0,.85)`,
  }
}
