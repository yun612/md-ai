<script setup lang="ts">
import type { ChatMessage as BaseChatMessage, ContentBlock, ModelConfig, TaskContext } from '@grisaiaevy/crafting-agent'
import type { ToolFunctionsContext } from './tool-box'
import type { OutlineData, OutlineItem } from '@/components/OutlineEditor.vue'
import { Agent } from '@grisaiaevy/crafting-agent'
import { useStorage } from '@vueuse/core'
import {
  Bot,
  Check,
  Copy,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Pause,
  Plus,
  Send,
  Settings,
  Trash2,
} from 'lucide-vue-next'

import { nanoid } from 'nanoid'
import { parse } from 'partial-json'
import { toast } from 'vue-sonner'
import { IndexedDBTaskStorage } from '@/agents/indexeddb_storage'
import AIConfig from '@/components/ai/chat-box/AIConfig.vue'
import MessageBlock from '@/components/ai/chat-box/MessageBlock.vue'
import OutlineEditor from '@/components/OutlineEditor.vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAIConfigStore } from '@/stores/aiConfig'
import { useDisplayStore } from '@/stores/display'
import { useEditorStore } from '@/stores/editor'
import { useProjectStore } from '@/stores/project'
import { copyPlain } from '@/utils/clipboard'
import { SimplePromptBuilder, WriteArticleToolHandler } from '../../agents/index'

const editorStore = useEditorStore()
const { editor } = storeToRefs(editorStore)

/* ---------- 待写入编辑器的文章内容 ---------- */
const pendingArticleContent = ref<string | null>(null)

/* ---------- 监听编辑器初始化，自动写入待定内容 ---------- */
watch(editor, (newEditor) => {
  if (newEditor && pendingArticleContent.value) {
    console.log(`[write_artical] 编辑器已就绪，写入待定内容`)
    const content = pendingArticleContent.value
    pendingArticleContent.value = null
    newEditor.dispatch({
      changes: {
        from: 0,
        to: newEditor.state.doc.length,
        insert: content,
      },
      selection: { anchor: content.length },
    })
    console.log(`[write_artical] 文章内容已替换到编辑器`)
  }
}, { immediate: true })
const displayStore = useDisplayStore()
const { toggleAIImageDialog } = displayStore

/* ---------- 输入 & 历史 ---------- */
const input = ref<string>(``)
const inputHistory = ref<string[]>([])
const historyIndex = ref<number | null>(null)

/* ---------- 配置 & 状态 ---------- */
const configVisible = ref(false)
const loading = ref(false)
const fetchController = ref<AbortController | null>(null)
const copiedIndex = ref<number | null>(null)
const memoryKey = `ai_memory_context`
const isQuoteAllContent = ref(false)
const outlineVisible = ref(false)

/* ---------- 即梦API配置 ---------- */
const jimengConfig = ref({
  accessKeyId: localStorage.getItem(`jimeng_access_key_id`) || ``,
  secretAccessKey: localStorage.getItem(`jimeng_secret_access_key`) || ``,
  reqKey: localStorage.getItem(`jimeng_req_key`) || `jimeng_high_aes_general_v21_L`,
})

function saveJimengConfig() {
  localStorage.setItem(`jimeng_access_key_id`, jimengConfig.value.accessKeyId)
  localStorage.setItem(`jimeng_secret_access_key`, jimengConfig.value.secretAccessKey)
  localStorage.setItem(`jimeng_req_key`, jimengConfig.value.reqKey)
}

// 初始化即梦API配置 - 从 localStorage 加载或使用空值
jimengConfig.value.accessKeyId = localStorage.getItem(`jimeng_access_key_id`) || ``
jimengConfig.value.secretAccessKey = localStorage.getItem(`jimeng_secret_access_key`) || ``
saveJimengConfig()

/* ---------- 大纲数据 ---------- */
const outlineData = useStorage<OutlineData>(`ai_outline_data`, {
  topic: `示例：如何写好一篇公众号文章`,
  items: [
    {
      id: `1`,
      title: `引言：吸引读者注意`,
      content: `用一个引人入胜的开头，可以是故事、问题或数据，抓住读者的注意力。`,
    },
    {
      id: `2`,
      title: `正文：核心内容展开`,
      content: `详细阐述主题，使用案例、数据、观点等支撑内容，保持逻辑清晰。`,
    },
    {
      id: `3`,
      title: `总结：强化观点`,
      content: `总结全文要点，给出行动建议或思考方向，让读者有所收获。`,
    },
  ],
})

