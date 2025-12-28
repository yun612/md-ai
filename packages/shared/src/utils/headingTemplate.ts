import { generateColorTheme } from './colorHelpers'

export interface HeadingTemplate {
  name: string
  description: string
  template: string
}

export interface HeadingStylesConfig {
  name: string
  description: string
  version: string
  author: string
  iconUrl: string
  bgImageUrl: string
  colorTheme: Record<string, string>
  headings: {
    h1?: HeadingTemplate
    h2: HeadingTemplate
    h3: HeadingTemplate
    h4: HeadingTemplate
    h5: HeadingTemplate
    h6: HeadingTemplate
  }
  options?: {
    wrapH2Content?: boolean
    h2ContentBorder?: boolean
    h2ContentBorderColor?: string
    h2ContentBackgroundColor?: string
  }
}

const cachedTemplates: Map<string, HeadingStylesConfig> = new Map()

export function replaceTemplateVariables(
  template: string,
  text: string,
  config: HeadingStylesConfig,
  primaryColor?: string,
  index?: string,
): string {
  let result = template

  // 支持两种格式：{{text.slice(start, end)}} 和 {{text.slice(start)}}
  const sliceRegex = /\{\{text\.slice\((\d+)(?:,\s*(\d+))?\)\}\}/g
  result = result.replace(sliceRegex, (_match, start, end) => {
    const startNum = Number.parseInt(start)
    if (end !== undefined) {
      const endNum = Number.parseInt(end)
      return text.slice(startNum, endNum)
    }
    else {
      return text.slice(startNum)
    }
  })

  result = result
    .replace(/\{\{iconUrl\}\}/g, config.iconUrl)
    .replace(/\{\{bgImageUrl\}\}/g, config.bgImageUrl)
    .replace(/\{\{text\}\}/g, text)

  if (index !== undefined) {
    result = result.replace(/\{\{index\}\}/g, index)
  }

  const generatedTheme = primaryColor ? generateColorTheme(primaryColor) : null
  const colorTheme = generatedTheme || config.colorTheme

  Object.keys(colorTheme).forEach((key) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, `g`)
    result = result.replace(regex, colorTheme[key])
  })

  return result
}

export function generateHeadingHTML(
  level: 1 | 2 | 3 | 4 | 5 | 6,
  text: string,
  config: HeadingStylesConfig,
  primaryColor?: string,
  index?: string,
): string {
  // 明确检查 h1-h6 是否存在，支持 h1 可选的情况
  let headingTemplate: HeadingTemplate | undefined
  if (level === 1) {
    headingTemplate = config.headings.h1
  }
  else if (level === 2) {
    headingTemplate = config.headings.h2
  }
  else if (level === 3) {
    headingTemplate = config.headings.h3
  }
  else if (level === 4) {
    headingTemplate = config.headings.h4
  }
  else if (level === 5) {
    headingTemplate = config.headings.h5
  }
  else if (level === 6) {
    headingTemplate = config.headings.h6
  }

  if (!headingTemplate || !headingTemplate.template) {
    return `<h${level}>${text}</h${level}>`
  }

  const template = headingTemplate.template
  return replaceTemplateVariables(template, text, config, primaryColor, index)
}

