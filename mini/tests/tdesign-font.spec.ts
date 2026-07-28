import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  prepareTDesignIconStyles,
  removeRemoteIconFontFace,
} from '../scripts/remove-tdesign-font-face.mjs'

describe('TDesign icon font preparation', () => {
  const temporaryRoots: string[] = []

  afterEach(() => {
    temporaryRoots.splice(0).forEach((root) => {
      rmSync(root, { recursive: true, force: true })
    })
  })

  it('removes only the remote font face while preserving local SVG icon styles', () => {
    const source =
      "@import '../common/style/index.wxss';" +
      '@font-face{font-family:t;src:url(https://tdesign.gtimg.com/icon/0.4.2/fonts/t.woff);font-weight:400;}' +
      '.t-icon--image{width:100%;height:100%;}' +
      '.t-icon{font-family:t!important;}'

    expect(removeRemoteIconFontFace(source)).toBe(
      "@import '../common/style/index.wxss';" +
        '.t-icon--image{width:100%;height:100%;}' +
        '.t-icon{font-family:t!important;}',
    )
  })

  it('patches installed and built styles once and remains idempotent', () => {
    const root = mkdtempSync(join(tmpdir(), 'smart-store-tdesign-'))
    temporaryRoots.push(root)
    const relativeTargets = [
      'node_modules/tdesign-miniprogram/miniprogram_dist/icon/icon.wxss',
      'miniprogram/miniprogram_npm/tdesign-miniprogram/icon/icon.wxss',
    ]
    const source =
      "@import '../common/style/index.wxss';" +
      '@font-face{font-family:t;src:url(https://tdesign.gtimg.com/icon/0.4.2/fonts/t.woff);}' +
      '.t-icon--image{width:100%;height:100%;}'

    relativeTargets.forEach((relativePath) => {
      const filePath = join(root, relativePath)
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, source, 'utf8')
    })

    expect(prepareTDesignIconStyles(root)).toHaveLength(2)
    expect(prepareTDesignIconStyles(root)).toEqual([])
    relativeTargets.forEach((relativePath) => {
      const prepared = readFileSync(join(root, relativePath), 'utf8')
      expect(prepared).not.toContain('tdesign.gtimg.com')
      expect(prepared).toContain('.t-icon--image')
    })
  })
})
