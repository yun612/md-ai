# 标题样式模板

## 简介

这是一个精美的标题样式模板集合，包含 H2-H6 的样式设计。模板基于 H2 和 H3 的精美样式，扩展生成了 H4-H6 的样式。

## 模板特点

- **H2**: 装饰圆点 + 背景纹理 + 错位底色效果
- **H3**: 圆角矩形 + 左侧突出块（显示前两个字符）
- **H4**: 简化版装饰圆点 + 渐变背景（基于 H2 风格）
- **H5**: 圆角矩形 + 左侧数字序号（基于 H3 风格）
- **H6**: 简约圆角 + 底部装饰线

## 使用方法

### 1. 加载模板

```typescript
import {
  loadHeadingTemplate,
  generateHeadingHTML,
} from "@/utils/headingTemplate";

// 加载模板配置
const config = loadHeadingTemplate();

// 生成 H2 标题 HTML
const h2HTML = generateHeadingHTML(2, "这是二级标题", config);

// 生成 H3 标题 HTML
const h3HTML = generateHeadingHTML(3, "这是三级标题", config);
```

### 2. 在渲染器中使用

```typescript
import { generateHeadingHTML } from '@/utils/headingTemplate'

// 在 heading 渲染函数中使用
heading({ tokens, depth }: Tokens.Heading) {
  const text = this.parser.parseInline(tokens)

  if (depth >= 2 && depth <= 6) {
    return generateHeadingHTML(depth as 2 | 3 | 4 | 5 | 6, text)
  }

  // 其他标题使用默认样式
  return styledContent(`h${depth}`, text)
}
```

### 3. 查看所有模板

```typescript
import { getAllTemplates } from "@/utils/headingTemplate";

const templates = getAllTemplates();
templates.forEach((template) => {
  console.log(template.name, template.description);
});
```

## 模板变量

模板中使用以下变量，会在生成时自动替换：

- `{{iconUrl}}` - 图标 URL
- `{{bgImageUrl}}` - 背景图片 URL
- `{{text}}` - 标题文本
- `{{lightGreen1}}` - 浅绿色 1（来自 colorTheme）
- `{{lightGreen2}}` - 浅绿色 2（来自 colorTheme）
- `{{green1}}` - 绿色 1（来自 colorTheme）
- 等等...

## 自定义

你可以修改 `heading-styles.json` 文件来自定义样式：

1. 修改颜色主题：编辑 `colorTheme` 对象
2. 修改模板：编辑 `headings.h2` 到 `headings.h6` 的 `template` 字段
3. 修改图标和背景：更新 `iconUrl` 和 `bgImageUrl`

## 文件结构

```
assets/templates/
├── heading-styles.json  # 模板配置文件
└── README.md           # 说明文档
```

## 注意事项

- 模板中的 `{{text.slice(0, 2)}}` 等 JavaScript 表达式需要在应用时特殊处理
- 确保图标和背景图片 URL 可访问
- 颜色值使用十六进制或 rgba 格式
