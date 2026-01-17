import type { TaskContext, ToolHandler } from '@grisaiaevy/crafting-agent'

export class WriteArticleToolHandler implements ToolHandler {
  private editor: any
  private isHtmlMode: boolean
  private pendingArticleContent: string | null = null
  private editorReady: boolean = false

  constructor(editor: any, isHtmlMode: boolean = false) {
    this.editor = editor
    this.isHtmlMode = isHtmlMode
    this.setupEditorWatch()
  }

  private setupEditorWatch() {
    if (!this.editor) {
      console.log(`[WriteArticleTool] Editor not provided, skipping watch setup`)
      return
    }

    const checkEditorReady = () => {
      if (this.editor && this.pendingArticleContent && !this.editorReady) {
        console.log(`[write_article] ${this.isHtmlMode ? `HTML` : `Markdown`} 编辑器已就绪，写入待定内容`)
        const content = this.pendingArticleContent
        this.pendingArticleContent = null
        this.editor.dispatch({
          changes: {
            from: 0,
            to: this.editor.state.doc.length,
            insert: content,
          },
          selection: { anchor: content.length },
        })
        console.log(`[write_article] 文章内容已替换到编辑器`)
        this.editorReady = true
      }
    }

    const interval = setInterval(() => {
      if (this.editor && this.editor.state) {
        checkEditorReady()
        if (this.editorReady) {
          clearInterval(interval)
        }
      }
    }, 100)

    setTimeout(() => {
      clearInterval(interval)
      if (!this.editorReady && this.pendingArticleContent) {
        console.log(`[write_article] 编辑器初始化超时，尝试直接写入`)
        checkEditorReady()
      }
    }, 5000)
  }

  getConfig() {
    return {
      humanInLoop: true,
    }
  }

  tool() {
    return {
      type: `function` as const,
      function: {
        name: `write_article`,
        description: `微信公众号内容`,
        parameters: {
          type: `object`,
          properties: {
            content: {
              type: `string`,
              description: `正文内容，使用section标签+style内联样式组织文章内容`,
            },
          },
          required: [`content`],
        },
      },
    }
  }

  async execute(toolCall: any, _context?: TaskContext): Promise<string> {
    console.log(`[WriteArticleTool] Executing:`, toolCall)
    const args = typeof toolCall.function.arguments === `string`
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments

    const content = args.content || ``
    console.log(`[WriteArticleTool] Content to write:`, content)

    if (!this.editor) {
      console.log(`[WriteArticleTool] Editor not available, storing content as pending`)
      this.pendingArticleContent = content
      return `Editor not ready, content stored as pending`
    }

    if (this.editor && this.editor.state) {
      console.log(`[write_article] ${this.isHtmlMode ? `HTML` : `Markdown`} 编辑器已就绪，写入内容`)
      this.editor.dispatch({
        changes: {
          from: 0,
          to: this.editor.state.doc.length,
          insert: content,
        },
        selection: { anchor: content.length },
      })
      console.log(`[write_article] 文章内容已替换到编辑器`)
      this.editorReady = true
    }
    else {
      console.log(`[WriteArticleTool] Editor not ready, storing content as pending`)
      this.pendingArticleContent = content
    }

    return `Write article executed: ${content.substring(0, 50)}...`
  }
}
