import assert from 'node:assert/strict'
import test from 'node:test'
import {
  main,
  parseDotEnv,
  validateEnvironment,
} from './production-readiness.mjs'

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

test('parseDotEnv ignores comments and preserves values after the first equals sign', () => {
  assert.deepEqual(parseDotEnv('# comment\nA=one=two\nB=value\n'), {
    A: 'one=two',
    B: 'value',
  })
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
      throw new Error('not tracked')
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
