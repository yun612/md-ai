import type { ToolContext, ToolHandler } from '@grisaiaevy/crafting-agent'
import { SANDBOX_MODIFIED_ATTR } from '@/components/editor/html-editor/useHtmlSandboxStore'

const APPLY_DIFF_DESCRIPTION = `
对现有文件应用精准、定向的修改，使用一个或多个搜索/替换块。此工具仅用于精细编辑；'SEARCH'块必须完全匹配现有内容，包括空格和缩进。若要进行多个定向更改，请在'diff'参数中提供多个SEARCH/REPLACE块。
`

const DIFF_PARAMETER_DESCRIPTION = `A string containing one or more search/replace blocks defining the changes. The ':start_line:' is required and indicates the starting line number of the original content. You must not add a start line for the replacement content. Each block must follow this format:
<<<<<<< SEARCH
:start_line:[line_number]
-------
[exact content to find]
=======
[new content to replace with]
>>>>>>> REPLACE`

export interface DiffResult {
  success: boolean
  content?: string
  error?: string
  failParts?: DiffResult[]
  modifiedSections?: string[]
}

export interface HtmlSandbox {
  createSandbox: (htmlContent: string) => void
  updateSandboxContent: (content: string) => void
  markSectionAsModified: (sectionId: string) => void
  applyDiffResult: (diffResult: string, modifiedSectionIds?: string[]) => void
  sandboxContent: { value: string }
  isActive: { value: boolean }
}

export class ApplyDiffToolHandler implements ToolHandler {
  private sandbox: HtmlSandbox | null = null
  private htmlContentGetter: (() => string) | null = null
  private readonly fuzzyThreshold = 0.8
  private readonly bufferLines = 5

  constructor(sandbox?: HtmlSandbox, htmlContentGetter?: () => string) {
    this.sandbox = sandbox || null
    this.htmlContentGetter = htmlContentGetter || null
  }

  /**
   * 设置 Sandbox 实例
   */
  setSandbox(sandbox: HtmlSandbox): void {
    this.sandbox = sandbox
  }

  /**
   * 设置获取 HTML 内容的函数
   */
  setHtmlContentGetter(getter: () => string): void {
    this.htmlContentGetter = getter
  }

  getConfig() {
    return {
      humanInLoop: true,
      displayName: `apply_diff`,
    }
  }

  tool() {
    return {
      type: `function` as const,
      function: {
        name: `apply_diff`,
        description: APPLY_DIFF_DESCRIPTION,
        parameters: {
          type: `object`,
          properties: {
            diff: {
              type: `string`,
              description: DIFF_PARAMETER_DESCRIPTION,
            },
          },
          required: [`diff`],
        },
      },
    }
  }

