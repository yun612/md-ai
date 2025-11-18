import type { Range } from '@codemirror/state'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'

/**
 * 截断 base64 图片数据的扩展
 * 在编辑器中显示时，将包含 base64 数据的长行标记，然后通过 CSS 截断显示
 * 实际文档内容保持不变
 */
export function truncateBase64Images() {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet

        constructor(view: EditorView) {
          this.decorations = this.buildDecorations(view)
        }

        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view)
          }
        }

        buildDecorations(view: EditorView): DecorationSet {
          const decorations: Range<Decoration>[] = []
          const doc = view.state.doc

          // 遍历文档的每一行
          for (let i = 0; i < doc.lines; i++) {
            const line = doc.line(i + 1)
            const lineText = line.text

            // 检测是否包含 base64 图片数据（长度超过 100 字符）
            // 匹配格式: ![alt](data:image/xxx;base64,xxxxx) 或 data:image/xxx;base64,xxxxx
            const base64Pattern = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]{100,}/
            if (base64Pattern.test(lineText)) {
              // 标记这一行包含长 base64 数据
              decorations.push(
                Decoration.line({
                  attributes: { 'data-base64-long': `true` },
                }).range(line.from),
              )
            }
          }

          return Decoration.set(decorations)
        }
      },
      {
        decorations: v => v.decorations,
      },
    ),
    EditorView.theme({
      '.cm-line[data-base64-long="true"]': {
        overflow: `hidden`,
        textOverflow: `ellipsis`,
        whiteSpace: `nowrap`,
        maxWidth: `100%`,
        display: `block`,
      },
    }),
  ]
}
