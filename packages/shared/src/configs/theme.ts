import type { IConfigOption, Theme } from '../types'
import { toMerged } from 'es-toolkit'

const defaultTheme: Theme = {
  base: {
    '--md-primary-color': `#000000`,
    'text-align': `left`,
    'line-height': `1.75`,
  },
  block: {
    container: {},
    // 一级标题
    h1: {
      'display': `table`,
      'padding': `0 1em`,
      'border-bottom': `2px solid var(--md-primary-color)`,
      'margin': `2em auto 1em`,
      'color': `hsl(var(--foreground))`,
      'font-size': `1.2em`,
      'font-weight': `bold`,
      'text-align': `center`,
    },

    // 二级标题
    h2: {
      'display': `table`,
      'padding': `0 0.2em`,
      'margin': `4em auto 2em`,
      'color': `#fff`,
      'background': `var(--md-primary-color)`,
      'font-size': `1.2em`,
      'font-weight': `bold`,
      'text-align': `center`,
    },

    // 三级标题
    h3: {
      'padding-left': `8px`,
      'border-left': `3px solid var(--md-primary-color)`,
      'margin': `2em 8px 0.75em 0`,
      'color': `hsl(var(--foreground))`,
      'font-size': `1.1em`,
      'font-weight': `bold`,
      'line-height': `1.2`,
    },

    // 四级标题
    h4: {
      'margin': `2em 8px 0.5em`,
      'color': `var(--md-primary-color)`,
      'font-size': `1em`,
      'font-weight': `bold`,
    },

    // 五级标题
    h5: {
      'margin': `1.5em 8px 0.5em`,
      'color': `var(--md-primary-color)`,
      'font-size': `1em`,
      'font-weight': `bold`,
    },

    // 六级标题
    h6: {
      'margin': `1.5em 8px 0.5em`,
      'font-size': `1em`,
      'color': `var(--md-primary-color)`,
    },

    // 段落
    p: {
      'margin': `1.5em 8px`,
      'letter-spacing': `0.1em`,
      'color': `hsl(var(--foreground))`,
    },

    // 引用
    blockquote: {
      'font-style': `normal`,
      'padding': `1em`,
      'border-left': `4px solid var(--md-primary-color)`,
      'border-radius': `6px`,
      'color': `rgba(0,0,0,0.5)`,
      'background': `var(--blockquote-background)`,
      'margin-bottom': `1em`,
    },

    // 引用内容
    blockquote_p: {
      'display': `block`,
      'font-size': `1em`,
      'letter-spacing': `0.1em`,
      'color': `hsl(var(--foreground))`,
    },

    blockquote_note: {
    },

    blockquote_tip: {
    },

    blockquote_info: {
    },

    blockquote_important: {
    },

    blockquote_warning: {
    },

    blockquote_caution: {
    },

    // GFM 警告块标题
    blockquote_title: {
      'display': `flex`,
      'align-items': `center`,
      'gap': `0.5em`,
      'margin-bottom': `0.5em`,
    },

    blockquote_title_note: {
      color: `#478be6`,
    },

    blockquote_title_tip: {
      color: `#57ab5a`,
    },

    blockquote_title_info: {
      color: `#93c5fd`,
    },

    blockquote_title_important: {
      color: `#986ee2`,
    },

    blockquote_title_warning: {
      color: `#c69026`,
    },

    blockquote_title_caution: {
      color: `#e5534b`,
    },

    blockquote_p_note: {
    },

    blockquote_p_tip: {
    },

    blockquote_p_info: {
    },

    blockquote_p_important: {
    },

    blockquote_p_warning: {
    },

    blockquote_p_caution: {
    },

    // 代码块
    code_pre: {
      'font-size': `90%`,
      'overflow-x': `auto`,
      'border-radius': `8px`,
      'padding': `1em`,
      'line-height': `1.5`,
      'margin': `10px 8px`,
    },

    // 行内代码
    code: {
      'margin': 0,
      'white-space': `nowrap`,
      'font-size': `90%`,
      'font-family': `Menlo, Operator Mono, Consolas, Monaco, monospace`,
    },

    // 图片
    image: {
      'display': `block`,
      'max-width': `100%`,
      'margin': `0.1em auto 0.5em`,
      'border-radius': `4px`,
    },

    // 有序列表
    ol: {
      'padding-left': `1em`,
      'margin-left': `0`,
      'color': `hsl(var(--foreground))`,
    },

    // 无序列表
    ul: {
      'list-style': `circle`,
      'padding-left': `1em`,
      'margin-left': `0`,
      'color': `hsl(var(--foreground))`,
    },

    footnotes: {
      'margin': `0.5em 8px`,
      'font-size': `80%`,
      'color': `hsl(var(--foreground))`,
    },

    figure: {
      margin: `1.5em 8px`,
      color: `hsl(var(--foreground))`,
    },

    hr: {
      'border-style': `solid`,
      'border-width': `2px 0 0`,
      'border-color': `rgba(0,0,0,0.1)`,
      '-webkit-transform-origin': `0 0`,
      '-webkit-transform': `scale(1, 0.5)`,
      'transform-origin': `0 0`,
      'transform': `scale(1, 0.5)`,
      'height': `0.4em`,
      'margin': `1.5em 0`,
    },

    block_katex: {
      'max-width': `100%`,
      'overflow-x': `auto`,
      '-webkit-overflow-scrolling': `touch`,
      'padding': `0.5em 0`,
    },
  },
  inline: {
    listitem: {
      display: `block`,
      margin: `0.2em 8px`,
      color: `hsl(var(--foreground))`,
    },

    codespan: {
      'font-size': `90%`,
      'color': `#d14`,
      'background': `rgba(27,31,35,.05)`,
      'padding': `3px 5px`,
      'border-radius': `4px`,
      // 'word-break': `break-all`,
    },

    em: {
      'font-style': `italic`,
      'font-size': `inherit`,
    },

    link: {
      color: `#576b95`,
    },

    wx_link: {
      'color': `#576b95`,
      'text-decoration': `none`,
    },

    // 字体加粗样式
    strong: {
      'color': `var(--md-primary-color)`,
      'font-weight': `bold`,
      'font-size': `inherit`,
    },

    table: {
      color: `hsl(var(--foreground))`,
    },

    thead: {
      'font-weight': `bold`,
      'color': `hsl(var(--foreground))`,
    },

    th: {
      'border': `1px solid #dfdfdf`,
      'padding': `0.25em 0.5em`,
      'color': `hsl(var(--foreground))`,
      'word-break': `keep-all`,
      'background': `rgba(0, 0, 0, 0.05)`,
    },

    td: {
      'border': `1px solid #dfdfdf`,
      'padding': `0.25em 0.5em`,
      'color': `hsl(var(--foreground))`,
      'word-break': `keep-all`,
    },

    footnote: {
      'font-size': `12px`,
      'color': `hsl(var(--foreground))`,
    },

    figcaption: {
      'text-align': `center`,
      'color': `#888`,
      'font-size': `0.8em`,
    },

    inline_katex: {
      'max-width': `100%`,
      'overflow-x': `auto`,
    },

    markup_highlight: {
      'background-color': `var(--md-primary-color)`,
      'padding': `2px 4px`,
      'border-radius': `2px`,
      'color': `#fff`,
    },
    markup_underline: {
      'text-decoration': `underline`,
      'text-decoration-color': `var(--md-primary-color)`,
    },
    markup_wavyline: {
      'text-decoration': `underline wavy`,
      'text-decoration-color': `var(--md-primary-color)`,
      'text-decoration-thickness': `2px`,
    },

  },
}

