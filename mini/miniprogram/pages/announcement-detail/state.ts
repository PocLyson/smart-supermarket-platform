import { HttpResponseError } from '../../services/http'

export interface AnnouncementDetailFailureState {
  ended: boolean
  loadError: string
}

export const announcementDetailFailureState = (
  error: unknown,
): AnnouncementDetailFailureState =>
  error instanceof HttpResponseError &&
  (error.statusCode === 404 || error.code === 'NOT_FOUND')
    ? { ended: true, loadError: '' }
    : {
        ended: false,
        loadError: '公告加载失败，请检查网络后重新加载',
      }
