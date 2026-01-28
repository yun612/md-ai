import type { Image, ImageProvider, SearchOptions } from './types'
import axios from 'axios'

export class PexelsProvider implements ImageProvider {
  name = `Pexels`
  private apiKey: string
  private baseUrl = `https://api.pexels.com/v1`

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ``
  }

  async search(options: SearchOptions): Promise<Image[]> {
    const { keyword, count = 10, page = 1, orientation = `all` } = options

    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          query: keyword,
          per_page: count,
          page,
          orientation: orientation === `all` ? undefined : orientation,
        },
        headers: {
          Authorization: this.apiKey,
        },
      })

      return response.data.photos.map((item: any) => ({
        id: item.id.toString(),
        url: item.src.large,
        thumbnailUrl: item.src.medium,
        title: item.alt || `Untitled`,
        author: item.photographer,
        authorUrl: item.photographer_url,
        source: this.name,
        width: item.width,
        height: item.height,
        license: `Pexels License`,
      }))
    }
    catch (error) {
      console.error(`Pexels API error:`, error)
      return []
    }
  }
}
