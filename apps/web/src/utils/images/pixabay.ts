import type { Image, ImageProvider, SearchOptions } from './types'
import axios from 'axios'

export class PixabayProvider implements ImageProvider {
  name = `Pixabay`
  private apiKey: string
  private baseUrl = `https://pixabay.com/api`

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ``
  }

  async search(options: SearchOptions): Promise<Image[]> {
    const { keyword, count = 10, page = 1, orientation = `all` } = options

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          key: this.apiKey,
          q: keyword,
          per_page: count,
          page,
          image_type: `photo`,
          orientation: orientation === `all` ? undefined : orientation,
          safesearch: `true`,
        },
      })

      return response.data.hits.map((item: any) => ({
        id: item.id.toString(),
        url: item.webformatURL,
        thumbnailUrl: item.previewURL,
        title: item.tags || `Untitled`,
        author: item.user,
        authorUrl: `https://pixabay.com/users/${item.user}-${item.user_id}/`,
        source: this.name,
        width: item.webformatWidth,
        height: item.webformatHeight,
        tags: item.tags?.split(`, `),
        license: `Pixabay License`,
      }))
    }
    catch (error) {
      console.error(`Pixabay API error:`, error)
      return []
    }
  }
}
