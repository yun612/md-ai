import type { ModelConfig, TaskContext } from '@crafting-agent/shared'
import { Task as TaskExecutor } from '@crafting-agent/shared'
import { DummyTaskStorage } from './dummy_storage'

/**
 * 浏览器环境的 Tool Handler（不依赖 Node.js）
 * 这里只是示例，实际需要根据 md-ai 的需求实现
 */
class BrowserToolHandler {
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

/**
 * 简单的 SystemPromptBuilder 实现
 */
class SimplePromptBuilder {
  async buildSystemPrompt(): Promise<string> {
    return `You are a helpful AI assistant for markdown editing.
You are working in a web-based markdown editor environment.
Help users with markdown content creation and editing.`
  }

  async buildEnvironmentDetails(): Promise<string> {
    return `Browser environment: ${navigator.userAgent}
Current time: ${new Date().toISOString()}`
  }
}

/**
 * 创建并启动一个 Task 实例
 *
 * @param modelConfig - 模型配置
 * @returns Task 实例和存储实例
 */
export async function createTask(modelConfig: ModelConfig) {
  const storage = new DummyTaskStorage()
  const taskId = `task-${Date.now()}`
  const projectId = `project-${Date.now()}`

  // 配置 AI Provider（需要从 md-ai 的配置中读取）
  // 这里使用示例配置
  const taskContext: TaskContext = {
    modelConfig,
    variables: {
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    },
    systemPromptBuilder: new SimplePromptBuilder(),
    tools: [
      new BrowserToolHandler(),
      // 可以添加更多浏览器兼容的工具
    ],
  }

  const task = new TaskExecutor(
    taskId,
    projectId,
    modelConfig,
    storage,
    taskContext,
  )

  return {
    task,
    storage,
    taskId,
    projectId,
  }
}

/**
 * 启动任务并处理流式响应
 *
 * @param userInstruction - 用户指令
 * @param modelConfig - 模型配置
 * @param onChunk - 处理每个响应块的回调函数
 */
export async function startTaskWithStreaming(
  userInstruction: string,
  modelConfig: ModelConfig,
  onChunk: (chunk: any) => void,
) {
  const { task, storage, taskId, projectId } = await createTask(modelConfig)

  console.log(`[Task] Starting task:`, {
    taskId,
    projectId,
    instruction: userInstruction,
  })

  try {
    const stream = task.startTask(userInstruction)

    for await (const chunk of stream) {
      onChunk(chunk)
    }

    console.log(`[Task] Task completed successfully`)
    return {
      success: true,
      taskId,
      storage,
    }
  }
  catch (error) {
    console.error(`[Task] Task failed:`, error)
    throw error
  }
}

/**
 * 简化的任务启动函数（用于快速测试）
 *
 * @example
 * ```typescript
 * const result = await runSimpleTask(
 *   'Help me write a markdown introduction',
 *   {
 *     agentModel: {
 *       provider: 'openrouter',
 *       apiKey: 'your-api-key',
 *       modelName: 'anthropic/claude-3-5-sonnet',
 *     }
 *   }
 * )
 * console.log('Task result:', result)
 * ```
 */
export async function runSimpleTask(
  userInstruction: string,
  modelConfig: ModelConfig,
) {
  const chunks: string[] = []

  await startTaskWithStreaming(
    userInstruction,
    modelConfig,
    (chunk) => {
      if (chunk.type === `text` && chunk.text) {
        chunks.push(chunk.text)
        console.log(`[Task] Text chunk:`, chunk.text)
      }
      else if (chunk.type === `reasoning` && chunk.reasoning) {
        console.log(`[Task] Reasoning:`, chunk.reasoning)
      }
      else if (chunk.type === `tool_calls`) {
        console.log(`[Task] Tool call:`, chunk.tool_call)
      }
    },
  )

  return {
    fullText: chunks.join(``),
    chunks,
  }
}

// 导出类型
export type { ModelConfig, TaskContext, TaskExecutor }
export { DummyTaskStorage }