const graceTheme = toMerged(defaultTheme, {
  base: {
  },
  block: {
    'container': {},
    'h1': {
      'padding': `0.5em 1em`,
      'border-bottom': `2px solid var(--md-primary-color)`,
      'font-size': `1.4em`,
      'text-shadow': `2px 2px 4px rgba(0,0,0,0.1)`,
    },

    'h2': {
      'padding': `0.3em 1em`,
      'border-radius': `8px`,
      'font-size': `1.3em`,
      'box-shadow': `0 4px 6px rgba(0,0,0,0.1)`,
    },

    'h3': {
      'padding-left': `12px`,
      'font-size': `1.2em`,
      'border-left': `4px solid var(--md-primary-color)`,
      'border-bottom': `1px dashed var(--md-primary-color)`,
    },

    'h4': {
      'font-size': `1.1em`,
    },

    'h5': {
      'font-size': `1em`,
    },

    'h6': {
      'font-size': `1em`,
    },

    'p': {
    },

    'blockquote': {
      'font-style': `italic`,
      'padding': `1em 1em 1em 2em`,
      'border-left': `4px solid var(--md-primary-color)`,
      'border-radius': `6px`,
      'color': `rgba(0,0,0,0.6)`,
      'box-shadow': `0 4px 6px rgba(0,0,0,0.05)`,
      'margin-bottom': `1em`,
    },

    'blockquote_p': {
    },

    'markdown-alert': {
      'font-style': `italic`,
    },

    'code_pre': {
      'box-shadow': `inset 0 0 10px rgba(0,0,0,0.05)`,
    },

    'code': {
      'font-family': `'Fira Code', Menlo, Operator Mono, Consolas, Monaco, monospace`,
    },

    'image': {
      'border-radius': `8px`,
      'box-shadow': `0 4px 8px rgba(0,0,0,0.1)`,
    },

    'ol': {
      'padding-left': `1.5em`,
    },

    'ul': {
      'list-style': `none`,
      'padding-left': `1.5em`,
    },

    'footnotes': {

    },

    'figure': {

    },

    'hr': {
      height: `1px`,
      border: `none`,
      margin: `2em 0`,
      background: `linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,0.1), rgba(0,0,0,0))`,
    },
  },
  inline: {
    listitem: {
      margin: `0.5em 8px`,
    },

    codespan: {
    },

    em: {
    },

    link: {
    },

    wx_link: {
    },

    strong: {
    },

    table: {
      'border-collapse': `separate`,
      'border-spacing': `0`,
      'border-radius': `8px`,
      'margin': `1em 8px`,
      'color': `hsl(var(--foreground))`,
      'box-shadow': `0 4px 6px rgba(0,0,0,0.1)`,
      'overflow': `hidden`,
    },

    thead: {
      color: `#fff`,
    },

    td: {
      padding: `0.5em 1em`,
    },

    footnote: {
      color: `rgba(0,0,0,0.5)`,
    },

    figcaption: {

    },
  },
})

