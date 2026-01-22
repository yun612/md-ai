import type { ToolContext, ToolHandler } from '@grisaiaevy/crafting-agent'
import type { HtmlSandbox } from './apply_diff'

export class GenerateOutlineToolHandler implements ToolHandler {
  private sandbox: HtmlSandbox | null = null
  private htmlContentGetter: (() => string) | null = null

  constructor(sandbox?: HtmlSandbox, htmlContentGetter?: () => string) {
    this.sandbox = sandbox || null
    this.htmlContentGetter = htmlContentGetter || null
  }

  /**
   * 设置 Sandbox 实例
   */
  setSandbox(sandbox: HtmlSandbox): void {
    this.sandbox = sandbox
  }

  /**
   * 设置获取 HTML 内容的函数
   */
  setHtmlContentGetter(getter: () => string): void {
    this.htmlContentGetter = getter
  }

  getConfig() {
    return {
      humanInLoop: true,
      displayName: `generate_outline`,
    }
  }

  tool() {
    return {
      type: `function` as const,
      function: {
        name: `generate_outline`,
        description: `为用户的文章生成需求列出一个大纲`,
        parameters: {
          type: `object`,
          properties: {
            title: {
              type: `string`,
              description: `The action to perform`,
            },
            contents: {
              type: `array`,
              items: {
                type: `object`,
                properties: {
                  sub_title: {
                    type: `string`,
                  },
                  description: {
                    type: `string`,
                  },
                },
              },
            },
          },
          required: [`title`, `contents`],
        },
      },
    }
  }

  async execute(toolCall: any, _context?: ToolContext): Promise<string> {
    console.log(`[GenerateOutlineTool] Executing:`, toolCall)
    const args = typeof toolCall.function.arguments === `string`
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments

    const title = args.title || ``
    const contents = args.contents || []

    // 生成 HTML 大纲内容
    let outlineHtml = `<section style="margin-top: 20px; padding: 15px; border: 1px solid #eee; border-radius: 8px;">
  <h1 style="font-size: 24px; color: #333; margin-bottom: 20px; text-align: center;">${title}</h1>
  <div style="line-height: 1.8; color: #666;">
`

    contents.forEach((item: any) => {
      outlineHtml += `    <div style="margin-bottom: 15px;">
      <h2 style="font-size: 18px; color: #444; margin-bottom: 8px;">${item.sub_title}</h2>
      <p style="font-size: 14px; color: #888;">${item.description}</p>
    </div>
`
    })

    outlineHtml += `  </div>
</section>`

    // 如果 Sandbox 已激活或有 getter，则处理 Sandbox
    if (this.sandbox || this.htmlContentGetter) {
      let originalContent = ``
      if (this.sandbox?.isActive.value) {
        originalContent = this.sandbox.sandboxContent.value
      }
      else if (this.htmlContentGetter) {
        originalContent = this.htmlContentGetter()
        if (this.sandbox) {
          this.sandbox.createSandbox(originalContent)
        }
      }

      // 这里简单地将大纲追加到内容末尾，或者如果内容为空则直接设置
      const newContent = originalContent ? `${originalContent}\n${outlineHtml}` : outlineHtml
      if (this.sandbox) {
        this.sandbox.updateSandboxContent(newContent)
      }
    }

    return `Generate outline executed: ${title}`
  }
}