/* ---------- 消息结构 ---------- */
interface ChatMessage extends Omit<BaseChatMessage, `role` | `id`> {
  id?: string
  role: `user` | `assistant` | `system`
  reasoning?: string
  done?: boolean
  searchResults?: Array<{
    title: string
    url: string
    snippet: string
    content?: string
  }>
  showSearchResults?: boolean
  imageResults?: Array<{
    url?: string
    base64?: string
    prompt?: string
    op?: string
    meta?: Record<string, any>
  }>
}

const messages = ref<ChatMessage[]>([])
const AIConfigStore = useAIConfigStore()
const { apiKey, endpoint, model, temperature, maxToken, type } = storeToRefs(AIConfigStore)
const projectStore = useProjectStore()
const { currentProject } = storeToRefs(projectStore)

const tasks = ref<any[]>([])
const currentTask = ref<any>(null)

/* ---------- 辅助函数 ---------- */
function createTextContentBlock(text: string): ContentBlock[] {
  if (!text)
    return []
  return [{
    type: `text`,
    text,
  }]
}

function getTextFromContentBlocks(content: ContentBlock[]): string {
  if (!content || !Array.isArray(content))
    return ``
  return content
    .filter(block => block.type === `text` && block.text)
    .map(block => block.text)
    .join(``)
}

function formatDateTime(date: Date | string | undefined): string {
  if (!date)
    return ``
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    const hours = d.getHours().toString().padStart(2, `0`)
    const minutes = d.getMinutes().toString().padStart(2, `0`)
    return `今天 ${hours}:${minutes}`
  }
  else if (days === 1) {
    return `昨天`
  }
  else if (days < 7) {
    const weekdays = [`周日`, `周一`, `周二`, `周三`, `周四`, `周五`, `周六`]
    return weekdays[d.getDay()]
  }
  else {
    const month = (d.getMonth() + 1).toString().padStart(2, `0`)
    const day = d.getDate().toString().padStart(2, `0`)
    return `${month}-${day}`
  }
}

async function loadTasks() {
  if (!currentProject.value?.id)
    return

  const storage = new IndexedDBTaskStorage()
  const projectTasks = await storage.getTasksByProjectId(currentProject.value.id)
  tasks.value = projectTasks
}

async function loadChatMessages(taskId: string) {
  const storage = new IndexedDBTaskStorage()
  const chatMessages = await storage.getChatMessagesByTaskId(taskId)
  console.log(`[AIAssistantSidebar] Loaded chat messages:`, chatMessages)
  messages.value = chatMessages.map((msg: any) => ({
    id: msg.id,
    projectId: msg.projectId,
    taskId: msg.taskId,
    conversationRound: msg.conversationRound,
    messageOrder: msg.messageOrder,
    role: msg.role,
    content: msg.content || [],
    reasoning: msg.reasoning,
    done: true,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  }))
}

watch(currentTask, async (newTask) => {
  if (newTask?.id && !loading.value) {
    await loadChatMessages(newTask.id)
  }
})

/* ---------- 初始数据 ---------- */
onMounted(async () => {
  // 每次打开都显示默认欢迎消息，不加载聊天历史
  // 编辑器内容会自动保存和加载，不需要保存聊天历史
  messages.value = getDefaultMessages()
  await scrollToBottom(true)
  await loadTasks()
})

watch(currentProject, async () => {
  await loadTasks()
})
function getDefaultMessages(): ChatMessage[] {
  return [{ role: `assistant`, content: createTextContentBlock(`你好，我是 AI 助手，有什么可以帮你的？`) }]
}

