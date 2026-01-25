import { addPrefix } from '@/utils'

/**
 * 画布面板配置
 */
export interface PanelConfig {
  id: string
  type: `nav` | `editor` | `preview` | `sandbox` | `ai`
  visible: boolean
  position: { x: number, y: number }
  size: { width: number, height: number }
  zIndex: number
  pinned?: `left` | `right` | `none`
}

/**
 * 画布状态 Store
 * 负责管理画布式布局中的面板状态
 */
export const useCanvasStore = defineStore(`canvas`, () => {
  // 当前最高 z-index
  const topZIndex = ref(100)

  // 所有面板配置
  const panels = useStorage<PanelConfig[]>(addPrefix(`canvas_panels`), [
    {
      id: `nav`,
      type: `nav`,
      visible: true,
      position: { x: 12, y: 12 },
      size: { width: 56, height: -1 }, // -1 表示自适应高度
      zIndex: 100,
      pinned: `left`,
    },
    {
      id: `preview`,
      type: `preview`,
      visible: true,
      position: { x: 0, y: 0 }, // 居中计算
      size: { width: 800, height: 600 },
      zIndex: 50,
      pinned: `none`,
    },
    {
      id: `sandbox`,
      type: `sandbox`,
      visible: false,
      position: { x: 0, y: 0 }, // 跟随 preview
      size: { width: 800, height: 600 }, // 与 preview 同步
      zIndex: 51,
      pinned: `none`,
    },
    {
      id: `ai`,
      type: `ai`,
      visible: false,
      position: { x: 0, y: 12 },
      size: { width: 380, height: -1 },
      zIndex: 100,
      pinned: `right`,
    },
  ])

  // 当前活跃面板
  const activePanel = ref<string | null>(null)

  // 预览和沙盒是否同步滚动
  const syncScroll = useStorage(addPrefix(`canvas_sync_scroll`), true)

  // 预览区域的滚动位置
  const previewScrollTop = ref(0)

  // 获取面板配置
  function getPanel(id: string): PanelConfig | undefined {
    return panels.value.find(p => p.id === id)
  }

  // 更新面板配置
  function updatePanel(id: string, updates: Partial<PanelConfig>) {
    const panel = panels.value.find(p => p.id === id)
    if (panel) {
      Object.assign(panel, updates)
    }
  }

  // 显示/隐藏面板
  function togglePanel(id: string, visible?: boolean) {
    const panel = getPanel(id)
    if (panel) {
      panel.visible = visible ?? !panel.visible
      if (panel.visible) {
        bringToFront(id)
      }
    }
  }

  // 将面板提升到最前
  function bringToFront(id: string) {
    const panel = getPanel(id)
    if (panel) {
      topZIndex.value++
      panel.zIndex = topZIndex.value
      activePanel.value = id
    }
  }

  // 更新面板位置
  function updatePosition(id: string, position: { x: number, y: number }) {
    updatePanel(id, { position })
  }

  // 更新面板大小
  function updateSize(id: string, size: { width: number, height: number }) {
    updatePanel(id, { size })
    // 如果是预览面板，同步更新沙盒面板大小
    if (id === `preview`) {
      updatePanel(`sandbox`, { size })
    }
  }

  // 同步滚动位置
  function setPreviewScrollTop(scrollTop: number) {
    previewScrollTop.value = scrollTop
  }

  // 重置面板布局
  function resetLayout() {
    panels.value = [
      {
        id: `nav`,
        type: `nav`,
        visible: true,
        position: { x: 12, y: 12 },
        size: { width: 56, height: -1 },
        zIndex: 100,
        pinned: `left`,
      },
      {
        id: `preview`,
        type: `preview`,
        visible: true,
        position: { x: 0, y: 0 },
        size: { width: 800, height: 600 },
        zIndex: 50,
        pinned: `none`,
      },
      {
        id: `sandbox`,
        type: `sandbox`,
        visible: false,
        position: { x: 0, y: 0 },
        size: { width: 800, height: 600 },
        zIndex: 51,
        pinned: `none`,
      },
      {
        id: `ai`,
        type: `ai`,
        visible: false,
        position: { x: 0, y: 12 },
        size: { width: 380, height: -1 },
        zIndex: 100,
        pinned: `right`,
      },
    ]
  }

  return {
    // State
    panels,
    activePanel,
    syncScroll,
    previewScrollTop,
    topZIndex,

    // Getters
    getPanel,

    // Actions
    updatePanel,
    togglePanel,
    bringToFront,
    updatePosition,
    updateSize,
    setPreviewScrollTop,
    resetLayout,
  }
})
