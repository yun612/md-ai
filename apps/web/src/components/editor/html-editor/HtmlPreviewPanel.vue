<script setup lang="ts">
const props = defineProps<{
  htmlContent: string
}>()

const previewRef = ref<HTMLDivElement>()

watchEffect(() => {
  if (previewRef.value) {
    previewRef.value.innerHTML = props.htmlContent
  }
})
</script>

<template>
  <div class="html-preview-panel h-full overflow-y-auto bg-background">
    <div
      id="html-output"
      ref="previewRef"
      class="html-preview-content p-4"
      v-html="htmlContent"
    />
  </div>
</template>

    <style scoped>
    .html-preview-panel {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
    'Helvetica Neue', sans-serif;
}

.html-preview-content {
  max-width: 100%;
  word-wrap: break-word;
}

.html-preview-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.html-preview-content :deep(pre) {
  overflow-x: auto;
  padding: 1em;
  background: #f5f5f5;
  border-radius: 4px;
}

.html-preview-content :deep(code) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}
</style>
