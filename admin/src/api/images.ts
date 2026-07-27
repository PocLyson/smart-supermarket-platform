import { request } from './http'

export interface ImageUploadResponse {
  url: string
  width: number
  height: number
  size: number
}

export const uploadProductImage = (file: File): Promise<ImageUploadResponse> => {
  const body = new FormData()
  body.append('file', file)
  return request('/api/admin/files/images', {
    method: 'POST',
    body,
  })
}
