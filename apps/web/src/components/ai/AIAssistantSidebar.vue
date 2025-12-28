<script setup lang="ts">
import type { ToolFunctionsContext } from './tool-box'
import type { OutlineData, OutlineItem } from '@/components/OutlineEditor.vue'
import type { QuickCommandRuntime } from '@/stores/quickCommands'
import { useStorage } from '@vueuse/core'

import DOMPurify from 'isomorphic-dompurify'
import {
  Bot,
  Check,
  Copy,
  Edit,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Pause,
  Plus,
  RefreshCcw,
  Send,
  Settings,
  Trash2,
} from 'lucide-vue-next'
import { marked } from 'marked'
import { toast } from 'vue-sonner'
import AIConfig from '@/components/ai/chat-box/AIConfig.vue'
import QuickCommandManager from '@/components/ai/chat-box/QuickCommandManager.vue'
import OutlineEditor from '@/components/OutlineEditor.vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import useAIConfigStore from '@/stores/aiConfig'
import { useDisplayStore } from '@/stores/display'
import { useEditorStore } from '@/stores/editor'
import { useQuickCommands } from '@/stores/quickCommands'
import { copyPlain } from '@/utils/clipboard'
import { toolDefinitions, toolFunctions } from './tool-box'

const editorStore = useEditorStore()
const { editor } = storeToRefs(editorStore)
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
const cmdMgrOpen = ref(false)
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
interface ChatMessage {
  role: `user` | `assistant` | `system`
  content: string
  reasoning?: string
  done?: boolean
  searchResults?: Array<{
    title: string
    url: string
    snippet: string
    content?: string
  }>
  showSearchResults?: boolean // 控制搜索结果是否展开显示
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
      `.ai-sidebar-textarea`,
    ) as HTMLTextAreaElement | null
    textarea?.focus()
    if (textarea) {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }
  })
}

/* ---------- 初始数据 ---------- */
onMounted(async () => {
  // 每次打开都显示默认欢迎消息，不加载聊天历史
  // 编辑器内容会自动保存和加载，不需要保存聊天历史
  messages.value = getDefaultMessages()
  await scrollToBottom(true)
})
function getDefaultMessages(): ChatMessage[] {
  return [{ role: `assistant`, content: `你好，我是 AI 助手，有什么可以帮你的？` }]
}

// 清理消息数据，移除 base64 数据以节省存储空间,新的数据做了拷贝，复制，其余去除
function cleanMessagesForStorage(messages: ChatMessage[]): ChatMessage[] {
  //  map 展开数据，浅拷贝一份数据
  return messages.map((msg) => {
    // 复制数据，保留原来的数据
    const cleaned = { ...msg }

    // 清理图片结果中的 base64 数据，只保留 URL 和元数据
    if (cleaned.imageResults && Array.isArray(cleaned.imageResults)) {
      cleaned.imageResults = cleaned.imageResults.map((img: any) => {
        // 只保留必要的字段，prompt描述，操作类型 op
        const cleanedImg: any = {
          prompt: img.prompt,
          op: img.op,
        }
        // 只保留 URL，不保留 base64
        if (img.url && !img.url.startsWith(`data:image`)) {
          cleanedImg.url = img.url
        }
        // 只保留必要的元数据
        if (img.meta?.algorithm_base_resp) {
          cleanedImg.meta = {
            algorithm_base_resp: img.meta.algorithm_base_resp,
          }
        }
        return cleanedImg
      })
    }

    // 清理内容中的 base64 数据（如果内容包含 base64 图片）
    if (cleaned.content && typeof cleaned.content === `string`) {
      // 移除 Markdown 图片中的 base64 数据
      cleaned.content = cleaned.content.replace(/!\[([^\]]*)\]\(data:image\/[^;]+;base64,[^\s)]+\)/g, `![$1](图片已生成)`)
      // 移除 HTML img 标签中的 base64 数据
      cleaned.content = cleaned.content.replace(/<img[^>]+src=["']data:image\/[^;]+;base64,[^"']+["'][^>]*>/g, `<img src="图片已生成" alt="图片">`)
      // 移除纯 base64 数据 URL
      cleaned.content = cleaned.content.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{100,}/g, `[图片已生成]`)
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

// 渲染markdown
function renderMarkdown(content: string): string {
  if (!content)
    return ``
  try {
    // 预处理：确保内容中没有会导致解析错误的格式
    const safeContent = content
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
        // 清理图片 alt 文本，确保是安全的字符串
        const safeAlt = (alt || `图片`)
          .toString()
          .replace(/[[\]()]/g, ``)
          .replace(/\n/g, ` `)
          .trim() || `图片`
        return `![${safeAlt}](${url})`
      })

    const html = marked.parse(safeContent) as string
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [`p`, `br`, `strong`, `em`, `code`, `pre`, `ul`, `ol`, `li`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `blockquote`, `a`, `img`],
      ALLOWED_ATTR: [`href`, `src`, `alt`, `title`, `class`, `target`, `rel`],
    })
  }
  catch (e) {
    console.error(`Markdown渲染失败:`, e)
    console.error(`失败的内容:`, content.substring(0, 200))
    // 如果渲染失败，返回转义后的纯文本
    return content.replace(/</g, `&lt;`).replace(/>/g, `&gt;`).replace(/\n/g, `<br>`)
  }
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
  input.value = lastUser.content
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

