import type { TaskContext, ToolHandler } from '@grisaiaevy/crafting-agent'

export class UpdateSectionToolHandler implements ToolHandler {
  getConfig() {
    return {
      humanInLoop: true,
    }
  }

  tool() {
    return {
      type: `function` as const,
      function: {
        name: `update_section`,
        description: `更新文章的章节内容`,
        parameters: {
          type: `object`,
          properties: {
            old: {
              type: `string`,
              description: `原章节内容`,
            },
            new: {
              type: `string`,
              description: `新章节内容`,
            },
          },
          required: [`old`, `new`],
        },
      },
    }
  }

  async execute(toolCall: any, _context?: TaskContext): Promise<string> {
    console.log(`[UpdateSectionTool] Executing:`, toolCall)
    const args = typeof toolCall.function.arguments === `string`
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments

    return `Update section executed: old content length ${args.old.length}, new content length ${args.new.length}`
  }
}