const simpleTheme = toMerged(defaultTheme, {
  base: {
  },
  block: {
    container: {},
    h1: {
      'padding': `0.5em 1em`,
      'font-size': `1.4em`,
      'text-shadow': `1px 1px 3px rgba(0,0,0,0.05)`,
    },

    h2: {
      'padding': `0.3em 1.2em`,
      'font-size': `1.3em`,
      'border-radius': `8px 24px 8px 24px`,
      'box-shadow': `0 2px 6px rgba(0,0,0,0.06)`,
    },

    h3: {
      'padding-left': `12px`,
      'font-size': `1.2em`,
      'border-radius': `6px`,
      'line-height': `2.4em`,
      'border-left': `4px solid var(--md-primary-color)`,
      'border-right': `1px solid color-mix(in srgb, var(--md-primary-color) 10%, transparent)`,
      'border-bottom': `1px solid color-mix(in srgb, var(--md-primary-color) 10%, transparent)`,
      'border-top': `1px solid color-mix(in srgb, var(--md-primary-color) 10%, transparent)`,
      'background': `color-mix(in srgb, var(--md-primary-color) 8%, transparent)`,
    },

    h4: {
      'font-size': `1.1em`,
      'border-radius': `6px`,
    },

    h5: {
      'border-radius': `6px`,
    },

    h6: {
      'border-radius': `6px`,
    },

    blockquote: {
      'font-style': `italic`,
      'padding': `1em 1em 1em 2em`,
      'color': `rgba(0,0,0,0.6)`,
      'border-bottom': `0.2px solid rgba(0, 0, 0, 0.04)`,
      'border-top': `0.2px solid rgba(0, 0, 0, 0.04)`,
      'border-right': `0.2px solid rgba(0, 0, 0, 0.04)`,
    },

    blockquote_note: {
      'font-style': `italic`,
    },

    blockquote_tip: {
      'font-style': `italic`,
    },

    blockquote_info: {
      'font-style': `italic`,
    },

    blockquote_important: {
      'font-style': `italic`,
    },

    blockquote_warning: {
      'font-style': `italic`,
    },

    blockquote_caution: {
      'font-style': `italic`,
    },

    blockquote_title: {
    },

    blockquote_title_note: {

    },

    blockquote_title_tip: {
    },

    blockquote_title_info: {
    },

    blockquote_title_important: {
    },

    blockquote_title_warning: {
    },

    blockquote_title_caution: {
    },

    blockquote_p_note: {
    },

    blockquote_p_tip: {
    },

    blockquote_p_info: {
    },

    blockquote_p_important: {
    },

    blockquote_p_warning: {
    },

    blockquote_p_caution: {
    },

    code_pre: {
      border: `1px solid rgba(0, 0, 0, 0.04)`,
    },

    code: {
      'font-family': `'Fira Code', Menlo, Operator Mono, Consolas, Monaco, monospace`,
    },

    image: {
      'border-radius': `8px`,
      'border': `1px solid rgba(0, 0, 0, 0.04)`,
    },

    ol: {
      'padding-left': `1.5em`,
    },

    ul: {
      'list-style': `none`,
      'padding-left': `1.5em`,
    },

    hr: {
      height: `1px`,
      border: `none`,
      margin: `2em 0`,
      background: `linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,0.1), rgba(0,0,0,0))`,
    },
  },
  inline: {
    listitem: {
      margin: `0.5em 8px`,
    },
  },
})

