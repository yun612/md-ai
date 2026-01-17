import type { Config } from '@grisaiaevy/crafting-agent'
import { serviceOptions } from '@md/shared/configs'
import {
  DEFAULT_SERVICE_KEY,
  DEFAULT_SERVICE_MAX_TOKEN,
  DEFAULT_SERVICE_TEMPERATURE,
  DEFAULT_SERVICE_TYPE,
} from '@md/shared/constants'
import { IndexedDBTaskStorage } from '../agents/indexeddb_storage'

const AI_CONFIG_CATEGORY = `llm`

interface ServiceConfig {
  provider: string
  temperature: number
  maxTokens: number
  apiKey: string
  modelName: string
  baseUrl: string
}

let storageInstance: IndexedDBTaskStorage | null = null

function getStorage(): IndexedDBTaskStorage {
  if (!storageInstance) {
    storageInstance = new IndexedDBTaskStorage()
  }
  return storageInstance
}

async function getServiceConfig(serviceType: string): Promise<ServiceConfig | null> {
  const storage = getStorage()
  const config = await storage.getConfigByKey(serviceType, AI_CONFIG_CATEGORY)
  if (config?.val) {
    try {
      return JSON.parse(config.val)
    }
    catch (e) {
      console.error(`Failed to parse config for ${serviceType}:`, e)
      return null
    }
  }
  return null
}

async function setServiceConfig(serviceType: string, config: ServiceConfig): Promise<void> {
  const storage = getStorage()

  // 通过 category + key 查询现有配置
  const existing = await storage.getConfigByKey(serviceType, AI_CONFIG_CATEGORY)

  const configData = {
    category: AI_CONFIG_CATEGORY,
    key: serviceType,
    val: JSON.stringify(config),
  } as Config

  // 如果存在，传递 id 以确保更新而不是创建新记录
  if (existing?.id) {
    configData.id = existing.id
  }

  await storage.createConfig(configData)
}

async function clearOldConfigs(): Promise<void> {
  const storage = getStorage()
  const configs = await storage.getConfigsByCategory(AI_CONFIG_CATEGORY)

  for (const config of configs) {
    if (config?.val) {
      try {
        const parsed = JSON.parse(config.val)
        if (parsed.type !== undefined || parsed.model !== undefined || parsed.endpoint !== undefined || parsed.maxToken !== undefined) {
          console.log(`[AIConfig] Clearing old config for key:`, config.key)
          await storage.deleteConfig(config.id)
        }
      }
      catch (e) {
        console.error(`[AIConfig] Failed to parse config:`, e)
      }
    }
  }
}

async function clearDuplicateConfigs(): Promise<void> {
  const storage = getStorage()
  const configs = await storage.getConfigsByCategory(AI_CONFIG_CATEGORY)

  // 按 key 分组，保留最新的记录
  const configsByKey = new Map<string, Config[]>()

  for (const config of configs) {
    if (!configsByKey.has(config.key)) {
      configsByKey.set(config.key, [])
    }
    configsByKey.get(config.key)!.push(config)
  }

  // 删除重复的配置，只保留最新的一条
  for (const [key, configList] of configsByKey) {
    if (configList.length > 1) {
      // 按 updatedAt 排序，保留最新的
      configList.sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      })

      // 删除除了第一条（最新）之外的所有记录
      for (let i = 1; i < configList.length; i++) {
        console.log(`[AIConfig] Deleting duplicate config for key "${key}":`, configList[i].id)
        await storage.deleteConfig(configList[i].id)
      }
    }
  }
}