// 清理消息数据，移除 base64 数据以节省存储空间,新的数据做了拷贝，复制，其余去除
function cleanMessagesForStorage(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((msg) => {
    const cleaned = { ...msg }

    if (cleaned.imageResults && Array.isArray(cleaned.imageResults)) {
      cleaned.imageResults = cleaned.imageResults.map((img: any) => {
        const cleanedImg: any = {
          prompt: img.prompt,
          op: img.op,
        }
        if (img.url && !img.url.startsWith(`data:image`)) {
          cleanedImg.url = img.url
        }
        if (img.meta?.algorithm_base_resp) {
          cleanedImg.meta = {
            algorithm_base_resp: img.meta.algorithm_base_resp,
          }
        }
        return cleanedImg
      })
    }

    if (cleaned.content && Array.isArray(cleaned.content)) {
      cleaned.content = cleaned.content.map((block: ContentBlock) => {
        if (block.type === `text` && block.text) {
          return {
            type: `text`,
            text: block.text.replace(/!\[([^\]]*)\]\(data:image\/[^;]+;base64,[^\s)]+\)/g, `![$1](图片已生成)`)
              .replace(/<img[^>]+src=["']data:image\/[^;]+;base64,[^"']+["'][^>]*>/g, `<img src="图片已生成" alt="图片">`)
              .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{100,}/g, `[图片已生成]`),
          }
        }
        return block
      })
    }

    return cleaned
  })
}

/* ---------- 事件处理 ---------- */
function switchToImageGenerator() {
  toggleAIImageDialog(true)
}