export function getDefaultTemplate(): HeadingStylesConfig {
  return {
    name: `精美标题样式模板`,
    description: `基于H2和H3的精美样式，包含H4-H6的扩展样式`,
    version: `1.0.0`,
    author: `md-ai`,
    iconUrl: `https://mmbiz.uecloud.com.cn/sz_mmbiz_png/I1fyHmvzZiaXqWLwTRoib4mcGgQXe0uyNTqEWV7FyAZ2icPV08wW1v4MibjFeMbf9frCCVnibxzz0LzmkZA2PAyxOcQ/0?from=appmsg`,
    bgImageUrl: `https://mmbiz.uecloud.com.cn/sz_mmbiz_png/I1fyHmvzZiaXqWLwTRoib4mcGgQXe0uyNTqEWV7FyAZ2icPV08wW1v4MibjFeMbf9frCCVnibxzz0LzmkZA2PAyxOcQ/0?from=appmsg`,
    colorTheme: {
      lightGreen1: `#e8f5e9`,
      lightGreen2: `#c8e6c9`,
      lightGreen3: `#a5d6a7`,
      lightGreen4: `#81c784`,
      green1: `#66bb6a`,
      green2: `#4caf50`,
      green3: `#43a047`,
      darkGreen: `#388e3c`,
      mintGreen: `#d4f1d4`,
      sageGreen: `#b8d4b8`,
      limeGreen: `#c9e4c9`,
      seaGreen: `#9fcd9f`,
      forestGreen: `#5fa85f`,
      text: `rgba(0,0,0,.9)`,
      textLight: `rgba(0,0,0,.85)`,
    },
    headings: {
      h2: {
        name: `二级标题 - 装饰圆点+错位底色`,
        description: `带顶部装饰圆点、背景纹理和错位底色的精美样式`,
        template: `<section style="display: flex; justify-content: center; align-items: center; margin: 20px 0;" data-heading="true" data-heading-depth="2">\n  <section style="display: flex; justify-content: flex-start; align-items: center; flex-direction: column; margin-bottom: 5px;">\n    <section style="width: 17px; height: 17px; display: flex; justify-content: center; align-items: center; align-self: flex-start; background: rgb(255, 255, 255); border-radius: 50%; border: 1px solid rgb(0, 0, 0); z-index: 2; margin-left: 5px; margin-bottom: -8.1px;">\n      <img src="{{iconUrl}}" style="width: 8px; height: 8px; vertical-align: middle;" alt="">\n    </section>\n    <section style="display: flex; justify-content: flex-start; align-items: center; flex-direction: column;">\n      <section style="text-align: center; background-image: url('{{bgImageUrl}}'); background-size: 100% 100%; padding: 9px 15px 14px 19px; z-index: 1;">\n        <section style="color: rgb(0, 0, 0); letter-spacing: 2px;">\n          <p style="margin: 0; font-size: 18px; font-weight: 600;">{{text}}</p>\n        </section>\n      </section>\n      <section style="width: 100%; height: 38px; background: rgb(182, 229, 175); border-radius: 5px; transform: translateX(4px); margin-top: -41.1px;"></section>\n    </section>\n  </section>\n</section>`,
      },
      h3: {
        name: `三级标题 - 圆角矩形+左侧突出块`,
        description: `圆角矩形设计，左侧显示前两个字符作为装饰`,
        template: `<section style="display: inline-flex; align-items: center; background: {{lightGreen2}}; border: 2px solid {{green1}}; border-radius: 50px; padding: 8px 16px; font-family: 'Arial', sans-serif;" data-heading="true" data-heading-depth="3">\n  <section style="font-size: 24px; font-weight: bold; margin-right: 12px;">{{text.slice(0, 2)}}</section>\n  <section style="font-size: 18px; font-weight: 500;">{{text.slice(2)}}</section>\n</section>`,
      },
      h4: {
        name: `四级标题 - 下划线+圆圈`,
        description: `简洁的下划线样式，文字前有小圆圈装饰`,
        template: `<section style="display: inline-flex; align-items: center; margin: 16px 0; padding-bottom: 8px; border-bottom: 2px solid {{green3}}; font-family: 'Arial', sans-serif;" data-heading="true" data-heading-depth="4">\n  <section style="width: 8px; height: 8px; border-radius: 50%; background: {{darkGreen}}; margin-right: 10px; flex-shrink: 0;"></section>\n  <section style="font-size: 16px; font-weight: 600; color: {{text}};">{{text}}</section>\n</section>`,
      },
      h5: {
        name: `五级标题 - 圆角矩形`,
        description: `基于H3风格，简洁的圆角矩形设计`,
        template: `<section style="display: inline-flex; align-items: center; background: {{lightGreen4}}; border: 2px solid {{green3}}; border-radius: 40px; padding: 6px 12px; font-family: 'Arial', sans-serif; margin: 16px 0;" data-heading="true" data-heading-depth="5">\n  <section style="font-size: 15px; font-weight: 500;">{{text}}</section>\n</section>`,
      },
      h6: {
        name: `六级标题 - 简约圆角`,
        description: `最简洁的圆角矩形设计，适合小标题`,
        template: `<section style="display: inline-flex; align-items: center; background: {{lightGreen1}}; border: 1.5px solid {{green3}}; border-radius: 35px; padding: 5px 10px; font-family: 'Arial', sans-serif; margin: 14px 0;" data-heading="true" data-heading-depth="6">\n  <section style="font-size: 14px; font-weight: 500;">{{text}}</section>\n</section>`,
      },
    },
    options: {
      wrapH2Content: true,
      h2ContentBorder: true,
      h2ContentBorderColor: `{{primaryColor}}`,
      h2ContentBackgroundColor: `{{primaryColorLight}}`,
    },
  }
}

export async function loadTemplateFromFile(templateId: string, filePath: string): Promise<HeadingStylesConfig> {
  if (cachedTemplates.has(templateId)) {
    return cachedTemplates.get(templateId)!
  }

  try {
    const response = await fetch(filePath)
    const template = await response.json() as HeadingStylesConfig
    cachedTemplates.set(templateId, template)
    return template
  }
  catch (error) {
    console.warn(`Failed to load template ${templateId}, using default`, error)
    const defaultTemplate = getDefaultTemplate()
    cachedTemplates.set(templateId, defaultTemplate)
    return defaultTemplate
  }
}

export function registerTemplate(templateId: string, config: HeadingStylesConfig): void {
  cachedTemplates.set(templateId, config)
}

export function getTemplate(templateId: string): HeadingStylesConfig | null {
  return cachedTemplates.get(templateId) || null
}

export function getAllRegisteredTemplates(): Map<string, HeadingStylesConfig> {
  return cachedTemplates
}
