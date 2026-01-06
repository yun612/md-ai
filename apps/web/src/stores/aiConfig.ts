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
  type: string
  temperature: number
  maxToken: number
  apiKey: string
  model: string
  endpoint: string
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
  const existing = await storage.getConfigByKey(serviceType, AI_CONFIG_CATEGORY)

  const configData = {
    category: AI_CONFIG_CATEGORY,
    key: serviceType,
    val: JSON.stringify(config),
    id: existing?.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  }

  if (existing) {
    await storage.createConfig(configData)
  }
  else {
    await storage.createConfig(configData)
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
      maxToken.value = savedConfig.maxToken ?? DEFAULT_SERVICE_MAX_TOKEN
      model.value = svc.models.includes(savedConfig.model) ? savedConfig.model : svc.models[0]
      apiKey.value = savedConfig.apiKey || DEFAULT_SERVICE_KEY
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
      type: type.value,
      temperature: temperature.value,
      maxToken: maxToken.value,
      apiKey: apiKey.value,
      model: model.value,
      endpoint: endpoint.value,
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
      id: existing?.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    }

    if (existing) {
      await storage.createConfig(globalData)
    }
    else {
      await storage.createConfig(globalData)
    }
  }

  watch(type, async (newType) => {
    await saveGlobalConfig()
    await syncServiceConfig(newType)
  })

  watch([temperature, maxToken, model, apiKey], async () => {
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
          type: service.value,
          temperature: DEFAULT_SERVICE_TEMPERATURE,
          maxToken: DEFAULT_SERVICE_MAX_TOKEN,
          apiKey: DEFAULT_SERVICE_KEY,
          model: service.models[0],
          endpoint: service.endpoint,
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
  }
})

export default useAIConfigStore
