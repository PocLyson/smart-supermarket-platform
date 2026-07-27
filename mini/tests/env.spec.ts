import {
  resolveApiBaseUrl,
  type MiniEnvironment,
} from '../miniprogram/config/env'

describe('mini environment config', () => {
  it.each<[MiniEnvironment, string]>([
    ['develop', 'http://localhost:8080'],
    ['trial', 'https://trial-api.example.invalid'],
    ['release', 'https://api.example.invalid'],
  ])('selects a distinct API host for %s', (environment, expected) => {
    expect(resolveApiBaseUrl(environment)).toBe(expected)
  })

  it('rejects an unconfigured trial or production host before making a request', () => {
    expect(() => resolveApiBaseUrl('trial', true)).toThrow(
      '尚未配置 trial API 地址',
    )
    expect(() => resolveApiBaseUrl('release', true)).toThrow(
      '尚未配置 release API 地址',
    )
  })
})
