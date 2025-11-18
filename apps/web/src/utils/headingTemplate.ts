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
    h2: HeadingTemplate
    h3: HeadingTemplate
    h4: HeadingTemplate
    h5: HeadingTemplate
    h6: HeadingTemplate
  }
}

let cachedTemplate: HeadingStylesConfig | null = null

export async function loadHeadingTemplate(): Promise<HeadingStylesConfig> {
  if (cachedTemplate) {
    return cachedTemplate
  }

  try {
    const response = await fetch(`/src/assets/templates/heading-styles.json`)
    const template = await response.json() as HeadingStylesConfig
    cachedTemplate = template
    return template
  }
  catch (error) {
    console.warn(`Failed to load heading template, using default`, error)
    const defaultTemplate = getDefaultTemplate()
    cachedTemplate = defaultTemplate
    return defaultTemplate
  }
}

export function loadHeadingTemplateSync(): HeadingStylesConfig {
  if (cachedTemplate) {
    return cachedTemplate
  }
  cachedTemplate = getDefaultTemplate()
  return cachedTemplate
}

function getDefaultTemplate(): HeadingStylesConfig {
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
  }
}

export function replaceTemplateVariables(
  template: string,
  text: string,
  config: HeadingStylesConfig,
): string {
  let result = template

  // 先处理 text.slice 表达式
  const sliceRegex = /\{\{text\.slice\((\d+),\s*(\d+)\)\}\}/g
  result = result.replace(sliceRegex, (_match, start, end) => {
    const startNum = Number.parseInt(start)
    const endNum = Number.parseInt(end)
    return text.slice(startNum, endNum)
  })

  // 替换其他变量
  result = result
    .replace(/\{\{iconUrl\}\}/g, config.iconUrl)
    .replace(/\{\{bgImageUrl\}\}/g, config.bgImageUrl)
    .replace(/\{\{text\}\}/g, text)

  // 替换颜色主题变量
  Object.keys(config.colorTheme).forEach((key) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, `g`)
    result = result.replace(regex, config.colorTheme[key])
  })

  return result
}

export function generateHeadingHTML(
  level: 2 | 3 | 4 | 5 | 6,
  text: string,
  config?: HeadingStylesConfig,
): string {
  const templateConfig = config || loadHeadingTemplateSync()
  const headingKey = `h${level}` as keyof typeof templateConfig.headings

  if (!templateConfig.headings[headingKey]) {
    return `<h${level}>${text}</h${level}>`
  }

  const template = templateConfig.headings[headingKey].template
  return replaceTemplateVariables(template, text, templateConfig)
}

export function getAllTemplates(): HeadingTemplate[] {
  const config = loadHeadingTemplateSync()
  return [
    config.headings.h2,
    config.headings.h3,
    config.headings.h4,
    config.headings.h5,
    config.headings.h6,
  ]
}
