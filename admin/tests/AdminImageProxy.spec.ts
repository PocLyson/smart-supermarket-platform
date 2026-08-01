import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('admin product image preview', () => {
  it('proxies uploaded image files to the API during local development', () => {
    const config = readFileSync(resolve(__dirname, '../vite.config.ts'), 'utf8')

    expect(config).toContain("'/files'")
    expect(config).toContain("target: 'http://127.0.0.1:8080'")
  })
})