const auroraTheme = toMerged(defaultTheme, {
  base: {
    '--md-primary-color': `#6a5acd`,
    'line-height': `1.85`,
    'letter-spacing': `0.02em`,
  },
  block: {
    container: {
      'background': `linear-gradient(145deg, rgba(106,90,205,0.12), rgba(99,179,237,0.12))`,
      'padding': `18px 18px 22px`,
      'border-radius': `18px`,
      'box-shadow': `0 12px 32px rgba(62,118,244,0.18)`,
    },
    h1: {
      'padding': `16px 18px`,
      'border-radius': `16px`,
      'background': `linear-gradient(120deg, rgba(99,179,237,0.95), rgba(123,97,255,0.95))`,
      'color': `#fff`,
      'letter-spacing': `0.04em`,
      'text-align': `left`,
      'box-shadow': `0 10px 28px rgba(123,97,255,0.32)`,
    },
    h2: {
      'padding': `10px 14px`,
      'border-radius': `12px`,
      'background': `linear-gradient(110deg, rgba(255,255,255,0.95), rgba(255,255,255,0.75))`,
      'border': `1px solid rgba(106,90,205,0.18)`,
      'box-shadow': `0 8px 18px rgba(62,118,244,0.12)`,
      'color': `#1f2937`,
    },
    h3: {
      'padding': `6px 10px`,
      'border-radius': `10px`,
      'border-left': `4px solid var(--md-primary-color)`,
      'background': `rgba(99,179,237,0.08)`,
      'color': `#1f2937`,
    },
    h4: {
      'padding-left': `12px`,
      'border-left': `3px solid rgba(106,90,205,0.55)`,
      'color': `#374151`,
    },
    p: {
      margin: `1.25em 6px`,
      color: `#0f172a`,
    },
    blockquote: {
      'padding': `14px 16px`,
      'border-left': `5px solid rgba(123,97,255,0.65)`,
      'border-radius': `14px`,
      'background': `linear-gradient(145deg, rgba(123,97,255,0.08), rgba(99,179,237,0.08))`,
      'box-shadow': `inset 0 1px 0 rgba(255,255,255,0.4)`,
      'color': `#1f2937`,
    },
    blockquote_title: {
      color: `rgba(26,86,219,0.95)`,
    },
    code_pre: {
      'border-radius': `14px`,
      'border': `1px solid rgba(15,23,42,0.08)`,
      'background': `#0f172a`,
      'color': `#e2e8f0`,
      'box-shadow': `0 10px 24px rgba(0,0,0,0.28)`,
    },
    code: {
      'background': `rgba(15,23,42,0.12)`,
      'padding': `3px 6px`,
      'border-radius': `6px`,
    },
    image: {
      'border-radius': `14px`,
      'box-shadow': `0 12px 32px rgba(62,118,244,0.18)`,
    },
    ul: {
      'list-style': `disc`,
      'padding-left': `1.5em`,
    },
    ol: {
      'padding-left': `1.6em`,
    },
    hr: {
      height: `2px`,
      border: `none`,
      background: `linear-gradient(90deg, rgba(123,97,255,0), rgba(123,97,255,0.45), rgba(123,97,255,0))`,
      margin: `2.25em 0`,
    },
    figure: {
      'background': `rgba(255,255,255,0.9)`,
      'padding': `12px`,
      'border-radius': `12px`,
      'box-shadow': `0 8px 20px rgba(15,23,42,0.08)`,
    },
  },
  inline: {
    listitem: {
      margin: `0.35em 6px`,
    },
    codespan: {
      'background': `rgba(15,23,42,0.06)`,
      'color': `#0f172a`,
      'border-radius': `6px`,
    },
    strong: {
      color: `#0f172a`,
    },
    link: {
      'color': `#2563eb`,
      'text-decoration': `none`,
      'border-bottom': `1px dashed rgba(37,99,235,0.35)`,
    },
    wx_link: {
      'text-decoration': `none`,
      'border-bottom': `1px dashed rgba(37,99,235,0.35)`,
    },
    footnote: {
      color: `rgba(15,23,42,0.7)`,
    },
  },
})

