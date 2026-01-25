<script setup lang="ts">
import { GripVertical } from 'lucide-vue-next'
import { useCanvasStore } from '@/stores/canvas'

const props = withDefaults(defineProps<{
  id: string
  title?: string
  draggable?: boolean
  resizable?: boolean
  showHeader?: boolean
  headerClass?: string
  contentClass?: string
  minWidth?: number
  minHeight?: number
}>(), {
  draggable: true,
  resizable: true,
  showHeader: true,
  minWidth: 200,
  minHeight: 100,
})

const emit = defineEmits<{
  close: []
  resize: [size: { width: number, height: number }]
}>()

const canvasStore = useCanvasStore()
const panelRef = ref<HTMLElement>()
const headerRef = ref<HTMLElement>()

// 获取面板配置
const panelConfig = computed(() => canvasStore.getPanel(props.id))

// 面板样式
const panelStyle = computed(() => {
  const config = panelConfig.value
  if (!config)
    return {}

  const style: Record<string, string> = {
    zIndex: String(config.zIndex),
  }

  // 处理固定位置的面板
  if (config.pinned === `left`) {
    style.left = `${config.position.x}px`
    style.top = `${config.position.y}px`
    style.bottom = `${config.position.y}px`
    if (config.size.width > 0) {
      style.width = `${config.size.width}px`
    }
  }
  else if (config.pinned === `right`) {
    style.right = `${config.position.x || 12}px`
    style.top = `${config.position.y}px`
    style.bottom = `${config.position.y}px`
    if (config.size.width > 0) {
      style.width = `${config.size.width}px`
    }
  }
  else {
    // 自由定位的面板
    style.left = `${config.position.x}px`
    style.top = `${config.position.y}px`
    if (config.size.width > 0) {
      style.width = `${config.size.width}px`
    }
    if (config.size.height > 0) {
      style.height = `${config.size.height}px`
    }
  }

  return style
})

// 是否活跃
const isActive = computed(() => canvasStore.activePanel === props.id)

// 拖拽逻辑
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

function handleMouseDown(e: MouseEvent) {
  if (!props.draggable || panelConfig.value?.pinned !== `none`)
    return

  isDragging.value = true
  const rect = panelRef.value?.getBoundingClientRect()
  if (rect) {
    dragOffset.value = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  canvasStore.bringToFront(props.id)

  document.addEventListener(`mousemove`, handleMouseMove)
  document.addEventListener(`mouseup`, handleMouseUp)
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging.value)
    return

  const newX = e.clientX - dragOffset.value.x
  const newY = e.clientY - dragOffset.value.y

  canvasStore.updatePosition(props.id, {
    x: Math.max(0, newX),
    y: Math.max(0, newY),
  })
}

function handleMouseUp() {
  isDragging.value = false
  document.removeEventListener(`mousemove`, handleMouseMove)
  document.removeEventListener(`mouseup`, handleMouseUp)
}

// 调整大小逻辑
const isResizing = ref(false)
const resizeDirection = ref<string>(``)

function handleResizeStart(e: MouseEvent, direction: string) {
  if (!props.resizable)
    return

  e.preventDefault()
  e.stopPropagation()

  isResizing.value = true
  resizeDirection.value = direction

  canvasStore.bringToFront(props.id)

  document.addEventListener(`mousemove`, handleResizeMove)
  document.addEventListener(`mouseup`, handleResizeEnd)
}

function handleResizeMove(e: MouseEvent) {
  if (!isResizing.value || !panelRef.value)
    return

  const rect = panelRef.value.getBoundingClientRect()
  const config = panelConfig.value
  if (!config)
    return

  let newWidth = config.size.width
  let newHeight = config.size.height

  if (resizeDirection.value.includes(`e`)) {
    newWidth = Math.max(props.minWidth, e.clientX - rect.left)
  }
  if (resizeDirection.value.includes(`s`)) {
    newHeight = Math.max(props.minHeight, e.clientY - rect.top)
  }
  if (resizeDirection.value.includes(`w`)) {
    const deltaX = rect.left - e.clientX
    newWidth = Math.max(props.minWidth, config.size.width + deltaX)
    if (newWidth !== config.size.width) {
      canvasStore.updatePosition(props.id, {
        x: config.position.x - deltaX,
        y: config.position.y,
      })
    }
  }
  if (resizeDirection.value.includes(`n`)) {
    const deltaY = rect.top - e.clientY
    newHeight = Math.max(props.minHeight, config.size.height + deltaY)
    if (newHeight !== config.size.height) {
      canvasStore.updatePosition(props.id, {
        x: config.position.x,
        y: config.position.y - deltaY,
      })
    }
  }

  canvasStore.updateSize(props.id, { width: newWidth, height: newHeight })
  emit(`resize`, { width: newWidth, height: newHeight })
}

function handleResizeEnd() {
  isResizing.value = false
  document.removeEventListener(`mousemove`, handleResizeMove)
  document.removeEventListener(`mouseup`, handleResizeEnd)
}

