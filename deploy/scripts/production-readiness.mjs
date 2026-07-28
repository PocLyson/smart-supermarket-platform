import { execFileSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  statSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { extractMiniOrigins } from './configure-mini-origin.mjs'

const requiredKeys = [
  'PUBLIC_HOST',
  'MYSQL_DATABASE',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_ROOT_PASSWORD',
  'REDIS_PASSWORD',
  'JWT_SECRET',
  'WECHAT_APP_ID',
  'WECHAT_APP_SECRET',
  'WECHAT_LOCAL_MOCK_ENABLED',
  'TLS_CERT_DIR',
]

const publicHostPattern =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

export function parseDotEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=')
        return separator < 1
          ? [line, '']
          : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
      }),
  )
}

export function validateEnvironment(env) {
  const errors = []

  for (const key of requiredKeys) {
    if (!env[key]) errors.push(`缺少必填环境变量：${key}`)
  }

  if (
    !publicHostPattern.test(env.PUBLIC_HOST ?? '') ||
    (env.PUBLIC_HOST ?? '').endsWith('.invalid')
  ) {
    errors.push('PUBLIC_HOST 必须是已备案的纯主机名')
  }

  if (Buffer.byteLength(env.JWT_SECRET ?? '', 'utf8') < 32) {
    errors.push('JWT_SECRET 至少需要 32 个字节')
  }

  if (
    new Set([
      env.MYSQL_PASSWORD,
      env.MYSQL_ROOT_PASSWORD,
      env.REDIS_PASSWORD,
    ]).size !== 3
  ) {
    errors.push('MySQL、root 与 Redis 密码必须互不相同')
  }

  if (env.WECHAT_LOCAL_MOCK_ENABLED !== 'false') {
    errors.push('公网环境禁止启用微信模拟登录')
  }

  if (!/^wx[0-9a-f]{16}$/.test(env.WECHAT_APP_ID ?? '')) {
    errors.push('WECHAT_APP_ID 格式不正确')
  }

  for (const [key, value] of Object.entries(env)) {
    if (/replace-with|example\.invalid/i.test(value)) {
      errors.push(`${key} 仍是不可部署的安全示例值`)
    }
  }

  return [...new Set(errors)]
}

function stripHashComments(source) {
  return source
    .split(/\r?\n/)
    .map((line) => {
      let quote = null
      for (let index = 0; index < line.length; index += 1) {
        const character = line[index]
        if (quote) {
          if (character === '\\') {
            index += 1
          } else if (character === quote) {
            quote = null
          }
        } else if (character === "'" || character === '"') {
          quote = character
        } else if (character === '#') {
          return line.slice(0, index)
        }
      }
      return line
    })
    .join('\n')
}

function yamlRecords(source) {
  return stripHashComments(source)
    .split(/\r?\n/)
    .map((line) => ({
      indent: line.match(/^ */)[0].length,
      text: line.trim(),
    }))
    .filter((line) => line.text)
}

function serviceBlock(records, serviceName) {
  const start = records.findIndex(
    (line) => line.indent === 2 && line.text === `${serviceName}:`,
  )
  if (start < 0) return []
  const next = records.findIndex(
    (line, index) => index > start && line.indent <= 2,
  )
  return records.slice(start + 1, next < 0 ? undefined : next)
}

function nestedValues(block, parentName, key) {
  const parent = block.findIndex(
    (line) => line.indent === 4 && line.text === `${parentName}:`,
  )
  if (parent < 0) return []
  const end = block.findIndex(
    (line, index) => index > parent && line.indent <= 4,
  )
  const prefix = `${key}:`
  return block
    .slice(parent + 1, end < 0 ? undefined : end)
    .filter((line) => line.indent === 6 && line.text.startsWith(prefix))
    .map((line) => line.text.slice(prefix.length).trim())
}