const notebookTheme = toMerged(defaultTheme, {
  base: {
    '--md-primary-color': `#c47a44`,
    'line-height': `1.8`,
    'letter-spacing': `0.01em`,
    'background': `#f9f4ec`,
  },
  block: {
    container: {
      'background': `#fdfaf3`,
      'padding': `16px 18px 22px`,
      'border-radius': `18px`,
      'box-shadow': `0 18px 32px rgba(201,164,116,0.18)`,
      'border': `1px solid rgba(196,122,68,0.16)`,
    },
    h1: {
      'padding': `12px 16px`,
      'border-left': `6px solid var(--md-primary-color)`,
      'background': `linear-gradient(90deg, rgba(196,122,68,0.18), rgba(196,122,68,0))`,
      'border-radius': `14px`,
      'color': `#5b3b1a`,
      'letter-spacing': `0.03em`,
    },
    h2: {
      'padding': `10px 14px`,
      'border-left': `4px solid rgba(196,122,68,0.65)`,
      'background': `rgba(196,122,68,0.08)`,
      'border-radius': `12px`,
      'color': `#5b3b1a`,
    },
    h3: {
      'padding-left': `12px`,
      'border-left': `3px solid rgba(196,122,68,0.55)`,
      'color': `#6b4421`,
    },
    h4: {
      'color': `#7d4c26`,
      'padding-left': `10px`,
      'border-left': `2px dashed rgba(196,122,68,0.45)`,
    },
    p: {
      margin: `1.2em 6px`,
      color: `#3b2f26`,
    },
    blockquote: {
      'padding': `14px 16px`,
      'border-left': `5px solid rgba(196,122,68,0.65)`,
      'background': `#fff7ec`,
      'border-radius': `12px`,
      'box-shadow': `inset 0 1px 0 rgba(255,255,255,0.6)`,
      'color': `#3b2f26`,
    },
    blockquote_title: {
      color: `rgba(196,122,68,0.95)`,
    },
    blockquote_p: {
      color: `#3b2f26`,
    },
    code_pre: {
      'border-radius': `14px`,
      'border': `1px solid rgba(0,0,0,0.06)`,
      'background': `#111827`,
      'color': `#fef9ee`,
      'box-shadow': `0 12px 24px rgba(0,0,0,0.18)`,
    },
    code: {
      'background': `rgba(196,122,68,0.14)`,
      'padding': `3px 6px`,
      'border-radius': `6px`,
      'color': `#5b3b1a`,
    },
    image: {
      'border-radius': `12px`,
      'border': `1px solid rgba(0,0,0,0.05)`,
      'box-shadow': `0 10px 24px rgba(201,164,116,0.16)`,
    },
    ul: {
      'list-style': `circle`,
      'padding-left': `1.6em`,
    },
    ol: {
      'padding-left': `1.7em`,
    },
    hr: {
      border: `none`,
      height: `1px`,
      background: `repeating-linear-gradient(90deg, rgba(196,122,68,0.45), rgba(196,122,68,0.45) 12px, transparent 12px, transparent 20px)`,
      margin: `2em 0`,
    },
    figure: {
      'background': `#fffdf8`,
      'padding': `12px`,
      'border-radius': `12px`,
      'border': `1px solid rgba(196,122,68,0.18)`,
      'box-shadow': `0 10px 20px rgba(201,164,116,0.14)`,
    },
  },
  inline: {
    listitem: {
      margin: `0.45em 6px`,
      color: `#3b2f26`,
    },
    codespan: {
      'background': `rgba(196,122,68,0.14)`,
      'border-radius': `6px`,
      'color': `#5b3b1a`,
    },
    strong: {
      color: `#5b3b1a`,
    },
    link: {
      'color': `#8c4a24`,
      'text-decoration': `none`,
      'border-bottom': `1px dashed rgba(140,74,36,0.4)`,
    },
    wx_link: {
      'text-decoration': `none`,
      'border-bottom': `1px dashed rgba(140,74,36,0.4)`,
    },
    footnote: {
      color: `rgba(59,47,38,0.8)`,
    },
  },
})

