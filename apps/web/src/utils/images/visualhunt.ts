import type { Image, ImageProvider, SearchOptions } from './types'
import axios from 'axios'

export class VisualhuntProvider implements ImageProvider {
  name = `Visualhunt`
  private apiKey: string
  private baseUrl = `https://api.visualhunt.com/v1`

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ``
  }

  async search(options: SearchOptions): Promise<Image[]> {
    const { keyword, count = 10, page = 1, color } = options

    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          q: keyword,
          per_page: count,
          page,
          color,
          type: `photo`,
        },
        headers: {
          Authorization: this.apiKey,
        },
      })

      return response.data.photos.map((item: any) => ({
        id: item.id.toString(),
        url: item.url,
        thumbnailUrl: item.url,
        title: item.title || `Untitled`,
        description: item.description,
        source: this.name,
        width: item.width,
        height: item.height,
        tags: item.tags?.map((tag: any) => tag.name),
        license: `Visualhunt License`,
      }))
    }
    catch (error) {
      console.error(`Visualhunt API error:`, error)
      return []
    }
  }
}