export const useAIConfigStore = defineStore(`AIConfig`, () => {
  const type = ref<string>(DEFAULT_SERVICE_TYPE)
  const temperature = ref<number>(DEFAULT_SERVICE_TEMPERATURE)
  const maxToken = ref<number>(DEFAULT_SERVICE_MAX_TOKEN)
  const endpoint = ref<string>(``)
  const model = ref<string>(``)
  const apiKey = ref<string>(DEFAULT_SERVICE_KEY)

  const isLoaded = ref(false)

  async function loadConfig() {
    // 移除或注释掉清理逻辑，避免误删正常配置
    // await clearOldConfigs()
    // await clearDuplicateConfigs()

    const storage = getStorage()
    const globalConfig = await storage.getConfigByKey(`global`, AI_CONFIG_CATEGORY)

    if (globalConfig?.val) {
      try {
        const parsed = JSON.parse(globalConfig.val)
        type.value = parsed.type || DEFAULT_SERVICE_TYPE
      }
      catch (e) {
        type.value = DEFAULT_SERVICE_TYPE
      }
    }

    await syncServiceConfig(type.value)
    isLoaded.value = true
  }

  async function syncServiceConfig(serviceType: string) {
    const svc = serviceOptions.find(s => s.value === serviceType) ?? serviceOptions[0]
    endpoint.value = svc.endpoint

    const savedConfig = await getServiceConfig(serviceType)

    if (savedConfig) {
      temperature.value = savedConfig.temperature ?? DEFAULT_SERVICE_TEMPERATURE
      maxToken.value = savedConfig.maxTokens ?? DEFAULT_SERVICE_MAX_TOKEN
      model.value = savedConfig.modelName ?? ``
      apiKey.value = savedConfig.apiKey || DEFAULT_SERVICE_KEY
      endpoint.value = savedConfig.baseUrl || svc.endpoint
    }
    else {
      temperature.value = DEFAULT_SERVICE_TEMPERATURE
      maxToken.value = DEFAULT_SERVICE_MAX_TOKEN
      model.value = svc.models[0]
      apiKey.value = DEFAULT_SERVICE_KEY
    }
  }

  async function saveCurrentConfig() {
    if (!isLoaded.value)
      return

    const config: ServiceConfig = {
      provider: type.value,
      temperature: temperature.value,
      maxTokens: maxToken.value,
      apiKey: apiKey.value,
      modelName: model.value,
      baseUrl: endpoint.value,
    }

    await setServiceConfig(type.value, config)
  }

  async function saveGlobalConfig() {
    const storage = getStorage()
    const existing = await storage.getConfigByKey(`global`, AI_CONFIG_CATEGORY)

    const globalData = {
      category: AI_CONFIG_CATEGORY,
      key: `global`,
      val: JSON.stringify({ type: type.value }),
    } as Config

    // 如果存在，传递 id 以确保更新而不是创建新记录
    if (existing?.id) {
      globalData.id = existing.id
    }

    await storage.createConfig(globalData)
  }

  // 自动保存配置
  watch(type, async (newType) => {
    if (!isLoaded.value || !newType)
      return
    await syncServiceConfig(newType)
    await saveGlobalConfig()
  })

  watch([model, endpoint, apiKey, temperature, maxToken], async () => {
    if (!isLoaded.value)
      return
    await saveCurrentConfig()
  }, { deep: true })

  const reset = async () => {
    type.value = DEFAULT_SERVICE_TYPE
    temperature.value = DEFAULT_SERVICE_TEMPERATURE
    maxToken.value = DEFAULT_SERVICE_MAX_TOKEN

    const storage = getStorage()
    for (const service of serviceOptions) {
      const existing = await storage.getConfigByKey(service.value, AI_CONFIG_CATEGORY)

      if (existing) {
        const defaultConfig: ServiceConfig = {
          provider: service.value,
          temperature: DEFAULT_SERVICE_TEMPERATURE,
          maxTokens: DEFAULT_SERVICE_MAX_TOKEN,
          apiKey: DEFAULT_SERVICE_KEY,
          modelName: service.models[0],
          baseUrl: service.endpoint,
        }

        await storage.createConfig({
          id: existing.id,
          category: AI_CONFIG_CATEGORY,
          key: service.value,
          val: JSON.stringify(defaultConfig),
        })
      }
    }

    await saveGlobalConfig()
  }

  loadConfig()

  return {
    type,
    endpoint,
    model,
    temperature,
    maxToken,
    apiKey,
    isLoaded,
    reset,
    loadConfig,
    saveCurrentConfig,
    saveGlobalConfig,
  }
})

export default useAIConfigStore
