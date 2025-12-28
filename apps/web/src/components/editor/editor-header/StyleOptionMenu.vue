<script setup lang="ts">
import type { IConfigOption } from '@md/shared/types'

const props = defineProps<{
  title: string
  options: IConfigOption[]
  current: string
  change: (val: any) => void
}>()

function setStyle(title: string, value: string) {
  switch (title) {
    case `字体`:
      return { fontFamily: value }
    case `字号`:
      return { fontSize: value }
    case `主题色`:
      return { color: value }
    default:
      return {}
  }
}
</script>

<template>
  <MenubarSub>
    <MenubarSubTrigger>
      <span class="mr-2 h-4 w-4" />
      <span>{{ props.title }}</span>
    </MenubarSubTrigger>
    <MenubarSubContent class="max-h-56 overflow-auto">
      <MenubarCheckboxItem
        v-for="{ label, value, desc } in options"
        :key="value"
        :label="label"
        :model-value="value"
        class="w-50"
        :checked="current === value"
        :title="title === '标题模板' && desc ? desc : undefined"
        @click="change(value)"
      >
        {{ label }}
        <DropdownMenuShortcut v-if="title !== '标题模板'" :style="setStyle(title, value)">
          {{ desc }}
        </DropdownMenuShortcut>
      </MenubarCheckboxItem>
    </MenubarSubContent>
  </MenubarSub>
</template>
