import type { TaskContext, ToolHandler } from '@grisaiaevy/crafting-agent'

export class WriteArticleToolHandler implements ToolHandler {
  getConfig() {
    return {
      humanInLoop: true,
    }
  }

  tool() {
    return {
      type: `function` as const,
      function: {
        name: `write_article`,
        description: `微信公众号内容`,
        parameters: {
          type: `object`,
          properties: {
            content: {
              type: `string`,
              description: `正文内容，使用section标签+style内联样式组织文章内容`,
            },
          },
          required: [`content`],
        },
      },
    }
  }

  async execute(toolCall: any, _context?: TaskContext): Promise<string> {
    console.log(`[WriteArticleTool] Executing:`, toolCall)
    const args = typeof toolCall.function.arguments === `string`
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments

    return `Write article executed: ${args.content}`
  }
}
