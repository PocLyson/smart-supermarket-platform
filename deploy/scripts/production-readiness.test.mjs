import assert from 'node:assert/strict'
import { execFileSync as runCommand } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  main,
  parseDotEnv,
  validateDeploymentFiles,
  validateEnvironment,
  validateMiniOrigins,
} from './production-readiness.mjs'

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))

const validEnvironment = {
  PUBLIC_HOST: 'shop.registered-domain.cn',
  MYSQL_DATABASE: 'smart_store',
  MYSQL_USER: 'smart_store_app',
  MYSQL_PASSWORD: 'db-password-with-32-characters-01',
  MYSQL_ROOT_PASSWORD: 'root-password-with-32-characters-02',
  REDIS_PASSWORD: 'redis-password-with-32-characters-03',
  JWT_SECRET: 'jwt-secret-with-at-least-32-random-bytes',
  WECHAT_APP_ID: 'wx1c7df3ea8adc9644',
  WECHAT_APP_SECRET: 'wechat-secret-kept-only-on-the-server',
  WECHAT_LOCAL_MOCK_ENABLED: 'false',
  TLS_CERT_DIR: './certs',
}

function createMiniEnvironmentSource(t, source) {
  const root = mkdtempSync(join(tmpdir(), 'smart-store-readiness-'))
  const configDirectory = join(root, 'mini', 'miniprogram', 'config')
  mkdirSync(configDirectory, { recursive: true })
  writeFileSync(join(configDirectory, 'env.ts'), source, 'utf8')
  t.after(() => rmSync(root, { force: true, recursive: true }))
  return root
}

function createMiniEnvironment(t, trial, release) {
  return createMiniEnvironmentSource(
    t,
    `const apiBaseUrls = {
  develop: 'http://localhost:8080',
  trial: '${trial}',
  release: '${release}',
}
`,
  )
}

function createDeploymentFixture(
  t,
  {
    composeTransform = (source) => source,
    nginxTransform = (source) => source,
  } = {},
) {
  const root = mkdtempSync(join(tmpdir(), 'smart-store-deployment-'))
  const nginxDirectory = join(root, 'deploy', 'nginx')
  mkdirSync(nginxDirectory, { recursive: true })
  writeFileSync(
    join(root, 'deploy', 'compose.production.yaml'),
    composeTransform(
      readFileSync(join(repositoryRoot, 'deploy', 'compose.production.yaml'), 'utf8'),
    ),
    'utf8',
  )
  writeFileSync(
    join(nginxDirectory, 'default.conf.template'),
    nginxTransform(
      readFileSync(
        join(repositoryRoot, 'deploy', 'nginx', 'default.conf.template'),
        'utf8',
      ),
    ),
    'utf8',
  )
  t.after(() => rmSync(root, { force: true, recursive: true }))
  return root
}

function gitPathNotMatchedError() {
  const error = new Error('git pathspec did not match')
  error.status = 1
  error.stderr =
    "error: pathspec 'deploy/.env.production' did not match any file(s) known to git"
  return error
}

test('parseDotEnv ignores comments and preserves values after the first equals sign', () => {
  assert.deepEqual(parseDotEnv('# comment\nA=one=two\nB=value\n'), {
    A: 'one=two',
    B: 'value',
  })
})

test('unquoted inline comments do not disguise reused passwords', () => {
  const parsed = parseDotEnv(`MYSQL_PASSWORD=same # database comment
MYSQL_ROOT_PASSWORD=same # root comment
REDIS_PASSWORD=same # redis comment
`)
  const errors = validateEnvironment({
    ...validEnvironment,
    ...parsed,
  })

  assert.deepEqual(parsed, {
    MYSQL_PASSWORD: 'same',
    MYSQL_ROOT_PASSWORD: 'same',
    REDIS_PASSWORD: 'same',
  })
  assert.ok(errors.includes('MySQL、root 与 Redis 密码必须互不相同'))
})

test('unquoted inline comments do not make a short JWT secret look long', () => {
  const environment = {
    ...validEnvironment,
    ...parseDotEnv(
      'JWT_SECRET=short # this comment is deliberately much longer than 32 bytes',
    ),
  }

  assert.ok(
    validateEnvironment(environment).includes(
      'JWT_SECRET 至少需要 32 个字节',
    ),
  )
})

