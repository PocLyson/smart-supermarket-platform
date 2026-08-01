import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  buildSettingsView,
  canClearLocalUsage,
  completeAccountDeletion,
  completeLogout,
  confirmAccountDeletion,
  confirmLocalUsageCleanup,
  ACCOUNT_DELETION_SUCCESS_FEEDBACK,
  LOCAL_CLEANUP_SUCCESS_FEEDBACK,
  LOGOUT_SUCCESS_FEEDBACK,
} from '../miniprogram/pages/settings/presentation'

const miniRoot = resolve(__dirname, '..', 'miniprogram')
const read = (relativePath: string) =>
  readFileSync(resolve(miniRoot, relativePath), 'utf8')

describe('settings presentation', () => {
  it('describes logged-in and logged-out account states', () => {
    expect(buildSettingsView(true)).toEqual({
      loggedIn: true,
      accountStatus: '微信账号 · 已登录',
    })
    expect(buildSettingsView(false)).toEqual({
      loggedIn: false,
      accountStatus: '未登录',
    })
  })

  it('explains the exact local cleanup scope', async () => {
    const confirm = vi.fn().mockResolvedValue(true)

    await expect(confirmLocalUsageCleanup(confirm)).resolves.toBe(true)

    expect(confirm.mock.calls[0][0].content).toContain('购物车')
    expect(confirm.mock.calls[0][0].content).toContain('搜索记录')
    expect(confirm.mock.calls[0][0].content).toContain('不会删除账号')
  })

  it('uses a complete short success message for the native toast', () => {
    expect(LOCAL_CLEANUP_SUCCESS_FEEDBACK).toEqual({
      title: '清除成功',
      icon: 'success',
    })
    expect(LOCAL_CLEANUP_SUCCESS_FEEDBACK.title.length).toBeLessThanOrEqual(4)
  })

  it('only allows local cleanup for a logged-in idle account', () => {
    expect(canClearLocalUsage(true, false)).toBe(true)
    expect(canClearLocalUsage(false, false)).toBe(false)
    expect(canClearLocalUsage(true, true)).toBe(false)
  })

  it('shows logout success feedback after returning to profile', async () => {
    const events: string[] = []

    await completeLogout({
      clearSession: () => events.push('clear'),
      showSuccess: () => events.push('toast'),
      returnToProfile: async () => {
        events.push('return')
      },
    })

    expect(events).toEqual(['clear', 'return', 'toast'])
    expect(LOGOUT_SUCCESS_FEEDBACK).toEqual({
      title: '账号已退出',
      icon: 'success',
    })
  })

  it('shows deletion success feedback after returning to profile', async () => {
    const events: string[] = []

    await completeAccountDeletion({
      clearLocalUsage: () => events.push('clear-local'),
      clearSession: () => events.push('clear-session'),
      clearAllStorage: () => events.push('clear-storage'),
      showSuccess: () => events.push('toast'),
      returnToProfile: async () => {
        events.push('return')
      },
    })

    expect(events).toEqual([
      'clear-local',
      'clear-session',
      'clear-storage',
      'return',
      'toast',
    ])
    expect(ACCOUNT_DELETION_SUCCESS_FEEDBACK).toEqual({
      title: '账号已注销',
      icon: 'success',
    })
  })

  it('requires two confirmations before account deletion', async () => {
    const confirm = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)

    await expect(confirmAccountDeletion(confirm)).resolves.toBe(true)

    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('renders the approved grouped settings structure', () => {
    const markup = read('pages/settings/index.wxml')
    const styles = read('pages/settings/index.wxss')

    expect(markup).toContain('账号设置')
    expect(markup).not.toContain('隐私设置')
    expect(markup).not.toContain('用户服务协议')
    expect(markup).not.toContain('隐私政策')
    expect(markup).toContain('账号管理')
    expect(markup.indexOf('清除本地使用记录')).toBeLessThan(
      markup.indexOf('退出登录'),
    )
    expect(markup).not.toContain('默认取货信息')
    expect(markup).toMatch(
      /<view\s+wx:if="\{\{loggedIn\}\}"\s+class="settings-row is-action local-cleanup-row"/,
    )
    expect(styles).toMatch(
      /\.settings-row\s*\{[\s\S]*?min-height:\s*96rpx;/,
    )
    expect(styles).toMatch(
      /\.delete-account-button\s*\{[\s\S]*?width:\s*100%;[\s\S]*?text-align:\s*left;/,
    )
    expect(markup).toContain('<text class="delete-account-label">')
    expect(markup).toMatch(
      /<view\s+class="delete-account-button/,
    )
    expect(markup).toContain('role="button"')
    expect(markup).not.toContain('<button class="delete-account-button"')
    expect(styles).toMatch(
      /\.delete-account-label\s*\{[\s\S]*?width:\s*100%;[\s\S]*?text-align:\s*left;/,
    )
  })
})