// 将图片应用到编辑器
function applyImageToEditor(img: { url?: string, base64?: string, prompt?: string }) {
  if (!editor.value) {
    toast.error(`编辑器未初始化`)
    return
  }

  try {
    // 生成图片的 Markdown 语法
    const altText = img.prompt || `图片`
    let imageMarkdown = ``
    if (img.url) {
      // 如果有 URL，使用 URL
      imageMarkdown = `![${altText}](${img.url})`
    }
    else if (img.base64) {
      // 如果是 base64，使用 data URI
      // ![](data:image/png;base64,${img.base64})
      imageMarkdown = `![${altText}](data:image/png;base64,${img.base64})`
    }
    else {
      toast.error(`图片数据无效`)
      return
    }

    // 获取当前编辑器内容
    const currentContent = editor.value.state.doc.toString()
    const insertPosition = editor.value.state.selection.main.head

    // 如果编辑器不为空，在插入位置前后添加换行
    const prefix = currentContent.length > 0 && insertPosition > 0 ? `\n\n` : ``
    const suffix = currentContent.length > insertPosition ? `\n\n` : ``

    // 插入图片 Markdown
    editor.value.dispatch({
      changes: {
        from: insertPosition,
        insert: prefix + imageMarkdown + suffix,
      },
      selection: { anchor: insertPosition + prefix.length + imageMarkdown.length + suffix.length },
    })

    toast.success(`图片已插入到编辑器`)
  }
  catch (error) {
    console.error(`插入图片失败:`, error)
    toast.error(`插入图片失败`)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229)
    return

  if (e.key === `Enter` && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
  else if (e.key === `ArrowUp`) {
    e.preventDefault()
    if (inputHistory.value.length === 0)
      return
    if (historyIndex.value === null) {
      historyIndex.value = inputHistory.value.length - 1
    }
    else if (historyIndex.value > 0) {
      historyIndex.value--
    }
    input.value = inputHistory.value[historyIndex.value] || ``
  }
  else if (e.key === `ArrowDown`) {
    e.preventDefault()
    if (historyIndex.value === null)
      return
    if (historyIndex.value < inputHistory.value.length - 1) {
      historyIndex.value++
      input.value = inputHistory.value[historyIndex.value] || ``
    }
    else {
      historyIndex.value = null
      input.value = ``
    }
  }
}

async function copyToClipboard(text: string, index: number) {
  copyPlain(text)
  copiedIndex.value = index
  setTimeout(() => (copiedIndex.value = null), 1500)
}

function editMessage(content: string) {
  input.value = content
  historyIndex.value = null
  nextTick(() => {
    const textarea = document.querySelector(
      `.ai-sidebar-textarea`,
    ) as HTMLTextAreaElement | null
    textarea?.focus()
    if (textarea) {
      const len = textarea.value.length
      textarea.setSelectionRange(len, len)
    }
  })
}

function resetMessages() {
  if (fetchController.value) {
    fetchController.value.abort()
    fetchController.value = null
  }
  messages.value = getDefaultMessages()
  try {
    const cleanedMessages = cleanMessagesForStorage(messages.value)
    localStorage.setItem(memoryKey, JSON.stringify(cleanedMessages))
  }
  catch (e) {
    console.error(`[存储] 重置消息时保存失败:`, e)
  }
  scrollToBottom(true)
}

function newConversation() {
  if (fetchController.value) {
    fetchController.value.abort()
    fetchController.value = null
  }
  messages.value = getDefaultMessages()
  currentTask.value = null
  input.value = ``
  loading.value = false
  try {
    const cleanedMessages = cleanMessagesForStorage(messages.value)
    localStorage.setItem(memoryKey, JSON.stringify(cleanedMessages))
  }
  catch (e) {
    console.error(`[存储] 新增对话时保存失败:`, e)
  }
  scrollToBottom(true)
}

function pauseStreaming() {
  if (fetchController.value) {
    fetchController.value.abort()
    fetchController.value = null
  }
  loading.value = false
  const last = messages.value[messages.value.length - 1]
  if (last?.role === `assistant`)
    last.done = true
  scrollToBottom(true)
}

/* ---------- 滚动控制 ---------- */
async function scrollToBottom(force = false) {
  await nextTick()
  const container = document.querySelector(`.ai-sidebar-chat-container`)
  if (container) {
    const isNearBottom = (container.scrollTop + container.clientHeight)
      >= (container.scrollHeight - 50)
    if (force || isNearBottom) {
      container.scrollTop = container.scrollHeight
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
}

/* ---------- 引用全文 ---------- */
function quoteAllContent() {
  isQuoteAllContent.value = !isQuoteAllContent.value
}

/* ---------- 重新生成最后一条消息 ---------- */
async function regenerateLast() {
  const lastUser = [...messages.value].reverse().find(m => m.role === `user`)
  if (!lastUser)
    return
  const idx = messages.value.findIndex((m, i, arr) =>
    i > 0 && arr[i - 1] === lastUser && m.role === `assistant`)
  if (idx !== -1)
    messages.value.splice(idx, 1)
  input.value = getTextFromContentBlocks(lastUser.content || [])
  await nextTick()
  sendMessage()
}

/* ---------- 从内容中解析大纲数据 ---------- */
function parseOutlineFromContent(content: string) {
  try {
    // 尝试从内容中提取 JSON 格式的大纲数据
    // 支持多种格式：
    // 1. 直接包含 {"outline": {...}} 的 JSON
    // 2. 包含在代码块中的 JSON
    // 3. 直接包含 outline 字段的对象

    // 方法1: 尝试提取 JSON 代码块
    const jsonBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*"outline"[\s\S]*\})\s*```/)
    if (jsonBlockMatch) {
      const jsonStr = jsonBlockMatch[1]
      const parsed = JSON.parse(jsonStr)
      if (parsed.outline) {
        applyOutlineData(parsed.outline)
        return
      }
    }

    // 方法2: 尝试提取内联 JSON 对象
    const jsonMatch = content.match(/\{[\s\S]*"outline"[\s\S]*\}/)
    if (jsonMatch) {
      const jsonStr = jsonMatch[0]
      const parsed = JSON.parse(jsonStr)
      if (parsed.outline) {
        applyOutlineData(parsed.outline)
        return
      }
    }

    // 方法3: 尝试直接解析整个内容（如果内容是纯 JSON）
    try {
      const parsed = JSON.parse(content.trim())
      if (parsed.outline) {
        applyOutlineData(parsed.outline)
      }
    }
    catch {
      // 不是纯 JSON，继续
    }
  }
  catch (e) {
    console.error(`解析大纲数据失败:`, e)
  }
}

/* ---------- 应用大纲数据到大纲编辑器 ---------- */
function applyOutlineData(outlineResult: OutlineData) {
  try {
    if (!outlineResult || !outlineResult.items || !Array.isArray(outlineResult.items)) {
      console.error(`大纲数据格式不正确`)
      return
    }

    // 确保每个 item 都有唯一 ID
    const processedItems: OutlineItem[] = outlineResult.items.map((item, index) => ({
      id: item.id || `outline-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      title: item.title || `标题 ${index + 1}`,
      content: item.content || ``,
    }))

    // 更新大纲数据
    outlineData.value = {
      topic: outlineResult.topic || `未指定主题`,
      items: processedItems,
    }

    // 显示大纲编辑器
    outlineVisible.value = true
    configVisible.value = false

    console.log(`大纲数据已加载到大纲编辑器`)
  }
  catch (e) {
    console.error(`应用大纲数据失败:`, e)
  }
}

