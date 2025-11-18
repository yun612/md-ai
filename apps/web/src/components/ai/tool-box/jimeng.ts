import CryptoJS from 'crypto-js'

interface RequestConfig {
  region: string
  service: string
  schema: string
  host: string
  path: string
  ak: string
  sk: string
}

class VolcEngineSign {
  private static readonly URLENCODER = new Set<number>()
  private static readonly CONST_ENCODE = `0123456789ABCDEF`

  private region: string
  private service: string
  private schema: string
  private host: string
  private path: string
  private ak: string
  private sk: string

  static {
    for (let i = 97; i <= 122; i++) {
      VolcEngineSign.URLENCODER.add(i)
    }
    for (let i = 65; i <= 90; i++) {
      VolcEngineSign.URLENCODER.add(i)
    }
    for (let i = 48; i <= 57; i++) {
      VolcEngineSign.URLENCODER.add(i)
    }
    VolcEngineSign.URLENCODER.add(`-`.charCodeAt(0))
    VolcEngineSign.URLENCODER.add(`_`.charCodeAt(0))
    VolcEngineSign.URLENCODER.add(`.`.charCodeAt(0))
    VolcEngineSign.URLENCODER.add(`~`.charCodeAt(0))
  }

  constructor(config: RequestConfig) {
    this.region = config.region
    this.service = config.service
    this.host = config.host
    this.schema = config.schema
    this.path = config.path
    this.ak = config.ak
    this.sk = config.sk
  }

  private signStringEncoder(source: string): string {
    if (!source) {
      return ``
    }

    const buf: string[] = []
    const encoder = new TextEncoder()
    const bytes = encoder.encode(source)

    for (const b of bytes) {
      if (VolcEngineSign.URLENCODER.has(b)) {
        buf.push(String.fromCharCode(b))
      }
      else if (b === 32) {
        buf.push(`%20`)
      }
      else {
        buf.push(`%`)
        const hex1 = VolcEngineSign.CONST_ENCODE.charAt(b >> 4)
        const hex2 = VolcEngineSign.CONST_ENCODE.charAt(b & 15)
        buf.push(hex1)
        buf.push(hex2)
      }
    }

    return buf.join(``)
  }

  private hashSHA256(content: string | Uint8Array): string {
    if (typeof content === `string`) {
      return CryptoJS.SHA256(content).toString()
    }
    else {
      const wordArray = CryptoJS.lib.WordArray.create(content as any)
      return CryptoJS.SHA256(wordArray).toString()
    }
  }

  private hmacSHA256(key: string | Uint8Array, content: string): Uint8Array {
    let keyWordArray: CryptoJS.lib.WordArray

    if (typeof key === `string`) {
      keyWordArray = CryptoJS.enc.Utf8.parse(key)
    }
    else {
      keyWordArray = CryptoJS.lib.WordArray.create(key as any)
    }

    const hmac = CryptoJS.HmacSHA256(content, keyWordArray)
    const hmacHex = hmac.toString(CryptoJS.enc.Hex)

    const bytes = new Uint8Array(hmacHex.length / 2)
    for (let i = 0; i < hmacHex.length; i += 2) {
      bytes[i / 2] = Number.parseInt(hmacHex.substr(i, 2), 16)
    }
    return bytes
  }

  private genSigningSecretKeyV4(secretKey: string, date: string, region: string, service: string): Uint8Array {
    const kDate = this.hmacSHA256(secretKey, date)
    const kRegion = this.hmacSHA256(kDate, region)
    const kService = this.hmacSHA256(kRegion, service)
    return this.hmacSHA256(kService, `request`)
  }

  async doRequest(
    method: string,
    queryList: Record<string, string>,
    body: string | Uint8Array,
    date: Date,
    action: string,
    version: string,
  ): Promise<{ code: number, body: string }> {
    const bodyBytes = typeof body === `string` ? new TextEncoder().encode(body) : body
    const xContentSha256 = this.hashSHA256(bodyBytes)

    const xDate = date.toISOString().replace(/[:-]|\.\d{3}/g, ``).replace(/(\d{8})T(\d{6}).*/, `$1T$2Z`)
    const shortXDate = xDate.substring(0, 8)
    const contentType = `application/json`
    const signHeader = `host;x-date;x-content-sha256;content-type`

    const realQueryList: Record<string, string> = { ...queryList }
    realQueryList.Action = action
    realQueryList.Version = version

    const sortedKeys = Object.keys(realQueryList).sort()
    const queryParts = sortedKeys.map(key =>
      `${this.signStringEncoder(key)}=${this.signStringEncoder(realQueryList[key])}`,
    )
    const queryString = queryParts.join(`&`)

    const canonicalString = [
      method,
      this.path,
      queryString,
      `host:${this.host}`,
      `x-date:${xDate}`,
      `x-content-sha256:${xContentSha256}`,
      `content-type:${contentType}`,
      ``,
      signHeader,
      xContentSha256,
    ].join(`\n`)

    console.log(canonicalString)

    const hashCanonicalString = this.hashSHA256(canonicalString)
    const credentialScope = `${shortXDate}/${this.region}/${this.service}/request`
    const signString = `HMAC-SHA256\n${xDate}\n${credentialScope}\n${hashCanonicalString}`

    const signKey = this.genSigningSecretKeyV4(this.sk, shortXDate, this.region, this.service)
    const signatureBytes = this.hmacSHA256(signKey, signString)
    const signature = Array.from(signatureBytes).map(b => b.toString(16).padStart(2, `0`)).join(``)

    const url = `${this.schema}://${this.host}${this.path}?${queryString}`

    const headers: Record<string, string> = {
      'Host': this.host,
      'X-Date': xDate,
      'X-Content-Sha256': xContentSha256,
      'Content-Type': contentType,
      'Authorization': `HMAC-SHA256 Credential=${this.ak}/${credentialScope}, SignedHeaders=${signHeader}, Signature=${signature}`,
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (method !== `GET` && bodyBytes.length > 0) {
      options.body = bodyBytes.buffer as ArrayBuffer
    }

    console.log(`[即梦签名] 请求URL:`, url)
    console.log(`[即梦签名] 请求Body:`, body)
    console.log(`[即梦签名] 签名:`, `${signature.substring(0, 20)}...`)

    try {
      const response = await fetch(url, options)
      const responseBody = await response.text()

      console.log(`[即梦签名] 响应状态:`, response.status)
      console.log(`[即梦签名] 响应Body:`, responseBody.substring(0, 500))

      return {
        code: response.status,
        body: responseBody,
      }
    }
    catch (error) {
      console.error(`[即梦签名] 请求失败:`, error)
      throw error
    }
  }
}

export async function jimengRequest(params: {
  accessKeyId: string
  secretAccessKey: string
  reqKey: string
  imageUrls: string[]
  prompt: string
}) {
  const endpoint = `visual.volcengineapi.com`
  const path = `/`
  const service = `cv`
  const region = `cn-north-1`
  const schema = `https`

  const sign = new VolcEngineSign({
    region,
    service,
    schema,
    host: endpoint,
    path,
    ak: params.accessKeyId,
    sk: params.secretAccessKey,
  })

  const action = `CVProcess`
  const version = `2022-08-31`
  const date = new Date()

  const req = {
    req_key: params.reqKey,
    image_urls: params.imageUrls,
    prompt: params.prompt,
  }

  return await sign.doRequest(`POST`, {}, JSON.stringify(req), date, action, version)
}

export default VolcEngineSign