test('quoted values preserve spaces and hashes while unquoted hashes need no space', () => {
  assert.deepEqual(
    parseDotEnv(`SINGLE=' value # kept '
DOUBLE=" value # kept "
HASH=abc#def
EMPTY= # ignored comment
`),
    {
      SINGLE: ' value # kept ',
      DOUBLE: ' value # kept ',
      HASH: 'abc#def',
      EMPTY: '',
    },
  )
})

test('rejects unsupported escapes, interpolation and multiline quotes', () => {
  for (const unsupported of [
    String.raw`A="line\nvalue"`,
    String.raw`A=value\#hash`,
    'A=${OTHER}',
    "A='first line\nsecond line'",
  ]) {
    assert.throws(
      () => parseDotEnv(unsupported),
      /dotenv 第 \d+ 行使用了不支持的语法/,
    )
  }
})

test('representative parsed values match Docker Compose interpolation', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'smart-store-dotenv-'))
  const envFile = join(root, 'representative.env')
  const composeFile = join(root, 'compose.yaml')
  const dotenv = `INLINE=same # ignored comment
HASH=abc#def
SINGLE='value # kept'
DOUBLE="value # kept"
`
  writeFileSync(envFile, dotenv, 'utf8')
  writeFileSync(
    composeFile,
    `services:
  probe:
    image: busybox
    environment:
      INLINE: \${INLINE}
      HASH: \${HASH}
      SINGLE: \${SINGLE}
      DOUBLE: \${DOUBLE}
`,
    'utf8',
  )
  t.after(() => rmSync(root, { force: true, recursive: true }))

  const rendered = JSON.parse(
    runCommand(
      'docker',
      [
        'compose',
        '-f',
        composeFile,
        '--env-file',
        envFile,
        'config',
        '--format',
        'json',
      ],
      { encoding: 'utf8' },
    ),
  )

  assert.deepEqual(parseDotEnv(dotenv), rendered.services.probe.environment)
})

test('valid environment has no errors', () => {
  assert.deepEqual(validateEnvironment(validEnvironment), [])
})

test('rejects unsafe public deployment values without echoing secrets', () => {
  const errors = validateEnvironment({
    ...validEnvironment,
    PUBLIC_HOST: 'https://shop.example.invalid/path',
    JWT_SECRET: 'short',
    MYSQL_ROOT_PASSWORD: validEnvironment.MYSQL_PASSWORD,
    WECHAT_LOCAL_MOCK_ENABLED: 'true',
  })

  assert.ok(errors.includes('PUBLIC_HOST 必须是已备案的纯主机名'))
  assert.ok(errors.includes('JWT_SECRET 至少需要 32 个字节'))
  assert.ok(errors.includes('MySQL、root 与 Redis 密码必须互不相同'))
  assert.ok(errors.includes('公网环境禁止启用微信模拟登录'))
  assert.equal(
    errors.some((error) => error.includes(validEnvironment.MYSQL_PASSWORD)),
    false,
  )
})

test('CLI reports validation failures without printing environment values', () => {
  const secret = 'never-print-this-secret'
  const messages = []
  const exitCode = main(['--env-file', 'deploy/.env.production'], {
    cwd: '/repository',
    existsSync: () => false,
    execFileSync: () => {
      throw gitPathNotMatchedError()
    },
    log: (message) => messages.push(message),
    platform: 'linux',
    readFileSync: () =>
      Object.entries({
        ...validEnvironment,
        JWT_SECRET: secret,
      })
        .map(([key, value]) => `${key}=${value}`)
        .join('\n'),
    statSync: () => ({ mode: 0o100600 }),
  })

  assert.equal(exitCode, 1)
  assert.match(messages.at(-1), /未通过（\d+ 项）/)
  assert.equal(messages.some((message) => message.includes(secret)), false)
  assert.equal(
    messages.includes('无法验证生产环境文件的 Git 跟踪状态'),
    false,
  )
})

