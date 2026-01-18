<script setup lang="ts">
import type { ChatMessage as BaseChatMessage, ContentBlock, ModelConfig, TaskContext } from '@grisaiaevy/crafting-agent'
import { Agent } from '@grisaiaevy/crafting-agent'
import {
  Bot,
  Check,
  Copy,
  FileText,
  History,
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
import HistoryTasksPanel from '@/components/ai/chat-box/HistoryTasksPanel.vue'
import MessageBlock from '@/components/ai/chat-box/MessageBlock.vue'
import OutlinePanel from '@/components/ai/chat-box/OutlinePanel.vue'
import { useHtmlEditorStore } from '@/components/editor/html-editor/useHtmlEditorStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAIConfigStore } from '@/stores/aiConfig'
import { useDisplayStore } from '@/stores/display'
import { useEditorStore } from '@/stores/editor'
import { useProjectStore } from '@/stores/project'
import { copyPlain } from '@/utils/clipboard'
import { GenerateOutlineToolHandler } from '../../agents/generate_outline'
import { SimplePromptBuilder } from '../../agents/index'
import { WriteArticleToolHandler } from '../../agents/write_article'

const editorStore = useEditorStore()
const htmlEditorStore = useHtmlEditorStore()
const { editor } = storeToRefs(editorStore)
const { isHtmlMode } = storeToRefs(htmlEditorStore)
const htmlEditor = computed(() => htmlEditorStore.htmlEditor)

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
const historyTasksVisible = ref(false)
const outlinePanelRef = ref<InstanceType<typeof OutlinePanel> | null>(null)

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

jimengConfig.value.accessKeyId = localStorage.getItem(`jimeng_access_key_id`) || ``
jimengConfig.value.secretAccessKey = localStorage.getItem(`jimeng_secret_access_key`) || ``
saveJimengConfig()

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
const currentTaskContext = ref<TaskContext | undefined>(undefined)

/* ---------- 辅助函数 ---------- */
function getCurrentEditor() {
  return isHtmlMode?.value ? htmlEditor?.value : editor?.value
}

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
  const currentEditor = getCurrentEditor()

  if (!currentEditor) {
    toast.error(`编辑器未初始化`)
    return
  }

  try {
    // 生成图片的语法（HTML 或 Markdown）
    const altText = img.prompt || `图片`
    let imageContent = ``

    if (isHtmlMode?.value) {
      // HTML 模式：使用 <img> 标签
      if (img.url) {
        imageContent = `<img src="${img.url}" alt="${altText}" style="max-width:100%;">`
      }
      else if (img.base64) {
        imageContent = `<img src="data:image/png;base64,${img.base64}" alt="${altText}" style="max-width:100%;">`
      }
      else {
        toast.error(`图片数据无效`)
        return
      }
    }
    else {
      // Markdown 模式：使用 Markdown 语法
      if (img.url) {
        imageContent = `![${altText}](${img.url})`
      }
      else if (img.base64) {
        imageContent = `![${altText}](data:image/png;base64,${img.base64})`
      }
      else {
        toast.error(`图片数据无效`)
        return
      }
    }

    // 获取当前编辑器内容
    const currentContent = currentEditor.state.doc.toString()
    const insertPosition = currentEditor.state.selection.main.head

    // 如果编辑器不为空，在插入位置前后添加换行
    const prefix = currentContent.length > 0 && insertPosition > 0 ? `\n\n` : ``
    const suffix = currentContent.length > insertPosition ? `\n\n` : ``

    // 插入图片
    currentEditor.dispatch({
      changes: {
        from: insertPosition,
        insert: prefix + imageContent + suffix,
      },
      selection: { anchor: insertPosition + prefix.length + imageContent.length + suffix.length },
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

function handleUseOutline() {
  outlineVisible.value = false
  const items = outlinePanelRef.value?.outlineData.items || []
  const aiPrompt = `请根据以下大纲继续补充和完善文章内容，让每个章节都更加丰富和详细：

${items.map((item: any, index: number) => `${index + 1}. ${item.title}${item.content ? `\n   ${item.content}` : ``}`).join(`\n`)}

请按照大纲结构，为每个章节补充详细的内容，使文章完整、连贯、有深度。`

  input.value = aiPrompt
  nextTick(() => {
    sendMessage()
  })
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

function prepareTask() {
  const taskStorage = getTaskStorage()
  const taskId = currentTask.value?.id || nanoid()
  const projectId = currentProject.value?.id || ``
  const modelConfig = getModelConfig()

  const currentEditor = getCurrentEditor()
  const taskContext: TaskContext = {
    modelConfig,
    variables: {},
    systemPromptBuilder: new SimplePromptBuilder(currentEditor?.state.doc.toString() || ``),
    tools: [
      new WriteArticleToolHandler(currentEditor, isHtmlMode?.value || false),
    ],
  }

  return {
    taskId,
    projectId,
    modelConfig,
    taskContext,
    taskStorage,
  }
}

async function sendMessage() {
  const userMessage = input.value.trim()
  if (!userMessage)
    return

  const modelConfig = getModelConfig()
  if (type.value !== `default` && !modelConfig.agentModel?.apiKey) {
    toast.error(`请先配置 API Key`)
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

  fetchController.value = new AbortController()

  try {
    const { taskId, projectId, modelConfig, taskContext, taskStorage } = prepareTask()

    currentTaskContext.value = taskContext

    if (!currentTask.value?.id) {
      currentTask.value = { id: taskId, title: userMessage.substring(0, 50) }
    }

    const agent = new Agent(
      taskId,
      projectId,
      modelConfig,
      taskStorage,
      taskContext,
    )
    let toolName = ``
    let toolArguments = ``
    let currentToolCall: any = null
    let toolHandler: any = null

    const stream = agent.startTask(userMessage)
    // core
    for await (const chunk of stream) {
      console.log(chunk)
      console.log(`[sendMessage] Chunk type:`, chunk.type)
      if (chunk.type === `text`) {
        console.log(`[sendMessage] Chunk text:`, chunk.text)
      }
      if (chunk.type === `reasoning`) {
        console.log(`[sendMessage] Chunk reasoning:`, chunk.reasoning)
      }
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

          if (currentToolCall && currentToolCall.function.name === chunk.tool_call.function.name) {
            console.log(`[sendMessage] Continuing tool call for:`, chunk.tool_call.function.name)
            console.log(`[sendMessage] Previous tool arguments:`, toolArguments)
            console.log(`[sendMessage] New chunk arguments:`, chunk.tool_call.function.arguments)
            toolArguments += chunk.tool_call.function.arguments
            currentToolCall.function.arguments += chunk.tool_call.function.arguments
            console.log(`[sendMessage] Updated tool arguments:`, toolArguments)
          }
          else {
            console.log(`[sendMessage] New tool call detected`)
            console.log(`[sendMessage] Previous tool call:`, currentToolCall)
            currentToolCall = { ...chunk.tool_call }
            toolName = chunk.tool_call.function.name || ``
            toolArguments = chunk.tool_call.function.arguments || ``
            console.log(`[sendMessage] New tool name:`, toolName)
            console.log(`[sendMessage] New tool arguments:`, toolArguments)
          }

          const toolCallBlock: ContentBlock = {
            type: `tool_use`,
            tool_use_id: currentToolCall.function.id,
            name: toolName,
            input: currentToolCall.function.arguments,
          }
          console.log(`[sendMessage] Tool call block created:`, toolCallBlock)

          if (Array.isArray(lastMessage.content)) {
            console.log(`[sendMessage] Last message content is array, length:`, lastMessage.content.length)
            const existingIndex = lastMessage.content.findIndex(
              (block: ContentBlock) => block.type === `tool_use` && block.tool_use_id === toolCallBlock.tool_use_id,
            )
            console.log(`[sendMessage] Existing tool call index:`, existingIndex)
            if (existingIndex !== -1) {
              console.log(`[sendMessage] Updating existing tool call at index:`, existingIndex)
              lastMessage.content[existingIndex] = toolCallBlock
            }
            else {
              console.log(`[sendMessage] Adding new tool call to content`)
              lastMessage.content.push(toolCallBlock)
            }
            if (!toolHandler) {
              console.log(`[sendMessage] Creating tool handler for:`, toolName)
              const currentEditor = getCurrentEditor()
              switch (toolName) {
                case `write_article`:
                  toolHandler = new WriteArticleToolHandler(currentEditor, isHtmlMode?.value || false)
                  console.log(`[sendMessage] WriteArticleToolHandler created`)
                  break
                case `generate_outline`:
                  toolHandler = new GenerateOutlineToolHandler()
                  console.log(`[sendMessage] GenerateOutlineToolHandler created`)
                  break
                default:
                  console.log(`[sendMessage] No handler for tool:`, toolName)
              }
            }
            if (toolHandler && toolHandler.getConfig().humanInLoop) {
              const parsedArguments = toolArguments ? parse(toolArguments) : {}
              const toolCallWithParsedArgs = {
                ...currentToolCall,
                function: {
                  ...currentToolCall.function,
                  arguments: parsedArguments,
                },
              }
              await toolHandler.execute(toolCallWithParsedArgs, taskContext)
            }
            else {
              console.log(`[sendMessage] Tool handler already exists`)
            }
          }
          else {
            console.log(`[sendMessage] Last message content is not array, replacing with array`)
            lastMessage.content = [toolCallBlock]
          }
          console.log(`[sendMessage] Last message after tool call:`, lastMessage)
        }
        scrollToBottom()
      }
      else {
        console.log(`[sendMessage] ERROR: Last message is not assistant or is undefined!`)
      }
    }

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
          :title="historyTasksVisible ? 'AI 对话' : '历史任务'"
          :class="{ 'bg-primary text-primary-foreground': historyTasksVisible }"
          @click="historyTasksVisible = !historyTasksVisible"
        >
          <History v-if="!historyTasksVisible" class="h-4 w-4" />
          <MessageCircle v-else class="h-4 w-4" />
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

    <!-- 历史任务面板 -->
    <HistoryTasksPanel
      v-if="historyTasksVisible"
      :tasks="tasks"
      :current-task="currentTask"
      @select-task="handleSelectTask"
      @close="historyTasksVisible = false"
    />

    <!-- 配置面板 -->
    <div v-if="configVisible" class="ai-sidebar-config border-b p-4">
      <AIConfig @saved="configVisible = false" />
    </div>

    <!-- 大纲编辑器 -->
    <OutlinePanel
      v-if="outlineVisible && !configVisible"
      ref="outlinePanelRef"
      @use-outline="handleUseOutline"
      @show-outline="() => { outlineVisible = true; configVisible = false }"
    />

    <!-- 聊天内容 -->
    <div
      v-if="!configVisible && !outlineVisible && !historyTasksVisible"
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
          :task-context="currentTaskContext"
          @on-copy="copyToClipboard"
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