/* ---------- 使用大纲写内容 ---------- */
function handleUseOutline(outline: OutlineData) {
  try {
    if (!outline || !outline.items || outline.items.length === 0) {
      console.error(`大纲数据为空`)
      return
    }

    // 将大纲转换为 Markdown 格式
    let markdownContent = `# ${outline.topic}\n\n`

    // 添加每个大纲项
    outline.items.forEach((item, index) => {
      markdownContent += `## ${index + 1}. ${item.title}\n\n`
      if (item.content && item.content.trim()) {
        markdownContent += `${item.content}\n\n`
      }
      else {
        markdownContent += `<!-- TODO: 补充 ${item.title} 的内容 -->\n\n`
      }
    })

    // 插入到编辑器（追加到末尾）
    if (editor.value) {
      const currentContent = editor.value.state.doc.toString()
      const insertPosition = currentContent.length

      // 如果编辑器不为空，先添加换行，这个是非常关键的点
      const prefix = currentContent.trim() ? `\n\n` : ``

      editor.value.dispatch({
        changes: {
          from: insertPosition,
          insert: prefix + markdownContent,
        },
        selection: { anchor: insertPosition + prefix.length + markdownContent.length },
      })
    }
    else {
      // 如果没有编辑器实例，尝试获取当前内容并追加
      // const currentContent = editorStore.getContent()
      // if (currentContent.trim()) {
      //   // 如果有内容，需要追加而不是替换
      //   // 由于 importContent 会替换整个内容，我们需要手动组合内容
      //   const newContent = `${currentContent}\n\n${markdownContent}`
      //   editorStore.importContent(newContent)
      // } else {
      //   // 如果没有内容，直接导入
      //   editorStore.importContent(markdownContent)
      // }

      // 这里直接做导入，不是追加
      editorStore.importContent(markdownContent)
    }

    // 关闭大纲编辑器，显示聊天界面
    outlineVisible.value = false

    // 自动调用 AI 继续补充内容
    const aiPrompt = `请根据以下大纲继续补充和完善文章内容，让每个章节都更加丰富和详细：

${outline.items.map((item, index) => `${index + 1}. ${item.title}${item.content ? `\n   ${item.content}` : ``}`).join(`\n`)}

请按照大纲结构，为每个章节补充详细的内容，使文章完整、连贯、有深度。`

    // 设置输入框内容并发送
    input.value = aiPrompt
    nextTick(() => {
      sendMessage()
    })

    console.log(`大纲已插入编辑器，AI 正在补充详细的内容...`)
  }
  catch (e) {
    console.error(`使用大纲失败:`, e)
  }
}

