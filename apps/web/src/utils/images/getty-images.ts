import type { Image, ImageProvider, SearchOptions } from './types'
import axios from 'axios'

export class GettyImagesProvider implements ImageProvider {
  name = `Getty Images`
  private apiKey: string
  private baseUrl = `https://api.gettyimages.com/v3`

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ``
  }

  async search(options: SearchOptions): Promise<Image[]> {
    const { keyword, count = 10, page = 1, orientation = `all` } = options

    try {
      const response = await axios.get(`${this.baseUrl}/search/images`, {
        params: {
          phrase: keyword,
          page_size: count,
          page,
          orient: orientation === `all` ? undefined : orientation,
          sort_order: `best_match`,
        },
        headers: {
          'Api-Key': this.apiKey,
        },
      })

      return response.data.images.map((item: any) => ({
        id: item.id,
        url: item.display_sizes[0]?.uri || ``,
        thumbnailUrl: item.display_sizes.find((d: any) => d.name === `thumb`)?.uri || item.display_sizes[0]?.uri || ``,
        title: item.title || `Untitled`,
        description: item.caption,
        source: this.name,
        width: item.display_sizes[0]?.width,
        height: item.display_sizes[0]?.height,
        license: `Getty Images License`,
      }))
    }
    catch (error) {
      console.error(`Getty Images API error:`, error)
      return []
    }
  }
}
