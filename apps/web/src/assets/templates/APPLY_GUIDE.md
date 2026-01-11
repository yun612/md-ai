# 如何应用标题样式模板

## ✅ 已应用！

模板已经直接应用到渲染器中了！H4-H6 的样式已经更新为简洁版本：

- **H4**: 下划线 + 圆圈装饰（圆圈颜色使用主题色更深的 darkGreen）
- **H5**: 简洁的圆角矩形
- **H6**: 最简约的圆角矩形

现在当你使用 Markdown 编辑器时，H4-H6 标题会自动使用这些新样式。

## 如何验证

1. 在编辑器中输入以下内容：

```markdown
#### 这是四级标题

##### 这是五级标题

###### 这是六级标题
```

2. 查看预览效果，应该能看到：
   - H4: 带下划线和圆圈装饰
   - H5: 圆角矩形
   - H6: 简约圆角矩形

## 如果需要使用 JSON 模板文件

如果你想通过 JSON 文件来管理和切换不同的模板，可以使用以下方案：

## 方案一：直接修改渲染器（推荐）

这是最简单直接的方法，修改渲染器让它使用我们的模板。

### 步骤 1：将模板工具函数移到 shared 包

由于渲染器在 `packages/core` 中，我们需要将模板工具函数移到 `packages/shared` 中，这样 core 包才能使用。

1. 将 `apps/web/src/utils/headingTemplate.ts` 复制到 `packages/shared/src/utils/headingTemplate.ts`
2. 将 `apps/web/src/assets/templates/heading-styles.json` 复制到 `packages/shared/src/assets/templates/heading-styles.json`
3. 修改导入路径

### 步骤 2：修改渲染器

修改 `packages/core/src/renderer/renderer-impl.ts`：

```typescript
import { generateHeadingHTML } from '@md/shared/utils/headingTemplate'

// 在 heading 函数中使用模板
heading({ tokens, depth }: Tokens.Heading) {
  const text = this.parser.parseInline(tokens)

  // 使用模板生成 H2-H6 标题
  if (depth >= 2 && depth <= 6) {
    return generateHeadingHTML(depth as 2 | 3 | 4 | 5 | 6, text)
  }

  // H1 和其他标题使用默认样式
  if (depth === 1) {
    return generateH1Template(text) // 保留原有的 H1 样式
  }

  const tag = `h${depth}`
  return styledContent(tag, text)
}
```

## 方案二：通过配置选项启用（更灵活）

这种方式允许用户选择是否使用模板，更适合作为可选功能。

### 步骤 1：在 IOpts 中添加选项

修改 `packages/shared/src/types/renderer-types.ts`：

```typescript
export interface IOpts {
  // ... 现有选项
  useHeadingTemplate?: boolean; // 是否使用标题模板
}
```

### 步骤 2：修改渲染器

修改 `packages/core/src/renderer/renderer-impl.ts`：

```typescript
import { generateHeadingHTML } from '@md/shared/utils/headingTemplate'

heading({ tokens, depth }: Tokens.Heading) {
  const text = this.parser.parseInline(tokens)

  // 如果启用了模板选项，使用模板
  if (opts.useHeadingTemplate && depth >= 2 && depth <= 6) {
    return generateHeadingHTML(depth as 2 | 3 | 4 | 5 | 6, text)
  }

  // 否则使用原有逻辑
  if (depth >= 1 && depth <= 6) {
    return generateHeadingTemplate(depth, text)
  }

  const tag = `h${depth}`
  return styledContent(tag, text)
}
```

### 步骤 3：在初始化时启用

修改 `apps/web/src/stores/render.ts`：

```typescript
renderer = initRenderer({
  theme: themeConfig,
  fonts,
  size,
  isUseIndent: options.isUseIndent,
  isUseJustify: options.isUseJustify,
  isMacCodeBlock: options.isMacCodeBlock,
  isShowLineNumber: options.isShowLineNumber,
  useHeadingTemplate: true, // 启用标题模板
});
```

## 方案三：通过 UI 选择模板（最灵活）

创建一个 UI 界面让用户选择不同的模板。

### 步骤 1：创建模板选择组件

创建一个组件让用户选择模板：

```vue
<template>
  <Select v-model="selectedTemplate">
    <SelectTrigger>
      <SelectValue placeholder="选择标题模板" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="default"> 默认样式 </SelectItem>
      <SelectItem value="beautiful"> 精美样式模板 </SelectItem>
    </SelectContent>
  </Select>
</template>
```

### 步骤 2：保存用户选择

将用户选择保存到 localStorage：

```typescript
const selectedTemplate = useStorage(`heading_template`, `default`);
```

### 步骤 3：根据选择应用模板

在渲染器中根据选择应用不同的模板。

## 快速应用（最简单）

如果你想快速应用模板，可以直接修改 `packages/core/src/renderer/renderer-impl.ts` 文件：

1. 在文件顶部添加导入（需要先将工具函数移到 shared 包）
2. 修改 `heading` 函数使用 `generateHeadingHTML`

## 注意事项

- 模板中的颜色变量会根据主题色自动替换
- 确保图标和背景图片 URL 可访问
- 如果模板加载失败，会回退到默认样式
