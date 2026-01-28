import type { Image, ImageProvider, SearchOptions } from './types'
import axios from 'axios'

export class IStockProvider implements ImageProvider {
  name = `iStock`
  private apiKey: string
  private baseUrl = `https://api.istockphoto.com/v2`

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ``
  }

  async search(options: SearchOptions): Promise<Image[]> {
    const { keyword, count = 10, page = 1, orientation = `all` } = options

    try {
      const response = await axios.get(`${this.baseUrl}/images/search`, {
        params: {
          query: keyword,
          count,
          page,
          orientation: orientation === `all` ? undefined : orientation,
        },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept-Language': `en-US`,
        },
      })

      return response.data.data.map((item: any) => ({
        id: item.id,
        url: item.display_sizes[0]?.uri || ``,
        thumbnailUrl: item.display_sizes.find((d: any) => d.name === `thumb`)?.uri || item.display_sizes[0]?.uri || ``,
        title: item.title || `Untitled`,
        description: item.description,
        source: this.name,
        width: item.display_sizes[0]?.width,
        height: item.display_sizes[0]?.height,
        license: `iStock License`,
      }))
    }
    catch (error) {
      console.error(`iStock API error:`, error)
      return []
    }
  }
}