  async execute(toolCall: any, context?: ToolContext): Promise<string> {
    if (context?.isPartial) {
      return ``
    }
    console.log(`[ApplyDiffTool] Executing (isPartial: ${context?.isPartial}):`, toolCall)
    try {
      // 获取 diff 参数
      const args = toolCall?.function?.arguments
      if (!args || typeof args.diff !== `string`) {
        console.warn(`[ApplyDiffTool] Missing or invalid 'diff' parameter`)
        return ``
      }
      const diffContent = unescapeHtmlEntities(args.diff)
      console.log(`[ApplyDiffTool] Diff content length:`, diffContent.length)

      let originalContent = ``
      if (this.sandbox?.isActive.value) {
        originalContent = this.sandbox.sandboxContent.value
        console.log(`[ApplyDiffTool] Using active sandbox content, length:`, originalContent.length)
      }
      else if (this.htmlContentGetter) {
        originalContent = this.htmlContentGetter()
        console.log(`[ApplyDiffTool] Fetching original content from getter, length:`, originalContent.length)
        if (this.sandbox) {
          console.log(`[ApplyDiffTool] Creating new sandbox`)
          this.sandbox.createSandbox(originalContent)
        }
      }
      else {
        console.error(`[ApplyDiffTool] No HTML content source available`)
        return ``
      }

      // 应用 diff
      console.log(`[ApplyDiffTool] Applying diff...`)
      const result = await this.applySingleDiff(originalContent, diffContent)
      console.log(`[ApplyDiffTool] Diff application result:`, { success: result.success, modifiedSections: result.modifiedSections?.length })

      if (result.success && result.content) {
        // 更新 Sandbox 内容
        if (this.sandbox) {
          console.log(`[ApplyDiffTool] Updating sandbox with result`)
          this.sandbox.applyDiffResult(result.content, result.modifiedSections)
        }

        return JSON.stringify({
          success: true,
          message: `Diff applied successfully`,
          modifiedSections: result.modifiedSections?.length || 0,
        })
      }
      else {
        console.warn(`[ApplyDiffTool] Diff application failed:`, result.error)
        return JSON.stringify({
          success: false,
          error: result.error || `Failed to apply diff`,
          failParts: result.failParts,
        })
      }
    }
    catch (error) {
      console.error(`[ApplyDiffTool] Unexpected error:`, error)
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private validateMarkerSequencing(diffContent: string): { success: boolean, error?: string } {
    const searchMarkerRegex = /(?:^|\n)(?:<<<<<<< |<<<<<<<< )SEARCH/g
    const replaceMarkerRegex = /(?:^|\n)(?:>>>>>>> |>>>>>>>> )REPLACE/g
    const dividerRegex = /(?:^|\n)=======/g

    const searchMatches = [...diffContent.matchAll(searchMarkerRegex)]
    const replaceMatches = [...diffContent.matchAll(replaceMarkerRegex)]
    const dividerMatches = [...diffContent.matchAll(dividerRegex)]

    if (searchMatches.length === 0) {
      return { success: false, error: `No SEARCH marker found` }
    }

    if (replaceMatches.length === 0) {
      return { success: false, error: `No REPLACE marker found` }
    }

    if (searchMatches.length !== replaceMatches.length) {
      return {
        success: false,
        error: `Mismatched SEARCH/REPLACE markers: ${searchMatches.length} SEARCH vs ${replaceMatches.length} REPLACE`,
      }
    }

    if (dividerMatches.length !== searchMatches.length) {
      return {
        success: false,
        error: `Mismatched dividers: expected ${searchMatches.length}, found ${dividerMatches.length}`,
      }
    }

    return { success: true }
  }

  private unescapeMarkers(text: string): string {
    return text
      .replace(/\\<<<<<<< /g, `<<<<<<< `)
      .replace(/\\<<<<<<<< /g, `<<<<<<<< `)
      .replace(/\\=======/g, `=======`)
      .replace(/\\>>>>>>> /g, `>>>>>>> `)
      .replace(/\\>>>>>>>> /g, `>>>>>>>> `)
      .replace(/\\-------/g, `-------`)
  }

  private async applySingleDiff(
    originalContent: string,
    diffContent: string,
    _paramStartLine?: number,
  ): Promise<DiffResult> {
    const validseq = this.validateMarkerSequencing(diffContent)
    if (!validseq.success) {
      return {
        success: false,
        error: validseq.error!,
      }
    }

    const matches = [
      ...diffContent.matchAll(
        // eslint-disable-next-line regexp/no-useless-assertions, regexp/no-super-linear-backtracking, regexp/no-useless-non-capturing-group, regexp/no-useless-escape, regexp/strict
        /(?:^|\n)(?<!\\)(?:<<<<<<< |<<<<<<<< )SEARCH>?\s*\n((?:\:start_line:\s*(\d+)\s*\n))?((?:\:end_line:\s*(\d+)\s*\n))?((?<!\\)-------\s*\n)?([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)=======\s*\n)([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)(?:>>>>>>> |>>>>>>>> )REPLACE<?)(?=\n|$)/g,
      ),
    ]

    if (matches.length === 0) {
      return {
        success: false,
        error: `Invalid diff format - missing required sections\n\nDebug Info:\n- Expected Format: <<<<<<< SEARCH\\n:start_line: start line\\n-------\\n[search content]\\n=======\\n[replace content]\\n>>>>>>> REPLACE\n- Tip: Make sure to include start_line/SEARCH/=======/REPLACE sections with correct markers on new lines`,
      }
    }

    const lineEnding = originalContent.includes(`\r\n`) ? `\r\n` : `\n`
    let resultLines = originalContent.split(/\r?\n/)
    let delta = 0
    const diffResults: DiffResult[] = []
    let appliedCount = 0
    const modifiedSections: string[] = []

    const replacements = matches
      .map(match => ({
        startLine: _paramStartLine ?? Number(match[2] ?? 0),
        searchContent: match[6],
        replaceContent: match[7],
      }))
      .sort((a, b) => a.startLine - b.startLine)

    for (const replacement of replacements) {
      let { searchContent, replaceContent } = replacement
      let startLine = replacement.startLine + (replacement.startLine === 0 ? 0 : delta)

      searchContent = this.unescapeMarkers(searchContent)
      replaceContent = this.unescapeMarkers(replaceContent)

      const hasAllLineNumbers
        = (everyLineHasLineNumbers(searchContent) && everyLineHasLineNumbers(replaceContent))
          || (everyLineHasLineNumbers(searchContent) && replaceContent.trim() === ``)

      if (hasAllLineNumbers && startLine === 0) {
        startLine = Number.parseInt(searchContent.split(`\n`)[0].split(`|`)[0])
      }

      if (hasAllLineNumbers) {
        searchContent = stripLineNumbers(searchContent)
        replaceContent = stripLineNumbers(replaceContent)
      }

      if (searchContent === replaceContent) {
        diffResults.push({
          success: false,
          error:
            `Search and replace content are identical - no changes would be made\n\n`
            + `Debug Info:\n`
            + `- Search and replace must be different to make changes\n`
            + `- Use read_file to verify the content you want to change`,
        })
        continue
      }

      const searchLines = searchContent === `` ? [] : searchContent.split(/\r?\n/)
      let replaceLines = replaceContent === `` ? [] : replaceContent.split(/\r?\n/)

      if (searchLines.length === 0) {
        diffResults.push({
          success: false,
          error: `Empty search content is not allowed\n\nDebug Info:\n- Search content cannot be empty\n- For insertions, provide a specific line using :start_line: and include content to search for\n- For example, match a single line to insert before/after it`,
        })
        continue
      }

      let matchIndex = -1
      let bestMatchScore = 0
      let bestMatchContent = ``
      const searchChunk = searchLines.join(`\n`)

      let searchStartIndex = 0
      let searchEndIndex = resultLines.length

      if (startLine) {
        const exactStartIndex = startLine - 1
        const searchLen = searchLines.length
        const exactEndIndex = exactStartIndex + searchLen - 1

        const originalChunk = resultLines.slice(exactStartIndex, exactEndIndex + 1).join(`\n`)
        const similarity = getSimilarity(originalChunk, searchChunk)

        if (similarity >= this.fuzzyThreshold) {
          matchIndex = exactStartIndex
          bestMatchScore = similarity
          bestMatchContent = originalChunk
        }
        else {
          searchStartIndex = Math.max(0, startLine - (this.bufferLines + 1))
          searchEndIndex = Math.min(resultLines.length, startLine + searchLines.length + this.bufferLines)
        }
      }

      if (matchIndex === -1) {
        const {
          bestScore,
          bestMatchIndex,
          bestMatchContent: midContent,
        } = fuzzySearch(resultLines, searchChunk, searchStartIndex, searchEndIndex)

        matchIndex = bestMatchIndex
        bestMatchScore = bestScore
        bestMatchContent = midContent
      }

      if (matchIndex === -1 || bestMatchScore < this.fuzzyThreshold) {
        const aggressiveSearchContent = stripLineNumbers(searchContent, true)
        const aggressiveReplaceContent = stripLineNumbers(replaceContent, true)
        const aggressiveSearchLines = aggressiveSearchContent ? aggressiveSearchContent.split(/\r?\n/) : []
        const aggressiveSearchChunk = aggressiveSearchLines.join(`\n`)

        const {
          bestScore,
          bestMatchIndex,
          bestMatchContent: aggContent,
        } = fuzzySearch(resultLines, aggressiveSearchChunk, searchStartIndex, searchEndIndex)

        if (bestMatchIndex !== -1 && bestScore >= this.fuzzyThreshold) {
          matchIndex = bestMatchIndex
          bestMatchScore = bestScore
          bestMatchContent = aggContent

          searchContent = aggressiveSearchContent
          replaceContent = aggressiveReplaceContent
          replaceLines = replaceContent ? replaceContent.split(/\r?\n/) : []
        }
        else {
          const originalContentSection
            = startLine !== undefined
              ? `\n\nOriginal Content:\n${addLineNumbers(
                resultLines
                  .slice(
                    Math.max(0, startLine - 1 - this.bufferLines),
                    Math.min(resultLines.length, startLine + searchLines.length + this.bufferLines),
                  )
                  .join(`\n`),
                Math.max(1, startLine - this.bufferLines),
              )}`
              : `\n\nOriginal Content:\n${addLineNumbers(resultLines.join(`\n`))}`

          const bestMatchSection = bestMatchContent
            ? `\n\nBest Match Found:\n${addLineNumbers(bestMatchContent, matchIndex + 1)}`
            : `\n\nBest Match Found:\n(no match)`

          const lineRange = startLine ? ` at line: ${startLine}` : ``

          diffResults.push({
            success: false,
            error: `No sufficiently similar match found${lineRange} (${Math.floor(
              bestMatchScore * 100,
            )}% similar, needs ${Math.floor(
              this.fuzzyThreshold * 100,
            )}%)\n\nDebug Info:\n- Similarity Score: ${Math.floor(
              bestMatchScore * 100,
            )}%\n- Required Threshold: ${Math.floor(this.fuzzyThreshold * 100)}%\n- Search Range: ${
              startLine ? `starting at line ${startLine}` : `start to end`
            }\n- Tried both standard and aggressive line number stripping\n- Tip: Use the read_file tool to get the latest content of the file before attempting to use the apply_diff tool again, as the file content may have changed\n\nSearch Content:\n${searchChunk}${bestMatchSection}${originalContentSection}`,
          })
          continue
        }
      }

      const matchedLines = resultLines.slice(matchIndex, matchIndex + searchLines.length)

      const originalIndents = matchedLines.map((line) => {
        const match = line.match(/^[\t ]*/)
        return match ? match[0] : ``
      })

      const searchIndents = searchLines.map((line) => {
        const match = line.match(/^[\t ]*/)
        return match ? match[0] : ``
      })

      // 为修改的内容添加 Sandbox 修改标记
      const sectionId = `modified-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      modifiedSections.push(sectionId)

      const indentedReplaceLines = replaceLines.map((line, index) => {
        const matchedIndent = originalIndents[0] || ``
        const currentIndentMatch = line.match(/^[\t ]*/)
        const currentIndent = currentIndentMatch ? currentIndentMatch[0] : ``
        const searchBaseIndent = searchIndents[0] || ``

        const searchBaseLevel = searchBaseIndent.length
        const currentLevel = currentIndent.length
        const relativeLevel = currentLevel - searchBaseLevel

        const finalIndent
          = relativeLevel < 0
            ? matchedIndent.slice(0, Math.max(0, matchedIndent.length + relativeLevel))
            : matchedIndent + currentIndent.slice(searchBaseLevel)

        let processedLine = finalIndent + line.trim()

        // 为 section 标签添加修改标记
        if (index === 0 && processedLine.match(/<section[^>]*>/i)) {
          processedLine = processedLine.replace(
            /<section([^>]*)>/i,
            `<section$1 ${SANDBOX_MODIFIED_ATTR}="true" data-element-id="${sectionId}">`,
          )
        }

        return processedLine
      })

      const beforeMatch = resultLines.slice(0, matchIndex)
      const afterMatch = resultLines.slice(matchIndex + searchLines.length)
      resultLines = [...beforeMatch, ...indentedReplaceLines, ...afterMatch]

      delta = delta - matchedLines.length + replaceLines.length
      appliedCount++
    }

    const finalContent = resultLines.join(lineEnding)

    if (appliedCount === 0) {
      return {
        success: false,
        failParts: diffResults,
      }
    }

    return {
      success: true,
      content: finalContent,
      failParts: diffResults.length > 0 ? diffResults : undefined,
      modifiedSections,
    }
  }
}

// 辅助函数

function unescapeHtmlEntities(text: string): string {
  if (!text)
    return text

  return text
    .replace(/&lt;/g, `<`)
    .replace(/&gt;/g, `>`)
    .replace(/&quot;/g, `"`)
    .replace(/&#39;/g, `'`)
    .replace(/&apos;/g, `'`)
    .replace(/&#91;/g, `[`)
    .replace(/&#93;/g, `]`)
    .replace(/&lsqb;/g, `[`)
    .replace(/&rsqb;/g, `]`)
    .replace(/&amp;/g, `&`)
}

function everyLineHasLineNumbers(content: string): boolean {
  if (!content || content.trim() === ``)
    return false
  const lines = content.split(`\n`)
  return lines.every(line => /^\s*\d+\s*\|/.test(line))
}

function stripLineNumbers(content: string, aggressive = false): string {
  if (!content)
    return content
  const lines = content.split(`\n`)
  return lines
    .map((line) => {
      if (aggressive) {
        return line.replace(/^\s*\d+\s*\|\s?/, ``)
      }
      return line.replace(/^\s*\d+\s*\|/, ``)
    })
    .join(`\n`)
}

function addLineNumbers(content: string, startLine = 1): string {
  const lines = content.split(`\n`)
  return lines.map((line, index) => `${startLine + index}|${line}`).join(`\n`)
}

function getSimilarity(a: string, b: string): number {
  if (a === b)
    return 1
  if (!a || !b)
    return 0

  const aLower = a.toLowerCase().trim()
  const bLower = b.toLowerCase().trim()

  if (aLower === bLower)
    return 0.99

  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0)
    return 1

  const distance = levenshteinDistance(a, b)
  return 1 - distance / maxLen
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      }
      else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

function fuzzySearch(
  lines: string[],
  searchChunk: string,
  startIndex: number,
  endIndex: number,
): { bestScore: number, bestMatchIndex: number, bestMatchContent: string } {
  let bestScore = 0
  let bestMatchIndex = -1
  let bestMatchContent = ``

  const searchLines = searchChunk.split(`\n`)
  const searchLen = searchLines.length

  for (let i = startIndex; i <= endIndex - searchLen; i++) {
    const chunk = lines.slice(i, i + searchLen).join(`\n`)
    const score = getSimilarity(chunk, searchChunk)

    if (score > bestScore) {
      bestScore = score
      bestMatchIndex = i
      bestMatchContent = chunk
    }
  }

  return { bestScore, bestMatchIndex, bestMatchContent }
}

// 导出公有方法，用于创建 Sandbox
export function createHtmlSandbox(
  sandboxStore: HtmlSandbox,
  htmlContent: string,
): void {
  sandboxStore.createSandbox(htmlContent)
}
