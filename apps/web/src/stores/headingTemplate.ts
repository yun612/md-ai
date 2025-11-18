import type { HeadingStylesConfig } from '@md/shared/utils/headingTemplate'
import { getDefaultTemplate, loadTemplateFromFile, registerTemplate } from '@md/shared/utils/headingTemplate'
import beautifulTemplate from '@/assets/templates/heading-styles.json'
import { addPrefix } from '@/utils'

export interface TemplateInfo {
  id: string
  name: string
  description: string
  filePath?: string
  config?: HeadingStylesConfig
}

const DEFAULT_TEMPLATE_ID = `beautiful`

const builtInTemplates: TemplateInfo[] = [
  {
    id: `beautiful`,
    name: `精美样式模板`,
    description: `基于H2和H3的精美样式，包含H4-H6的扩展样式`,
    config: beautifulTemplate as HeadingStylesConfig,
  },
  {
    id: `default`,
    name: `默认样式`,
    description: `使用系统默认的标题样式`,
  },
]

export const useHeadingTemplateStore = defineStore(`headingTemplate`, () => {
  // 添加错误处理，避免 Storage 配额错误
  let storageValue = DEFAULT_TEMPLATE_ID
  try {
    const stored = localStorage.getItem(addPrefix(`heading_template_id`))
    if (stored) {
      storageValue = stored
    }
  }
  catch (error) {
    console.warn(`Failed to read heading template from storage:`, error)
  }

  const selectedTemplateId = ref<string>(storageValue)

  // 监听变化并保存到 storage（带错误处理）
  watch(selectedTemplateId, (newValue) => {
    try {
      localStorage.setItem(addPrefix(`heading_template_id`), newValue)
    }
    catch (error) {
      console.warn(`Failed to save heading template to storage:`, error)
    }
  }, { immediate: false })

  const templates = ref<Map<string, HeadingStylesConfig>>(new Map())

  // 初始化时立即加载默认模板
  const beautifulTemplateConfig = beautifulTemplate as HeadingStylesConfig
  templates.value.set(`beautiful`, beautifulTemplateConfig)

  const currentTemplate = computed(() => {
    if (selectedTemplateId.value === `default`) {
      return null
    }

    // 优先从 Map 中获取
    let template = templates.value.get(selectedTemplateId.value)

    // 如果 Map 中没有，但选择的是 beautiful，直接返回配置
    if (!template && selectedTemplateId.value === `beautiful`) {
      template = beautifulTemplateConfig
      // 同时更新 Map，避免下次再查找
      templates.value.set(`beautiful`, beautifulTemplateConfig)
    }

    return template || null
  })

  async function loadTemplate(templateId: string) {
    if (templateId === `default`) {
      return null
    }

    if (templates.value.has(templateId)) {
      return templates.value.get(templateId)!
    }

    const templateInfo = builtInTemplates.find(t => t.id === templateId)

    if (templateInfo?.config) {
      templates.value.set(templateId, templateInfo.config)
      return templateInfo.config
    }

    if (templateInfo?.filePath) {
      try {
        const config = await loadTemplateFromFile(templateId, templateInfo.filePath)
        templates.value.set(templateId, config)
        return config
      }
      catch (error) {
        console.warn(`Failed to load template ${templateId} from file, using default`, error)
        const defaultTemplate = getDefaultTemplate()
        templates.value.set(templateId, defaultTemplate)
        return defaultTemplate
      }
    }

    if (templateId === `beautiful`) {
      const defaultTemplate = getDefaultTemplate()
      templates.value.set(templateId, defaultTemplate)
      return defaultTemplate
    }

    return getDefaultTemplate()
  }

  async function selectTemplate(templateId: string) {
    selectedTemplateId.value = templateId
    await loadTemplate(templateId)
  }

  const customTemplates = ref<TemplateInfo[]>([])

  function addCustomTemplate(templateId: string, config: HeadingStylesConfig) {
    registerTemplate(templateId, config)
    templates.value.set(templateId, config)
  }

  function getAvailableTemplates(): TemplateInfo[] {
    return [...builtInTemplates, ...customTemplates.value]
  }

  function addTemplateFromFile(templateId: string, filePath: string, name: string, description: string) {
    const templateInfo: TemplateInfo = {
      id: templateId,
      name,
      description,
      filePath,
    }
    customTemplates.value.push(templateInfo)
    loadTemplate(templateId)
  }

  function addTemplateFromConfig(templateId: string, config: HeadingStylesConfig, name?: string, description?: string) {
    const templateInfo: TemplateInfo = {
      id: templateId,
      name: name || config.name,
      description: description || config.description,
      config,
    }
    customTemplates.value.push(templateInfo)
    addCustomTemplate(templateId, config)
  }

  // 初始化时加载模板
  loadTemplate(selectedTemplateId.value)

  return {
    selectedTemplateId,
    currentTemplate,
    selectTemplate,
    addCustomTemplate,
    getAvailableTemplates,
    loadTemplate,
    addTemplateFromFile,
    addTemplateFromConfig,
  }
})
