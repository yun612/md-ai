<script setup lang="ts">
/**
 * CanvasContainer - 画布容器
 * 作为所有悬浮面板的容器，提供画布背景
 */

const props = withDefaults(defineProps<{
  showGrid?: boolean
}>(), {
  showGrid: false,
})
</script>

<template>
  <div class="canvas-container" :class="{ 'show-grid': showGrid }">
    <!-- 画布背景 -->
    <div class="canvas-background" />

    <!-- 面板层 - 使用 slot 渲染所有悬浮面板 -->
    <div class="canvas-panels">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.canvas-container {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: hsl(var(--background));
}

/* 画布背景 */
.canvas-background {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, hsl(var(--muted) / 0.3) 0%, transparent 50%),
    linear-gradient(225deg, hsl(var(--primary) / 0.05) 0%, transparent 50%);
  pointer-events: none;
}

/* 网格背景 (可选) */
.canvas-container.show-grid .canvas-background {
  background-image:
    linear-gradient(hsl(var(--border) / 0.3) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--border) / 0.3) 1px, transparent 1px);
  background-size: 20px 20px;
}

/* 面板层 */
.canvas-panels {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.canvas-panels > :deep(*) {
  pointer-events: auto;
}

/* 深色模式 */
.dark .canvas-background {
  background:
    linear-gradient(135deg, hsl(var(--muted) / 0.2) 0%, transparent 50%),
    linear-gradient(225deg, hsl(var(--primary) / 0.08) 0%, transparent 50%);
}
</style>