function nestedList(block, parentName) {
  const parent = block.findIndex(
    (line) => line.indent === 4 && line.text === `${parentName}:`,
  )
  if (parent < 0) return []
  const end = block.findIndex(
    (line, index) => index > parent && line.indent <= 4,
  )
  return block
    .slice(parent + 1, end < 0 ? undefined : end)
    .filter((line) => line.indent === 6 && line.text.startsWith('- '))
    .map((line) => line.text.slice(2).trim())
}

export function validateDeploymentFiles(rootDir) {
  const errors = []
  let compose = ''
  let nginxTemplate = ''

  try {
    compose = readFileSync(
      join(rootDir, 'deploy', 'compose.production.yaml'),
      'utf8',
    )
  } catch {
    errors.push('缺少生产 Compose 配置')
  }

  try {
    nginxTemplate = readFileSync(
      join(rootDir, 'deploy', 'nginx', 'default.conf.template'),
      'utf8',
    )
  } catch {
    errors.push('缺少 Nginx 生产模板')
  }

  const records = yamlRecords(compose)
  const server = serviceBlock(records, 'server')
  const nginx = serviceBlock(records, 'nginx')
  const composeContractsHold =
    nestedValues(
      server,
      'environment',
      'WECHAT_LOCAL_MOCK_ENABLED',
    ).length === 1 &&
    nestedValues(
      server,
      'environment',
      'WECHAT_LOCAL_MOCK_ENABLED',
    )[0] === '"false"' &&
    nestedValues(server, 'environment', 'CORS_ALLOWED_ORIGINS').length ===
      1 &&
    nestedValues(server, 'environment', 'CORS_ALLOWED_ORIGINS')[0] ===
      'https://${PUBLIC_HOST}' &&
    nestedValues(nginx, 'environment', 'PUBLIC_HOST').length === 1 &&
    nestedValues(nginx, 'environment', 'PUBLIC_HOST')[0] ===
      '${PUBLIC_HOST:?PUBLIC_HOST is required}' &&
    nestedValues(nginx, 'environment', 'NGINX_ENVSUBST_FILTER').length ===
      1 &&
    nestedValues(nginx, 'environment', 'NGINX_ENVSUBST_FILTER')[0] ===
      '^PUBLIC_HOST$' &&
    nestedList(nginx, 'volumes').includes(
      './nginx/default.conf.template:/etc/nginx/templates/default.conf.template:ro',
    )

  if (!composeContractsHold) {
    errors.push('生产 Compose 配置未满足公网部署契约')
  }

  for (const serviceName of ['mysql', 'redis', 'server']) {
    const block = serviceBlock(records, serviceName)
    if (
      block.some(
        (line) => line.indent === 4 && /^ports\s*:/.test(line.text),
      )
    ) {
      errors.push('mysql、redis 与 server 不得发布主机端口')
      break
    }
  }

  const activeNginx = stripHashComments(nginxTemplate)
  const publicServerNames =
    activeNginx.match(/^\s*server_name\s+\$\{PUBLIC_HOST\};\s*$/gm) ?? []
  if (publicServerNames.length < 2) {
    errors.push('Nginx 模板未使用 PUBLIC_HOST')
  }

  for (const variable of [
    '$host',
    '$request_uri',
    '$request_id',
    '$remote_addr',
    '$proxy_add_x_forwarded_for',
  ]) {
    if (!activeNginx.includes(variable)) {
      errors.push('Nginx 模板未保留运行时变量')
      break
    }
  }

  if (
    !/^\s*return\s+301\s+https:\/\/\$\{PUBLIC_HOST\}\$request_uri;\s*$/m.test(
      activeNginx,
    )
  ) {
    errors.push('Nginx HTTP 跳转必须使用 PUBLIC_HOST')
  }

  if (
    !/server\s*\{[^{}]*listen\s+80\s+default_server;[^{}]*server_name\s+_;[^{}]*return\s+444;[^{}]*\}/s.test(
      activeNginx,
    )
  ) {
    errors.push('Nginx 必须拒绝未知 Host')
  }

  if (existsSync(join(rootDir, 'deploy', 'nginx', 'smart-store.conf'))) {
    errors.push('旧 Nginx 配置仍然存在')
  }

  return errors
}

