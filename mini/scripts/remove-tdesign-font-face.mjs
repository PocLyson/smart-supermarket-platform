import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function removeRemoteIconFontFace(source) {
  return source.replace(
    /@font-face\{(?=[^}]*tdesign\.gtimg\.com)[^}]*\}/g,
    '',
  )
}

function patchFile(filePath) {
  if (!existsSync(filePath)) return false

  const source = readFileSync(filePath, 'utf8')
  const prepared = removeRemoteIconFontFace(source)
  if (prepared === source) return false

  writeFileSync(filePath, prepared, 'utf8')
  return true
}

export function prepareTDesignIconStyles(rootDir) {
  return [
    resolve(
      rootDir,
      'node_modules/tdesign-miniprogram/miniprogram_dist/icon/icon.wxss',
    ),
    resolve(
      rootDir,
      'miniprogram/miniprogram_npm/tdesign-miniprogram/icon/icon.wxss',
    ),
  ].filter(patchFile)
}

const scriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] === scriptPath) {
  const miniRoot = resolve(dirname(scriptPath), '..')
  const patched = prepareTDesignIconStyles(miniRoot)
  console.log(`Prepared ${patched.length} TDesign icon style file(s).`)
}
