import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  buildSettingsView,
  confirmAccountDeletion,
  confirmLocalUsageCleanup,
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
    expect(markup).toContain('隐私设置')
    expect(markup).toContain('账号管理')
    expect(markup).not.toContain('默认取货信息')
    expect(styles).toMatch(
      /\.settings-row\s*\{[\s\S]*?min-height:\s*96rpx;/,
    )
  })
})
