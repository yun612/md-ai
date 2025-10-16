<script setup lang="ts">
import type { Editor } from 'codemirror'
import type { ComponentPublicInstance } from 'vue'
import imageCompression from 'browser-image-compression'
import { fromTextArea } from 'codemirror'
import { Eye, Pen } from 'lucide-vue-next'
import { SidebarAIToolbar } from '@/components/ai'
import CursorStyleChatPanel from '@/components/ai/chat-box/CursorStyleChatPanel.vue'
import TextSelectionFloating from '@/components/ai/TextSelectionFloating.vue'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { SearchTab } from '@/components/ui/search-tab'
import { checkImage, toBase64 } from '@/utils'
import { createExtraKeys } from '@/utils/editor'
import { fileUpload } from '@/utils/file'

const store = useStore()
const displayStore = useDisplayStore()

const { isDark, output, editor } = storeToRefs(store)
const { editorRefresh } = store

const { toggleShowUploadImgDialog } = displayStore

const backLight = ref(false)
const isCoping = ref(false)

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

// 切换编辑/预览视图（仅限移动端）
function toggleView() {
  showEditor.value = !showEditor.value
}

/* ---------- 全局文本选中悬浮 ---------- */
const showTextFloating = ref(false)
const selectedText = ref(``)
const floatingPosition = ref({ x: 0, y: 0 })
let selectionTimer: NodeJS.Timeout | null = null

// 获取选中文本的精确位置
function getSelectionPosition() {
  const selection = window.getSelection()
  console.log(`Selection object:`, selection)

  if (!selection || selection.rangeCount === 0) {
    console.log(`No selection or no ranges`)
    return null
  }

  const range = selection.getRangeAt(0)
  const text = range.toString().trim()
  console.log(`Selected text:`, text)

  if (!text || text.length === 0) {
    console.log(`No text selected`)
    return null
  }

  // 使用getBoundingClientRect()获取位置信息
  const rect = range.getBoundingClientRect()
  console.log(`Selection rect:`, rect)

  if (rect.width === 0 && rect.height === 0) {
    console.log(`Invalid rect dimensions`)
    return null
  }

  return {
    x: rect.left + rect.width / 2,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    text,
  }
}

// 处理文本选中事件（带防抖）
function handleGlobalTextSelection() {
  console.log(`handleGlobalTextSelection called`)

  // 清除之前的定时器
  if (selectionTimer) {
    clearTimeout(selectionTimer)
  }

  // 设置防抖定时器
  selectionTimer = setTimeout(() => {
    const position = getSelectionPosition()
    console.log(`Selection position:`, position)

    if (position) {
      selectedText.value = position.text
      floatingPosition.value = {
        x: position.x,
        y: position.y,
      }
      showTextFloating.value = true
      console.log(`Showing floating toolbar:`, { text: position.text, position: floatingPosition.value })
    }
    else {
      showTextFloating.value = false
      selectedText.value = ``
      console.log(`Hiding floating toolbar`)
    }
  }, 50) // 50ms防抖，与豆包类似
}

// 处理selectionchange事件（更精确的监听）
function handleSelectionChange() {
  handleGlobalTextSelection()
}

// 处理悬浮工具栏的操作
function handleFloatingAction(action: string, text: string) {
  // 打开AI聊天面板
  displayStore.toggleAIDialog(true)

  // 根据操作类型设置不同的提示词
  let prompt = ``
  switch (action) {
    case `copy`:
      navigator.clipboard.writeText(text).catch((err) => {
        console.error(`复制失败:`, err)
      })
      return // 复制操作不需要打开AI面板
    case `polish`:
      prompt = `请帮我润色以下文字，让它更加优雅和流畅：\n\n${text}`
      break
    case `rewrite`:
      prompt = `请帮我重写以下文字，保持原意但使用不同的表达方式：\n\n${text}`
      break
    case `summarize`:
      prompt = `请帮我总结以下内容：\n\n${text}`
      break
    case `translate`:
      prompt = `请帮我翻译以下文字：\n\n${text}`
      break
    case `expand`:
      prompt = `请帮我扩展以下内容，让它更加详细和丰富：\n\n${text}`
      break
  }

  // 延迟设置输入内容，确保AI面板已经打开
  nextTick(() => {
    setTimeout(() => {
      const textarea = document.querySelector(
        `textarea[placeholder*="说些什么" ]`,
      ) as HTMLTextAreaElement | null
      if (textarea) {
        textarea.value = prompt
        textarea.focus()
        textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      }
    }, 100)
  })

  // 关闭悬浮工具栏
  showTextFloating.value = false
}

function closeTextFloating() {
  showTextFloating.value = false
  selectedText.value = ``
}

// 测试函数
function testFloating() {
  console.log(`Testing floating toolbar`)
  console.log(`Current state:`, {
    showTextFloating: showTextFloating.value,
    selectedText: selectedText.value,
    floatingPosition: floatingPosition.value,
  })
  selectedText.value = `测试文本`
  floatingPosition.value = { x: 300, y: 200 }
  showTextFloating.value = true
  console.log(`After setting:`, {
    showTextFloating: showTextFloating.value,
    selectedText: selectedText.value,
    floatingPosition: floatingPosition.value,
  })
}