const plazaTheme = toMerged(defaultTheme, {
  base: {
    '--md-primary-color': `#2563eb`,
    'line-height': `1.85`,
    'letter-spacing': `0.02em`,
  },
  block: {
    container: {
      'background': `linear-gradient(145deg, rgba(37,99,235,0.1), rgba(123,97,255,0.08))`,
      'padding': `18px 18px 22px`,
      'border-radius': `18px`,
      'box-shadow': `0 14px 32px rgba(37,99,235,0.16)`,
      'border': `1px solid rgba(37,99,235,0.18)`,
    },
    h1: {
      'padding': `14px 16px`,
      'border-radius': `14px`,
      'background': `linear-gradient(120deg, rgba(37,99,235,0.92), rgba(123,97,255,0.85))`,
      'color': `#fff`,
      'letter-spacing': `0.04em`,
      'box-shadow': `0 12px 28px rgba(37,99,235,0.28)`,
    },
    h2: {
      'padding': `10px 14px`,
      'border-radius': `12px`,
      'background': `#fff`,
      'border': `1px solid rgba(37,99,235,0.14)`,
      'box-shadow': `0 10px 20px rgba(37,99,235,0.12)`,
      'color': `#1f2937`,
    },
    h3: {
      'padding': `8px 12px`,
      'border-left': `4px solid var(--md-primary-color)`,
      'border-radius': `12px`,
      'background': `rgba(37,99,235,0.08)`,
      'color': `#111827`,
    },
    p: {
      color: `#0f172a`,
    },
    blockquote: {
      'padding': `14px 16px`,
      'border-left': `5px solid rgba(37,99,235,0.6)`,
      'background': `linear-gradient(135deg, rgba(37,99,235,0.08), rgba(123,97,255,0.08))`,
      'border-radius': `12px`,
      'color': `#0f172a`,
    },
    code_pre: {
      'background': `#0f172a`,
      'color': `#e2e8f0`,
      'border': `1px solid rgba(255,255,255,0.08)`,
      'border-radius': `14px`,
      'box-shadow': `0 12px 26px rgba(0,0,0,0.32)`,
    },
    code: {
      'background': `rgba(37,99,235,0.08)`,
      'padding': `3px 6px`,
      'border-radius': `6px`,
      'color': `#1d4ed8`,
    },
    image: {
      'border-radius': `14px`,
      'box-shadow': `0 12px 26px rgba(37,99,235,0.18)`,
    },
    hr: {
      height: `2px`,
      border: `none`,
      background: `linear-gradient(90deg, rgba(37,99,235,0), rgba(37,99,235,0.45), rgba(37,99,235,0))`,
      margin: `2em 0`,
    },
  },
  inline: {
    listitem: {
      margin: `0.35em 6px`,
    },
    codespan: {
      'background': `rgba(37,99,235,0.08)`,
      'color': `#0f172a`,
      'border-radius': `6px`,
    },
    link: {
      'color': `#2563eb`,
      'text-decoration': `none`,
      'border-bottom': `1px dashed rgba(37,99,235,0.35)`,
    },
    wx_link: {
      'text-decoration': `none`,
      'border-bottom': `1px dashed rgba(37,99,235,0.35)`,
    },
  },
})

