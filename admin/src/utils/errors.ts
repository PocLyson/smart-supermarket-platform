import { ElMessage } from 'element-plus'
import { ApiError } from '@/api/http'

export const reportUnexpectedError = (error: unknown, fallback: string): void => {
  if (!(error instanceof ApiError)) ElMessage.error(fallback)
}