// AI 工具箱已移到侧边栏

const previewRef = useTemplateRef<HTMLDivElement>(`previewRef`)

const timeout = ref<NodeJS.Timeout>()

// 使浏览区与编辑区滚动条建立同步联系
function leftAndRightScroll() {
  const scrollCB = (text: string) => {
    // AIPolishBtnRef.value?.close()

    let source: HTMLElement
    let target: HTMLElement

    clearTimeout(timeout.value)
    if (text === `preview`) {
      source = previewRef.value!
      target = document.querySelector<HTMLElement>(`.CodeMirror-scroll`)!
      editor.value!.off(`scroll`, editorScrollCB)
      timeout.value = setTimeout(() => {
        editor.value!.on(`scroll`, editorScrollCB)
      }, 300)
    }
    else {
      source = document.querySelector<HTMLElement>(`.CodeMirror-scroll`)!
      target = previewRef.value!
      target.removeEventListener(`scroll`, previewScrollCB, false)
      timeout.value = setTimeout(() => {
        target.addEventListener(`scroll`, previewScrollCB, false)
      }, 300)
    }

    const percentage
      = source.scrollTop / (source.scrollHeight - source.offsetHeight)
    const height = percentage * (target.scrollHeight - target.offsetHeight)

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
  if (editor.value) {
    editor.value.on(`scroll`, editorScrollCB)
  }
}

onMounted(() => {
  setTimeout(() => {
    leftAndRightScroll()
  }, 300)
})

const searchTabRef
  = useTemplateRef<InstanceType<typeof SearchTab>>(`searchTabRef`)

function openSearchWithSelection(cm: Editor) {
  const selected = cm.getSelection().trim()
  if (!searchTabRef.value)
    return

  if (selected) {
    // 自动带入选中文本
    searchTabRef.value.setSearchWord(selected)
  }
  else {
    // 仅打开面板
    searchTabRef.value.showSearchTab = true
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === `Escape` && searchTabRef.value?.showSearchTab) {
    searchTabRef.value.showSearchTab = false
    e.preventDefault()
    editor.value?.focus()
  }
}

onMounted(() => {
  document.addEventListener(`keydown`, handleGlobalKeydown)
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
  // 上传成功，获取光标
  const cursor = editor.value!.getCursor()
  const markdownImage = `![](${imageUrl})`
  // 将 Markdown 形式的 URL 插入编辑框光标所在位置
  toRaw(store.editor!).replaceSelection(`\n${markdownImage}\n`, cursor as any)
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
  editor.value!.setValue(md.str)
}

const codeMirrorWrapper = useTemplateRef<ComponentPublicInstance<HTMLDivElement>>(`codeMirrorWrapper`)

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

const changeTimer = ref<NodeJS.Timeout>()

const editorRef = useTemplateRef<HTMLTextAreaElement>(`editorRef`)
const progressValue = ref(0)
function createFormTextArea(dom: HTMLTextAreaElement) {
  const textArea = fromTextArea(dom, {
    mode: `text/x-markdown`,
    theme: isDark.value ? `darcula` : `xq-light`,
    lineNumbers: false,
    lineWrapping: true,
    styleActiveLine: true,
    autoCloseBrackets: true,
    extraKeys: createExtraKeys(openSearchWithSelection),
    undoDepth: 200,
  })

  textArea.on(`change`, (editor) => {
    clearTimeout(changeTimer.value)
    changeTimer.value = setTimeout(() => {
      editorRefresh()

      const currentPost = store.posts[store.currentPostIndex]
      if (!currentPost) {
        return
      }

      const content = editor.getValue()
      if (content === currentPost.content) {
        return
      }

      currentPost.updateDatetime = new Date()
      currentPost.content = content
    }, 300)
  })

  // 粘贴上传图片并插入
  textArea.on(`paste`, async (_editor, event) => {
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

  return textArea
}

// 初始化编辑器
onMounted(() => {
  const editorDom = editorRef.value

  if (editorDom == null) {
    return
  }

  const currentPost = store.posts[store.currentPostIndex]
  if (!currentPost) {
    return
  }

  editorDom.value = currentPost.content

  nextTick(() => {
    editor.value = createFormTextArea(editorDom)

    // AI 工具箱已移到侧边栏，不再需要初始化编辑器事件
    editorRefresh()
    mdLocalToRemote()
  })

  // 添加全局文本选中事件监听器
  console.log(`Adding event listeners for text selection`)
  document.addEventListener(`mouseup`, handleGlobalTextSelection)
  document.addEventListener(`selectionchange`, handleSelectionChange)
  document.addEventListener(`keyup`, handleGlobalTextSelection) // 支持键盘选中
})

// 监听暗色模式变化并更新编辑器主题
watch(isDark, () => {
  const theme = isDark.value ? `darcula` : `xq-light`
  toRaw(editor.value)?.setOption?.(`theme`, theme)
})

// 历史记录的定时器
const historyTimer = ref<NodeJS.Timeout>()
onMounted(() => {
  // 定时，30 秒记录一次文章的历史记录
  historyTimer.value = setInterval(() => {
    const currentPost = store.posts[store.currentPostIndex]
    if (!currentPost) {
      return
    }

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
  document.removeEventListener(`mouseup`, handleGlobalTextSelection)
  document.removeEventListener(`selectionchange`, handleSelectionChange)
  document.removeEventListener(`keyup`, handleGlobalTextSelection)

  // 清理定时器
  if (selectionTimer) {
    clearTimeout(selectionTimer)
  }
})
</script>

<template>
  <div class="container flex flex-col" style="position: relative; z-index: 1;">
    <Progress v-model="progressValue" class="absolute left-0 right-0 rounded-none" style="height: 2px; z-index: 2;" />
    <EditorHeader
      style="position: relative; z-index: 100;"
      @start-copy="startCopy"
      @end-copy="endCopy"
    />

    <main class="container-main flex flex-1 flex-col" style="position: relative; z-index: 1;">
      <div
        class="container-main-section border-radius-10 relative flex flex-1 overflow-hidden border"
      >
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel
            :default-size="15"
            :max-size="store.isOpenPostSlider ? 30 : 0"
            :min-size="store.isOpenPostSlider ? 10 : 0"
          >
            <PostSlider />
          </ResizablePanel>
          <ResizableHandle class="hidden md:block" />
          <ResizablePanel class="flex">
            <div
              v-show="!store.isMobile || (store.isMobile && showEditor)"
              ref="codeMirrorWrapper"
              class="codeMirror-wrapper relative flex-1"
              :class="{
                'order-1 border-l': !store.isEditOnLeft,
                'border-r': store.isEditOnLeft,
              }"
            >
              <SearchTab v-if="editor" ref="searchTabRef" :editor="editor" />
              <SidebarAIToolbar
                :is-mobile="store.isMobile"
                :show-editor="showEditor"
              />

              <EditorContextMenu>
                <textarea
                  id="editor"
                  ref="editorRef"
                  type="textarea"
                  placeholder="Your markdown text here."
                />
              </EditorContextMenu>
            </div>
            <div
              v-show="!store.isMobile || (store.isMobile && !showEditor)"
              class="relative flex-1 overflow-x-hidden transition-width"
              :class="[store.isOpenRightSlider ? 'w-0' : 'w-100']"
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
                    class="preview border-x shadow-xl"
                    :class="[store.isMobile ? 'w-[100%]' : store.previewWidth]"
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
                  :right="store.isMobile ? 24 : 20"
                  :bottom="store.isMobile ? 90 : 20"
                />
              </div>

              <FloatingToc />
            </div>
            <RightSlider v-if="!displayStore.aiDialogVisible" />
          </ResizablePanel>
          <ResizableHandle v-if="displayStore.aiDialogVisible" class="hidden md:block" />
          <ResizablePanel
            v-if="displayStore.aiDialogVisible"
            :default-size="30"
            :min-size="20"
            :max-size="50"
          >
            <CursorStyleChatPanel v-model:open="displayStore.aiDialogVisible" />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <!-- 移动端浮动按钮组 -->
      <div v-if="store.isMobile" class="fixed bottom-16 right-6 z-50 flex flex-col gap-2">
        <!-- 切换编辑/预览按钮 -->
        <button
          class="bg-primary flex items-center justify-center rounded-full p-3 text-white shadow-lg transition active:scale-95 hover:scale-105 dark:bg-gray-700 dark:text-white dark:ring-2 dark:ring-white/30"
          aria-label="切换编辑/预览"
          @click="toggleView"
        >
          <component :is="showEditor ? Eye : Pen" class="h-5 w-5" />
        </button>
      </div>

      <!-- 测试按钮 -->
      <div class="fixed top-4 right-4 z-40">
        <button
          class="bg-red-500 text-white px-4 py-2 rounded shadow-lg"
          @click="testFloating"
        >
          测试悬浮
        </button>
      </div>

      <!-- AI工具箱已移到侧边栏，这里不再显示 -->

      <UploadImgDialog @upload-image="uploadImage" />

      <InsertFormDialog />

      <InsertMpCardDialog />

      <AlertDialog v-model:open="store.isOpenConfirmDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>提示</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将丢失本地自定义样式，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction @click="store.resetStyle()">
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>

    <Footer />

    <!-- 全局文本选中悬浮组件 -->
    <TextSelectionFloating
      :visible="showTextFloating"
      :selected-text="selectedText"
      :position="floatingPosition"
      @close="closeTextFloating"
      @action="handleFloatingAction"
    />
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

.codeMirror-wrapper {
  overflow-x: hidden;
  height: 100%;
  position: relative;
}
</style>
