import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TOKEN_NAMES = [
  '--primary-50',
  '--primary-100',
  '--primary-200',
  '--primary-300',
  '--primary-400',
  '--primary-500',
  '--primary-600',
  '--primary-700',
  '--primary-800',
  '--primary-900',
] as const

const readToken = (file: string, token: string): string => {
  const source = readFileSync(file, 'utf8')
  const match = source.match(new RegExp(`${token}\\s*:\\s*([^;]+);`))
  if (!match) throw new Error(`Missing theme token ${token} in ${file}`)
  return match[1].trim()
}

describe('merchant theme contract', () => {
  test.each(TOKEN_NAMES)('keeps customer %s unchanged', (token) => {
    const customerTheme = resolve('../mini/miniprogram/styles/theme.wxss')
    const merchantTheme = resolve('miniprogram/styles/theme.wxss')

    expect(readToken(merchantTheme, token)).toBe(readToken(customerTheme, token))
  })

  test('keeps the complete customer token map without a second palette', () => {
    const readTokens = (file: string): Record<string, string> =>
      Object.fromEntries(
        [...readFileSync(file, 'utf8').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(
          ([, name, value]) => [name, value.replace(/\s+/g, ' ').trim()],
        ),
      )

    expect(readTokens(resolve('miniprogram/styles/theme.wxss'))).toEqual(
      readTokens(resolve('../mini/miniprogram/styles/theme.wxss')),
    )
  })
})
