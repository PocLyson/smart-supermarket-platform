import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createAnnouncementsService } from '../miniprogram/services/announcements'
import {
  HttpResponseError,
  NetworkUncertainError,
} from '../miniprogram/services/http'
import { announcementDetailFailureState } from '../miniprogram/pages/announcement-detail/state'

const miniRoot = resolve(__dirname, '..', 'miniprogram')

function read(relativePath: string) {
  return readFileSync(resolve(miniRoot, relativePath), 'utf8')
}

describe('announcements service', () => {
  it('uses the public announcement endpoints with their exact pagination contract', async () => {
    const get = vi.fn().mockResolvedValue(null)
    const announcements = createAnnouncementsService({ get })

    await announcements.latest()
    await announcements.list()
    await announcements.detail(7)

    expect(get).toHaveBeenNthCalledWith(1, '/api/mini/announcements/latest')
    expect(get).toHaveBeenNthCalledWith(
      2,
      '/api/mini/announcements',
      { page: 0, size: 20 },
    )
    expect(get).toHaveBeenNthCalledWith(3, '/api/mini/announcements/7')
  })
})

describe('announcement mini-program visual and resilience contract', () => {
  it('ends only for not found and keeps network or server failures retryable', () => {
    expect(
      announcementDetailFailureState(
        new HttpResponseError('missing', 404, 'NOT_FOUND', 'request-404'),
      ),
    ).toEqual({ ended: true, loadError: '' })
    expect(
      announcementDetailFailureState(
        new HttpResponseError('missing', 409, 'NOT_FOUND', 'request-business'),
      ),
    ).toEqual({ ended: true, loadError: '' })

    const expectedRetryable = {
      ended: false,
      loadError: '公告加载失败，请检查网络后重新加载',
    }
    expect(announcementDetailFailureState(new NetworkUncertainError())).toEqual(
      expectedRetryable,
    )
    expect(
      announcementDetailFailureState(
        new HttpResponseError('server error', 500, 'INTERNAL_ERROR', 'request-500'),
      ),
    ).toEqual(expectedRetryable)
  })

  it('places a conditional announcement bar after the hero and before categories', () => {
    const home = read('pages/home/index.wxml')
    const heroIndex = home.indexOf('class="home-hero"')
    const announcementIndex = home.indexOf('class="announcement-strip"')
    const categoryIndex = home.indexOf('class="category-heading"')

    expect(announcementIndex).toBeGreaterThan(heroIndex)
    expect(announcementIndex).toBeLessThan(categoryIndex)
    expect(home).toMatch(
      /<view wx:if="\{\{latestAnnouncement\}\}" class="announcement-strip"[\s\S]*?bindtap="onOpenAnnouncement"/,
    )
    expect(home).toContain('catchtap="onOpenAnnouncements"')
  })

  it('registers the announcement list and detail pages', () => {
    const appConfig = JSON.parse(read('app.json')) as { pages: string[] }

    expect(appConfig.pages).toContain('pages/announcements/index')
    expect(appConfig.pages).toContain('pages/announcement-detail/index')
  })

  it('loads announcements independently and hides the strip if that request fails', () => {
    const home = read('pages/home/index.ts')
    const onLoad = home.match(/onLoad\(\)\s*\{([\s\S]*?)\n  \},/)

    expect(onLoad?.[1]).toContain('void this.loadLatestAnnouncement()')
    expect(onLoad?.[1]).toContain('void this.loadInitial()')
    expect(home).toMatch(
      /async loadLatestAnnouncement\(\)[\s\S]*?catch\s*\{\s*this\.setData\(\{ latestAnnouncement: undefined \}\)/,
    )
  })

  it('renders ended detail content as plain pre-wrapped text rather than rich text', () => {
    const detail = read('pages/announcement-detail/index.wxml')
    const styles = read('pages/announcement-detail/index.wxss')

    expect(detail).toContain('该公告已结束')
    expect(detail).toContain('bindtap="onBack"')
    expect(detail).toContain('wx:elif="{{loadError}}"')
    expect(detail).toContain('公告加载失败')
    expect(detail).toContain('bindtap="onRetry"')
    expect(detail).toContain('重新加载')
    expect(detail).toContain('<text class="announcement-content">{{announcement.content}}</text>')
    expect(detail).not.toContain('<rich-text')
    expect(styles).toMatch(
      /\.announcement-content\s*\{[\s\S]*?white-space:\s*pre-wrap;/,
    )
  })
})
