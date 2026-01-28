import type { Image, ImageProvider, SearchOptions } from './types'
import { FlickrProvider } from './flickr'
import { FreeImagesProvider } from './freeimages'
import { GettyImagesProvider } from './getty-images'
import { IStockProvider } from './istock'
import { PexelsProvider } from './pexels'
import { PixabayProvider } from './pixabay'
import { ShutterstockProvider } from './shutterstock'
import { UnsplashProvider } from './unsplash'
import { VisualhuntProvider } from './visualhunt'

export interface ImageManagerConfig {
  providers?: {
    unsplash?: string
    pexels?: string
    pixabay?: string
    flickr?: string
    istock?: string
    shutterstock?: string
    gettyImages?: string
    visualhunt?: string
    freeimages?: string
  }
}

export class ImageManager {
  private providers: Map<string, ImageProvider> = new Map()

  constructor(config: ImageManagerConfig = {}) {
    this.initializeProviders(config)
  }

  private initializeProviders(config: ImageManagerConfig) {
    const { providers = {} } = config

    const unsplashKey = providers.unsplash || import.meta.env.VITE_UNSPLASH_API_KEY
    const pexelsKey = providers.pexels || import.meta.env.VITE_PEXELS_API_KEY
    const pixabayKey = providers.pixabay || import.meta.env.VITE_PIXABAY_API_KEY
    const flickrKey = providers.flickr || import.meta.env.VITE_FLICKR_API_KEY
    const istockKey = providers.istock || import.meta.env.VITE_ISTOCK_API_KEY
    const shutterstockKey = providers.shutterstock || import.meta.env.VITE_SHUTTERSTOCK_API_KEY
    const gettyImagesKey = providers.gettyImages || import.meta.env.VITE_GETTY_IMAGES_API_KEY
    const visualhuntKey = providers.visualhunt || import.meta.env.VITE_VISUALHUNT_API_KEY
    const freeimagesKey = providers.freeimages || import.meta.env.VITE_FREEIMAGES_API_KEY

    if (unsplashKey) {
      this.providers.set(`unsplash`, new UnsplashProvider(unsplashKey))
    }
    if (pexelsKey) {
      this.providers.set(`pexels`, new PexelsProvider(pexelsKey))
    }
    if (pixabayKey) {
      this.providers.set(`pixabay`, new PixabayProvider(pixabayKey))
    }
    if (flickrKey) {
      this.providers.set(`flickr`, new FlickrProvider(flickrKey))
    }
    if (istockKey) {
      this.providers.set(`istock`, new IStockProvider(istockKey))
    }
    if (shutterstockKey) {
      this.providers.set(`shutterstock`, new ShutterstockProvider(shutterstockKey))
    }
    if (gettyImagesKey) {
      this.providers.set(`gettyImages`, new GettyImagesProvider(gettyImagesKey))
    }
    if (visualhuntKey) {
      this.providers.set(`visualhunt`, new VisualhuntProvider(visualhuntKey))
    }
    if (freeimagesKey) {
      this.providers.set(`freeimages`, new FreeImagesProvider(freeimagesKey))
    }
  }

  async searchImages(
    keyword: string,
    options: Omit<SearchOptions, `keyword`> & {
      provider?: string | string[]
      count?: number
    } = {},
  ): Promise<Image[]> {
    const { provider, count = 10, ...searchOptions } = options
    const finalOptions: SearchOptions = {
      keyword,
      count,
      ...searchOptions,
    }

    if (!provider) {
      return this.searchAllProviders(finalOptions, count)
    }

    if (Array.isArray(provider)) {
      return this.searchMultipleProviders(provider, finalOptions, count)
    }

    return this.searchSingleProvider(provider, finalOptions)
  }

  private async searchAllProviders(options: SearchOptions, totalCount: number): Promise<Image[]> {
    const providerCount = this.providers.size
    if (providerCount === 0) {
      console.warn(`No image providers configured`)
      return []
    }

    const countPerProvider = Math.ceil(totalCount / providerCount)
    const results = await Promise.all(
      Array.from(this.providers.values()).map(provider =>
        provider.search({ ...options, count: countPerProvider }),
      ),
    )

    return results.flat().slice(0, totalCount)
  }

  private async searchMultipleProviders(
    providerNames: string[],
    options: SearchOptions,
    totalCount: number,
  ): Promise<Image[]> {
    const validProviders = providerNames
      .map(name => this.providers.get(name))
      .filter((p): p is ImageProvider => p !== undefined)

    if (validProviders.length === 0) {
      console.warn(`No valid image providers found`)
      return []
    }

    const countPerProvider = Math.ceil(totalCount / validProviders.length)
    const results = await Promise.all(
      validProviders.map(provider => provider.search({ ...options, count: countPerProvider })),
    )

    return results.flat().slice(0, totalCount)
  }

  private async searchSingleProvider(providerName: string, options: SearchOptions): Promise<Image[]> {
    const provider = this.providers.get(providerName)
    if (!provider) {
      console.warn(`Provider "${providerName}" not found`)
      return []
    }

    return provider.search(options)
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  addProvider(name: string, provider: ImageProvider): void {
    this.providers.set(name, provider)
  }

  removeProvider(name: string): boolean {
    return this.providers.delete(name)
  }
}

export function createImageManager(config?: ImageManagerConfig): ImageManager {
  return new ImageManager(config)
}
