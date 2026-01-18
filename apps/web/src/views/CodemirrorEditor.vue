<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

import { Compartment, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { highlightPendingBlocks, hljs } from '@md/core'
import { themeMap } from '@md/shared/configs'
import { theme as codeMirrorTheme, markdownSetup, truncateBase64Images } from '@md/shared/editor'
import imageCompression from 'browser-image-compression'
import { Eye, Palette, Pen } from 'lucide-vue-next'
import { SidebarAIToolbar } from '@/components/ai'
import AIAssistantSidebar from '@/components/ai/AIAssistantSidebar.vue'
import { HtmlEditorView, HtmlPreviewPanel, useHtmlEditorStore } from '@/components/editor/html-editor'
import TemplateGallery from '@/components/editor/TemplateGallery.vue'

import { Button } from '@/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { SearchTab } from '@/components/ui/search-tab'
import { useCssEditorStore } from '@/stores/cssEditor'
import { useDisplayStore } from '@/stores/display'
import { useEditorStore } from '@/stores/editor'
import { usePostStore } from '@/stores/post'
import { useRenderStore } from '@/stores/render'
import { useThemeStore } from '@/stores/theme'
import { useUIStore } from '@/stores/ui'
import { checkImage, toBase64 } from '@/utils'
import { fileUpload } from '@/utils/file'

const editorStore = useEditorStore()
const postStore = usePostStore()
const renderStore = useRenderStore()
const themeStore = useThemeStore()
const uiStore = useUIStore()
const cssEditorStore = useCssEditorStore()
const displayStore = useDisplayStore()
const htmlEditorStore = useHtmlEditorStore()

const { editor } = storeToRefs(editorStore)
const { output } = storeToRefs(renderStore)
const { isDark } = storeToRefs(uiStore)
const { posts, currentPostIndex } = storeToRefs(postStore)
const { previewWidth, theme } = storeToRefs(themeStore)
const { isHtmlMode, htmlContent, showHtmlEditor } = storeToRefs(htmlEditorStore)

const {
  isMobile,
  isEditOnLeft,
  isOpenPostSlider,
  isOpenRightSlider,
  isOpenAIPanel,
  isOpenConfirmDialog,
} = storeToRefs(uiStore)

const { toggleShowUploadImgDialog } = displayStore

// Editor refresh function
function editorRefresh() {
  themeStore.updateCodeTheme()

  // const raw = editorStore.getContent()
  let raw: string
  if (isHtmlMode.value) {
    raw = htmlEditorStore.htmlContent
  }
  else {
    ensureRenderer()
    raw = editorStore.getContent()
  }
  renderStore.render(raw, {
    isCiteStatus: themeStore.isCiteStatus,
    legend: themeStore.legend,
    isUseIndent: themeStore.isUseIndent,
    isUseJustify: themeStore.isUseJustify,
    isCountStatus: themeStore.isCountStatus,
    isMacCodeBlock: themeStore.isMacCodeBlock,
    isShowLineNumber: themeStore.isShowLineNumber,
  })
}

// Reset style function
function resetStyle() {
  themeStore.resetStyle()
  cssEditorStore.resetCssConfig()
  renderStore.updateCss(cssEditorStore.getCurrentTabContent())
  editorRefresh()
  toast.success(`样式已重置`)
}

watch(output, () => {
  nextTick(() => {
    const outputElement = document.getElementById(`output`)
    if (outputElement) {
      highlightPendingBlocks(hljs, outputElement)
    }
  })
})

const backLight = ref(false)
const isCoping = ref(false)

// 辅助函数：查找 CodeMirror 滚动容器
function findCodeMirrorScroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.cm-scroller`)
    || document.querySelector<HTMLElement>(`.CodeMirror-scroll`)
}

function startCopy() {
  backLight.value = true
  isCoping.value = true
}

// 拷贝结束
function endCopy() {
  backLight.value = false
  setTimeout(() => {
    isCoping.value = false
  }, 800)
}

const showEditor = ref(true)
const showTemplateGallery = ref(false)

interface TemplateApplyPayload {
  themeKey: keyof typeof themeMap
  primaryColor: string
  name: string
}

const htmlTemplates: Partial<Record<TemplateApplyPayload[`themeKey`], (content: string) => string>> = {
  aurora: content => `
    <style>
      .tpl-aurora { background: linear-gradient(145deg, rgba(99,179,237,0.08), rgba(123,97,255,0.08)); padding: 16px; border-radius: 16px; }
      .tpl-aurora-inner { background: #fff; border-radius: 14px; padding: 18px; box-shadow: 0 14px 32px rgba(62,118,244,0.16); }
      .tpl-aurora-inner h1, .tpl-aurora-inner h2, .tpl-aurora-inner h3, .tpl-aurora-inner h4 { color: #0f172a; }
      .tpl-aurora-inner p { color: #0f172a; line-height: 1.8; }
      .tpl-aurora-inner code { background: rgba(15,23,42,0.12); padding: 3px 6px; border-radius: 6px; }
      .tpl-aurora-inner pre { background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 12px; }
    </style>
    <div class="tpl-aurora">
      <div class="tpl-aurora-inner">
        ${content || `<p>在这里添加你的内容</p>`}
      </div>
    </div>
  `,
  notebook: content => `
    <style>
      .tpl-notebook { background: #f9f4ec; padding: 16px; border-radius: 18px; }
      .tpl-notebook-inner { background: #fdfaf3; border: 1px solid rgba(196,122,68,0.16); box-shadow: 0 14px 28px rgba(201,164,116,0.14); border-radius: 14px; padding: 18px; }
      .tpl-notebook-inner h1, .tpl-notebook-inner h2, .tpl-notebook-inner h3, .tpl-notebook-inner h4 { color: #5b3b1a; }
      .tpl-notebook-inner p { color: #3b2f26; line-height: 1.8; }
      .tpl-notebook-inner code { background: rgba(196,122,68,0.14); padding: 3px 6px; border-radius: 6px; color: #5b3b1a; }
      .tpl-notebook-inner pre { background: #111827; color: #fef9ee; border-radius: 12px; padding: 12px; }
    </style>
    <div class="tpl-notebook">
      <div class="tpl-notebook-inner">
        ${content || `<p>在这里添加你的内容</p>`}
      </div>
    </div>
  `,
  plaza: content => `
    <style>
      .tpl-plaza { background: linear-gradient(145deg, rgba(37,99,235,0.12), rgba(123,97,255,0.12)); padding: 16px; border-radius: 18px; }
      .tpl-plaza-inner { background: #fff; border: 1px solid rgba(37,99,235,0.14); border-radius: 16px; padding: 18px; box-shadow: 0 12px 28px rgba(37,99,235,0.15); }
      .tpl-plaza-inner h1, .tpl-plaza-inner h2, .tpl-plaza-inner h3, .tpl-plaza-inner h4 { color: #0f172a; }
      .tpl-plaza-inner p { color: #1f2937; line-height: 1.85; }
      .tpl-plaza-inner code { background: rgba(37,99,235,0.08); padding: 3px 6px; border-radius: 6px; color: #1d4ed8; }
      .tpl-plaza-inner pre { background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 12px; }
    </style>
    <div class="tpl-plaza">
      <div class="tpl-plaza-inner">
        ${content || `<p>在这里添加你的内容</p>`}
      </div>
    </div>
  `,
  sunset: content => `
    <style>
      .tpl-sunset { background: linear-gradient(145deg, rgba(249,115,22,0.14), rgba(244,114,182,0.12)); padding: 16px; border-radius: 18px; }
      .tpl-sunset-inner { background: #fffaf5; border: 1px solid rgba(249,115,22,0.2); border-radius: 16px; padding: 18px; box-shadow: 0 12px 26px rgba(249,115,22,0.16); }
      .tpl-sunset-inner h1, .tpl-sunset-inner h2, .tpl-sunset-inner h3, .tpl-sunset-inner h4 { color: #7c2d12; }
      .tpl-sunset-inner p { color: #4a2c16; line-height: 1.85; }
      .tpl-sunset-inner code { background: rgba(249,115,22,0.1); padding: 3px 6px; border-radius: 6px; color: #c2410c; }
      .tpl-sunset-inner pre { background: #0f172a; color: #fef9ee; border-radius: 12px; padding: 12px; }
    </style>
    <div class="tpl-sunset">
      <div class="tpl-sunset-inner">
        ${content || `<p>在这里添加你的内容</p>`}
      </div>
    </div>
  `,
  ink: content => `
    <style>
      .tpl-ink { background: linear-gradient(135deg, #0b1220, #0f172a); padding: 16px; border-radius: 18px; border: 1px solid rgba(209,177,122,0.26); }
      .tpl-ink-inner { background: rgba(15,23,42,0.9); border-radius: 16px; padding: 18px; box-shadow: 0 14px 32px rgba(0,0,0,0.32); border: 1px solid rgba(209,177,122,0.22); }
      .tpl-ink-inner h1, .tpl-ink-inner h2, .tpl-ink-inner h3, .tpl-ink-inner h4 { color: #f7f3ea; }
      .tpl-ink-inner p { color: #cbd5e1; line-height: 1.9; }
      .tpl-ink-inner code { background: rgba(209,177,122,0.12); padding: 3px 6px; border-radius: 6px; color: #f7f3ea; }
      .tpl-ink-inner pre { background: #0b1220; color: #f7f3ea; border-radius: 12px; padding: 12px; border: 1px solid rgba(209,177,122,0.2); }
    </style>
    <div class="tpl-ink">
      <div class="tpl-ink-inner">
        ${content || `<p>在这里添加你的内容</p>`}
      </div>
    </div>
  `,
}

function buildHtmlWithTemplate(themeKey: TemplateApplyPayload[`themeKey`], content: string) {
  const builder = htmlTemplates[themeKey]
  return builder ? builder(content) : content
}

function ensureRenderer() {
  if (renderStore.getRenderer())
    return

  renderStore.initRendererInstance(
    cssEditorStore.getCurrentTabContent(),
    themeMap[themeStore.theme],
    themeStore.fontFamily,
    themeStore.fontSize,
    {
      primaryColor: themeStore.primaryColor,
      isUseIndent: themeStore.isUseIndent,
      isUseJustify: themeStore.isUseJustify,
      isMacCodeBlock: themeStore.isMacCodeBlock,
      isShowLineNumber: themeStore.isShowLineNumber,
    },
  )
}

function toggleTemplateGallery() {
  showTemplateGallery.value = !showTemplateGallery.value
  // 确保移动端在模板模式下也能看到左侧区域
  if (showTemplateGallery.value)
    showEditor.value = true
}

function closeTemplateGallery() {
  showTemplateGallery.value = false
}

function applyTemplateFromGallery(payload: TemplateApplyPayload) {
  const { themeKey, primaryColor, name } = payload
  // HTML 模式：直接生成带样式的 HTML 模板，不再切换到 Markdown
  if (isHtmlMode.value) {
    const html = buildHtmlWithTemplate(themeKey, htmlEditorStore.htmlContent)
    htmlEditorStore.setHtmlContent(html)
    editorRefresh()
    toast.success(`已应用「${name}」模板（HTML）`)
    closeTemplateGallery()
    return
  }

  ensureRenderer()
  themeStore.theme = themeKey
  if (primaryColor)
    themeStore.primaryColor = primaryColor

  renderStore.updateTheme(
    cssEditorStore.getCurrentTabContent(),
    themeMap[themeKey],
    themeStore.fontFamily,
    themeStore.fontSize,
    primaryColor || themeStore.primaryColor,
  )

  editorRefresh()
  toast.success(`已应用「${name}」模板`)
  closeTemplateGallery()
}

// 切换编辑/预览视图（仅限移动端）
function toggleView() {
  showEditor.value = !showEditor.value
}

// AI 工具箱已移到侧边栏

const previewRef = useTemplateRef<HTMLDivElement>(`previewRef`)
const htmlEditorRef = useTemplateRef<InstanceType<typeof HtmlEditorView>>(`htmlEditorRef`)

const timeout = ref<NodeJS.Timeout>()
const codeMirrorView = ref<EditorView | null>(null)
const themeCompartment = new Compartment()
const changeTimer = ref<NodeJS.Timeout>()

// 使浏览区与编辑区滚动条建立同步联系
function leftAndRightScroll() {
  const scrollCB = (text: string) => {
    // AIPolishBtnRef.value?.close()

    let source: HTMLElement | null
    let target: HTMLElement | null

    clearTimeout(timeout.value)
    if (text === `preview`) {
      source = previewRef.value
      target = findCodeMirrorScroller()
      if (!source) {
        console.warn(`Cannot find preview container`)
        return
      }
      if (!target) {
        console.warn(`Cannot find CodeMirror scroll container`)
        return
      }
      // CodeMirror v6 使用 DOM 事件
      const scrollEl = findCodeMirrorScroller()
      if (scrollEl) {
        scrollEl.removeEventListener(`scroll`, editorScrollCB)
        timeout.value = setTimeout(() => {
          if (scrollEl) {
            scrollEl.addEventListener(`scroll`, editorScrollCB)
          }
        }, 300)
      }
    }
    else {
      source = findCodeMirrorScroller()
      target = previewRef.value
      if (!source) {
        console.warn(`Cannot find CodeMirror scroll container`)
        return
      }
      if (!target) {
        console.warn(`Cannot find preview container`)
        return
      }

      // 防止都滚动的冲突，先去除监听滚的事件，本次滚动结束后再恢复监听。
      target.removeEventListener(`scroll`, previewScrollCB, false)
      timeout.value = setTimeout(() => {
        if (target) {
          target.addEventListener(`scroll`, previewScrollCB, false)
        }
      }, 300)
    }

    if (!source || !target) {
      return
    }

    const sourceHeight = source.scrollHeight - source.offsetHeight
    const targetHeight = target.scrollHeight - target.offsetHeight

    if (sourceHeight <= 0 || targetHeight <= 0) {
      return
    }

    const percentage = source.scrollTop / sourceHeight
    const height = percentage * targetHeight

    target.scrollTo(0, height)
  }

  function editorScrollCB() {
    scrollCB(`editor`)
  }

  function previewScrollCB() {
    scrollCB(`preview`)
  }

  if (previewRef.value) {
    previewRef.value.addEventListener(`scroll`, previewScrollCB, false)
  }
  const scrollEl = findCodeMirrorScroller()
  if (scrollEl) {
    scrollEl.addEventListener(`scroll`, editorScrollCB)
  }
}

onMounted(() => {
  setTimeout(() => {
    leftAndRightScroll()
  }, 300)
})

const searchTabRef
  = useTemplateRef<InstanceType<typeof SearchTab>>(`searchTabRef`)

// 用于存储待处理的搜索请求
const pendingSearchRequest = ref<{ selected: string } | null>(null)

function openSearchWithSelection(view: EditorView) {
  const selection = view.state.selection.main
  const selected = view.state.doc.sliceString(selection.from, selection.to).trim()

  if (searchTabRef.value) {
    // SearchTab 已准备好，直接使用
    if (selected) {
      searchTabRef.value.setSearchWord(selected)
    }
    else {
      searchTabRef.value.showSearchTab = true
    }
  }
  else {
    // SearchTab 还没准备好，保存请求
    pendingSearchRequest.value = { selected }
  }
}

// 监听 searchTabRef 的变化，处理待处理的请求
watch(searchTabRef, (newRef) => {
  if (newRef && pendingSearchRequest.value) {
    const { selected } = pendingSearchRequest.value
    if (selected) {
      newRef.setSearchWord(selected)
    }
    else {
      newRef.showSearchTab = true
    }
    pendingSearchRequest.value = null
  }
})

function handleGlobalKeydown(e: KeyboardEvent) {
  // 处理 ESC 键关闭搜索
  const editorView = codeMirrorView.value

  if (e.key === `Escape` && searchTabRef.value?.showSearchTab) {
    searchTabRef.value.showSearchTab = false
    e.preventDefault()
    editorView?.focus()
  }
}

onMounted(() => {
  // 使用较低优先级确保 CodeMirror 键盘事件先处理
  document.addEventListener(`keydown`, handleGlobalKeydown, { passive: false, capture: false })
})

function beforeUpload(file: File) {
  // validate image
  const checkResult = checkImage(file)
  if (!checkResult.ok) {
    toast.error(checkResult.msg)
    return false
  }

  // check image host
  const imgHost = localStorage.getItem(`imgHost`) || `default`
  localStorage.setItem(`imgHost`, imgHost)

  const config = localStorage.getItem(`${imgHost}Config`)
  const isValidHost = imgHost === `default` || config
  if (!isValidHost) {
    toast.error(`请先配置 ${imgHost} 图床参数`)
    return false
  }

  return true
}

// 图片上传结束
function uploaded(imageUrl: string) {
  if (!imageUrl) {
    toast.error(`上传图片未知异常`)
    return
  }
  setTimeout(() => {
    toggleShowUploadImgDialog(false)
  }, 1000)
  // 上传成功，插入图片
  const markdownImage = `![](${imageUrl})`
  // 将 Markdown 形式的 URL 插入编辑框光标所在位置
  if (codeMirrorView.value) {
    codeMirrorView.value.dispatch(codeMirrorView.value.state.replaceSelection(`\n${markdownImage}\n`))
  }
  toast.success(`图片上传成功`)
}

const isImgLoading = ref(false)
async function compressImage(file: File) {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  }
  const compressedFile = await imageCompression(file, options)
  return compressedFile
}
async function uploadImage(
  file: File,
  cb?: { (url: any, data: string): void, (arg0: unknown): void } | undefined,
  applyUrl?: boolean,
) {
  try {
    isImgLoading.value = true
    // compress image if useCompression is true
    const useCompression = localStorage.getItem(`useCompression`) === `true`
    if (useCompression) {
      file = await compressImage(file)
    }
    const base64Content = await toBase64(file)
    const url = await fileUpload(base64Content, file)
    if (cb) {
      cb(url, base64Content)
    }
    else {
      uploaded(url)
    }
    if (applyUrl) {
      return uploaded(url)
    }
  }
  catch (err) {
    toast.error((err as any).message)
  }
  finally {
    isImgLoading.value = false
  }
}

// 从文件列表中查找一个 md 文件并解析
async function getMd({ list }: { list: { path: string, file: File }[] }) {
  return new Promise<{ str: string, file: File, path: string }>((resolve) => {
    const { path, file } = list.find(item => item.path.match(/\.md$/))!
    const reader = new FileReader()
    reader.readAsText(file!, `UTF-8`)
    reader.onload = (evt) => {
      resolve({
        str: evt.target!.result as string,
        file,
        path,
      })
    }
  })
}

// 转换文件系统句柄中的文件为文件列表
async function showFileStructure(root: any) {
  const result = []
  let cwd = ``
  try {
    const dirs = [root]
    for (const dir of dirs) {
      cwd += `${dir.name}/`
      for await (const [, handle] of dir) {
        if (handle.kind === `file`) {
          result.push({
            path: cwd + handle.name,
            file: await handle.getFile(),
          })
        }
        else {
          result.push({
            path: `${cwd + handle.name}/`,
          })
          dirs.push(handle)
        }
      }
    }
  }
  catch (err) {
    console.error(err)
  }
  return result
}

// 上传 md 中的图片
async function uploadMdImg({
  md,
  list,
}: {
  md: { str: string, path: string, file: File }
  list: { path: string, file: File }[]
}) {
  // 获取所有相对地址的图片
  const mdImgList = [...(md.str.matchAll(/!\[(.*?)\]\((.*?)\)/g) || [])].filter(item => item)
  const root = md.path.match(/.+?\//)![0]
  const resList = await Promise.all<{ matchStr: string, url: string }>(
    mdImgList.map((item) => {
      return new Promise((resolve) => {
        let [, , matchStr] = item
        matchStr = matchStr.replace(/^.\//, ``) // 处理 ./img/ 为 img/ 统一相对路径风格
        const { file }
          = list.find(f => f.path === `${root}${matchStr}`) || {}
        uploadImage(file!, url => resolve({ matchStr, url }))
      })
    }),
  )
  resList.forEach((item) => {
    md.str = md.str
      .replace(`](./${item.matchStr})`, `](${item.url})`)
      .replace(`](${item.matchStr})`, `](${item.url})`)
  })
  if (codeMirrorView.value) {
    codeMirrorView.value.dispatch({
      changes: { from: 0, to: codeMirrorView.value.state.doc.length, insert: md.str },
    })
  }
}

const codeMirrorWrapper = useTemplateRef<ComponentPublicInstance<HTMLDivElement>>(`codeMirrorWrapper`)
const editorRef = useTemplateRef<HTMLDivElement>(`editorRef`)

// 转换 markdown 中的本地图片为线上图片
// todo 处理事件覆盖
function mdLocalToRemote() {
  const dom = codeMirrorWrapper.value!

  dom.ondragover = evt => evt.preventDefault()
  dom.ondrop = async (evt) => {
    evt.preventDefault()
    if (evt.dataTransfer == null || !Array.isArray(evt.dataTransfer.items)) {
      return
    }

    for (const item of evt.dataTransfer.items.filter(item => item.kind === `file`)) {
      item
        .getAsFileSystemHandle()
        .then(async (handle: { kind: string, getFile: () => any }) => {
          if (handle.kind === `directory`) {
            const list = (await showFileStructure(handle)) as {
              path: string
              file: File
            }[]
            const md = await getMd({ list })
            uploadMdImg({ md, list })
          }
          else {
            const file = await handle.getFile()
            console.log(`file`, file)
            beforeUpload(file) && uploadImage(file)
          }
        })
    }
  }
}

// html 内容变化
function handleHtmlContentChange(content: string) {
  const currentPost = posts.value[currentPostIndex.value]
  if (!currentPost)
    return

  clearTimeout(changeTimer.value)
  changeTimer.value = setTimeout(() => {
    if (content !== currentPost.content) {
      currentPost.content = content
      currentPost.updateDatetime = new Date()
    }
    editorRefresh()
  }, 300)
}

watch(isHtmlMode, (newMode) => {
  const currentPost = posts.value[currentPostIndex.value]
  if (!currentPost)
    return

  if (newMode) {
    htmlEditorStore.setHtmlContent(currentPost.content)
    nextTick(() => {
      const editorRef = htmlEditorRef.value
      if (editorRef?.setContent) {
        editorRef.setContent(currentPost.content)
      }
      editorRefresh()
    })
  }
  else {
    // 切换到 Markdown 模式
    if (codeMirrorView.value) {
      const currentContent = codeMirrorView.value.state.doc.toString()
      if (currentContent !== currentPost.content) {
        codeMirrorView.value.dispatch({
          changes: {
            from: 0,
            to: codeMirrorView.value.state.doc.length,
            insert: currentPost.content,
          },
        })
      }
    }
    else {
      // 如果编辑器还未创建，则创建它
      const editorDom = editorRef.value
      if (editorDom) {
        createFormTextArea(editorDom)
      }
    }
    editorRefresh()
  }
})

// 监听html内容变化
watch(htmlContent, (newContent) => {
  if (isHtmlMode.value) {
    handleHtmlContentChange(newContent)
  // codeMirrorView.value?.dispatch({
  //   changes: { from: 0, to: codeMirrorView.value.state.doc.length, insert: newContent },
  // })
  }
})

const progressValue = ref(0)

function createFormTextArea(dom: HTMLDivElement) {
  // 创建编辑器状态
  const state = EditorState.create({
    doc: posts.value[currentPostIndex.value].content,
    extensions: [
      markdownSetup({
        onSearch: openSearchWithSelection,
      }),
      truncateBase64Images(), // 截断 base64 图片数据显示
      themeCompartment.of(codeMirrorTheme(isDark.value)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const value = update.state.doc.toString()
          clearTimeout(changeTimer.value)
          changeTimer.value = setTimeout(() => {
            editorRefresh()

            const currentPost = posts.value[currentPostIndex.value]
            if (value === currentPost.content) {
              return
            }

            currentPost.updateDatetime = new Date()
            currentPost.content = value
          }, 300)
        }
      }),
    ],
  })

  // 创建编辑器视图
  const view = new EditorView({
    state,
    parent: dom,
  })

  codeMirrorView.value = view
  editor.value = view // 同时赋值给 editorStore 的 editor

  // 添加粘贴事件监听
  view.dom.addEventListener(`paste`, async (event: ClipboardEvent) => {
    if (!(event.clipboardData?.items) || isImgLoading.value) {
      return
    }
    const items = [...event.clipboardData.items].map(item => item.getAsFile()).filter(item => item != null && beforeUpload(item)) as File[]
    // 即使return了，粘贴的文本内容也会被插入
    if (items.length === 0) {
      return
    }
    // start progress
    const intervalId = setInterval(() => {
      const newProgress = progressValue.value + 1
      if (newProgress >= 100) {
        return
      }
      progressValue.value = newProgress
    }, 100)
    for (const item of items) {
      event.preventDefault()
      await uploadImage(item)
    }
    const cleanup = () => {
      clearInterval(intervalId)
      progressValue.value = 100 // 设置完成状态
      // 可选：延迟一段时间后重置进度
      setTimeout(() => {
        progressValue.value = 0
      }, 1000)
    }
    cleanup()
  })

  // 返回编辑器 view
  return view
}

// 初始化编辑器
onMounted(() => {
  const editorDom = editorRef.value

  if (editorDom == null) {
    return
  }

  // 暂时不需要强制切换，只支持html格式
  // 检查当前内容，如果是 Markdown 格式的默认内容，强制切换到 Markdown 模式
  // const currentPost = posts.value[currentPostIndex.value]
  // if (currentPost?.content) {
  //   // 如果内容以 # 开头或包含典型的 Markdown 语法，且当前是 HTML 模式，切换到 Markdown 模式
  //   const isMarkdownContent = currentPost.content.startsWith(`#`)
  //     || currentPost.content.includes(`## `)
  //     || currentPost.content.includes(`### `)
  //     || (currentPost.content.includes(`探索 Markdown`) && !currentPost.content.includes(`<html`))

  //   if (isMarkdownContent && isHtmlMode.value) {
  //     htmlEditorStore.switchToMarkdown()
  //   }
  // }

  // 初始化渲染器
  const cssContent = cssEditorStore.getCurrentTabContent()
  renderStore.initRendererInstance(
    cssContent,
    themeMap[themeStore.theme],
    themeStore.fontFamily,
    themeStore.fontSize,
    {
      primaryColor: themeStore.primaryColor,
      isUseIndent: themeStore.isUseIndent,
      isUseJustify: themeStore.isUseJustify,
      isMacCodeBlock: themeStore.isMacCodeBlock,
      isShowLineNumber: themeStore.isShowLineNumber,
    },
  )

  nextTick(() => {
    if (isHtmlMode.value) {
      const currentPost = posts.value[currentPostIndex.value]
      if (currentPost) {
        htmlEditorStore.setHtmlContent(currentPost.content)
      }
    }
    else {
      const editorView = createFormTextArea(editorDom)
      editor.value = editorView
    }

    editorRefresh()
    mdLocalToRemote()
  })
})

// 监听暗色模式变化并更新编辑器主题
watch(isDark, () => {
  if (codeMirrorView.value) {
    codeMirrorView.value.dispatch({
      effects: themeCompartment.reconfigure(codeMirrorTheme(isDark.value)),
    })
  }
})

// 监听当前文章切换，更新编辑器内容
watch(currentPostIndex, () => {
  const currentPost = posts.value[currentPostIndex.value]
  if (!currentPost)
    return

  if (isHtmlMode.value) {
    htmlEditorStore.setHtmlContent(currentPost.content)
    nextTick(() => {
      const editorRef = htmlEditorRef.value
      if (editorRef?.setContent) {
        editorRef.setContent(currentPost.content)
      }
    })
    editorRefresh()
  }
  else {
    if (!codeMirrorView.value)
      return

    const currentContent = codeMirrorView.value.state.doc.toString()

    if (currentContent !== currentPost.content) {
      codeMirrorView.value.dispatch({
        changes: {
          from: 0,
          to: codeMirrorView.value.state.doc.length,
          insert: currentPost.content,
        },
      })

      editorRefresh()
    }
  }
})

// 历史记录的定时器
const historyTimer = ref<NodeJS.Timeout>()
onMounted(() => {
  // 定时，30 秒记录一次文章的历史记录
  historyTimer.value = setInterval(() => {
    const currentPost = posts.value[currentPostIndex.value]

    // 与最后一篇记录对比
    const pre = (currentPost.history || [])[0]?.content
    if (pre === currentPost.content) {
      return
    }

    currentPost.history ??= []
    currentPost.history.unshift({
      content: currentPost.content,
      datetime: new Date().toLocaleString(`zh-CN`),
    })

    currentPost.history.length = Math.min(currentPost.history.length, 10)
  }, 30 * 1000)
})

// 销毁时清理定时器和全局事件监听器
onUnmounted(() => {
  // 清理定时器 - 防止回调访问已销毁的DOM
  clearTimeout(historyTimer.value)
  clearTimeout(timeout.value)
  clearTimeout(changeTimer.value)

  // 清理全局事件监听器 - 防止全局事件触发已销毁的组件
  document.removeEventListener(`keydown`, handleGlobalKeydown)
})
</script>

<template>
  <div class="container flex flex-col">
    <Progress v-model="progressValue" class="absolute left-0 right-0 rounded-none" style="height: 2px;" />
    <EditorHeader
      @start-copy="startCopy"
      @end-copy="endCopy"
    />

    <main class="container-main flex flex-1 flex-col">
      <div
        class="container-main-section border-radius-10 relative flex flex-1 overflow-hidden border"
      >
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel
            :default-size="15"
            :max-size="isOpenPostSlider ? 30 : 0"
            :min-size="isOpenPostSlider ? 10 : 0"
          >
            <PostSlider />
          </ResizablePanel>
          <ResizableHandle class="hidden md:block" />
          <ResizablePanel class="flex">
            <div
              v-show="(!isMobile || (isMobile && showEditor)) && (!isHtmlMode || showHtmlEditor)"
              ref="codeMirrorWrapper"
              class="codeMirror-wrapper relative flex-1"
              :class="{
                'order-1 border-l': !isEditOnLeft,
                'border-r': isEditOnLeft,
              }"
            >
              <div class="template-toggle absolute left-3 top-3 z-30 flex gap-2">
                <Button size="sm" variant="secondary" class="shadow-sm" @click="toggleTemplateGallery">
                  <Palette class="mr-1 h-4 w-4" />
                  精美模板
                </Button>
                <Button
                  v-if="showTemplateGallery"
                  size="sm"
                  variant="outline"
                  class="shadow-sm"
                  @click="closeTemplateGallery"
                >
                  返回编辑
                </Button>
              </div>

              <TemplateGallery
                v-if="showTemplateGallery"
                :current-theme="theme"
                @apply="applyTemplateFromGallery"
                @close="closeTemplateGallery"
              />

              <template v-else>
                <SearchTab v-if="codeMirrorView && !isHtmlMode" ref="searchTabRef" :editor-view="codeMirrorView as any" />
                <SidebarAIToolbar
                  :is-mobile="isMobile"
                  :show-editor="showEditor"
                />

                <EditorContextMenu v-if="!isHtmlMode">
                  <div
                    id="editor"
                    ref="editorRef"
                    class="codemirror-container"
                  />
                </EditorContextMenu>
                <div v-else class="html-editor-wrapper h-full">
                  <HtmlEditorView
                    ref="htmlEditorRef"
                    @content-change="handleHtmlContentChange"
                  />
                </div>
              </template>
            </div>
            <div
              v-show="!isMobile || (isMobile && !showEditor)"
              class="relative flex-1 overflow-x-hidden transition-width"
              :class="[isOpenRightSlider ? 'w-0' : 'w-100']"
            >
              <div
                id="preview"
                ref="previewRef"
                class="preview-wrapper w-full p-5"
              >
                <div
                  id="output-wrapper"
                  class="w-full"
                  :class="{ output_night: !backLight }"
                >
                  <div
                    v-if="isHtmlMode"
                    class="preview border-x shadow-xl h-full"
                    :class="[isMobile ? 'w-[100%]' : previewWidth]"
                  >
                    <section id="output" class="w-full">
                      <HtmlPreviewPanel :html-content="htmlContent" />
                    </section>
                  </div>
                  <div
                    v-else
                    class="preview border-x shadow-xl"
                    :class="[isMobile ? 'w-[100%]' : previewWidth]"
                  >
                    <section id="output" class="w-full" v-html="output" />
                    <div v-if="isCoping" class="loading-mask">
                      <div class="loading-mask-box">
                        <div class="loading__img" />
                        <span>正在生成</span>
                      </div>
                    </div>
                  </div>
                </div>
                <BackTop
                  target="preview"
                  :right="isMobile ? 24 : 20"
                  :bottom="isMobile ? 90 : 20"
                />
              </div>

              <FloatingToc />
            </div>
            <CssEditor />
            <RightSlider />
          </ResizablePanel>
          <ResizableHandle
            v-if="isOpenAIPanel"
            class="hidden md:block"
          />
          <ResizablePanel
            v-if="isOpenAIPanel"
            :default-size="25"
            :min-size="20"
            :max-size="40"
            class="border-l"
          >
            <AIAssistantSidebar />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <!-- 移动端浮动按钮组 -->
      <div v-if="isMobile" class="fixed bottom-16 right-6 z-50 flex flex-col gap-2">
        <!-- 切换编辑/预览按钮 -->
        <button
          class="bg-primary flex items-center justify-center rounded-full p-3 text-white shadow-lg transition active:scale-95 hover:scale-105 dark:bg-gray-700 dark:text-white dark:ring-2 dark:ring-white/30"
          aria-label="切换编辑/预览"
          @click="toggleView"
        >
          <component :is="showEditor ? Eye : Pen" class="h-5 w-5" />
        </button>
      </div>

      <!-- AI工具箱已移到侧边栏，这里不再显示 -->

      <UploadImgDialog @upload-image="uploadImage" />

      <InsertFormDialog />

      <InsertMpCardDialog />

      <AlertDialog v-model:open="isOpenConfirmDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>提示</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将丢失本地自定义样式，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction @click="resetStyle">
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  </div>
</template>

<style lang="less" scoped>
@import url('../assets/less/app.less');
</style>

<style lang="less" scoped>
.container {
  height: 100vh;
  min-width: 100%;
  padding: 0;
}

.container-main {
  overflow: hidden;
}

#output-wrapper {
  position: relative;
  user-select: text;
  height: 100%;
}

.loading-mask {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  text-align: center;
  color: hsl(var(--foreground));
  background-color: hsl(var(--background));

  .loading-mask-box {
    position: sticky;
    top: 50%;
    transform: translateY(-50%);

    .loading__img {
      width: 75px;
      height: 75px;
      background: url('../assets/images/favicon.png') no-repeat;
      margin: 1em auto;
      background-size: cover;
    }
  }
}

:deep(.preview-table) {
  border-spacing: 0;
}

.codeMirror-wrapper,
.preview-wrapper {
  height: 100%;
}

.html-editor-wrapper {
  height: 100%;
  overflow: hidden;
}

.codeMirror-wrapper {
  overflow-x: hidden;
  height: 100%;
  position: relative;
}
</style>