test('CLI rejects unsupported dotenv syntax without printing the value', () => {
  const messages = []
  const unsupportedValue = String.raw`do-not-print\nthis`
  const exitCode = main(['--env-file', 'deploy/.env.production'], {
    cwd: '/repository',
    log: (message) => messages.push(message),
    readFileSync: () => `JWT_SECRET="${unsupportedValue}"`,
  })

  assert.equal(exitCode, 1)
  assert.ok(messages.includes('生产环境文件包含不支持的 dotenv 语法'))
  assert.equal(
    messages.some((message) => message.includes(unsupportedValue)),
    false,
  )
})

test('CLI fails closed when Git tracking status cannot be checked', () => {
  const missingGit = new Error('spawn git ENOENT')
  missingGit.code = 'ENOENT'
  const brokenRepository = new Error('git repository is damaged')
  brokenRepository.status = 128
  brokenRepository.stderr = 'fatal: not a git repository'

  for (const commandError of [missingGit, brokenRepository]) {
    const messages = []
    const exitCode = main(['--env-file', 'deploy/.env.production'], {
      cwd: '/repository',
      existsSync: () => true,
      execFileSync: () => {
        throw commandError
      },
      log: (message) => messages.push(message),
      platform: 'linux',
      readFileSync: () =>
        Object.entries(validEnvironment)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n'),
      statSync: () => ({ mode: 0o100600 }),
    })

    assert.equal(exitCode, 1)
    assert.ok(messages.includes('无法验证生产环境文件的 Git 跟踪状态'))
    assert.equal(
      messages.some((message) => message.includes(commandError.message)),
      false,
    )
  }
})

test('CLI rejects tracked production env files and missing certificates', () => {
  const messages = []
  const exitCode = main(['--env-file', 'deploy/.env.production'], {
    cwd: '/repository',
    existsSync: () => false,
    execFileSync: () => '',
    log: (message) => messages.push(message),
    platform: 'linux',
    readFileSync: () =>
      Object.entries(validEnvironment)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n'),
    statSync: () => ({ mode: 0o100600 }),
  })

  assert.equal(exitCode, 1)
  assert.ok(messages.includes('生产环境文件不得被 Git 跟踪'))
  assert.ok(messages.includes('TLS 证书文件缺失'))
})

test('CLI fails closed when Docker Compose cannot render the configuration', () => {
  const messages = []
  const exitCode = main(['--env-file', 'deploy/.env.production'], {
    cwd: repositoryRoot,
    existsSync: () => true,
    execFileSync: (command, args) => {
      if (command === 'git') throw gitPathNotMatchedError()
      assert.equal(command, 'docker')
      assert.deepEqual(args, [
        'compose',
        '-f',
        join(repositoryRoot, 'deploy', 'compose.production.yaml'),
        '--env-file',
        join(repositoryRoot, 'deploy', '.env.production'),
        'config',
      ])
      const error = new Error('compose failed with sensitive stderr')
      error.stderr = 'must-not-be-printed'
      throw error
    },
    log: (message) => messages.push(message),
    platform: 'linux',
    readFileSync: () =>
      Object.entries(validEnvironment)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n'),
    statSync: () => ({ mode: 0o100600 }),
  })

  assert.equal(exitCode, 1)
  assert.ok(messages.includes('Docker Compose 配置无法渲染'))
  assert.equal(
    messages.some((message) => message.includes('must-not-be-printed')),
    false,
  )
})

test('deployment files force the public hostname and disable local login mock', () => {
  assert.deepEqual(validateDeploymentFiles(repositoryRoot), [])
})

test('deployment validation ignores a commented false mock setting', (t) => {
  const root = createDeploymentFixture(t, {
    composeTransform: (source) =>
      source.replace(
        'WECHAT_LOCAL_MOCK_ENABLED: "false"',
        'WECHAT_LOCAL_MOCK_ENABLED: "true"\n      # WECHAT_LOCAL_MOCK_ENABLED: "false"',
      ),
  })

  assert.ok(
    validateDeploymentFiles(root).includes(
      '生产 Compose 配置未满足公网部署契约',
    ),
  )
})

