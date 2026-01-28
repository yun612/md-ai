<script setup lang="ts">
import { Palette, Sparkles, Wand2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

type TemplateId = `aurora` | `notebook` | `plaza` | `sunset` | `ink`

interface TemplateCard {
  id: TemplateId
  name: string
  description: string
  primaryColor: string
  highlights: string[]
  previewTitle: string
  previewPoints: string[]
}

const props = defineProps<{
  currentTheme: string
}>()

const emit = defineEmits<{
  (e: `apply`, payload: { themeKey: TemplateCard[`id`], primaryColor: string, name: string }): void
  (e: `close`): void
}>()

const templates: TemplateCard[] = [
  {
    id: `aurora`,
    name: `霓虹杂志`,
    description: `渐变标题、玻璃态卡片与深色代码框，适合科技或品牌提案`,
    primaryColor: `#6a5acd`,
    highlights: [`渐变标题`, `卡片阴影`, `深色代码块`],
    previewTitle: `品牌焕新提纲`,
    previewPoints: [`受众痛点`, `价值卖点`, `执行节点`],
  },
  {
    id: `notebook`,
    name: `质感手账`,
    description: `纸张质感与留白分割，柔和的暖色系，适合方案纪要或学习笔记`,
    primaryColor: `#c47a44`,
    highlights: [`纸感底纹`, `柔和分隔线`, `暖色标题`],
    previewTitle: `季度复盘要点`,
    previewPoints: [`目标回顾`, `数据亮点`, `改进动作`],
  },
  {
    id: `plaza`,
    name: `质感商务`,
    description: `蓝紫渐变标题、留白卡片，适合汇报/路演大纲`,
    primaryColor: `#2563eb`,
    highlights: [`渐变腰线`, `留白布局`, `信息卡片`],
    previewTitle: `路演要点速写`,
    previewPoints: [`市场洞察`, `方案亮点`, `实施节奏`],
  },
  {
    id: `sunset`,
    name: `暖夕叙事`,
    description: `橙粉暖色调，圆角分组，适合故事化方案/宣讲`,
    primaryColor: `#f97316`,
    highlights: [`柔和渐变`, `标签胶囊`, `引用分隔`],
    previewTitle: `故事线框架`,
    previewPoints: [`情景引入`, `情感钩子`, `结局反转`],
  },
  {
    id: `ink`,
    name: `夜色黑金`,
    description: `深色底 + 金色强调，适合高级质感提案`,
    primaryColor: `#d1b17a`,
    highlights: [`黑金配色`, `暗色代码`, `精致边框`],
    previewTitle: `高定方案脉络`,
    previewPoints: [`核心卖点`, `体验路径`, `落地资源`],
  },
]

function applyTemplate(card: TemplateCard) {
  emit(`apply`, {
    themeKey: card.id,
    primaryColor: card.primaryColor,
    name: card.name,
  })
}

function closeGallery() {
  emit(`close`)
}
</script>

<template>
  <div class="template-gallery h-full overflow-auto p-4">
    <div class="mb-4">
      <div class="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Palette class="h-4 w-4" />
        精美模板
      </div>
      <p class="mt-1 text-xs text-muted-foreground">
        生成内容后可随时切换模板，左侧快速预览
      </p>
    </div>

    <div class="grid gap-3">
      <div
        v-for="card in templates"
        :key="card.id"
        class="template-card relative overflow-hidden rounded-2xl border bg-white/80 p-4 shadow-sm transition-all duration-200 dark:border-slate-800 dark:bg-slate-900/80"
        :class="{
          'ring-2 ring-primary shadow-xl dark:ring-primary/80 border-primary/30 dark:border-primary/40': props.currentTheme === card.id,
        }"
      >
        <div class="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
          <Sparkles class="h-3 w-3" />
          新模板
        </div>
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Wand2 class="h-4 w-4 text-primary" />
              {{ card.name }}
            </div>
            <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {{ card.description }}
            </p>
            <div class="mt-2 flex flex-wrap gap-1">
              <span
                v-for="tag in card.highlights"
                :key="tag"
                class="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {{ tag }}
              </span>
            </div>
          </div>
          <Button size="sm" class="gap-1" @click="applyTemplate(card)">
            应用此模板
          </Button>
        </div>

        <div class="mt-4">
          <div class="preview-card" :class="[`preview-${card.id}`]">
            <div class="preview-header">
              <div class="title">
                {{ card.previewTitle }}
              </div>
              <div class="pill">
                双栏卡片 · 自动对齐
              </div>
            </div>
            <div class="preview-body">
              <div
                v-for="point in card.previewPoints"
                :key="point"
                class="preview-block"
              >
                <div class="block-title">
                  {{ point }}
                </div>
                <div class="block-desc">
                  支持粗体、引用、代码块等常见排版需求。
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.template-gallery {
  background:
    radial-gradient(circle at 10% 20%, rgba(99, 179, 237, 0.08), transparent 22%),
    radial-gradient(circle at 90% 10%, rgba(123, 97, 255, 0.08), transparent 20%),
    radial-gradient(circle at 50% 90%, rgba(196, 122, 68, 0.08), transparent 18%);

  /* 隐藏滚动条但保持滚动功能 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */

  &::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
  }
}

