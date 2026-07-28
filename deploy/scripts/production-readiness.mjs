import { execFileSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  statSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

  const composeContracts = [
    'WECHAT_LOCAL_MOCK_ENABLED: "false"',
    'CORS_ALLOWED_ORIGINS: https://${PUBLIC_HOST}',
    'PUBLIC_HOST: ${PUBLIC_HOST:?PUBLIC_HOST is required}',
    'NGINX_ENVSUBST_FILTER: ^PUBLIC_HOST$',
    './nginx/default.conf.template:/etc/nginx/templates/default.conf.template:ro',
  ]
  if (composeContracts.some((contract) => !compose.includes(contract))) {
    errors.push('生产 Compose 配置未满足公网部署契约')
  }

  if (!nginxTemplate.includes('server_name ${PUBLIC_HOST};')) {
    errors.push('Nginx 模板未使用 PUBLIC_HOST')
  }

  for (const variable of [
    '$host',
    '$request_uri',
    '$request_id',
    '$remote_addr',
    '$proxy_add_x_forwarded_for',
  ]) {
    if (!nginxTemplate.includes(variable)) {
      errors.push('Nginx 模板未保留运行时变量')
      break
    }
  }

  if (existsSync(join(rootDir, 'deploy', 'nginx', 'smart-store.conf'))) {
    errors.push('旧 Nginx 配置仍然存在')
  }

  return errors
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
      { stdio: 'ignore' },
    )
    errors.push('生产环境文件不得被 Git 跟踪')
  } catch {
    // A non-zero git result proves that this production environment file is untracked.
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
