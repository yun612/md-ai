export interface Image {
  id: string
  url: string
  thumbnailUrl: string
  title: string
  description?: string
  author?: string
  authorUrl?: string
  source: string
  width?: number
  height?: number
  tags?: string[]
  license?: string
}

export interface SearchOptions {
  keyword: string
  count?: number
  page?: number
  orientation?: `horizontal` | `vertical` | `all`
  size?: `small` | `medium` | `large` | `original`
  color?: string
}

export interface ImageProvider {
  name: string
  search: (options: SearchOptions) => Promise<Image[]>
}

export interface ProviderConfig {
  apiKey?: string
  baseUrl: string
}
