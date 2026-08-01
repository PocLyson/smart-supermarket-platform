import { readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const miniRoot = resolve(__dirname, '..')
const miniprogramRoot = resolve(miniRoot, 'miniprogram')
const heroDirectory = resolve(
  miniprogramRoot,
  'assets',
  'home',
)

type PackIgnoreRule = {
  type: 'file' | 'folder' | 'suffix' | 'prefix'
  value: string
}

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = resolve(directory, entry)
    return statSync(fullPath).isDirectory() ? listFiles(fullPath) : [fullPath]
  })
}

function isIgnored(relativePath: string, rules: PackIgnoreRule[]) {
  const normalizedPath = relativePath.split('\\').join('/')

  return rules.some(({ type, value }) => {
    const normalizedValue = value.split('\\').join('/')

    if (type === 'file') return normalizedPath === normalizedValue
    if (type === 'folder') {
      return (
        normalizedPath === normalizedValue ||
        normalizedPath.startsWith(`${normalizedValue}/`)
      )
    }
    if (type === 'suffix') return normalizedPath.endsWith(normalizedValue)
    const fileName = normalizedPath.split('/').pop()
    return fileName?.startsWith(normalizedValue)
  })
}

describe('mini program package size', () => {
  it('keeps the home hero asset below 350 KB', () => {
    const heroFiles = readdirSync(heroDirectory).filter((fileName) =>
      fileName.startsWith('navy-fresh-grocery-hero.'),
    )
    const totalBytes = heroFiles.reduce(
      (sum, fileName) =>
        sum + statSync(resolve(heroDirectory, fileName)).size,
      0,
    )

    expect(heroFiles).toHaveLength(1)
    expect(totalBytes).toBeLessThanOrEqual(350 * 1024)
  })

  it('keeps the effective upload source within the 2 MiB main-package limit', () => {
    const projectConfig = JSON.parse(
      readFileSync(resolve(miniRoot, 'project.config.json'), 'utf8'),
    ) as {
      packOptions?: {
        ignore?: PackIgnoreRule[]
      }
    }
    const ignoreRules = projectConfig.packOptions?.ignore ?? []
    const effectiveBytes = listFiles(miniprogramRoot)
      .filter(
        (filePath) =>
          !isIgnored(relative(miniprogramRoot, filePath), ignoreRules),
      )
      .reduce((sum, filePath) => sum + statSync(filePath).size, 0)

    expect(effectiveBytes).toBeLessThanOrEqual(2 * 1024 * 1024)
  })
})
