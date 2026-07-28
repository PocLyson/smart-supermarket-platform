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

export function replaceMiniOrigins(source, host) {
  const origin = `https://${validatePublicHost(host)}`
  const withTrial = source.replace(
    /trial:\s*'https:\/\/[^']+'/,
    `trial: '${origin}'`,
  )
  const withRelease = withTrial.replace(
    /release:\s*'https:\/\/[^']+'/,
    `release: '${origin}'`,
  )

  if (
    withRelease === source ||
    !withRelease.includes(`trial: '${origin}'`) ||
    !withRelease.includes(`release: '${origin}'`)
  ) {
    throw new Error('mini environment source did not match the expected contract')
  }

  return withRelease
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