// 点击面板时提升层级
function handlePanelClick() {
  canvasStore.bringToFront(props.id)
}

// 清理事件监听
onUnmounted(() => {
  document.removeEventListener(`mousemove`, handleMouseMove)
  document.removeEventListener(`mouseup`, handleMouseUp)
  document.removeEventListener(`mousemove`, handleResizeMove)
  document.removeEventListener(`mouseup`, handleResizeEnd)
})
</script>

<template>
  <div
    v-if="panelConfig?.visible"
    ref="panelRef"
    class="floating-panel"
    :class="{
      'is-active': isActive,
      'is-dragging': isDragging,
      'is-resizing': isResizing,
      'is-pinned': panelConfig?.pinned !== 'none',
    }"
    :style="panelStyle"
    @mousedown="handlePanelClick"
  >
    <!-- 头部 -->
    <div
      v-if="showHeader && title"
      ref="headerRef"
      class="floating-panel-header"
      :class="headerClass"
      @mousedown="handleMouseDown"
    >
      <div class="header-content">
        <GripVertical v-if="draggable && panelConfig?.pinned === 'none'" class="drag-handle" />
        <span class="header-title">{{ title }}</span>
      </div>
      <div class="header-actions">
        <slot name="header-actions" />
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="floating-panel-content" :class="contentClass">
      <slot />
    </div>

    <!-- 调整大小手柄 -->
    <template v-if="resizable && panelConfig?.pinned === 'none'">
      <div class="resize-handle resize-n" @mousedown="(e) => handleResizeStart(e, 'n')" />
      <div class="resize-handle resize-s" @mousedown="(e) => handleResizeStart(e, 's')" />
      <div class="resize-handle resize-e" @mousedown="(e) => handleResizeStart(e, 'e')" />
      <div class="resize-handle resize-w" @mousedown="(e) => handleResizeStart(e, 'w')" />
      <div class="resize-handle resize-ne" @mousedown="(e) => handleResizeStart(e, 'ne')" />
      <div class="resize-handle resize-nw" @mousedown="(e) => handleResizeStart(e, 'nw')" />
      <div class="resize-handle resize-se" @mousedown="(e) => handleResizeStart(e, 'se')" />
      <div class="resize-handle resize-sw" @mousedown="(e) => handleResizeStart(e, 'sw')" />
    </template>
  </div>
</template>

<style scoped>
.floating-panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1),
    0 0 0 1px rgb(0 0 0 / 0.05);
  transition:
    box-shadow 0.2s ease,
    transform 0.1s ease;
  overflow: hidden;
}

.floating-panel.is-active {
  box-shadow:
    0 10px 25px -5px rgb(0 0 0 / 0.15),
    0 8px 10px -6px rgb(0 0 0 / 0.1),
    0 0 0 2px hsl(var(--primary) / 0.2);
}

.floating-panel.is-dragging,
.floating-panel.is-resizing {
  opacity: 0.9;
  cursor: grabbing;
}

.floating-panel.is-pinned {
  transition: none;
}

.dark .floating-panel {
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.3),
    0 2px 4px -2px rgb(0 0 0 / 0.2),
    0 0 0 1px rgb(255 255 255 / 0.05);
}

/* 头部样式 */
.floating-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid hsl(var(--border) / 0.5);
  background: linear-gradient(135deg, hsl(var(--muted) / 0.3), transparent);
  cursor: grab;
  user-select: none;
  min-height: 44px;
}

.floating-panel-header:active {
  cursor: grabbing;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drag-handle {
  width: 16px;
  height: 16px;
  color: hsl(var(--muted-foreground));
  opacity: 0.5;
  transition: opacity 0.2s;
}

.floating-panel-header:hover .drag-handle {
  opacity: 1;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 内容区域 */
.floating-panel-content {
  flex: 1;
  overflow: hidden;
  background: hsl(var(--background));
}

/* 调整大小手柄 */
.resize-handle {
  position: absolute;
  z-index: 10;
}

.resize-n,
.resize-s {
  left: 8px;
  right: 8px;
  height: 6px;
  cursor: ns-resize;
}

.resize-n {
  top: -3px;
}

.resize-s {
  bottom: -3px;
}

.resize-e,
.resize-w {
  top: 8px;
  bottom: 8px;
  width: 6px;
  cursor: ew-resize;
}

.resize-e {
  right: -3px;
}

.resize-w {
  left: -3px;
}

.resize-ne,
.resize-nw,
.resize-se,
.resize-sw {
  width: 12px;
  height: 12px;
}

.resize-ne {
  top: -3px;
  right: -3px;
  cursor: nesw-resize;
}

.resize-nw {
  top: -3px;
  left: -3px;
  cursor: nwse-resize;
}

.resize-se {
  bottom: -3px;
  right: -3px;
  cursor: nwse-resize;
}

.resize-sw {
  bottom: -3px;
  left: -3px;
  cursor: nesw-resize;
}
</style>
