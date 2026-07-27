type MiniEnvironment = 'development' | 'trial' | 'production'

const apiBaseUrls: Record<MiniEnvironment, string> = {
  development: 'http://localhost:8080',
  trial: 'https://trial-api.example.invalid',
  production: 'https://api.example.invalid',
}

const currentEnvironment: MiniEnvironment = 'development'

export const apiBaseUrl = apiBaseUrls[currentEnvironment]