const sunsetTheme = toMerged(defaultTheme, {
  base: {
    '--md-primary-color': `#f97316`,
    'line-height': `1.9`,
    'letter-spacing': `0.015em`,
    'background': `#fffaf5`,
  },
  block: {
    container: {
      'background': `#fffaf5`,
      'padding': `16px 18px 22px`,
      'border-radius': `18px`,
      'border': `1px solid rgba(249,115,22,0.16)`,
      'box-shadow': `0 14px 30px rgba(249,115,22,0.18)`,
    },
    h1: {
      'padding': `12px 16px`,
      'border-radius': `14px`,
      'background': `linear-gradient(120deg, rgba(249,115,22,0.92), rgba(244,114,182,0.78))`,
      'color': `#fff7ed`,
      'letter-spacing': `0.03em`,
      'box-shadow': `0 12px 26px rgba(249,115,22,0.26)`,
    },
    h2: {
      'padding': `10px 14px`,
      'border-left': `4px solid rgba(249,115,22,0.6)`,
      'background': `rgba(249,115,22,0.08)`,
      'border-radius': `12px`,
      'color': `#7c2d12`,
    },
    h3: {
      'padding-left': `12px`,
      'border-left': `3px solid rgba(249,115,22,0.5)`,
      'color': `#7c2d12`,
    },
    p: {
      color: `#4a2c16`,
    },
    blockquote: {
      'padding': `14px 16px`,
      'border-left': `5px solid rgba(249,115,22,0.55)`,
      'background': `linear-gradient(145deg, rgba(249,115,22,0.08), rgba(244,114,182,0.08))`,
      'border-radius': `12px`,
      'color': `#5f370e`,
    },
    code_pre: {
      'background': `#111827`,
      'color': `#fef9ee`,
      'border-radius': `14px`,
      'border': `1px solid rgba(255,255,255,0.06)`,
      'box-shadow': `0 12px 24px rgba(0,0,0,0.28)`,
    },
    code: {
      'background': `rgba(249,115,22,0.1)`,
      'padding': `3px 6px`,
      'border-radius': `6px`,
      'color': `#c2410c`,
    },
    image: {
      'border-radius': `14px`,
      'box-shadow': `0 10px 24px rgba(249,115,22,0.18)`,
    },
    hr: {
      height: `2px`,
      border: `none`,
      background: `linear-gradient(90deg, rgba(249,115,22,0), rgba(249,115,22,0.4), rgba(249,115,22,0))`,
      margin: `2em 0`,
    },
  },
  inline: {
    listitem: {
      margin: `0.4em 6px`,
      color: `#4a2c16`,
    },
    codespan: {
      'background': `rgba(249,115,22,0.1)`,
      'color': `#7c2d12`,
      'border-radius': `6px`,
    },
    strong: {
      color: `#7c2d12`,
    },
    link: {
      'color': `#c2410c`,
      'text-decoration': `none`,
      'border-bottom': `1px dashed rgba(249,115,22,0.4)`,
    },
    wx_link: {
      'text-decoration': `none`,
      'border-bottom': `1px dashed rgba(249,115,22,0.4)`,
    },
  },
})