test('deployment validation rejects ports on internal services', (t) => {
  for (const [service, port] of [
    ['mysql', '3306'],
    ['redis', '6379'],
    ['server', '8080'],
  ]) {
    const root = createDeploymentFixture(t, {
      composeTransform: (source) =>
        source.replace(
          `  ${service}:\n`,
          `  ${service}:\n    ports:\n      - "${port}:${port}"\n`,
        ),
    })

    assert.ok(
      validateDeploymentFiles(root).includes(
        'mysql、redis 与 server 不得发布主机端口',
      ),
    )
  }
})

test('deployment validation ignores commented Nginx server_name decoys', (t) => {
  const root = createDeploymentFixture(t, {
    nginxTransform: (source) =>
      `# server_name \${PUBLIC_HOST};\n${source.replaceAll(
        'server_name ${PUBLIC_HOST};',
        'server_name _;',
      )}`,
  })

  assert.ok(
    validateDeploymentFiles(root).includes('Nginx 模板未使用 PUBLIC_HOST'),
  )
})

test('deployment validation rejects redirects derived from the client Host', (t) => {
  const root = createDeploymentFixture(t, {
    nginxTransform: (source) =>
      source.replace(
        'https://${PUBLIC_HOST}$request_uri',
        'https://$host$request_uri',
      ),
  })

  assert.ok(
    validateDeploymentFiles(root).includes(
      'Nginx HTTP 跳转必须使用 PUBLIC_HOST',
    ),
  )
})

test('mini trial and release origins may both match PUBLIC_HOST', (t) => {
  const root = createMiniEnvironment(
    t,
    'https://shop.registered-domain.cn',
    'https://shop.registered-domain.cn',
  )

  assert.deepEqual(
    validateMiniOrigins(root, 'shop.registered-domain.cn'),
    [],
  )
})

test('mini origin mismatch returns one stable error', (t) => {
  const root = createMiniEnvironment(
    t,
    'https://other.registered-domain.cn',
    'https://shop.registered-domain.cn',
  )

  assert.deepEqual(validateMiniOrigins(root, 'shop.registered-domain.cn'), [
    '小程序 trial 与 release API origin 必须与 PUBLIC_HOST 完全一致',
  ])
})

test('mini invalid sentinels return one stable error', (t) => {
  const root = createMiniEnvironment(
    t,
    'https://trial-api.example.invalid',
    'https://api.example.invalid',
  )

  assert.deepEqual(validateMiniOrigins(root, 'shop.registered-domain.cn'), [
    '小程序 trial 与 release API origin 必须与 PUBLIC_HOST 完全一致',
  ])
})

test('mini origin validation ignores comment decoys', (t) => {
  const root = createMiniEnvironmentSource(
    t,
    `const apiBaseUrls = {
  // trial: 'https://shop.registered-domain.cn',
  develop: 'http://localhost:8080',
  trial: 'https://other.registered-domain.cn',
  release: 'https://shop.registered-domain.cn',
}`,
  )

  assert.deepEqual(validateMiniOrigins(root, 'shop.registered-domain.cn'), [
    '小程序 trial 与 release API origin 必须与 PUBLIC_HOST 完全一致',
  ])
})

test('mini origin validation rejects duplicate public fields', (t) => {
  const root = createMiniEnvironmentSource(
    t,
    `const apiBaseUrls = {
  trial: 'https://shop.registered-domain.cn',
  trial: 'https://shop.registered-domain.cn',
  release: 'https://shop.registered-domain.cn',
}`,
  )

  assert.deepEqual(validateMiniOrigins(root, 'shop.registered-domain.cn'), [
    '小程序 trial 与 release API origin 必须与 PUBLIC_HOST 完全一致',
  ])
})

test('mini origin validation rejects missing fields despite comment decoys', (t) => {
  const root = createMiniEnvironmentSource(
    t,
    `const apiBaseUrls = {
  // trial: 'https://shop.registered-domain.cn',
  develop: 'http://localhost:8080',
  release: 'https://shop.registered-domain.cn',
}`,
  )

  assert.deepEqual(validateMiniOrigins(root, 'shop.registered-domain.cn'), [
    '小程序 trial 与 release API origin 必须与 PUBLIC_HOST 完全一致',
  ])
})
