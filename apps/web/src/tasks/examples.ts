/**
 * Task 使用示例
 *
 * 展示如何在 md-ai 中使用 @crafting-agent/shared 的 Task 功能
 */

import type { ModelConfig } from './index'
import { runSimpleTask } from './index'

/**
 * 示例 1: 使用 OpenRouter 运行任务
 */
export async function exampleWithOpenRouter() {
  const modelConfig: ModelConfig = {
    agentModel: {
      provider: `openrouter`,
      apiKey: `your-openrouter-api-key`, // 从环境变量或配置中获取
      modelName: `anthropic/claude-3-5-sonnet`,
      maxTokens: 4096,
    },
  }

  try {
    const result = await runSimpleTask(
      `Help me write a professional README for a markdown editor project`,
      modelConfig,
    )

    console.log(`Task completed!`)
    console.log(`Generated text:`, result.fullText)
    return result
  }
  catch (error) {
    console.error(`Task failed:`, error)
    throw error
  }
}

/**
 * 示例 2: 使用 Google Gemini 运行任务
 */
export async function exampleWithGoogle() {
  const modelConfig: ModelConfig = {
    agentModel: {
      provider: `google`,
      apiKey: `your-google-api-key`,
      modelName: `gemini-2.0-flash-exp`,
      maxTokens: 8192,
    },
  }

  try {
    const result = await runSimpleTask(
      `Generate a creative markdown introduction for a blog post about AI`,
      modelConfig,
    )

    return result
  }
  catch (error) {
    console.error(`Task failed:`, error)
    throw error
  }
}

/**
 * 示例 3: 在 Vue 组件中使用 (带流式输出)
 */
export async function exampleInVueComponent() {
  const { startTaskWithStreaming } = await import(`./index`)

  const modelConfig: ModelConfig = {
    agentModel: {
      provider: `openrouter`,
      apiKey: `your-api-key`,
      modelName: `anthropic/claude-3-5-sonnet`,
    },
  }

  const chunks: string[] = []

  await startTaskWithStreaming(
    `Write a markdown tutorial about Vue 3 composition API`,
    modelConfig,
    (chunk) => {
      // 处理流式响应
      if (chunk.type === `text` && chunk.text) {
        chunks.push(chunk.text)
        // 在 Vue 中可以更新 reactive 状态
        // markdownContent.value += chunk.text
        console.log(`Received chunk:`, chunk.text)
      }
      else if (chunk.type === `reasoning` && chunk.reasoning) {
        console.log(`AI is thinking:`, chunk.reasoning)
      }
      else if (chunk.type === `tool_calls`) {
        console.log(`AI is calling a tool:`, chunk.tool_call)
      }
    },
  )

  return chunks.join(``)
}

/**
 * 示例 4: 与 md-ai 现有的 AI 配置集成
 */
export async function exampleWithMdAiConfig() {
  // 假设从 md-ai 的 stores/aiConfig.ts 获取配置
  const aiConfig = {
    provider: `openrouter`,
    apiKey: localStorage.getItem(`openrouter_api_key`) || ``,
    modelName: `anthropic/claude-3-5-sonnet`,
  }

  const modelConfig: ModelConfig = {
    agentModel: {
      provider: aiConfig.provider as any,
      apiKey: aiConfig.apiKey,
      modelName: aiConfig.modelName,
      maxTokens: 4096,
    },
  }

  return await runSimpleTask(
    `Improve the following markdown content: [your content here]`,
    modelConfig,
  )
}

/**
 * 使用说明：
 *
 * 1. 在 Vue 组件中导入：
 * ```typescript
 * import { runSimpleTask, startTaskWithStreaming } from '@/tasks'
 * ```
 *
 * 2. 在 setup() 中使用：
 * ```typescript
 * const result = ref('')
 * const loading = ref(false)
 *
 * const runAITask = async () => {
 *   loading.value = true
 *   try {
 *     const response = await runSimpleTask(userInput.value, modelConfig)
 *     result.value = response.fullText
 *   } finally {
 *     loading.value = false
 *   }
 * }
 * ```
 *
 * 3. 流式输出示例：
 * ```typescript
 * const streamingContent = ref('')
 *
 * await startTaskWithStreaming(instruction, modelConfig, (chunk) => {
 *   if (chunk.type === 'text') {
 *     streamingContent.value += chunk.text
 *   }
 * })
 * ```
 */