/* ---------- 图片下载 ---------- */
function downloadBase64Image(base64: string, filename = `image.png`) {
  try {
    const a = document.createElement(`a`)
    a.href = `data:image/png;base64,${base64}`
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  catch (e) {
    console.error(`下载图片失败:`, e)
  }
}

/* ---------- 选中历史任务 ---------- */
function handleSelectTask(task: any) {
  console.log(`选中任务:`, task)
  currentTask.value = task
}

const toolContext: ToolFunctionsContext = {
  jimengConfig,
  saveJimengConfig,
}

let storageInstance: IndexedDBTaskStorage | null = null

function getTaskStorage(): IndexedDBTaskStorage {
  if (!storageInstance) {
    storageInstance = new IndexedDBTaskStorage()
  }
  return storageInstance
}

function getModelConfig(): ModelConfig {
  return {
    agentModel: {
      provider: type.value,
      apiKey: apiKey.value,
      baseUrl: endpoint.value,
      modelName: model.value,
      maxTokens: maxToken.value,
    },
  }
}

async function startTaskWithStreaming(
  userInstruction: string,
  onChunk: (chunk: any) => void,
) {
  const taskStorage = getTaskStorage()

  const taskId = currentTask.value?.id || nanoid()
  const projectId = currentProject.value?.id || ``

  const modelConfig = getModelConfig()

  const taskContext: TaskContext = {
    modelConfig,
    variables: {
    },
    systemPromptBuilder: new SimplePromptBuilder(editor?.value?.state.doc.toString() || ``),
    tools: [
      // new GenerateOutlineToolHandler(),
      new WriteArticleToolHandler(),
    ],
  }

  const agent = new Agent(
    taskId,
    projectId,
    modelConfig,
    taskStorage,
    taskContext,
  )

  console.log(`[Task] Starting task:`, {
    modelConfig,
    taskId,
    projectId,
    instruction: userInstruction,
  })

  try {
    const stream = agent.startTask(userInstruction)

    for await (const chunk of stream) {
      onChunk(chunk)
    }

    console.log(`[Task] Task completed successfully`)
    return {
      success: true,
      taskId,
      storage: taskStorage,
    }
  }
  catch (error) {
    console.error(`[Task] Task failed:`, error)
    throw error
  }
}

async function sendMessage() {
  const userMessage = input.value.trim()
  if (!userMessage)
    return

  const modelConfig = getModelConfig()
  if (!modelConfig.agentModel || !modelConfig.agentModel.apiKey || !modelConfig.agentModel.baseUrl || !modelConfig.agentModel.modelName) {
    const missingFields = []
    if (!modelConfig.agentModel?.apiKey)
      missingFields.push(`API Key`)
    if (!modelConfig.agentModel?.baseUrl)
      missingFields.push(`Base URL`)
    if (!modelConfig.agentModel?.modelName)
      missingFields.push(`Model Name`)
    toast.error(`请先配置${missingFields.join(`、`)}`)
    return
  }

  input.value = ``
  historyIndex.value = null

  if (!inputHistory.value.includes(userMessage)) {
    inputHistory.value.push(userMessage)
  }

  messages.value.push({
    role: `user`,
    content: createTextContentBlock(userMessage),
    done: true,
  })

  messages.value.push({
    role: `assistant`,
    content: [],
    done: false,
  })

  loading.value = true

  const taskId = currentTask.value?.id || nanoid()
  if (!currentTask.value?.id) {
    currentTask.value = { id: taskId, title: userMessage.substring(0, 50) }
  }

  console.log(`[sendMessage] Messages after push:`, messages.value)
  console.log(`[sendMessage] Last message role:`, messages.value[messages.value.length - 1]?.role)

  fetchController.value = new AbortController()

  try {
    let toolName = ``
    let toolArguments = ``
    await startTaskWithStreaming(userMessage, (chunk) => {
      console.log(chunk)
      console.log(`[sendMessage] Chunk type:`, chunk.type)
      console.log(`[sendMessage] Chunk text:`, chunk.text)
      console.log(`[sendMessage] Chunk reasoning:`, chunk.reasoning)
      console.log(`[sendMessage] Messages length:`, messages.value.length)

      const lastIndex = messages.value.length - 1
      const lastMessage = messages.value[lastIndex]
      console.log(`[sendMessage] Last message before update:`, lastMessage)
      console.log(`[sendMessage] Last message role:`, lastMessage?.role)

      if (lastMessage?.role === `assistant`) {
        if (chunk.type === `text` && chunk.text) {
          const currentText = getTextFromContentBlocks(lastMessage.content || [])
          console.log(`[sendMessage] Current text:`, currentText)
          console.log(`[sendMessage] New text:`, currentText + chunk.text)

          const newContent = createTextContentBlock(currentText + chunk.text)
          console.log(`[sendMessage] New content blocks:`, newContent)

          lastMessage.content = newContent
          console.log(`[sendMessage] Last message after update:`, lastMessage)
          console.log(`[sendMessage] Messages array last item:`, messages.value[lastIndex])
        }
        else if (chunk.type === `reasoning` && chunk.reasoning) {
          lastMessage.reasoning = (lastMessage.reasoning || ``) + chunk.reasoning
        }
        else if (chunk.type === `tool_calls` && chunk.tool_call) {
          console.log(`[sendMessage] Tool call:`, chunk.tool_call)
          const toolCallBlock: ContentBlock = {
            type: `tool_use`,
            tool_use_id: chunk.tool_call.function.id,
            name: chunk.tool_call.function.name,
            input: chunk.tool_call.function.arguments,
          }
          if (toolCallBlock.name) {
            toolName = toolCallBlock.name
          }
          if (toolCallBlock.input) {
            toolArguments += toolCallBlock.input
          }

          if (toolName === `write_article`) {
            if (!toolArguments) {
              return
            }
            console.log(`[sendMessage] Tool arguments:`, toolArguments)
            const repaired = parse(toolArguments)
            console.log(`[repaired]: `, repaired)
            const articleContent = repaired.content || ``
            console.log(`[articleContent]: `, articleContent)

            if (editor.value && articleContent) {
              editor.value.dispatch({
                changes: {
                  from: 0,
                  to: editor.value.state.doc.length,
                  insert: articleContent,
                },
                selection: { anchor: articleContent.length },
              })

              console.log(`[write_artical] 文章内容已替换到编辑器`)
            }
            else if (articleContent) {
              console.log(`[write_artical] 编辑器未就绪，保存待写入内容`)
              pendingArticleContent.value = articleContent
            }
            else {
              console.log(`[write_artical] 未写入编辑器:`, {
                editorExists: !!editor.value,
                contentLength: articleContent?.length,
              })
            }
          }

          if (Array.isArray(lastMessage.content)) {
            lastMessage.content.push(toolCallBlock)
          }
          else {
            lastMessage.content = [toolCallBlock]
          }
          console.log(`[sendMessage] Last message after tool call:`, lastMessage)
        }
        scrollToBottom()
      }
      else {
        console.log(`[sendMessage] ERROR: Last message is not assistant or is undefined!`)
      }
    })

    const lastIndex = messages.value.length - 1
    const lastMessage = messages.value[lastIndex]
    if (lastMessage?.role === `assistant`) {
      messages.value[lastIndex] = {
        ...lastMessage,
        done: true,
      }
    }
  }
  catch (error) {
    console.error(`[sendMessage] Error:`, error)
    const lastIndex = messages.value.length - 1
    const lastMessage = messages.value[lastIndex]
    if (lastMessage?.role === `assistant`) {
      messages.value[lastIndex] = {
        ...lastMessage,
        content: createTextContentBlock(`抱歉，发生了错误：${error instanceof Error ? error.message : String(error)}`),
        done: true,
      }
    }
    toast.error(`发送消息失败`)
  }
  finally {
    loading.value = false
    fetchController.value = null
  }
}
</script>

<template>
  <div class="ai-sidebar flex h-full flex-col bg-background">
    <!-- 头部 -->
    <div class="ai-sidebar-header flex items-center justify-between border-b px-4 py-3">
      <div class="flex items-center gap-2">
        <Bot class="h-5 w-5 text-muted-foreground" />
        <h2 class="text-sm font-semibold">
          AI 助手
        </h2>
        <Button
          variant="ghost"
          size="icon"
          class="h-5 w-5"
          title="新增对话"
          @click="newConversation"
        >
          <Plus class="h-3.5 w-3.5" />
        </Button>
      </div>
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          title="AI 文生图"
          @click="switchToImageGenerator()"
        >
          <ImageIcon class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          :title="outlineVisible ? 'AI 对话' : '大纲编辑器'"
          :class="{ 'bg-primary text-primary-foreground': outlineVisible }"
          @click="outlineVisible = !outlineVisible"
        >
          <FileText v-if="!outlineVisible" class="h-4 w-4" />
          <MessageCircle v-else class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          :title="configVisible ? 'AI 对话' : '配置参数'"
          @click="configVisible = !configVisible"
        >
          <Settings v-if="!configVisible" class="h-4 w-4" />
          <MessageCircle v-else class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- 历史任务列表 -->
    <div
      v-if="!configVisible && !outlineVisible && tasks.length > 0"
      class="ai-sidebar-tasks border-b bg-muted/20 px-3 py-2"
    >
      <div class="text-xs font-medium text-muted-foreground mb-2">
        历史任务
      </div>
      <div class="space-y-1 max-h-24 overflow-y-auto">
        <Button
          v-for="task in tasks"
          :key="task.id"
          variant="ghost"
          size="sm"
          class="w-full justify-start h-auto py-1.5 px-2 text-xs flex-col items-start"
          :class="{ 'bg-primary/10': currentTask?.id === task.id }"
          @click="handleSelectTask(task)"
        >
          <span class="truncate font-medium">{{ task.name || task.description || '未命名任务' }}</span>
          <span class="text-[10px] text-muted-foreground mt-0.5">
            {{ formatDateTime(task.createdAt) }}
          </span>
        </Button>
      </div>
    </div>

    <!-- 配置面板 -->
    <div v-if="configVisible" class="ai-sidebar-config border-b p-4">
      <AIConfig @saved="configVisible = false" />
    </div>

    <!-- 大纲编辑器 -->
    <div v-if="outlineVisible && !configVisible" class="ai-sidebar-outline flex-1 overflow-y-auto p-4">
      <OutlineEditor v-model="outlineData" @use-outline="handleUseOutline" />
    </div>

    <!-- 聊天内容 -->
    <div
      v-if="!configVisible && !outlineVisible"
      class="ai-sidebar-chat-container ai-sidebar-chat flex-1 overflow-y-auto px-3 py-3"
    >
      <div class="space-y-3">
        <MessageBlock
          v-for="(msg, index) in messages"
          :key="index"
          :msg="msg"
          :index="index"
          :is-last-message="index === messages.length - 1"
          :copied-index="copiedIndex"
          @copy="copyToClipboard"
          @edit="editMessage"
          @regenerate="regenerateLast"
          @apply-image="applyImageToEditor"
          @download-image="downloadBase64Image"
        />
      </div>
    </div>

    <!-- 输入区域 -->
    <div v-if="!configVisible" class="ai-sidebar-input border-t p-3">
      <div class="space-y-2">
        <!-- 引用全文按钮 -->
        <div class="flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            class="h-7 px-2 text-xs"
            :class="[
              isQuoteAllContent
                ? 'bg-primary text-primary-foreground'
                : '',
            ]"
            @click="quoteAllContent"
          >
            <component :is="isQuoteAllContent ? Check : Copy" class="mr-1 h-3 w-3" />
            引用全文
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7"
            title="清空对话"
            @click="resetMessages"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </Button>
        </div>

        <!-- 输入框 -->
        <div class="relative">
          <Textarea
            v-model="input"
            placeholder="输入消息…"
            rows="2"
            class="ai-sidebar-textarea resize-none pr-10 text-sm"
            @keydown="handleKeydown"
          />
          <Button
            :disabled="!input.trim() && !loading"
            size="icon"
            class="absolute bottom-2 right-2 h-7 w-7 rounded-full"
            :aria-label="loading ? '暂停' : '发送'"
            @click="loading ? pauseStreaming() : sendMessage()"
          >
            <Pause v-if="loading" class="h-4 w-4" />
            <Send v-else class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-sidebar {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
    'Helvetica Neue', sans-serif;
}

