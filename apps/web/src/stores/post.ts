import { v4 as uuid } from 'uuid'
import { addPrefix } from '@/utils'

// 默认 HTML 内容
const DEFAULT_HTML_CONTENT = `<section style="width:100%;display:inline-block;background:#e3f2fd;padding:20px;text-align:center;width:33%;box-sizing:border-box;">第一栏</section>
<section style="width:100%;display:inline-block;background:#f3e5f5;padding:20px;text-align:center;width:33%;box-sizing:border-box;">第二栏</section>
<section style="width:100%;display:inline-block;background:#ff0;padding:20px;text-align:center;width:34%;box-sizing:border-box;">第三栏</section>`

/**
 * Post 结构接口
 */
export interface Post {
  id: string
  title: string
  content: string
  history: {
    datetime: string
    content: string
  }[]
  createDatetime: Date
  updateDatetime: Date
  // 父标签
  parentId?: string | null
  // 展开状态
  collapsed?: boolean
}

/**
 * 文章管理 Store
 * 负责管理文章列表、当前文章、文章 CRUD 操作
 */
export const usePostStore = defineStore(`post`, () => {
  // 安全的 localStorage 读取函数
  function safeGetStorage<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        return JSON.parse(stored) as T
      }
    }
    catch (error) {
      console.warn(`Failed to read ${key} from storage:`, error)
    }
    return defaultValue
  }

  // 安全的 localStorage 写入函数
  function safeSetStorage<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    }
    catch (error) {
      console.warn(`Failed to save ${key} to storage (quota exceeded):`, error)
      return false
    }
  }

  // 内容列表 - 使用手动管理的 ref
  const defaultPosts: Post[] = [
    {
      id: uuid(),
      title: `内容1`,
      content: DEFAULT_HTML_CONTENT,
      history: [
        { datetime: new Date().toLocaleString(`zh-cn`), content: DEFAULT_HTML_CONTENT },
      ],
      createDatetime: new Date(),
      updateDatetime: new Date(),
    },
  ]

  const posts = ref<Post[]>(safeGetStorage(addPrefix(`posts`), defaultPosts))

  // 监听 posts 变化并保存（带错误处理和节流，限制历史记录大小）
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch(posts, (newPosts) => {
    // 限制历史记录大小，每个文章最多保留 10 条
    const cleanedPosts = newPosts.map(post => ({
      ...post,
      history: post.history?.slice(-10) || [],
    }))

    // 节流保存，避免频繁写入
    if (saveTimer) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      safeSetStorage(addPrefix(`posts`), cleanedPosts)
    }, 500)
  }, { deep: true })

  // 当前文章 ID
  const currentPostId = ref<string>(safeGetStorage(addPrefix(`current_post_id`), ``))
  watch(currentPostId, (newValue) => {
    try {
      localStorage.setItem(addPrefix(`current_post_id`), newValue)
    }
    catch (error) {
      console.warn(`Failed to save currentPostId to storage:`, error)
    }
  })

  // 预备弃用的旧字段（用于迁移）
  const editorContent = ref<string>(safeGetStorage(`__editor_content`, DEFAULT_HTML_CONTENT))
  watch(editorContent, (newValue) => {
    try {
      localStorage.setItem(`__editor_content`, newValue)
    }
    catch (error) {
      console.warn(`Failed to save editorContent to storage:`, error)
    }
  })

  // 在补齐 id 后，若 currentPostId 无效 ➜ 自动指向第一篇
  onBeforeMount(() => {
    posts.value = posts.value.map((post, index) => {
      const now = Date.now()
      return {
        ...post,
        id: post.id ?? uuid(),
        createDatetime: post.createDatetime ?? new Date(now + index),
        updateDatetime: post.updateDatetime ?? new Date(now + index),
      }
    })

    // 兼容：如果本地没有 currentPostId，或指向的文章已不存在
    if (!currentPostId.value || !posts.value.some(p => p.id === currentPostId.value)) {
      currentPostId.value = posts.value[0]?.id ?? ``
    }
  })

  // 根据 id 找索引
  const findIndexById = (id: string) => posts.value.findIndex(p => p.id === id)

  // computed: 让旧代码还能用 index，但底层映射 id
  const currentPostIndex = computed<number>({
    get: () => findIndexById(currentPostId.value),
    set: (idx) => {
      if (idx >= 0 && idx < posts.value.length) {
        currentPostId.value = posts.value[idx].id
      }
    },
  })

  // 获取 Post
  const getPostById = (id: string) => posts.value.find(p => p.id === id)

  // 获取当前文章
  const currentPost = computed(() => getPostById(currentPostId.value))

  // 添加文章
  const addPost = (title: string, parentId: string | null = null) => {
    const newPost: Post = {
      id: uuid(),
      title,
      content: `# ${title}`,
      history: [
        { datetime: new Date().toLocaleString(`zh-cn`), content: `# ${title}` },
      ],
      createDatetime: new Date(),
      updateDatetime: new Date(),
      parentId,
    }
    posts.value.push(newPost)
    currentPostId.value = newPost.id
  }

  // 重命名文章
  const renamePost = (id: string, title: string) => {
    const post = getPostById(id)
    if (post) {
      post.title = title
      post.updateDatetime = new Date()
    }
  }

  // 删除文章
  const delPost = (id: string) => {
    const idx = findIndexById(id)
    if (idx === -1)
      return

    posts.value.splice(idx, 1)
    currentPostId.value = posts.value[Math.min(idx, posts.value.length - 1)]?.id ?? ``
  }

  // 更新文章父 ID
  const updatePostParentId = (postId: string, parentId: string | null) => {
    const post = getPostById(postId)
    if (post) {
      post.parentId = parentId
      post.updateDatetime = new Date()
    }
  }

  // 更新文章内容
  const updatePostContent = (id: string, content: string) => {
    const post = getPostById(id)
    if (post) {
      post.content = content
      post.updateDatetime = new Date()
      // 确保历史记录不超过限制
      if (post.history && post.history.length > 10) {
        post.history = post.history.slice(-10)
      }
    }
  }

  // 收起所有文章
  const collapseAllPosts = () => {
    posts.value.forEach((post) => {
      post.collapsed = true
    })
  }

  // 展开所有文章
  const expandAllPosts = () => {
    posts.value.forEach((post) => {
      post.collapsed = false
    })
  }

  // 迁移阶段，兼容之前的方案
  onMounted(() => {
    if (editorContent.value !== DEFAULT_HTML_CONTENT) {
      const post = getPostById(currentPostId.value)
      if (post) {
        post.content = editorContent.value
      }
      editorContent.value = DEFAULT_HTML_CONTENT
    }
  })

  return {
    // State
    posts,
    currentPostId,
    currentPostIndex,
    currentPost,

    // Getters
    getPostById,
    findIndexById,

    // Actions
    addPost,
    renamePost,
    delPost,
    updatePostParentId,
    updatePostContent,
    collapseAllPosts,
    expandAllPosts,
  }
})
