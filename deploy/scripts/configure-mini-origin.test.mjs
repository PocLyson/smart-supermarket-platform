import assert from 'node:assert/strict'
import { dirname } from 'node:path'
import test from 'node:test'
import {
  main,
  replaceMiniOrigins,
  validatePublicHost,
} from './configure-mini-origin.mjs'

const source = `const apiBaseUrls = {
  develop: 'http://localhost:8080',
  trial: 'https://trial-api.example.invalid',
  release: 'https://api.example.invalid',
}`

test('updates trial and release together', () => {
  const updated = replaceMiniOrigins(source, 'shop.registered-domain.cn')

  assert.match(updated, /trial: 'https:\/\/shop\.registered-domain\.cn'/)
  assert.match(updated, /release: 'https:\/\/shop\.registered-domain\.cn'/)
  assert.match(updated, /develop: 'http:\/\/localhost:8080'/)
})

test('rejects protocol, path, port and invalid sentinel hosts', () => {
  for (const host of [
    'https://shop.registered-domain.cn',
    'shop.registered-domain.cn/path',
    'shop.registered-domain.cn:443',
    'shop.example.invalid',
  ]) {
    assert.throws(() => validatePublicHost(host))
  }
})

test('CLI writes a sibling temporary file before atomically replacing env.ts', () => {
  const writes = []
  const renames = []
  const exitCode = main(
    ['--host', 'shop.registered-domain.cn'],
    {
      cwd: '/repository',
      log: () => {},
      readFileSync: () => source,
      renameSync: (...args) => renames.push(args),
      unlinkSync: () => {},
      writeFileSync: (...args) => writes.push(args),
    },
  )

  assert.equal(exitCode, 0)
  assert.equal(writes.length, 1)
  assert.equal(renames.length, 1)
  assert.equal(writes[0][0], renames[0][0])
  assert.equal(dirname(writes[0][0]), dirname(renames[0][1]))
  assert.match(
    renames[0][1].replaceAll('\\', '/'),
    /mini\/miniprogram\/config\/env\.ts$/,
  )
  assert.match(writes[0][1], /trial: 'https:\/\/shop\.registered-domain\.cn'/)
  assert.match(writes[0][1], /release: 'https:\/\/shop\.registered-domain\.cn'/)
})