.ai-sidebar-header {
  min-height: 48px;
}

.ai-sidebar-chat-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
}

.ai-sidebar-chat-container::-webkit-scrollbar {
  width: 6px;
}

.ai-sidebar-chat-container::-webkit-scrollbar-track {
  background: transparent;
}

.ai-sidebar-chat-container::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 3px;
}

.ai-sidebar-chat-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

.dark .ai-sidebar-chat-container {
  scrollbar-color: rgba(107, 114, 128, 0.3) transparent;
}

.dark .ai-sidebar-chat-container::-webkit-scrollbar-thumb {
  background-color: rgba(107, 114, 128, 0.3);
}

.dark .ai-sidebar-chat-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(107, 114, 128, 0.5);
}

/* 处理代码块溢出 */
.ai-sidebar-chat-container pre {
  overflow-x: auto;
  max-width: 100%;
  padding: 0.75rem;
  border-radius: 0.375rem;
  background-color: hsl(var(--muted));
  margin: 0.5rem 0;
  word-wrap: break-word;
}

.ai-sidebar-chat-container code {
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  max-width: 100%;
}

.ai-sidebar-chat-container pre code {
  white-space: pre;
  word-break: normal;
  overflow-wrap: normal;
  display: block;
  overflow-x: auto;
}

/* 确保消息框内容不溢出 */
.ai-sidebar-chat-container > div > div {
  max-width: 100%;
  min-width: 0;
  word-wrap: break-word;
}

/* 文本内容处理 */
.ai-sidebar-chat-container .whitespace-pre-wrap {
  overflow-wrap: anywhere;
  word-break: break-word;
  max-width: 100%;
  min-width: 0;
}

/* 图片样式 */
.ai-sidebar-chat-container img {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 1rem 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: block;
  border: 1px solid hsl(var(--border) / 0.3);
}
</style>