export function validateMiniOrigins(rootDir, publicHost) {
  const error =
    '小程序 trial 与 release API origin 必须与 PUBLIC_HOST 完全一致'
  let source

  try {
    source = readFileSync(
      join(rootDir, 'mini', 'miniprogram', 'config', 'env.ts'),
      'utf8',
    )
  } catch {
    return [error]
  }

  const expectedOrigin = `https://${publicHost}`
  try {
    const fields = extractMiniOrigins(source)
    return fields.trial.value === expectedOrigin &&
      fields.release.value === expectedOrigin
      ? []
      : [error]
  } catch {
    return [error]
  }
}

const defaultRepositoryRoot = fileURLToPath(new URL('../..', import.meta.url))

function parseArguments(args) {
  let envFile = 'deploy/.env.production'

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--env-file' || !args[index + 1]) {
      throw new Error('用法：production-readiness.mjs [--env-file <path>]')
    }
    envFile = args[index + 1]
    index += 1
  }

  return { envFile }
}

function isGitPathNotMatched(error) {
  return (
    error?.status === 1 &&
    /pathspec .* did not match any file\(s\) known to git/i.test(
      String(error.stderr ?? ''),
    )
  )
}

export function main(args, dependencies = {}) {
  const {
    cwd = process.cwd(),
    existsSync: fileExists = existsSync,
    execFileSync: runCommand = execFileSync,
    log = console.log,
    platform = process.platform,
    readFileSync: readFile = readFileSync,
    repositoryRoot = defaultRepositoryRoot,
    statSync: getFileStatus = statSync,
  } = dependencies

  let envFile
  try {
    envFile = resolve(cwd, parseArguments(args).envFile)
  } catch (error) {
    log(error.message)
    log('生产就绪检查未通过（1 项）')
    return 1
  }

  let environmentText
  try {
    environmentText = readFile(envFile, 'utf8')
  } catch {
    log('无法读取生产环境文件')
    log('生产就绪检查未通过（1 项）')
    return 1
  }

  const environment = parseDotEnv(environmentText)
  const errors = [
    ...validateEnvironment(environment),
    ...validateDeploymentFiles(repositoryRoot),
    ...validateMiniOrigins(repositoryRoot, environment.PUBLIC_HOST ?? ''),
  ]

  if (platform !== 'win32') {
    try {
      if ((getFileStatus(envFile).mode & 0o777) !== 0o600) {
        errors.push('生产环境文件权限必须为 600')
      }
    } catch {
      errors.push('无法检查生产环境文件权限')
    }
  }

  try {
    const trackedPath = relative(repositoryRoot, envFile).replaceAll('\\', '/')
    runCommand(
      'git',
      ['-C', repositoryRoot, 'ls-files', '--error-unmatch', '--', trackedPath],
      { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] },
    )
    errors.push('生产环境文件不得被 Git 跟踪')
  } catch (error) {
    if (!isGitPathNotMatched(error)) {
      errors.push('无法验证生产环境文件的 Git 跟踪状态')
    }
  }

  try {
    runCommand(
      'docker',
      [
        'compose',
        '-f',
        join(repositoryRoot, 'deploy', 'compose.production.yaml'),
        '--env-file',
        envFile,
        'config',
      ],
      { stdio: 'ignore' },
    )
  } catch {
    errors.push('Docker Compose 配置无法渲染')
  }

  const certificateDirectory = resolve(
    dirname(envFile),
    environment.TLS_CERT_DIR ?? '',
  )
  if (
    !fileExists(resolve(certificateDirectory, 'fullchain.pem')) ||
    !fileExists(resolve(certificateDirectory, 'privkey.pem'))
  ) {
    errors.push('TLS 证书文件缺失')
  }

  const uniqueErrors = [...new Set(errors)]
  for (const error of uniqueErrors) log(error)

  if (uniqueErrors.length > 0) {
    log(`生产就绪检查未通过（${uniqueErrors.length} 项）`)
    return 1
  }

  log('生产就绪检查通过（0 项错误）')
  return 0
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = main(process.argv.slice(2))
}
