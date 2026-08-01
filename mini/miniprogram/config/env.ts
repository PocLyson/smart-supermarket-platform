export type MiniEnvironment = 'develop' | 'trial' | 'release'

const apiBaseUrls: Record<MiniEnvironment, string> = {
  develop: 'http://localhost:8080',
  trial: 'https://trial-api.example.invalid',
  release: 'https://api.example.invalid',
}

export const resolveApiBaseUrl = (
  environment: MiniEnvironment,
  requireConfigured = false,
): string => {
  const value = apiBaseUrls[environment]
  if (requireConfigured && value.endsWith('.invalid')) {
    throw new Error(`尚未配置 ${environment} API 地址`)
  }
  return value
}

const currentEnvironment = (): MiniEnvironment => {
  if (typeof wx === 'undefined' || typeof wx.getAccountInfoSync !== 'function') {
    return 'develop'
  }
  return wx.getAccountInfoSync().miniProgram.envVersion
}

export const getApiBaseUrl = (): string => {
  const environment = currentEnvironment()
  return resolveApiBaseUrl(environment, environment !== 'develop')
}

export const resolveApiAssetUrl = (
  value: string | null | undefined,
): string => {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  const baseUrl = getApiBaseUrl().replace(/\/$/, '')
  return `${baseUrl}${value.startsWith('/') ? value : `/${value}`}`
}
