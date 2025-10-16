<script setup lang="ts">
import type { QuickCommandRuntime } from '@/stores/useQuickCommands'
import {
  Bot,
  Check,
  Copy,
  Image as ImageIcon,
  MessageSquare,
  Pause,
  Plus,
  RefreshCcw,
  Send,
  Settings,
  Trash2,
  X,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import useAIConfigStore from '@/stores/AIConfig'
import { useQuickCommands } from '@/stores/useQuickCommands'
import { copyPlain } from '@/utils/clipboard'

/* ---------- 组件属性 ---------- */
const props = defineProps<{ open: boolean }>()
const emit = defineEmits([`update:open`])

const store = useStore()
const { editor } = storeToRefs(store)
const displayStore = useDisplayStore()
const { toggleAIImageDialog } = displayStore

/* ---------- 弹窗开关 ---------- */
const dialogVisible = ref(props.open)
watch(() => props.open, val => (dialogVisible.value = val))
watch(dialogVisible, (val) => {
  emit(`update:open`, val)
  if (val)
    scrollToBottom(true)
})

/* ---------- 输入 & 历史 ---------- */
const input = ref<string>(``)
const inputHistory = ref<string[]>([])
const historyIndex = ref<number | null>(null)

/* ---------- 配置 & 状态 ---------- */
const configVisible = ref(false)
const loading = ref(false)
const fetchController = ref<AbortController | null>(null)
const copiedIndex = ref<number | null>(null)
const isQuoteAllContent = ref(false)
const cmdMgrOpen = ref(false)

/* ---------- 消息结构 ---------- */
interface ChatMessage {
  role: `user` | `assistant` | `system`
  content: string
  reasoning?: string
  done?: boolean
}

/* ---------- 对话会话结构 ---------- */
interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

const messages = ref<ChatMessage[]>([])
const AIConfigStore = useAIConfigStore()
const { apiKey, endpoint, model, temperature, maxToken, type } = storeToRefs(AIConfigStore)

/* ---------- 多对话管理 ---------- */
const chatSessions = ref<ChatSession[]>([])
const currentSessionId = ref<string>(``)
const showChatHistory = ref(false)

/* ---------- 快捷指令 ---------- */
const quickCmdStore = useQuickCommands()

function getSelectedText(): string {
  try {
    const cm: any = editor.value
    if (!cm)
      return ``
    if (typeof cm.getSelection === `function`)
      return cm.getSelection() || ``
    return ``
  }
  catch (e) {
    console.warn(`获取选中文本失败`, e)
    return ``
  }
}

function applyQuickCommand(cmd: QuickCommandRuntime) {
  const selected = getSelectedText()
  input.value = cmd.buildPrompt(selected)
  historyIndex.value = null
  nextTick(() => {
    const textarea = document.querySelector(
      `textarea[placeholder*="说些什么" ]`,
    ) as HTMLTextAreaElement | null
    textarea?.focus()
    if (textarea) {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }
  })
}

/* ---------- 对话管理函数 ---------- */
function generateSessionId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function createNewChatSession(): ChatSession {
  const now = Date.now()
  return {
    id: generateSessionId(),
    title: `新对话 ${new Date().toLocaleTimeString()}`,
    messages: getDefaultMessages(),
    createdAt: now,
    updatedAt: now,
  }
}

function getDefaultMessages(): ChatMessage[] {
  return [{ role: `assistant`, content: `你好，我是 AI 助手，有什么可以帮你的？` }]
}

function saveChatSessions() {
  localStorage.setItem(`ai_chat_sessions`, JSON.stringify(chatSessions.value))
}

function loadChatSessions() {
  const saved = localStorage.getItem(`ai_chat_sessions`)
  if (saved) {
    chatSessions.value = JSON.parse(saved)
  }
  else {
    // 创建默认对话
    const defaultSession = createNewChatSession()
    chatSessions.value = [defaultSession]
    currentSessionId.value = defaultSession.id
    saveChatSessions()
  }
}

function switchToSession(sessionId: string) {
  const session = chatSessions.value.find(s => s.id === sessionId)
  if (session) {
    currentSessionId.value = sessionId
    messages.value = [...session.messages]
    scrollToBottom(true)
  }
}

function createNewChat() {
  const newSession = createNewChatSession()
  chatSessions.value.unshift(newSession)
  currentSessionId.value = newSession.id
  messages.value = [...newSession.messages]
  saveChatSessions()
  scrollToBottom(true)
}

function deleteChatSession(sessionId: string) {
  const index = chatSessions.value.findIndex(s => s.id === sessionId)
  if (index !== -1) {
    chatSessions.value.splice(index, 1)
    saveChatSessions()

    // 如果删除的是当前对话，切换到第一个对话
    if (currentSessionId.value === sessionId) {
      if (chatSessions.value.length > 0) {
        switchToSession(chatSessions.value[0].id)
      }
      else {
        // 如果没有对话了，创建一个新的
        createNewChat()
      }
    }
  }
}

function getCurrentSession(): ChatSession | undefined {
  return chatSessions.value.find(s => s.id === currentSessionId.value)
}

function formatMessageContent(msg: ChatMessage): string {
  const content = msg.content || (msg.role === `assistant` && !msg.done ? `思考中…` : ``)
  return content
    .replace(/\n\s*\n\s*\n/g, `\n\n`) // 将多个连续换行符压缩为最多两个
    .trim() // 移除首尾空白
}

function updateCurrentSession() {
  const session = getCurrentSession()
  if (session) {
    session.messages = [...messages.value]
    session.updatedAt = Date.now()
    // 如果这是第一条用户消息，更新标题
    if (messages.value.length === 2 && messages.value[0].role === `assistant` && messages.value[1].role === `user`) {
      const userMessage = messages.value[1].content.slice(0, 20)
      session.title = userMessage + (messages.value[1].content.length > 20 ? `...` : ``)
    }
    saveChatSessions()
  }
}

/* ---------- 初始数据 ---------- */
onMounted(async () => {
  loadChatSessions()
  if (currentSessionId.value) {
    switchToSession(currentSessionId.value)
  }
  await scrollToBottom(true)
})

/* ---------- 事件处理 ---------- */
function handleConfigSaved() {
  configVisible.value = false
  scrollToBottom(true)
}

function switchToImageGenerator() {
  emit(`update:open`, false)
  setTimeout(() => {
    toggleAIImageDialog(true)
  }, 100)
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

// editMessage 函数已移除，不再需要编辑用户消息的功能

function resetMessages() {
  if (fetchController.value) {
    fetchController.value.abort()
    fetchController.value = null
  }
  messages.value = getDefaultMessages()
  updateCurrentSession()
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
  const container = document.querySelector(`.cursor-chat-container`)
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
  input.value = lastUser.content
  await nextTick()
  sendMessage()
}

/* ---------- 发送消息 ---------- */
async function sendMessage() {
  if (!input.value.trim() || loading.value)
    return

  inputHistory.value.push(input.value.trim())
  historyIndex.value = null

  loading.value = true
  const userInput = input.value.trim()
  messages.value.push({ role: `user`, content: userInput })
  input.value = ``

  const replyMessage: ChatMessage = { role: `assistant`, content: ``, reasoning: ``, done: false }
  messages.value.push(replyMessage)
  const replyMessageProxy = messages.value[messages.value.length - 1]
  await scrollToBottom(true)

  const allHistory = messages.value
    .slice(-12)
    .filter((msg, idx, arr) =>
      !(idx === arr.length - 1 && msg.role === `assistant` && !msg.done)
      && !(idx === 0 && msg.role === `assistant`),
    )

  let contextHistory: ChatMessage[]
  if (isQuoteAllContent.value) {
    const latest: ChatMessage[] = []
    for (let i = allHistory.length - 1; i >= 0 && latest.length < 2; i--) {
      const m = allHistory[i]
      if (latest.length === 0 || m.role === `user`)
        latest.unshift(m)
      else if (m.role === `assistant`)
        latest.unshift(m)
    }
    contextHistory = latest
  }
  else {
    contextHistory = allHistory.slice(-10)
  }
  const quoteMessages: ChatMessage[] = isQuoteAllContent.value
    ? [{
        role: `system`,
        content:
          `下面是一篇 Markdown 文章全文，请严格以此为主完成后续指令：\n\n${editor.value!.getValue()}`,
      }]
    : []

  const payloadMessages: ChatMessage[] = [
    {
      role: `system`,
      content: `你是一个专业的 Markdown 编辑器助手，请用简洁中文回答。`,
    },
    ...quoteMessages,
    ...contextHistory,
  ]

  const payload = {
    model: model.value,
    messages: payloadMessages,
    temperature: temperature.value,
    max_tokens: maxToken.value,
    stream: true,
  }
  const headers: Record<string, string> = { 'Content-Type': `application/json` }
  if (apiKey.value && type.value !== `default`)
    headers.Authorization = `Bearer ${apiKey.value}`

  fetchController.value = new AbortController()
  const signal = fetchController.value.signal

  try {
    const url = new URL(endpoint.value)
    if (!url.pathname.endsWith(`/chat/completions`))
      url.pathname = url.pathname.replace(/\/?$/, `/chat/completions`)

    const res = await window.fetch(url.toString(), {
      method: `POST`,
      headers,
      body: JSON.stringify(payload),
      signal,
    })
    if (!res.ok || !res.body)
      throw new Error(`响应错误：${res.status} ${res.statusText}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder(`utf-8`)
    let buffer = ``

    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        const last = messages.value[messages.value.length - 1]
        if (last.role === `assistant`) {
          last.done = true
          await scrollToBottom(true)
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(`\n`)
      buffer = lines.pop() || ``

      for (const line of lines) {
        if (!line.trim() || line.trim() === `data: [DONE]`)
          continue
        try {
          const json = JSON.parse(line.replace(/^data: /, ``))
          const delta = json.choices?.[0]?.delta || {}
          const last = messages.value[messages.value.length - 1]
          if (last !== replyMessageProxy)
            return
          if (delta.content)
            last.content += delta.content
          else if (delta.reasoning_content)
            last.reasoning = (last.reasoning || ``) + delta.reasoning_content
          await scrollToBottom()
        }
        catch (e) {
          console.error(`解析失败:`, e)
        }
      }
    }
  }
  catch (e) {
    if ((e as Error).name === `AbortError`) {
      console.log(`请求中止`)
    }
    else {
      console.error(`请求失败:`, e)
      messages.value[messages.value.length - 1].content
        = `❌ 请求失败: ${(e as Error).message}`
    }
    await scrollToBottom(true)
  }
  finally {
    updateCurrentSession()
    loading.value = false
    fetchController.value = null
  }
}
</script>

<template>
  <!-- Cursor风格的AI聊天面板 - 右侧面板模式 -->
  <div
    v-show="dialogVisible"
    class="cursor-chat-panel h-full flex flex-col border-l-2 border-gray/50 bg-white dark:bg-[#191919] flex-1 relative overflow-hidden"
  >
    <!-- 头部 -->
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Bot class="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 class="font-semibold text-gray-900 dark:text-white">
            AI Assistant
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ getCurrentSession()?.title || 'Markdown Editor Helper' }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          class="w-8 h-8"
          @click="showChatHistory = !showChatHistory"
        >
          <MessageSquare class="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="w-8 h-8"
          @click="configVisible = !configVisible"
        >
          <Settings class="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="w-8 h-8"
          @click="switchToImageGenerator"
        >
          <ImageIcon class="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="w-8 h-8"
          @click="resetMessages"
        >
          <Trash2 class="w-4 h-4" />
        </Button>
      </div>
    </div>

    <!-- 对话历史侧边栏 -->
    <div
      v-if="showChatHistory"
      class="absolute inset-0 z-10 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-gray-900 dark:text-white">
            对话历史
          </h3>
          <Button
            variant="ghost"
            size="icon"
            class="w-6 h-6"
            @click="showChatHistory = false"
          >
            <X class="w-4 h-4" />
          </Button>
        </div>
        <Button
          class="w-full mb-3"
          @click="createNewChat"
        >
          <Plus class="w-4 h-4 mr-2" />
          新建对话
        </Button>
      </div>

      <div class="flex-1 overflow-y-auto p-2">
        <div
          v-for="session in chatSessions"
          :key="session.id"
          class="group relative p-3 rounded-lg cursor-pointer transition-colors"
          :class="currentSessionId === session.id
            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800'"
          @click="switchToSession(session.id)"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ session.title }}
              </h4>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {{ new Date(session.updatedAt).toLocaleString() }}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
              @click.stop="deleteChatSession(session.id)"
            >
              <Trash2 class="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷指令栏 -->
    <div
      v-if="!configVisible"
      class="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
    >
      <div class="flex flex-wrap gap-2">
        <template v-if="quickCmdStore.commands.length">
          <Button
            v-for="cmd in quickCmdStore.commands"
            :key="cmd.id"
            variant="secondary"
            size="sm"
            class="text-xs h-7 px-2"
            @click="applyQuickCommand(cmd)"
          >
            {{ cmd.label }}
          </Button>
        </template>
        <Button
          variant="ghost"
          size="icon"
          class="w-7 h-7"
          @click="cmdMgrOpen = true"
        >
          <Plus class="w-3 h-3" />
        </Button>
        <QuickCommandManager v-model:open="cmdMgrOpen" />
      </div>
    </div>

    <!-- 配置面板 -->
    <div v-if="configVisible" class="p-4 border-b border-gray-200 dark:border-gray-700">
      <AIConfig @saved="handleConfigSaved" />
    </div>

    <!-- 聊天内容区域 -->
    <div
      v-if="!configVisible"
      class="cursor-chat-container flex-1 overflow-y-auto p-4 space-y-3"
    >
      <div
        v-for="(msg, index) in messages"
        :key="index"
        class="flex gap-3"
        :class="msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
      >
        <!-- 头像 -->
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          :class="msg.role === 'user'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
        >
          <Bot v-if="msg.role === 'assistant'" class="w-4 h-4" />
          <span v-else class="text-sm font-medium">U</span>
        </div>

        <!-- 消息内容 -->
        <div
          class="max-w-[80%] rounded-2xl px-4 py-2 text-sm"
          :class="msg.role === 'user'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'"
        >
          <!-- reasoning -->
          <div v-if="msg.reasoning" class="text-xs opacity-70 mb-2 italic">
            {{ msg.reasoning }}
          </div>

          <!-- 消息内容 -->
          <div
            class="whitespace-pre-wrap leading-relaxed"
            :class="msg.content ? '' : 'animate-pulse opacity-50'"
          >
            {{ formatMessageContent(msg) }}
          </div>

          <!-- 操作按钮 -->
          <div
            v-if="index > 0 && !(msg.role === 'assistant' && index === messages.length - 1 && !msg.done)"
            class="flex gap-1 mt-2 group"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <!-- 复制按钮 - 所有消息都显示 -->
            <Button
              variant="ghost"
              size="icon"
              class="w-6 h-6 opacity-60 hover:opacity-100 transition-opacity"
              @click="copyToClipboard(msg.content, index)"
            >
              <Check
                v-if="copiedIndex === index"
                class="w-3 h-3 text-green-600"
              />
              <Copy v-else class="w-3 h-3" />
            </Button>

            <!-- 重新生成按钮 - 仅AI的最后一条消息显示 -->
            <Button
              v-if="msg.role === 'assistant' && msg.done && index === messages.length - 1"
              variant="ghost"
              size="icon"
              class="w-6 h-6 opacity-60 hover:opacity-100 transition-opacity"
              @click="regenerateLast"
            >
              <RefreshCcw class="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div
      v-if="!configVisible"
      class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
    >
      <!-- 引用全文选项 -->
      <div class="mb-3">
        <Button
          variant="ghost"
          size="sm"
          class="h-7 text-xs"
          :class="isQuoteAllContent ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : ''"
          @click="quoteAllContent"
        >
          <Check v-if="isQuoteAllContent" class="w-3 h-3 mr-1" />
          <Copy v-else class="w-3 h-3 mr-1" />
          引用全文
        </Button>
      </div>

      <!-- 输入框 -->
      <div class="relative">
        <Textarea
          v-model="input"
          placeholder="说些什么… (Enter 发送，Shift+Enter 换行)"
          rows="3"
          class="pr-12 resize-none border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          @keydown="handleKeydown"
        />
        <Button
          :disabled="!input.trim() && !loading"
          size="icon"
          class="absolute bottom-2 right-2 w-8 h-8 rounded-full"
          :class="loading ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'"
          @click="loading ? pauseStreaming() : sendMessage()"
        >
          <Pause v-if="loading" class="w-4 h-4" />
          <Send v-else class="w-4 h-4" />
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 右侧面板样式 */
.cursor-chat-panel {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.cursor-chat-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
}

.cursor-chat-container::-webkit-scrollbar {
  width: 4px;
}

.cursor-chat-container::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 2px;
}

.dark .cursor-chat-container::-webkit-scrollbar-thumb {
  background: rgba(107, 114, 128, 0.3);
}

/* 优化消息显示，减少多余空白 */
.cursor-chat-container .whitespace-pre-wrap {
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* 确保消息气泡没有多余的边距 */
.cursor-chat-container .rounded-2xl {
  margin-bottom: 0;
}

/* 优化消息内容的行高和间距 */
.cursor-chat-container .leading-relaxed {
  line-height: 1.5;
}

/* 移除消息气泡的默认边距 */
.cursor-chat-container .space-y-3 > * + * {
  margin-top: 0.75rem;
}

/* 确保消息内容没有多余的底部边距 */
.cursor-chat-container .whitespace-pre-wrap:last-child {
  margin-bottom: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .cursor-chat-panel {
    width: 100vw;
  }
}
</style>
