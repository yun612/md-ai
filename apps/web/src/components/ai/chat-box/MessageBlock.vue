<script setup lang="ts">
import type { ChatMessage as BaseChatMessage, ContentBlock } from '@grisaiaevy/crafting-agent'
import DOMPurify from 'isomorphic-dompurify'
import { Check, Copy, Edit, RefreshCcw } from 'lucide-vue-next'
import { marked } from 'marked'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'

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

interface Props {
  msg: ChatMessage
  index: number
  isLastMessage: boolean
  copiedIndex: number | null
}

interface Emits {
  (e: `copy`, text: string, index: number): void
  (e: `edit`, content: string): void
  (e: `regenerate`): void
  (e: `applyImage`, img: { url?: string, base64?: string, prompt?: string }): void
  (e: `downloadImage`, base64: string, filename: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localShowSearchResults = ref(props.msg.showSearchResults ?? false)

function getTextFromContentBlocks(content: ContentBlock[]): string {
  if (!content || !Array.isArray(content))
    return ``
  return content
    .filter(block => block.type === `text` && block.text)
    .map(block => block.text)
    .join(``)
}

function renderMarkdown(content: string): string {
  if (!content)
    return ``
  try {
    const safeContent = content
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
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
    return content.replace(/</g, `&lt;`).replace(/>/g, `&gt;`).replace(/\n/g, `<br>`)
  }
}

function handleCopy() {
  emit(`copy`, getTextFromContentBlocks(props.msg.content || []), props.index)
}

function handleEdit() {
  emit(`edit`, getTextFromContentBlocks(props.msg.content || []))
}

function handleRegenerate() {
  emit(`regenerate`)
}

function handleApplyImage(img: { url?: string, base64?: string, prompt?: string }) {
  emit(`applyImage`, img)
}

function handleDownloadImage(base64: string, filename: string) {
  emit(`downloadImage`, base64, filename)
}

function getToolUseBlocks(content: ContentBlock[]): ContentBlock[] {
  if (!content || !Array.isArray(content))
    return []
  return content.filter(block => block.type === `tool_use`)
}

function getTextBlocks(content: ContentBlock[]): ContentBlock[] {
  if (!content || !Array.isArray(content))
    return []
  return content.filter(block => block.type === `text` && block.text)
}
</script>

<template>
  <div class="w-full">
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
      <template v-if="msg.role === 'assistant'">
        <div
          v-if="getTextBlocks(msg.content || []).length > 0"
          class="break-words markdown-content"
          v-html="renderMarkdown(getTextFromContentBlocks(getTextBlocks(msg.content || [])))"
        />
        <div
          v-else-if="!msg.done"
          class="animate-pulse opacity-50"
        >
          思考中…
        </div>
        <div v-else class="text-xs opacity-50">
          (无内容)
        </div>
        <div v-if="getToolUseBlocks(msg.content || []).length > 0" class="mt-3 pt-2 border-t border-border/30">
          <div class="text-xs font-medium opacity-70 mb-2">
            工具调用：
          </div>
          <div class="space-y-2">
            <div
              v-for="(toolBlock, toolIndex) in getToolUseBlocks(msg.content || [])"
              :key="toolIndex"
              class="border border-border/50 rounded-md p-2 bg-muted/30"
            >
              <div class="flex items-center gap-2 mb-1.5">
                <div class="text-xs font-medium text-primary">
                  {{ toolBlock.name }}
                </div>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  {{ toolBlock.tool_use_id?.slice(0, 8) || '未知' }}...
                </span>
              </div>
              <pre v-if="toolBlock.input" class="text-xs bg-muted/50 p-2 rounded overflow-x-auto">{{ JSON.stringify(toolBlock.input, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </template>
      <div
        v-else
        class="break-words whitespace-pre-wrap"
      >
        {{ getTextFromContentBlocks(msg.content || []) }}
      </div>

      <!-- 搜索结果列表（可折叠） -->
      <div v-if="msg.searchResults && msg.searchResults.length > 0" class="mt-3 pt-2 border-t border-border/30">
        <button
          class="flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity mb-2"
          @click="localShowSearchResults = !localShowSearchResults"
        >
          <span>{{ localShowSearchResults ? '▼' : '▶' }}</span>
          <span>搜索结果（{{ msg.searchResults.length }} 条）</span>
        </button>
        <div v-if="localShowSearchResults" class="space-y-2">
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
                  @click.stop="handleApplyImage(img)"
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
                  @click.stop="handleDownloadImage(img.base64!, `image-${idx}.png`)"
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
        v-if="index > 0 && !(msg.role === 'assistant' && isLastMessage && !msg.done)"
        variant="ghost"
        size="sm"
        class="h-7 px-2 text-xs"
        aria-label="复制内容"
        @click="handleCopy"
      >
        <Check
          v-if="copiedIndex === index"
          class="h-3.5 w-3.5 mr-1 text-green-600"
        />
        <Copy v-else class="h-3.5 w-3.5 mr-1" />
        <span>复制</span>
      </Button>
      <Button
        v-if="index > 0 && !(msg.role === 'assistant' && isLastMessage && !msg.done)"
        variant="ghost"
        size="sm"
        class="h-7 px-2 text-xs"
        aria-label="编辑内容"
        @click="handleEdit"
      >
        <Edit class="h-3.5 w-3.5 mr-1" />
        <span>编辑</span>
      </Button>
      <Button
        v-if="msg.role === 'assistant' && msg.done && isLastMessage"
        variant="ghost"
        size="sm"
        class="h-7 px-2 text-xs"
        aria-label="重新生成"
        @click="handleRegenerate"
      >
        <RefreshCcw class="h-3.5 w-3.5 mr-1" />
        <span>重新生成</span>
      </Button>
    </div>
  </div>
</template>

<style scoped>
.markdown-content {
  line-height: 1.6;
}

.markdown-content p {
  margin: 0.5rem 0;
}

.markdown-content p:first-child {
  margin-top: 0;
}

.markdown-content p:last-child {
  margin-bottom: 0;
}

.markdown-content img {
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

.markdown-content img:hover {
  transform: scale(1.02);
}

.markdown-content blockquote {
  border-left: 3px solid hsl(var(--primary));
  padding-left: 1rem;
  margin: 1rem 0;
  color: hsl(var(--muted-foreground));
  font-style: italic;
  background-color: hsl(var(--muted) / 0.3);
  padding: 0.75rem 1rem;
  border-radius: 0 0.375rem 0.375rem 0;
}

.markdown-content thead {
  background-color: hsl(var(--muted));
}

.markdown-content th,
.markdown-content td {
  padding: 0.5rem 0.75rem;
  border: 1px solid hsl(var(--border));
  text-align: left;
}

.markdown-content th {
  font-weight: 600;
  background-color: hsl(var(--muted) / 0.5);
}

.markdown-content pre {
  overflow-x: auto;
  max-width: 100%;
  padding: 0.75rem;
  border-radius: 0.375rem;
  background-color: hsl(var(--muted));
  margin: 0.5rem 0;
  word-wrap: break-word;
}

.markdown-content code {
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  max-width: 100%;
}

.markdown-content pre code {
  white-space: pre;
  word-break: normal;
  overflow-wrap: normal;
  display: block;
  overflow-x: auto;
}
</style>
