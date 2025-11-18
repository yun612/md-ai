import Firecrawl from '@mendable/firecrawl-js'
import { jimengRequest } from './jimeng'

export interface JimengConfig {
  accessKeyId: string
  secretAccessKey: string
  reqKey: string
}

export interface ToolFunctionsContext {
  jimengConfig: { value: JimengConfig }
  saveJimengConfig: () => void
}

function getImageApiConfig(): { endpoint: string, apiKey: string } {
  const endpoint = localStorage.getItem(`image_api_endpoint`) || ``
  const apiKey = localStorage.getItem(`image_api_key`) || ``
  return { endpoint, apiKey }
}

export type ToolFunction = (args: any, context?: ToolFunctionsContext) => Promise<any> | any

export const toolFunctions: Record<string, ToolFunction> = {
  get_current_weather: async (args: { location: string, unit?: string }) => {
    console.log(`调用天气工具，参数:`, args)

    return {
      location: args.location,
      temperature: `22`,
      unit: args.unit || `摄氏度`,
      condition: `晴天`,
      humidity: `65%`,
      wind: `5 km/h`,
      description: `${args.location}今天天气${args.unit === `华氏度` ? `72°F` : `22°C`}，晴天`,
    }
  },

  image_generate: async (args: { prompt: string, size?: string, n?: number, style?: string, image_urls?: string[] }, context?: ToolFunctionsContext) => {
    let prompt = (args.prompt || ``).trim()

    prompt = prompt
      .replace(/^(生成|创建|制作|画|设计|绘制)\s*(一个|一张|一幅)?/, ``)
      .replace(/\s*(的图片|图片)$/, ``)
      .trim()

    if (!prompt) {
      prompt = (args.prompt || ``).trim()
    }

    console.log(`[即梦] 开始生成图片`)
    console.log(`[即梦] 原始提示词:`, args.prompt)
    console.log(`[即梦] 优化后提示词:`, prompt)
    console.log(`[即梦] 其他参数:`, { image_urls: args.image_urls, size: args.size, style: args.style })

    if (!prompt)
      return { error: `prompt 不能为空` }

    if (!context?.jimengConfig.value.accessKeyId || !context?.jimengConfig.value.secretAccessKey) {
      console.error(`未配置API密钥`)
      return { error: `未配置API。请调用 jimeng_set_api_key 设置密钥` }
    }

    console.log(`API密钥已配置:`, context.jimengConfig.value.reqKey)

    const maxRetries = 3
    let lastError: Error | null = null

    // 重试 重新连接
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`重试第 ${attempt} 次，共 ${maxRetries} 次`)
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 2), 5000)))
        }

        const apiResponse = await jimengRequest({
          accessKeyId: context.jimengConfig.value.accessKeyId,
          secretAccessKey: context.jimengConfig.value.secretAccessKey,
          reqKey: context.jimengConfig.value.reqKey,
          imageUrls: args.image_urls || [],
          prompt,
        })

        console.log(`API响应:`, {
          code: apiResponse.code,
          bodyLength: apiResponse.body.length,
          bodyPreview: apiResponse.body.substring(0, 500),
        })

        // 错误调试

        if (apiResponse.code !== 200) {
          console.error(`HTTP状态码错误:`, apiResponse.code)
          console.error(`响应体:`, apiResponse.body)
          throw new Error(`图片生成失败: ${apiResponse.code} ${apiResponse.body}`)
        }

        let data: any
        // 调试错误信息
        try {
          data = JSON.parse(apiResponse.body)
        }
        catch (parseError) {
          console.error(`JSON解析数据:`, parseError)
          console.error(`响应体内容:`, apiResponse.body)
          throw new Error(`API响应格式错误: ${(parseError as Error).message}`)
        }

        console.log(`[即梦] 解析后的数据（完整）:`, JSON.stringify(data, null, 2))
        console.log(`[即梦] 数据结构检查:`, {
          code: data.code,
          message: data.message,
          hasData: !!data.data,
          hasBinaryDataBase64: !!data?.data?.binary_data_base64,
          isArray: Array.isArray(data?.data?.binary_data_base64),
          length: Array.isArray(data?.data?.binary_data_base64) ? data.data.binary_data_base64.length : 0,
          dataKeys: data?.data ? Object.keys(data.data) : [],
        })

        if (data.code !== 10000) {
          if (data.message && (data.message.includes(`审核`) || data.message.includes(`违规`) || data.message.includes(`禁止`))) {
            throw new Error(`内容审核未通过: ${data.message}。请尝试修改提示词，避免敏感内容。`)
          }
          throw new Error(`图片生成失败: ${data.message || `未知错误`} (code: ${data.code})`)
        }

        let images: Array<{ url?: string, base64?: string, prompt: string, op: string, meta: any }> = []

        if (data?.data?.binary_data_base64 && Array.isArray(data.data.binary_data_base64) && data.data.binary_data_base64.length > 0) {
          console.log(`binary_data_base64 格式，共`, data.data.binary_data_base64.length, `张图片`)
          console.log(`第一张图片base64预览:`, `${data.data.binary_data_base64[0].substring(0, 50)}...`)
          images = data.data.binary_data_base64.map((base64Data: string) => ({
            base64: base64Data,
            prompt,
            op: `generate`,
            meta: data.data || data,
          }))
        }
        else if (Array.isArray(data?.data?.image_urls)) {
          images = data.data.image_urls.map((imageUrl: string) => ({
            url: imageUrl,
            prompt,
            op: `generate`,
            meta: data.data || data,
          }))
        }
        else if (typeof data?.data?.image_url === `string`) {
          console.log(`检测到 image_url 格式（单个）`)
          images = [{
            url: data.data.image_url,
            prompt,
            op: `generate`,
            meta: data.data || data,
          }]
        }
        else if (Array.isArray(data?.data?.images)) {
          console.log(`[即梦] 检测到 images 格式，共`, data.data.images.length, `张图片`)
          images = data.data.images.map((img: any) => ({
            url: img.url || img.image_url,
            base64: img.base64,
            prompt,
            op: `generate`,
            meta: img,
          })).filter((img: any) => img.url || img.base64)
        }
        else if (Array.isArray(data?.data)) {
          console.log(`[即梦] 检测到 data.data 数组格式，共`, data.data.length, `项`)
          images = data.data.map((item: any) => ({
            url: item.url || item.image_url,
            base64: item.base64,
            prompt,
            op: `generate`,
            meta: item,
          })).filter((img: any) => img.url || img.base64)
        }
        else if (Array.isArray(data)) {
          console.log(`[即梦] 检测到 data 数组格式，共`, data.length, `项`)
          images = data.map((item: any) => ({
            url: item.url || item.image_url,
            base64: item.base64,
            prompt,
            op: `generate`,
            meta: item,
          })).filter((img: any) => img.url || img.base64)
        }

        console.log(`[即梦] 提取的图片列表:`, images.length, `张`)
        if (images.length > 0) {
          console.log(`[即梦] 第一张图片详情:`, {
            hasUrl: !!images[0].url,
            hasBase64: !!images[0].base64,
            base64Length: images[0].base64?.length || 0,
            base64Preview: `${images[0].base64?.substring(0, 50)}...` || `N/A`,
          })
        }

        if (images.length === 0) {
          console.error(`[即梦] 未找到图片数据`)
          console.error(`[即梦] 返回数据结构:`, {
            code: data.code,
            hasData: !!data.data,
            dataKeys: data.data ? Object.keys(data.data) : [],
            fullData: JSON.stringify(data, null, 2).substring(0, 1000),
          })
          throw new Error(`图片生成成功但未返回图片数据，返回数据: ${JSON.stringify(data, null, 2)}`)
        }

        console.log(`[即梦] 图片生成成功，共`, images.length, `张，准备返回`)
        const returnResult = { images, prompt }
        console.log(`[即梦] 返回结果:`, {
          imagesCount: returnResult.images.length,
          firstImageHasBase64: !!returnResult.images[0]?.base64,
          firstImageHasUrl: !!returnResult.images[0]?.url,
        })
        return returnResult
      }
      catch (e) {
        lastError = e as Error
        const errorMessage = lastError.message || String(lastError)

        const shouldRetry = attempt < maxRetries && (
          errorMessage.includes(`网络`)
          || errorMessage.includes(`timeout`)
          || errorMessage.includes(`ECONNRESET`)
          || errorMessage.includes(`ETIMEDOUT`)
          || errorMessage.includes(`500`)
          || errorMessage.includes(`502`)
          || errorMessage.includes(`503`)
          || errorMessage.includes(`504`)
        )

        if (shouldRetry) {
          console.warn(`[即梦] 第 ${attempt} 次尝试失败，将重试:`, errorMessage)
          continue
        }
        else {
          console.error(`[即梦] 第 ${attempt} 次尝试失败，不再重试:`, errorMessage)
          break
        }
      }
    }

    const finalError = lastError || new Error(`未知错误`)
    console.error(`[即梦] 所有重试均失败，最终错误:`, finalError.message)
    return {
      error: `图片生成失败（已重试 ${maxRetries} 次）: ${finalError.message}`,
    }
  },

  image_remove_background: async (args: { image_url?: string, image_base64?: string }) => {
    const { endpoint, apiKey } = getImageApiConfig()
    if (!endpoint || !apiKey)
      return { error: `未配置图片 API。请设置 localStorage: image_api_endpoint 与 image_api_key` }
    if (!args.image_url && !args.image_base64)
      return { error: `请提供 image_url 或 image_base64` }
    try {
      const url = new URL(endpoint)
      if (!/\/v\d+\/images/.test(url.pathname))
        url.pathname = `${url.pathname.replace(/\/?$/, ``)}/v1/images/edits/remove-bg`
      const resp = await fetch(url.toString(), {
        method: `POST`,
        headers: {
          'Content-Type': `application/json`,
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          image_url: args.image_url,
          image_base64: args.image_base64,
        }),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => ``)
        throw new Error(`去除背景失败: ${resp.status} ${resp.statusText} ${text}`)
      }
      const data = await resp.json().catch(() => ({}))
      const items = Array.isArray(data?.data) ? data.data : []
      const images = items.map((it: any) => ({
        url: it.url,
        base64: it.b64_json,
        op: `remove_background`,
        meta: it,
      }))
      return { images }
    }
    catch (e) {
      return { error: (e as Error).message }
    }
  },

  image_variation: async (args: { image_url?: string, image_base64?: string, prompt?: string, strength?: number }) => {
    const { endpoint, apiKey } = getImageApiConfig()
    if (!endpoint || !apiKey)
      return { error: `未配置图片 API。请设置 localStorage: image_api_endpoint 与 image_api_key` }

    try {
      const url = new URL(endpoint)
      if (!/\/v\d+\/images/.test(url.pathname))
        url.pathname = `${url.pathname.replace(/\/?$/, ``)}/v1/images/variations`
      const resp = await fetch(url.toString(), {
        method: `POST`,
        headers: {
          'Content-Type': `application/json`,
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          image_url: args.image_url,
          image_base64: args.image_base64,
          prompt: args.prompt ?? ``,
          strength: args.strength ?? 0.7,
        }),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => ``)
        throw new Error(`图片变体失败: ${resp.status} ${resp.statusText} ${text}`)
      }
      const data = await resp.json().catch(() => ({}))
      const items = Array.isArray(data?.data) ? data.data : []
      const images = items.map((it: any) => ({
        url: it.url,
        base64: it.b64_json,
        op: `variation`,
        meta: it,
      }))
      return { images }
    }
    catch (e) {
      return { error: (e as Error).message }
    }
  },

  search_web: async (args: { query: string }) => {
    console.log(`调用搜索工具，参数:`, args)

    const query = args.query || ``
    if (!query.trim()) {
      return {
        error: `搜索关键词不能为空`,
        results: [],
      }
    }

    try {
      const firecrawl = new Firecrawl({
        apiKey: `fc-16d6c9d0a18943b6adaf7c045c28f75c`,
      })
      const searchOptions: any = {
        limit: 3,
      }
      const searchPromise = firecrawl.search(query, searchOptions)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`搜索请求超时，请稍后重试`)), 60000),
      )

      const searchResults = await Promise.race([searchPromise, timeoutPromise]) as any

      console.log(`Firecrawl 搜索结果:`, searchResults)

      const results = searchResults?.data || []

      if (!Array.isArray(results) || results.length === 0) {
        return {
          query,
          total_results: 0,
          results: [],
          summary: `未找到关于"${query}"的搜索结果`,
          note: `请尝试使用其他关键词搜索`,
        }
      }

      const formattedResults = results.map((item: any, index: number) => {
        return {
          title: item.title || `搜索结果 ${index + 1}`,
          url: item.url || ``,
          snippet: item.description
            ? item.description.substring(0, 300)
            : item.snippet || item.content?.substring(0, 300) || ``,
          content: item.markdown || item.content || item.description || ``,
        }
      })

      return {
        query,
        total_results: formattedResults.length,
        results: formattedResults,
        summary: `找到 ${formattedResults.length} 条关于"${query}"的搜索结果`,
        source: `Firecrawl`,
      }
    }
    catch (e) {
      console.error(`搜索工具执行失败:`, e)

      const errorMessage = (e as Error).message || `未知错误`

      let errorNote = `请检查网络连接或 API 配置`
      if (errorMessage.includes(`timeout`) || errorMessage.includes(`超时`)) {
        errorNote = `搜索请求超时，可能是网络较慢或 API 服务繁忙，请稍后重试或尝试更简短的关键词`
      }
      else if (errorMessage.includes(`401`) || errorMessage.includes(`403`)) {
        errorNote = `API 认证失败，请检查 API Key 是否正确`
      }
      else if (errorMessage.includes(`429`)) {
        errorNote = `API 请求频率过高，请稍后再试`
      }

      return {
        query,
        error: `搜索失败: ${errorMessage}`,
        results: [],
        note: errorNote,
      }
    }
  },

  generate_article_outline: async (args: { topic: string, style?: string, length?: string }) => {
    console.log(`调用文章大纲生成工具，参数:`, args)

    const topic = args.topic || `未指定主题`
    const style = args.style || `公众号文章`
    const length = args.length || `中等长度`

    return {
      success: true,
      message: `请为"${topic}"生成一篇${style}风格、${length}的文章大纲。请在回复中以 JSON 格式返回大纲数据，格式为：{"outline": {"topic": "主题", "items": [{"id": "1", "title": "标题", "content": "内容"}]}}`,
      topic,
      style,
      length,
    }
  },

  jimeng_set_api_key: async (args: { access_key_id: string, secret_access_key: string, req_key?: string }, context?: ToolFunctionsContext) => {
    console.log(`设置即梦API密钥`)

    if (!args.access_key_id || !args.secret_access_key) {
      return {
        success: false,
        error: `access_key_id 和 secret_access_key 不能为空`,
      }
    }

    if (!context) {
      return {
        success: false,
        error: `缺少配置上下文`,
      }
    }

    context.jimengConfig.value.accessKeyId = args.access_key_id
    context.jimengConfig.value.secretAccessKey = args.secret_access_key
    if (args.req_key) {
      context.jimengConfig.value.reqKey = args.req_key
    }

    context.saveJimengConfig()

    return {
      success: true,
      message: `即梦API密钥配置成功！现在可以使用 image_generate 工具生成图片了。`,
      config: {
        access_key_id: `${args.access_key_id.substring(0, 10)}***`,
        req_key: context.jimengConfig.value.reqKey,
      },
    }
  },
}
