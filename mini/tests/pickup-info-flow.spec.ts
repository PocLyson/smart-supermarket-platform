import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relativePath: string) =>
  {
    const path = resolve(__dirname, '../miniprogram', relativePath)
    return existsSync(path) ? readFileSync(path, 'utf8') : ''
  }

describe('pickup information flow', () => {
  it('provides a dedicated pickup information page from settings', () => {
    const appConfig = JSON.parse(read('app.json')) as { pages: string[] }
    const settingsMarkup = read('pages/settings/index.wxml')
    const settingsSource = read('pages/settings/index.ts')
    const pickupSource = read('pages/pickup-info/index.ts')

    expect(appConfig.pages).toContain('pages/pickup-info/index')
    expect(settingsMarkup).toContain('bindtap="onPickupInfo"')
    expect(settingsMarkup).toContain('取货信息')
    expect(settingsSource).toContain(
      "wx.navigateTo({ url: '/pages/pickup-info/index' })",
    )
    expect(pickupSource).toContain('await profileService.get()')
    expect(pickupSource).toContain('await profileService.save({')
  })

  it('shows save feedback after returning to the previous page', () => {
    const pickupSource = read('pages/pickup-info/index.ts')

    expect(pickupSource).toMatch(
      /wx\.navigateBack\(\{[\s\S]*?success:\s*\(\)\s*=>[\s\S]*?wx\.showToast\(\{\s*title:\s*'取货信息已保存'/,
    )
    expect(pickupSource).not.toContain(
      "wx.showToast({ title: '取货信息已保存', icon: 'success' })\n      wx.navigateBack()",
    )
  })

  it('keeps pickup editing out of the profile page', () => {
    const profileMarkup = read('pages/profile/index.wxml')
    const profileSource = read('pages/profile/index.ts')

    expect(profileMarkup).not.toContain('保存取货信息')
    expect(profileMarkup).not.toContain('bindinput="onPickupNameInput"')
    expect(profileSource).not.toContain('profileService.save')
    expect(profileSource).not.toContain('onPickupNameInput')
  })

  it('automatically loads a read-only pickup profile during checkout', () => {
    const checkoutMarkup = read('pages/checkout/index.wxml')
    const checkoutSource = read('pages/checkout/index.ts')

    expect(checkoutSource).toContain('await profileService.get()')
    expect(checkoutSource).toContain('pickupReady')
    expect(checkoutSource).toContain('profileLoading')
    expect(checkoutSource).toContain(
      "wx.navigateTo({ url: '/pages/pickup-info/index' })",
    )
    expect(checkoutMarkup).not.toContain('bindinput="onPickupNameInput"')
    expect(checkoutMarkup).not.toContain('bindinput="onPhoneInput"')
    expect(checkoutMarkup).toContain('{{pickupName}}')
    expect(checkoutMarkup).toContain('{{phone}}')
    expect(checkoutMarkup).toContain('完善取货信息')
    expect(checkoutMarkup).toContain(
      '<text class="field-helper">可在设置中修改</text>',
    )
    expect(checkoutMarkup).not.toContain('下单时自动使用')
  })
})
