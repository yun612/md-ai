import type { TaskContext, ToolHandler } from '@grisaiaevy/crafting-agent'

export class GenerateOutlineToolHandler implements ToolHandler {
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

  async execute(toolCall: any, _context?: TaskContext): Promise<string> {
    console.log(`[GenerateOutlineTool] Executing:`, toolCall)
    const args = typeof toolCall.function.arguments === `string`
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments

    return `Generate outline executed: ${args.title}`
  }
}
