import {
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const publicHostPattern =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

export function validatePublicHost(host) {
  if (!publicHostPattern.test(host) || host.endsWith('.invalid')) {
    throw new Error(
      'host must be a registered hostname without protocol or path',
    )
  }
  return host
}

function stripComments(source) {
  const characters = [...source]
  let quote = null

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index]
    const next = characters[index + 1]

    if (quote) {
      if (character === '\\') {
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character
      continue
    }

    if (character === '/' && next === '/') {
      characters[index] = ' '
      characters[index + 1] = ' '
      index += 2
      while (index < characters.length && characters[index] !== '\n') {
        characters[index] = ' '
        index += 1
      }
      index -= 1
      continue
    }

    if (character === '/' && next === '*') {
      characters[index] = ' '
      characters[index + 1] = ' '
      index += 2
      while (
        index < characters.length &&
        !(characters[index] === '*' && characters[index + 1] === '/')
      ) {
        if (characters[index] !== '\n') characters[index] = ' '
        index += 1
      }
      if (index < characters.length) {
        characters[index] = ' '
        characters[index + 1] = ' '
        index += 1
      }
    }
  }

  return characters.join('')
}

function findClosingBrace(source, openingBrace) {
  let depth = 0
  let quote = null

  for (let index = openingBrace; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (character === '\\') {
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character
    } else if (character === '{') {
      depth += 1
    } else if (character === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }

  throw new Error('apiBaseUrls object is not closed')
}

function topLevelSegments(source, start, end) {
  const segments = []
  let segmentStart = start
  let depth = 0
  let quote = null

  for (let index = start; index < end; index += 1) {
    const character = source[index]
    if (quote) {
      if (character === '\\') {
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character
    } else if ('{[('.includes(character)) {
      depth += 1
    } else if ('}])'.includes(character)) {
      depth -= 1
    } else if (character === ',' && depth === 0) {
      segments.push([segmentStart, index])
      segmentStart = index + 1
    }
  }
  segments.push([segmentStart, end])
  return segments
}

export function extractMiniOrigins(source) {
  const uncommented = stripComments(source)
  const declarationPattern =
    /\b(?:const|let|var)\s+apiBaseUrls\b[^=;]*=\s*\{/g
  const declarations = [...uncommented.matchAll(declarationPattern)]
  if (declarations.length !== 1) {
    throw new Error('expected exactly one apiBaseUrls object')
  }

  const declaration = declarations[0]
  const openingBrace =
    declaration.index + declaration[0].lastIndexOf('{')
  const closingBrace = findClosingBrace(uncommented, openingBrace)
  const fields = { trial: [], release: [] }
  const fieldPattern =
    /^\s*(trial|release)\s*:\s*'((?:\\.|[^'\\])*)'\s*$/d

  for (const [start, end] of topLevelSegments(
    uncommented,
    openingBrace + 1,
    closingBrace,
  )) {
    const match = fieldPattern.exec(uncommented.slice(start, end))
    if (!match) continue
    fields[match[1]].push({
      end: start + match.indices[2][1],
      start: start + match.indices[2][0],
      value: match[2],
    })
  }

  if (fields.trial.length !== 1 || fields.release.length !== 1) {
    throw new Error('expected exactly one trial and one release field')
  }

  return {
    release: fields.release[0],
    trial: fields.trial[0],
  }
}

export function replaceMiniOrigins(source, host) {
  const origin = `https://${validatePublicHost(host)}`
  const fields = extractMiniOrigins(source)
  let updated = source

  for (const field of [fields.trial, fields.release].sort(
    (left, right) => right.start - left.start,
  )) {
    updated = `${updated.slice(0, field.start)}${origin}${updated.slice(field.end)}`
  }

  return updated
}

function parseArguments(args) {
  if (args.length !== 2 || args[0] !== '--host' || !args[1]) {
    throw new Error('usage: configure-mini-origin.mjs --host <hostname>')
  }
  return { host: validatePublicHost(args[1]) }
}

export function main(args, dependencies = {}) {
  const {
    cwd = process.cwd(),
    log = console.log,
    readFileSync: readFile = readFileSync,
    renameSync: renameFile = renameSync,
    unlinkSync: removeFile = unlinkSync,
    writeFileSync: writeFile = writeFileSync,
  } = dependencies

  const targetPath = resolve(cwd, 'mini/miniprogram/config/env.ts')
  const temporaryPath = `${targetPath}.tmp-${process.pid}`

  try {
    const { host } = parseArguments(args)
    const source = readFile(targetPath, 'utf8')
    const updated = replaceMiniOrigins(source, host)
    writeFile(temporaryPath, updated, { encoding: 'utf8', flag: 'wx' })
    renameFile(temporaryPath, targetPath)
    log('小程序 trial 与 release API origin 已同步更新')
    return 0
  } catch (error) {
    try {
      removeFile(temporaryPath)
    } catch {
      // The temporary file may not exist when validation fails.
    }
    log(error.message)
    return 1
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = main(process.argv.slice(2))
}