.template-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.08);
}

.preview-card {
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.preview-header .title {
  font-weight: 700;
  font-size: 15px;
}

.preview-header .pill {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.6);
  color: #0f172a;
}

.preview-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.preview-block {
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(15, 23, 42, 0.05);
}

.preview-block .block-title {
  font-weight: 700;
  margin-bottom: 4px;
  font-size: 13px;
}

.preview-block .block-desc {
  font-size: 12px;
  color: #475569;
}

.preview-aurora {
  background: linear-gradient(135deg, rgba(99, 179, 237, 0.14), rgba(123, 97, 255, 0.12));
  border: 1px solid rgba(123, 97, 255, 0.18);
  box-shadow: 0 12px 28px rgba(62, 118, 244, 0.16);
}

.preview-aurora .title {
  color: #0f172a;
}

.preview-aurora .block-title {
  color: #0f172a;
}

.preview-aurora .pill {
  background: rgba(15, 23, 42, 0.78);
  color: #e2e8f0;
  border: none;
}

.preview-plaza {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.14), rgba(123, 97, 255, 0.1));
  border: 1px solid rgba(37, 99, 235, 0.2);
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.15);
}

.preview-plaza .title {
  color: #0f172a;
}

.preview-plaza .pill {
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
  border: 1px solid rgba(37, 99, 235, 0.35);
}

.preview-plaza .block-title {
  color: #0f172a;
}

.preview-plaza .block-desc {
  color: #1f2937;
}

.preview-sunset {
  background: linear-gradient(145deg, rgba(249, 115, 22, 0.18), rgba(244, 114, 182, 0.12));
  border: 1px solid rgba(249, 115, 22, 0.18);
  box-shadow: 0 10px 24px rgba(249, 115, 22, 0.18);
}

.preview-sunset .title {
  color: #7c2d12;
}

.preview-sunset .pill {
  background: rgba(249, 115, 22, 0.12);
  color: #c2410c;
  border: 1px solid rgba(249, 115, 22, 0.28);
}

.preview-sunset .block-title {
  color: #7c2d12;
}

.preview-sunset .block-desc {
  color: #5f370e;
}

.preview-ink {
  background:
    radial-gradient(circle at 20% 20%, rgba(209, 177, 122, 0.16), transparent 35%),
    linear-gradient(135deg, #0b1220, #0f172a);
  border: 1px solid rgba(209, 177, 122, 0.28);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.36);
}

.preview-ink .title {
  color: #f7f3ea;
}

.preview-ink .pill {
  background: rgba(209, 177, 122, 0.12);
  color: #d1b17a;
  border: 1px solid rgba(209, 177, 122, 0.3);
}

.preview-ink .block-title {
  color: #f7f3ea;
}

.preview-ink .block-desc {
  color: #cbd5e1;
}

.preview-notebook {
  background: #fdfaf3;
  border: 1px solid rgba(196, 122, 68, 0.2);
  box-shadow: 0 10px 22px rgba(201, 164, 116, 0.14);
}

.preview-notebook .title {
  color: #5b3b1a;
}

.preview-notebook .pill {
  background: rgba(196, 122, 68, 0.12);
  color: #6b4421;
  border: 1px solid rgba(196, 122, 68, 0.28);
}

.preview-notebook .block-title {
  color: #6b4421;
}

.preview-notebook .block-desc {
  color: #4b3b2f;
}
</style>
