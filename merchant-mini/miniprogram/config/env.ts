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

export const getApiBaseUrl = (): string => {
  const environment =
    typeof wx === 'undefined' || typeof wx.getAccountInfoSync !== 'function'
      ? 'develop'
      : wx.getAccountInfoSync().miniProgram.envVersion
  return resolveApiBaseUrl(environment, environment !== 'develop')
}
