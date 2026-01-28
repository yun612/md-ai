import type { Image, ImageProvider, SearchOptions } from './types'
import axios from 'axios'

export class ShutterstockProvider implements ImageProvider {
  name = `Shutterstock`
  private apiKey: string
  private baseUrl = `https://api.shutterstock.com/v2`

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ``
  }

  async search(options: SearchOptions): Promise<Image[]> {
    const { keyword, count = 10, page = 1, orientation = `all`, color } = options

    try {
      const response = await axios.get(`${this.baseUrl}/images/search`, {
        params: {
          query: keyword,
          per_page: count,
          page,
          orientation: orientation === `all` ? undefined : orientation,
          color,
          view: `minimal`,
        },
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })

      return response.data.data.map((item: any) => ({
        id: item.id,
        url: item.assets?.preview?.url || item.assets?.huge?.url || ``,
        thumbnailUrl: item.assets?.thumb_large?.url || item.assets?.preview?.url || ``,
        title: item.description || `Untitled`,
        description: item.description,
        source: this.name,
        width: item.assets?.preview?.width,
        height: item.assets?.preview?.height,
        license: `Shutterstock License`,
      }))
    }
    catch (error) {
      console.error(`Shutterstock API error:`, error)
      return []
    }
  }
}