// 添加工具函数定义
interface ToolCall {
  id: string
  type: `function`
  function: {
    name: string
    arguments: string
  }
}

const toolContext: ToolFunctionsContext = {
  jimengConfig,
  saveJimengConfig,
}

/* ---------- 发送消息 ---------- */
async function sendMessage() {
  if (!input.value.trim() || loading.value)
    return

  /* 记录历史输入 */
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

  /* 组装上下文 */
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
          `下面是一篇 Markdown 文章全文，请严格以此为主完成后续指令：\n\n${editor.value?.state.doc.toString()}`,
      }]
    : []

  const payloadMessages: ChatMessage[] = [
    {
      role: `system`,
      content: `你是一个专业的 Markdown 编辑器助手，请用简洁中文回答。

**图片生成规则（必须严格遵守）：**
1. 当用户提到以下任何关键词时，**必须立即调用 image_generate 工具**：
   - 生成图片、创建图片、画图、设计图片、制作图片
   - 图片、图像、图、画
   - 任何包含"图片"、"图像"、"画"的请求
   
2. **禁止行为**：
   - 不要回复"我无法生成图片"、"我不会生成图片"等
   - 不要只回复文字而不调用工具
   - 不要询问用户是否需要生成图片，直接调用工具
   
3. **必须行为**：
   - 检测到图片生成需求时，立即调用 image_generate 工具
   - 将用户的完整描述作为 prompt 参数传递给工具
   - 等待工具返回结果后再回复用户`,
    },
    ...quoteMessages,
    ...contextHistory,
  ]

  // 循环处理多轮对话（用于处理 tool calls）
  let continueConversation = true
  let conversationRound = 0
  const maxRounds = 5
  // 标记是否调用了大纲生成工具（用于在下一轮回复中解析大纲数据）
  let hasOutlineToolCall = false

  while (continueConversation && conversationRound < maxRounds) {
    conversationRound++

    const payload = {
      model: model.value,
      messages: payloadMessages,
      tools: toolDefinitions,

      // 新增tool
      tool_choice: `auto`,
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

      // 智能处理端点路径
      // 如果路径已经包含 /chat/completions，直接使用
      // 如果路径以 /v3 或 /v1 结尾，追加 /chat/completions
      // 否则替换最后一个路径段
      if (url.pathname.endsWith(`/chat/completions`)) {
        // 已经包含完整路径，不做处理
      }
      else if (url.pathname.match(/\/v\d+$/)) {
        // 路径以 /v1 或 /v3 结尾，追加 /chat/completions
        url.pathname = url.pathname.replace(/\/?$/, `/chat/completions`)
      }
      else if (url.pathname === `/` || url.pathname === ``) {
        // 根路径，添加 /chat/completions
        url.pathname = `/chat/completions`
      }
      else {
        // 其他情况，替换最后一个路径段或追加
        url.pathname = url.pathname.replace(/\/?$/, `/chat/completions`)
      }

      console.log(`[请求] URL:`, url.toString())
      console.log(`[请求] 工具数量:`, payload.tools?.length || 0)
      if (payload.tools && payload.tools.length > 0) {
        console.log(`[请求] 可用工具:`, payload.tools.map((t: any) => t.function?.name).filter(Boolean))
      }
      console.log(`[请求] payload:`, JSON.stringify(payload, null, 2))

      const res = await window.fetch(url.toString(), {
        method: `POST`,
        headers,
        body: JSON.stringify(payload),
        signal,
      })

      if (!res.ok || !res.body) {
        const errorText = await res.text().catch(() => ``)
        console.error(`请求失败详情:`, {
          status: res.status,
          statusText: res.statusText,
          url: url.toString(),
          errorText,
        })
        throw new Error(`响应错误：${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ``}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder(`utf-8`)
      let buffer = ``

      // 用于收集 tool calls
      const toolCallBuffer: Record<number, ToolCall> = {}

      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          const last = messages.value[messages.value.length - 1]
          if (last.role === `assistant`) {
            last.done = true

            // 如果调用了大纲生成工具，尝试从回复中解析大纲数据
            if (hasOutlineToolCall && last.content) {
              parseOutlineFromContent(last.content)
            }
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
            const finishReason = json.choices?.[0]?.finish_reason

            // 记录 finish_reason，帮助诊断工具调用问题
            if (finishReason) {
              console.log(`[响应] finish_reason:`, finishReason)
              if (finishReason === `length`) {
                console.warn(`[响应] 响应因长度限制而结束，可能没有完成工具调用`)
              }
              else if (finishReason === `tool_calls`) {
                console.log(`[响应] 检测到工具调用完成`)
              }
            }

            const last = messages.value[messages.value.length - 1]

            // 第二轮及以后的对话，更新最后一条消息
            if (last !== replyMessageProxy && conversationRound > 1) {
              if (delta.content)
                last.content = (last.content || ``) + delta.content
              await scrollToBottom()
              continue
            }

            // 处理内容
            if (delta.content) {
              last.content = (last.content || ``) + delta.content
              await scrollToBottom()
            }
            else if (delta.reasoning_content) {
              last.reasoning = (last.reasoning || ``) + delta.reasoning_content
              await scrollToBottom()
            }

            // 处理 tool calls - 收集完整的工具调用信息
            if (delta.tool_calls) {
              console.log(`[工具调用] 检测到 tool_calls delta:`, delta.tool_calls)
              for (const toolCallDelta of delta.tool_calls) {
                // 检查是否调用了大纲生成工具
                if (toolCallDelta.function?.name === `generate_article_outline`) {
                  hasOutlineToolCall = true
                }
                const index = toolCallDelta.index
                if (!toolCallBuffer[index]) {
                  toolCallBuffer[index] = {
                    id: toolCallDelta.id || ``,
                    type: toolCallDelta.type || `function`,
                    function: {
                      name: ``,
                      arguments: ``,
                    },
                  }
                  console.log(`[工具调用] 创建新的工具调用缓冲区 [${index}]:`, toolCallDelta)
                }

                if (toolCallDelta.id)
                  toolCallBuffer[index].id = toolCallDelta.id
                if (toolCallDelta.function?.name) {
                  toolCallBuffer[index].function.name += toolCallDelta.function.name
                  console.log(`[工具调用] 工具名称 [${index}]:`, toolCallDelta.function.name)
                }
                if (toolCallDelta.function?.arguments) {
                  toolCallBuffer[index].function.arguments += toolCallDelta.function.arguments
                  console.log(`[工具调用] 工具参数片段 [${index}]:`, toolCallDelta.function.arguments.substring(0, 100))
                }
              }
            }
          }
          catch (e) {
            console.error(`解析失败:`, e)
          }
        }
      }

      // 检查是否有 tool calls 需要执行
      const completedToolCalls = Object.values(toolCallBuffer).filter(
        tc => tc.function.name && tc.function.arguments !== undefined && tc.function.arguments.length > 0,
      ) as ToolCall[]

      // 如果没有工具调用，检查用户消息是否应该触发图片生成
      if (completedToolCalls.length === 0) {
        const lastUserMessage = [...payloadMessages].reverse().find(m => m.role === `user`)
        if (lastUserMessage) {
          const userContent = lastUserMessage.content || ``
          const imageKeywords = [`图片`, `图像`, `图`, `画`, `生成图片`, `创建图片`, `画图`, `设计图片`, `制作图片`]
          const shouldTriggerImage = imageKeywords.some(keyword => userContent.includes(keyword))

          if (shouldTriggerImage) {
            console.warn(`[工具调用] 用户消息包含图片相关关键词，但AI没有调用工具`)
            console.warn(`[工具调用] 用户消息:`, userContent)
            console.warn(`[工具调用] 工具缓冲区:`, toolCallBuffer)
            console.warn(`[工具调用] 这可能是因为：1) AI模型选择不调用工具 2) 响应被截断 3) 工具调用格式错误`)
          }
        }
      }

      if (completedToolCalls.length > 0) {
        console.log(`[工具调用] 检测到 tool calls:`, completedToolCalls)
        console.log(`[工具调用] 工具数量:`, completedToolCalls.length)

        const last = messages.value[messages.value.length - 1]

        // 执行工具函数
        const toolResults = []
        for (const toolCall of completedToolCalls) {
          try {
            const args = JSON.parse(toolCall.function.arguments)
            console.log(`[工具执行] 开始执行工具: ${toolCall.function.name}`, args)

            // 如果是图片生成工具，显示执行状态
            if (toolCall.function.name === `image_generate`) {
              last.content = `正在生成图片，请稍候...`
              await scrollToBottom()
            }

            // 如果调用的是大纲生成工具，设置标记
            if (toolCall.function.name === `generate_article_outline`) {
              hasOutlineToolCall = true
            }

            const toolFn = toolFunctions[toolCall.function.name]

            if (!toolFn) {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: `tool`,
                content: JSON.stringify({ error: `工具 ${toolCall.function.name} 不存在` }),
              })
              continue
            }

            // 执行工具函数，获取 JSON 数据
            const result = await Promise.resolve(toolFn(args, toolContext))
            console.log(`工具返回的 JSON 数据:`, result)

            // 如果是搜索工具，保存搜索结果到消息中（默认不展开）
            if (toolCall.function.name === `search_web` && result.results && Array.isArray(result.results)) {
              last.searchResults = result.results.map((item: any) => ({
                title: item.title || ``,
                url: item.url || ``,
                snippet: item.snippet || item.description || ``,
                content: item.content || ``,
              }))
              last.showSearchResults = false // 默认不展开搜索结果
            }

            // 如果是图片工具，保存图片结果到消息中
            if ((toolCall.function.name === `image_generate`
              || toolCall.function.name === `image_remove_background`
              || toolCall.function.name === `image_variation`)) {
              console.log(`[工具处理] ${toolCall.function.name} 返回结果:`, JSON.stringify(result, null, 2))

              // 检查是否有错误
              if (result.error) {
                console.error(`[工具] ${toolCall.function.name} 执行失败:`, result.error)
                last.content = `图片生成失败: ${result.error}`
                last.done = true
              }
              // 检查是否有图片结果
              else if (result.images && Array.isArray(result.images) && result.images.length > 0) {
                console.log(`[工具] ${toolCall.function.name} 成功，共 ${result.images.length} 张图片`)
                console.log(`工具] 图片数据详情:`, result.images.map((img: any, idx: number) => ({
                  index: idx,
                  hasUrl: !!img.url,
                  hasBase64: !!img.base64,
                  base64Length: img.base64?.length || 0,
                  base64Preview: `${img.base64?.substring(0, 50)}...` || `N/A`,
                  prompt: img.prompt,
                })))

                // 存储图片结果
                last.imageResults = result.images.map((it: any) => ({
                  url: it.url,
                  base64: it.base64,
                  prompt: it.prompt,
                  op: it.op,
                  meta: it.meta,
                }))
                console.log(`[工具] 图片结果已存储到 last.imageResults，共 ${last.imageResults?.length || 0} 张`)

                // 生成Markdown格式的图片显示
                const imageMarkdown = result.images.map((it: any, idx: number) => {
                  // 确保 alt 文本是安全的字符串，移除可能导致问题的特殊字符
                  const safeAlt = (it.prompt || `生成的图片 ${idx + 1}`)
                    .toString()
                    .replace(/[[\]()]/g, ``) // 移除 Markdown 特殊字符
                    .replace(/\n/g, ` `) // 替换换行符
                    .trim() || `图片 ${idx + 1}`

                  if (it.url) {
                    return `![${safeAlt}](${it.url})`
                  }
                  else if (it.base64) {
                    // 根据base64前缀判断图片格式
                    let mimeType = `image/jpeg` // 默认JPEG
                    if (it.base64.startsWith(`/9j/`)) {
                      // JPEG格式 (FF D8 FF)
                      mimeType = `image/jpeg`
                    }
                    else if (it.base64.startsWith(`iVBORw0KGgo`)) {
                      // PNG格式 (89 50 4E 47)
                      mimeType = `image/png`
                    }
                    else if (it.base64.startsWith(`R0lGODlh`) || it.base64.startsWith(`R0lGODdh`)) {
                      // GIF格式 (47 49 46 38)
                      mimeType = `image/gif`
                    }
                    else if (it.base64.startsWith(`UklGR`)) {
                      // WebP格式
                      mimeType = `image/webp`
                    }
                    return `![${safeAlt}](data:${mimeType};base64,${it.base64})`
                  }
                  return ``
                }).filter(Boolean).join(`\n\n`)

                // 设置消息内容，包含Markdown格式的图片
                last.content = `图片生成成功！共生成 ${result.images.length} 张图片\n\n${imageMarkdown}`
                last.done = true
                console.log(`[工具] 图片结果已添加到消息:`, last.imageResults)
                console.log(`[工具] 图片Markdown内容:`, imageMarkdown)
              }
              else {
                console.warn(`[工具] ${toolCall.function.name} 返回数据格式异常:`, result)
                last.content = `图片生成返回数据格式异常: ${JSON.stringify(result, null, 2)}`
                last.done = true
              }
            }

            // 如果是文章大纲生成工具，标记已调用（等待 AI 在下一轮回复中返回大纲数据）
            else if (toolCall.function.name === `generate_article_outline`) {
              // 工具函数返回的是提示信息，不包含实际大纲数据
              // 大纲数据会在 AI 的下一轮回复中返回
              // 我们会在回复完成后通过 parseOutlineFromContent 函数解析
              last.content = `正在生成文章大纲，请稍候...`
            }
            // 如果是搜索工具，只显示简短提示，不显示完整 JSON 数据
            else if (toolCall.function.name === `search_web`) {
              if (result.error) {
                last.content = `搜索失败: ${result.error}`
              }
              else {
                const resultCount = result.results?.length || 0
                last.content = `已搜索"${args.query}"，找到 ${resultCount} 条结果`
              }
            }
            else {
              // 其他工具正常显示调用信息和结果
              if (result.error) {
                last.content = `工具执行失败: ${result.error}`
              }
              else {
                last.content = `[调用工具: ${toolCall.function.name}(${JSON.stringify(args)})]\n返回数据: ${JSON.stringify(result, null, 2)}`
              }
            }

            // 将 JSON 结果添加到工具结果中
            toolResults.push({
              tool_call_id: toolCall.id,
              role: `tool`,
              content: JSON.stringify(result), // 重要：必须是 JSON 字符串
            })

            await scrollToBottom()
          }
          catch (e) {
            console.error(`工具执行失败:`, e)
            toolResults.push({
              tool_call_id: toolCall.id,
              role: `tool`,
              content: JSON.stringify({ error: `工具执行失败: ${(e as Error).message}` }),
            })
          }
        }

        // 将工具结果添加到消息历史，并准备下一轮请求
        payloadMessages.push({
          role: `assistant`,
          content: last.content || null,
          tool_calls: completedToolCalls,
        } as any)

        // 添加工具返回的 JSON 数据
        for (const result of toolResults) {
          payloadMessages.push(result as any)
        }

        // 创建新的 assistant 消息用于接收最终回复
        const nextReplyMessage: ChatMessage = { role: `assistant`, content: ``, reasoning: ``, done: false }
        messages.value.push(nextReplyMessage)
        continueConversation = true
        await scrollToBottom(true)
      }
      else {
        // 没有 tool calls，结束对话
        continueConversation = false
      }
    }
    catch (e) {
      if ((e as Error).name === `AbortError`) {
        console.log(`请求中止`)
        continueConversation = false
      }
      else {
        console.error(`请求失败:`, e)
        messages.value[messages.value.length - 1].content
          = `请求失败: ${(e as Error).message}`
        continueConversation = false
      }
      await scrollToBottom(true)
    }
  }

  // 结束处理 - 不保存聊天历史，只保留默认欢迎消息
  // 编辑器内容会自动保存，不需要保存聊天历史
  // 如果需要，可以清空历史记录
  try {
    // 只保存默认欢迎消息，不保存聊天历史
    const defaultMessages = getDefaultMessages()
    localStorage.setItem(memoryKey, JSON.stringify(defaultMessages))
  }
  catch (error) {
    // 如果保存失败，尝试清空历史记录
    try {
      localStorage.removeItem(memoryKey)
    }
    catch (e2) {
      console.error(`[存储] 清空历史记录失败:`, e2)
    }
    console.error(`[存储] 保存消息失败:`, error)
  }

  loading.value = false
  fetchController.value = null
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

    <!-- 快捷指令栏 -->
    <div
      v-if="!configVisible && !outlineVisible"
      class="ai-sidebar-commands border-b bg-muted/30 px-3 py-2"
    >
      <div class="flex items-center gap-2 overflow-x-auto">
        <template v-if="quickCmdStore.commands.length">
          <Button
            v-for="cmd in quickCmdStore.commands.slice(0, 3)"
            :key="cmd.id"
            variant="secondary"
            size="sm"
            class="h-7 shrink-0 text-xs"
            @click="applyQuickCommand(cmd)"
          >
            {{ cmd.label }}
          </Button>
        </template>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 shrink-0"
          title="管理指令"
          @click="cmdMgrOpen = true"
        >
          <Plus class="h-3.5 w-3.5" />
        </Button>
      </div>
      <QuickCommandManager v-model:open="cmdMgrOpen" />
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
        <div
          v-for="(msg, index) in messages"
          :key="index"
          class="w-full"
        >
          <!-- 消息内容框 -->
          <div
            class="w-full rounded-md px-3 py-2.5 text-sm leading-relaxed overflow-x-auto"
            :class="msg.role === 'user'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/50 text-muted-foreground border border-border/50'"
          >
            <!-- reasoning -->
            <div v-if="msg.reasoning" class="mb-1 text-xs italic opacity-70 break-words">
              {{ msg.reasoning }}
            </div>

            <!-- 内容 -->
            <div
              v-if="msg.content"
              class="break-words"
              :class="msg.role === 'assistant' ? 'markdown-content' : 'whitespace-pre-wrap'"
              v-html="msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content"
            />
            <div
              v-else-if="msg.role === 'assistant' && !msg.done"
              class="animate-pulse opacity-50"
            >
              思考中…
            </div>

            <!-- 搜索结果列表（可折叠） -->
            <div v-if="msg.searchResults && msg.searchResults.length > 0" class="mt-3 pt-2 border-t border-border/30">
              <button
                class="flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity mb-2"
                @click="msg.showSearchResults = !msg.showSearchResults"
              >
                <span>{{ msg.showSearchResults ? '▼' : '▶' }}</span>
                <span>搜索结果（{{ msg.searchResults.length }} 条）</span>
              </button>
              <div v-if="msg.showSearchResults" class="space-y-2">
                <div
                  v-for="(result, resultIndex) in msg.searchResults"
                  :key="resultIndex"
                  class="border border-border/50 rounded-md p-2.5 hover:bg-muted/30 transition-colors cursor-pointer group"
                >
                  <a
                    :href="result.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block no-underline"
                    @click.stop
                  >
                    <div class="font-medium text-sm text-primary hover:text-primary/80 group-hover:underline mb-1.5 line-clamp-1">
                      {{ result.title }}
                    </div>
                    <div class="text-xs text-muted-foreground line-clamp-2 mb-1.5">
                      {{ result.snippet }}
                    </div>
                    <div class="text-xs text-muted-foreground/60 truncate">
                      {{ result.url }}
                    </div>
                  </a>
                </div>
              </div>
            </div>

            <!-- 图片结果列表 -->
            <div v-if="msg.imageResults && msg.imageResults.length > 0" class="mt-3 space-y-3 pt-2 border-t border-border/30">
              <div class="text-xs font-medium opacity-70">
                图片结果：
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="(img, idx) in msg.imageResults"
                  :key="idx"
                  class="border border-border/50 rounded-md p-2 bg-background/60"
                >
                  <a
                    v-if="img.url"
                    :href="img.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block"
                    @click.stop
                  >
                    <img :src="img.url" alt="image result" class="w-full h-auto rounded-sm">
                  </a>
                  <img
                    v-else-if="img.base64"
                    :src="`data:image/png;base64,${img.base64}`"
                    alt="image result"
                    class="w-full h-auto rounded-sm"
                  >
                  <div class="mt-1 flex items-center justify-between">
                    <span class="text-[10px] uppercase opacity-60">{{ img.op || 'image' }}</span>
                    <div class="flex items-center gap-2">
                      <button
                        class="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                        title="插入到编辑器"
                        @click.stop="applyImageToEditor(img)"
                      >
                        应用
                      </button>
                      <a
                        v-if="img.url"
                        :href="img.url"
                        download
                        class="text-[10px] underline opacity-70 hover:opacity-100"
                        @click.stop
                      >下载</a>
                      <button
                        v-else-if="img.base64"
                        class="text-[10px] underline opacity-70 hover:opacity-100"
                        @click.stop="downloadBase64Image(img.base64!, `image-${idx}.png`)"
                      >
                        下载
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 工具按钮 - 放在消息框下方 -->
          <div
            class="flex items-center gap-1 mt-1"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <Button
              v-if="index > 0 && !(msg.role === 'assistant' && index === messages.length - 1 && !msg.done)"
              variant="ghost"
              size="sm"
              class="h-7 px-2 text-xs"
              aria-label="复制内容"
              @click="copyToClipboard(msg.content, index)"
            >
              <Check
                v-if="copiedIndex === index"
                class="h-3.5 w-3.5 mr-1 text-green-600"
              />
              <Copy v-else class="h-3.5 w-3.5 mr-1" />
              <span>复制</span>
            </Button>
            <Button
              v-if="index > 0 && !(msg.role === 'assistant' && index === messages.length - 1 && !msg.done)"
              variant="ghost"
              size="sm"
              class="h-7 px-2 text-xs"
              aria-label="编辑内容"
              @click="editMessage(msg.content)"
            >
              <Edit class="h-3.5 w-3.5 mr-1" />
              <span>编辑</span>
            </Button>
            <Button
              v-if="msg.role === 'assistant' && msg.done && index === messages.length - 1"
              variant="ghost"
              size="sm"
              class="h-7 px-2 text-xs"
              aria-label="重新生成"
              @click="regenerateLast"
            >
              <RefreshCcw class="h-3.5 w-3.5 mr-1" />
              <span>重新生成</span>
            </Button>
          </div>
        </div>
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

/* Markdown内容样式 */
.ai-sidebar-chat-container .markdown-content {
  line-height: 1.6;
}

.ai-sidebar-chat-container .markdown-content p {
  margin: 0.5rem 0;
}

.ai-sidebar-chat-container .markdown-content p:first-child {
  margin-top: 0;
}

.ai-sidebar-chat-container .markdown-content p:last-child {
  margin-bottom: 0;
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

.ai-sidebar-chat-container .markdown-content img {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 0.75rem 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: block;
  border: 1px solid hsl(var(--border) / 0.3);
  cursor: pointer;
  transition: transform 0.2s ease;
}

.ai-sidebar-chat-container .markdown-content img:hover {
  transform: scale(1.02);
}

/* 引用块样式 */
.ai-sidebar-chat-container blockquote {
  border-left: 3px solid hsl(var(--primary));
  padding-left: 1rem;
  margin: 1rem 0;
  color: hsl(var(--muted-foreground));
  font-style: italic;
  background-color: hsl(var(--muted) / 0.3);
  padding: 0.75rem 1rem;
  border-radius: 0 0.375rem 0.375rem 0;
}

.ai-sidebar-chat-container thead {
  background-color: hsl(var(--muted));
}

.ai-sidebar-chat-container th,
.ai-sidebar-chat-container td {
  padding: 0.5rem 0.75rem;
  border: 1px solid hsl(var(--border));
  text-align: left;
}

.ai-sidebar-chat-container th {
  font-weight: 600;
  background-color: hsl(var(--muted) / 0.5);
}
</style>
