<script setup lang="ts">
import { FileCode, FileText } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useEditorStore } from '@/stores/editor'
import { useRenderStore } from '@/stores/render'
import { generatePureHTML } from '@/utils'
import { useHtmlEditorStore } from './html-editor/useHtmlEditorStore'

const props = defineProps<{
  compact?: boolean
}>()

const emit = defineEmits<{
  modeChanged: [mode: `markdown` | `html`, convertedContent?: string]
}>()

const htmlEditorStore = useHtmlEditorStore()
const editorStore = useEditorStore()
const renderStore = useRenderStore()

const { editMode, isHtmlMode } = storeToRefs(htmlEditorStore)

// HTML 转 Markdown (简单实现)
function htmlToMarkdown(html: string): string {
  // 提取 body 内容
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[1] : html

  const markdown = bodyContent
    // 标题
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, `# $1\n\n`)
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, `## $1\n\n`)
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, `### $1\n\n`)
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, `#### $1\n\n`)
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, `##### $1\n\n`)
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, `###### $1\n\n`)
    // 加粗
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, `**$1**`)
    .replace(/<b[^>]*>(.*?)<\/b>/gi, `**$1**`)
    // 斜体
    .replace(/<em[^>]*>(.*?)<\/em>/gi, `*$1*`)
    .replace(/<i[^>]*>(.*?)<\/i>/gi, `*$1*`)
    // 代码
    .replace(/<code[^>]*>(.*?)<\/code>/gi, `\`$1\``)
    .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, `\`\`\`\n$1\n\`\`\`\n\n`)
    .replace(/<pre[^>]*>(.*?)<\/pre>/gi, `\`\`\`\n$1\n\`\`\`\n\n`)
    // 链接
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, `[$2]($1)`)
    // 图片
    .replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, `![$2]($1)`)
    .replace(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi, `![]($1)`)
    // 列表
    .replace(/<li[^>]*>(.*?)<\/li>/gi, `- $1\n`)
    .replace(/<ul[^>]*>(.*?)<\/ul>/gi, `$1\n`)
    .replace(/<ol[^>]*>(.*?)<\/ol>/gi, `$1\n`)
    // 段落和换行
    .replace(/<p[^>]*>(.*?)<\/p>/gi, `$1\n\n`)
    .replace(/<br\s*\/?>/gi, `\n`)
    .replace(/<div[^>]*>(.*?)<\/div>/gi, `$1\n`)
    // 引用
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, (_, content) => {
      return `${content.split(`\n`).map((line: string) => `> ${line.trim()}`).join(`\n`)}\n\n`
    })
    // 删除其他 HTML 标签
    .replace(/<[^>]+>/g, ``)
    // 解码 HTML 实体
    .replace(/&nbsp;/g, ` `)
    .replace(/&lt;/g, `<`)
    .replace(/&gt;/g, `>`)
    .replace(/&amp;/g, `&`)
    .replace(/&quot;/g, `"`)
    // 清理多余空行
    .replace(/\n{3,}/g, `\n\n`)
    .trim()

  return markdown
}

async function handleModeSwitch(targetMode: `markdown` | `html`) {
  const currentMode = editMode.value

  // 如果切换到相同模式，不做处理
  if (currentMode === targetMode) {
    return
  }

  try {
    let convertedContent = ``

    if (targetMode === `html`) {
      // Markdown → HTML
      const markdownContent = editorStore.getContent()
      htmlEditorStore.setMarkdownContent(markdownContent)

      // 使用渲染器生成 HTML
      convertedContent = await generatePureHTML(markdownContent)

      // 包装成完整的 HTML 文档
      convertedContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
    body {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      line-height: 1.6;
      color: #333;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    p {
      margin-bottom: 16px;
    }
    code {
      background: #f6f8fa;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', monospace;
    }
    pre {
      background: #f6f8fa;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }
    pre code {
      background: none;
      padding: 0;
    }
  </style>
</head>
<body>
${convertedContent}
</body>
</html>`

      htmlEditorStore.setHtmlContent(convertedContent)
      htmlEditorStore.switchToHtml()
      emit(`modeChanged`, targetMode, convertedContent)
      toast.success(`已切换到 HTML 模式，Markdown 已转换为 HTML`)
    }
    else {
      // HTML → Markdown
      const htmlContentValue = htmlEditorStore.htmlContent
      convertedContent = htmlToMarkdown(htmlContentValue)

      htmlEditorStore.setMarkdownContent(convertedContent)
      htmlEditorStore.switchToMarkdown()
      emit(`modeChanged`, targetMode, convertedContent)
      toast.success(`已切换到 Markdown 模式，HTML 已转换为 Markdown`)
    }
  }
  catch (error) {
    console.error(`格式转换失败:`, error)
    toast.error(`格式转换失败，请检查内容格式`)
  }
}
</script>

<template>
  <!-- 紧凑模式 - 用于垂直侧边栏 -->
  <template v-if="props.compact">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          class="nav-btn"
          :class="{ active: isHtmlMode }"
          @click="handleModeSwitch('html')"
        >
          <FileCode class="size-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>HTML 模式</p>
      </TooltipContent>
    </Tooltip>
  </template>

  <!-- 标准模式 - 用于顶部工具栏 -->
  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="h-8 px-3"
      >
        <component
          :is="isHtmlMode ? FileCode : FileText"
          class="h-4 w-4 mr-2"
        />
        <span>{{ editMode === 'markdown' ? 'Markdown' : 'HTML' }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuItem
        :class="{ 'bg-accent': editMode === 'html' }"
        @click="handleModeSwitch('html')"
      >
        <FileCode class="h-4 w-4 mr-2" />
        <div>
          <div class="font-medium">
            HTML 模式
          </div>
          <div class="text-xs text-muted-foreground">
            直接编写 HTML+CSS 代码
          </div>
        </div>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<style scoped>
.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-btn:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
  transform: translateY(-1px);
}

.nav-btn.active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.1);
}
</style>