const inkTheme = toMerged(defaultTheme, {
  base: {
    '--md-primary-color': `#d1b17a`,
    'line-height': `1.9`,
    'letter-spacing': `0.02em`,
    'background': `#0b1220`,
  },
  block: {
    container: {
      'background': `linear-gradient(135deg, #0b1220, #0f172a)`,
      'padding': `18px 18px 22px`,
      'border-radius': `18px`,
      'border': `1px solid rgba(209,177,122,0.24)`,
      'box-shadow': `0 16px 36px rgba(0,0,0,0.32)`,
    },
    h1: {
      'padding': `14px 16px`,
      'border-radius': `14px`,
      'background': `linear-gradient(120deg, rgba(209,177,122,0.85), rgba(209,177,122,0.65))`,
      'color': `#0b1220`,
      'letter-spacing': `0.04em`,
      'box-shadow': `0 12px 28px rgba(0,0,0,0.4)`,
    },
    h2: {
      'padding': `10px 14px`,
      'border-left': `4px solid rgba(209,177,122,0.7)`,
      'background': `rgba(209,177,122,0.08)`,
      'border-radius': `12px`,
      'color': `#f7f3ea`,
    },
    h3: {
      'padding-left': `12px`,
      'border-left': `3px solid rgba(209,177,122,0.55)`,
      'color': `#f7f3ea`,
    },
    p: {
      color: `#cbd5e1`,
    },
    blockquote: {
      'padding': `14px 16px`,
      'border-left': `5px solid rgba(209,177,122,0.55)`,
      'background': `rgba(15,23,42,0.65)`,
      'border-radius': `12px`,
      'color': `#e2e8f0`,
      'box-shadow': `inset 0 1px 0 rgba(255,255,255,0.05)`,
    },
    code_pre: {
      'background': `#0b1220`,
      'color': `#f7f3ea`,
      'border-radius': `14px`,
      'border': `1px solid rgba(209,177,122,0.22)`,
      'box-shadow': `0 12px 28px rgba(0,0,0,0.4)`,
    },
    code: {
      'background': `rgba(209,177,122,0.14)`,
      'padding': `3px 6px`,
      'border-radius': `6px`,
      'color': `#f7f3ea`,
    },
    image: {
      'border-radius': `14px`,
      'border': `1px solid rgba(209,177,122,0.16)`,
      'box-shadow': `0 12px 30px rgba(0,0,0,0.32)`,
    },
    hr: {
      height: `1px`,
      border: `none`,
      background: `linear-gradient(90deg, rgba(209,177,122,0), rgba(209,177,122,0.45), rgba(209,177,122,0))`,
      margin: `2em 0`,
    },
  },
  inline: {
    listitem: {
      margin: `0.4em 6px`,
      color: `#e2e8f0`,
    },
    codespan: {
      'background': `rgba(209,177,122,0.14)`,
      'color': `#f7f3ea`,
      'border-radius': `6px`,
    },
    strong: {
      color: `#f7f3ea`,
    },
    link: {
      'color': `#d1b17a`,
      'text-decoration': `none`,
      'border-bottom': `1px dashed rgba(209,177,122,0.4)`,
    },
    wx_link: {
      'text-decoration': `none`,
      'border-bottom': `1px dashed rgba(209,177,122,0.4)`,
    },
  },
})

export const themeMap = {
  default: defaultTheme,
  grace: graceTheme,
  simple: simpleTheme,
  aurora: auroraTheme,
  notebook: notebookTheme,
  plaza: plazaTheme,
  sunset: sunsetTheme,
  ink: inkTheme,
}

export const themeOptions: IConfigOption<keyof typeof themeMap>[] = [
  {
    label: `经典`,
    value: `default`,
    desc: ``,
  },
  {
    label: `优雅`,
    value: `grace`,
    desc: `@brzhang`,
  },
  {
    label: `简洁`,
    value: `simple`,
    desc: `@okooo5km`,
  },
  {
    label: `霓虹杂志`,
    value: `aurora`,
    desc: `渐变标题卡片`,
  },
  {
    label: `质感手账`,
    value: `notebook`,
    desc: `纸感留白`,
  },
  {
    label: `质感商务`,
    value: `plaza`,
    desc: `蓝紫渐变`,
  },
  {
    label: `暖夕叙事`,
    value: `sunset`,
    desc: `橙粉故事`,
  },
  {
    label: `夜色黑金`,
    value: `ink`,
    desc: `暗色高定`,
  },
]
