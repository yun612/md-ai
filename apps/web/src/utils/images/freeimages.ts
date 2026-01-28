import type { Image, ImageProvider, SearchOptions } from './types'
import axios from 'axios'

export class FreeImagesProvider implements ImageProvider {
  name = `FreeImages`
  private apiKey: string
  private baseUrl = `https://freeimages.p.rapidapi.com`

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ``
  }

  async search(options: SearchOptions): Promise<Image[]> {
    const { keyword, count = 10, page = 1 } = options

    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          query: keyword,
          per_page: count,
          page,
        },
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': `freeimages.p.rapidapi.com`,
        },
      })

      return response.data.images.map((item: any) => ({
        id: item.id.toString(),
        url: item.url,
        thumbnailUrl: item.thumbnail_url || item.url,
        title: item.title || `Untitled`,
        description: item.description,
        author: item.author,
        source: this.name,
        width: item.width,
        height: item.height,
        license: `FreeImages License`,
      }))
    }
    catch (error) {
      console.error(`FreeImages API error:`, error)
      return []
    }
  }
}
