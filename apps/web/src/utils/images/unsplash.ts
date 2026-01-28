import type { Image, ImageProvider, SearchOptions } from './types'
import axios from 'axios'

export class UnsplashProvider implements ImageProvider {
  name = `Unsplash`
  private apiKey: string
  private baseUrl = `https://api.unsplash.com`

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ``
  }

  async search(options: SearchOptions): Promise<Image[]> {
    const { keyword, count = 10, page = 1, orientation = `landscape` } = options

    try {
      const response = await axios.get(`${this.baseUrl}/search/photos`, {
        params: {
          query: keyword,
          per_page: count,
          page,
          orientation,
        },
        headers: {
          Authorization: `Client-ID ${this.apiKey}`,
        },
      })

      return response.data.results.map((item: any) => ({
        id: item.id,
        url: item.urls.regular,
        thumbnailUrl: item.urls.thumb,
        title: item.alt_description || `Untitled`,
        description: item.description,
        author: item.user.name,
        authorUrl: item.user.links.html,
        source: this.name,
        width: item.width,
        height: item.height,
        tags: item.tags?.map((tag: any) => tag.title),
        license: `Unsplash License`,
      }))
    }
    catch (error) {
      console.error(`Unsplash API error:`, error)
      return []
    }
  }
}
