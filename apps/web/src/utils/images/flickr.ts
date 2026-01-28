import type { Image, ImageProvider, SearchOptions } from './types'
import axios from 'axios'

export class FlickrProvider implements ImageProvider {
  name = `Flickr`
  private apiKey: string
  private baseUrl = `https://www.flickr.com/services/rest`

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ``
  }

  async search(options: SearchOptions): Promise<Image[]> {
    const { keyword, count = 10, page = 1 } = options

    try {
      const searchResponse = await axios.get(this.baseUrl, {
        params: {
          method: `flickr.photos.search`,
          api_key: this.apiKey,
          text: keyword,
          per_page: count,
          page,
          format: `json`,
          nojsoncallback: 1,
          safe_search: 1,
        },
      })

      const photos = searchResponse.data.photos?.photo || []

      const images = await Promise.all(
        photos.map(async (photo: any) => {
          const sizeResponse = await axios.get(this.baseUrl, {
            params: {
              method: `flickr.photos.getSizes`,
              api_key: this.apiKey,
              photo_id: photo.id,
              format: `json`,
              nojsoncallback: 1,
            },
          })

          const sizes = sizeResponse.data.sizes?.size || []
          const largeSize = sizes.find((s: any) => s.label === `Large`) || sizes[sizes.length - 1]
          const thumbSize = sizes.find((s: any) => s.label === `Thumbnail`) || sizes[0]

          return {
            id: photo.id,
            url: largeSize?.source || ``,
            thumbnailUrl: thumbSize?.source || ``,
            title: photo.title || `Untitled`,
            source: this.name,
            width: Number.parseInt(largeSize?.width || `0`),
            height: Number.parseInt(largeSize?.height || `0`),
            license: `Flickr License`,
          }
        }),
      )

      return images
    }
    catch (error) {
      console.error(`Flickr API error:`, error)
      return []
    }
  }
}
