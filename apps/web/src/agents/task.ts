import type {
  ISystemPromptBuilder,
  TaskContext,
  ToolHandler,
} from '@grisaiaevy/crafting-agent'

export class BrowserToolHandler implements ToolHandler {
  tool() {
    return {
      type: `function` as const,
      function: {
        name: `browser_action`,
        description: `Execute a browser-based action`,
        parameters: {
          type: `object`,
          properties: {
            action: {
              type: `string`,
              description: `The action to perform`,
            },
          },
          required: [`action`],
        },
      },
    }
  }

  async execute(toolCall: any, _context?: TaskContext): Promise<string> {
    console.log(`[BrowserTool] Executing:`, toolCall)
    const args = typeof toolCall.function.arguments === `string`
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments

    return `Browser action executed: ${args.action}`
  }
}

export class SimplePromptBuilder implements ISystemPromptBuilder {
  async buildSystemPrompt(): Promise<string> {
    return `You are a helpful AI assistant for markdown editing.
You are working in a web-based markdown editor environment.
Help users with markdown content creation and editing.`
  }

  async buildEnvironmentDetails(): Promise<string> {
    return `Current time: ${new Date().toISOString()}

`
  }
}
