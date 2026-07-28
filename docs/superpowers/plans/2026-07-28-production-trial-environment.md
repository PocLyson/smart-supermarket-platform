# Production Trial Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, testable production-deployment gate for the WeChat trial environment without purchasing cloud resources or storing secrets in Git.

**Architecture:** Keep the existing single-host Docker Compose deployment, but make the public hostname an explicit environment input and render it into the official Nginx image template. Add a dependency-free Node.js readiness checker that rejects secrets in Git, unsafe credentials, local WeChat mock login, missing certificates, mismatched mini-program origins, and invalid Compose configuration before upload or deployment.

**Tech Stack:** Node.js built-in test runner, Docker Compose v2, Nginx 1.28 official image templating, Spring Boot 3.5, Vue 3/Vite, native WeChat mini program TypeScript.

## Global Constraints

- Do not purchase a domain, server, certificate, or other paid resource in this implementation.
- Do not ask for or persist the WeChat AppSecret in chat, source files, shell history, logs, or tests.
- Keep `WECHAT_LOCAL_MOCK_ENABLED=false` in every public environment.
- Expose only ports `80` and `443`; never publish Spring Boot, MySQL, or Redis ports.
- Store production secrets only in `deploy/.env.production` with filesystem mode `600`.
- Treat `PUBLIC_HOST` as a hostname such as `shop.registered-domain.cn`, without protocol, path, query, fragment, wildcard, or port.
- Use the same `https://${PUBLIC_HOST}` origin for the admin site, mini-program API, and product images.
- Preserve the user's existing uncommitted `mini/project.config.json` AppID change and never stage it as part of these tasks.
- Keep safe `.invalid` sentinels until a registered, ICP-filed hostname is supplied.
- Every implementation task follows red-green TDD and ends with a focused commit.

## File Structure

- `.gitignore`: enforce that production environment files, certificates, and local backup artifacts cannot be committed.
- `deploy/env.example`: document all required production keys with non-deployable safe values.
- `deploy/compose.production.yaml`: pass the public hostname and hard-disable local WeChat mock login.
- `deploy/nginx/default.conf.template`: render only `PUBLIC_HOST` while preserving Nginx runtime variables.
- `deploy/scripts/production-readiness.mjs`: parse and validate the production environment and repository state without printing secrets.
- `deploy/scripts/production-readiness.test.mjs`: cover credential, hostname, Git, certificate, mini-origin, and deployment-file gates.
- `deploy/scripts/configure-mini-origin.mjs`: set trial and release API origins from one validated hostname.
- `deploy/scripts/configure-mini-origin.test.mjs`: prove both public mini-program origins change together and malformed hosts are rejected.
- `mini/miniprogram/config/env.ts`: retain safe `.invalid` sentinels until the hostname configuration command is run.
- `docs/operations/domain-and-wechat-trial.md`: operator runbook for purchase, ICP filing, DNS, TLS, WeChat legal domains, upload, and trial acceptance.
- `docs/operations/deployment.md`: call the readiness checker before Compose deployment.
- `README.md`: link the new runbook and readiness command.

---

### Task 1: Protect production secrets and validate environment values

**Files:**
- Modify: `.gitignore:1-20`
- Modify: `deploy/env.example:1-9`
- Create: `deploy/scripts/production-readiness.mjs`
- Create: `deploy/scripts/production-readiness.test.mjs`

**Interfaces:**
- Consumes: a UTF-8 dotenv file containing `PUBLIC_HOST`, database credentials, Redis credentials, JWT secret, WeChat credentials, TLS directory, and the local-mock switch.
- Produces: `parseDotEnv(text): Record<string, string>` and `validateEnvironment(env): string[]`; the CLI exits `0` only when no validation errors exist and never prints environment values.

- [ ] **Step 1: Write failing pure-validation tests**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
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
  assert.equal(errors.some((error) => error.includes(validEnvironment.MYSQL_PASSWORD)), false)
})
```

- [ ] **Step 2: Run the tests and verify the module is missing**

Run:

```powershell
node --test deploy/scripts/production-readiness.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `production-readiness.mjs`.

- [ ] **Step 3: Implement dotenv parsing and pure environment validation**

```js
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
    !/^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
      env.PUBLIC_HOST ?? '',
    ) ||
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
```

- [ ] **Step 4: Add the CLI without exposing values**

The CLI must:

1. accept `--env-file <path>`, defaulting to `deploy/.env.production`;
2. read the file as UTF-8;
3. print only validation messages and a final pass/fail count;
4. set `process.exitCode = 1` when validation fails;
5. export `main(args, dependencies)` so tests can inject filesystem and command dependencies.

Run:

```powershell
node --test deploy/scripts/production-readiness.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Enforce ignored secret paths and expand the safe example**

Append to `.gitignore`:

```gitignore
deploy/.env.production
deploy/.env.*.local
deploy/certs/
deploy/backups/
```

Update `deploy/env.example` to include:

```dotenv
PUBLIC_HOST=shop.example.invalid
WECHAT_LOCAL_MOCK_ENABLED=false
```

Keep the existing non-secret sample keys. The `.invalid` hostname deliberately makes the example non-deployable.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
node --test deploy/scripts/production-readiness.test.mjs
git check-ignore deploy/.env.production deploy/certs/fullchain.pem
git diff --check
```

Expected: tests PASS; both secret paths are ignored; no whitespace errors.

Commit:

```powershell
git add .gitignore deploy/env.example deploy/scripts/production-readiness.mjs deploy/scripts/production-readiness.test.mjs
git commit -m "feat(deploy): validate production environment"
```

---

### Task 2: Render the public hostname and hard-disable mock login

**Files:**
- Modify: `deploy/compose.production.yaml:1-75`
- Delete: `deploy/nginx/smart-store.conf`
- Create: `deploy/nginx/default.conf.template`
- Modify: `deploy/scripts/production-readiness.mjs`
- Modify: `deploy/scripts/production-readiness.test.mjs`

**Interfaces:**
- Consumes: the validated `PUBLIC_HOST` and existing production environment variables.
- Produces: an Nginx configuration rendered by the official image with only `PUBLIC_HOST` substituted; `validateDeploymentFiles(rootDir): string[]` checks the static deployment contract.

- [ ] **Step 1: Add a failing deployment-contract test**

```js
test('deployment files force the public hostname and disable local login mock', () => {
  assert.deepEqual(validateDeploymentFiles(repositoryRoot), [])
})
```

`validateDeploymentFiles` must require all of these literal contracts:

```text
deploy/compose.production.yaml:
  WECHAT_LOCAL_MOCK_ENABLED: "false"
  CORS_ALLOWED_ORIGINS: https://${PUBLIC_HOST}
  PUBLIC_HOST: ${PUBLIC_HOST:?PUBLIC_HOST is required}
  NGINX_ENVSUBST_FILTER: ^PUBLIC_HOST$
  ./nginx/default.conf.template:/etc/nginx/templates/default.conf.template:ro

deploy/nginx/default.conf.template:
  server_name ${PUBLIC_HOST};
```

Run:

```powershell
node --test deploy/scripts/production-readiness.test.mjs
```

Expected: FAIL because the current Compose and Nginx files do not satisfy the contract.

- [ ] **Step 2: Create the Nginx template**

Move the current `smart-store.conf` behavior into `default.conf.template` and change both server blocks to:

```nginx
server_name ${PUBLIC_HOST};
```

Preserve these Nginx runtime variables exactly:

```nginx
$host
$request_uri
$request_id
$remote_addr
$proxy_add_x_forwarded_for
```

They remain intact because Compose sets `NGINX_ENVSUBST_FILTER=^PUBLIC_HOST$`.

- [ ] **Step 3: Update production Compose**

Add to the `server.environment` section:

```yaml
CORS_ALLOWED_ORIGINS: https://${PUBLIC_HOST}
WECHAT_LOCAL_MOCK_ENABLED: "false"
```

Add to the `nginx` service:

```yaml
environment:
  PUBLIC_HOST: ${PUBLIC_HOST:?PUBLIC_HOST is required}
  NGINX_ENVSUBST_FILTER: ^PUBLIC_HOST$
```

Replace the Nginx configuration mount with:

```yaml
- ./nginx/default.conf.template:/etc/nginx/templates/default.conf.template:ro
```

Do not add port mappings to `mysql`, `redis`, or `server`.

- [ ] **Step 4: Implement and run static deployment checks**

Implement `validateDeploymentFiles(rootDir)` using `readFileSync` and exact string checks. Do not parse or print secrets.

Run:

```powershell
node --test deploy/scripts/production-readiness.test.mjs
docker compose -f deploy/compose.production.yaml --env-file deploy/env.example config > $null
```

Expected: tests PASS and Compose renders successfully with safe example values.

- [ ] **Step 5: Commit**

```powershell
git add deploy/compose.production.yaml deploy/nginx/default.conf.template deploy/nginx/smart-store.conf deploy/scripts/production-readiness.mjs deploy/scripts/production-readiness.test.mjs
git commit -m "feat(deploy): template the production hostname"
```

---

### Task 3: Configure mini-program trial and release origins atomically

**Files:**
- Create: `deploy/scripts/configure-mini-origin.mjs`
- Create: `deploy/scripts/configure-mini-origin.test.mjs`
- Modify: `deploy/scripts/production-readiness.mjs`
- Modify: `deploy/scripts/production-readiness.test.mjs`
- Modify only when a registered hostname is supplied: `mini/miniprogram/config/env.ts:1-23`
- Existing test: `mini/tests/env.spec.ts`

**Interfaces:**
- Consumes: `--host shop.registered-domain.cn` and the current `env.ts` source.
- Produces: `validatePublicHost(host): string`, `replaceMiniOrigins(source, host): string`, and a CLI that changes both `trial` and `release` to `https://${host}` in one write.
- The readiness checker requires both public origins to equal `https://${PUBLIC_HOST}`.

- [ ] **Step 1: Write failing hostname and replacement tests**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
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
```

- [ ] **Step 2: Run the tests and verify the module is missing**

Run:

```powershell
node --test deploy/scripts/configure-mini-origin.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement atomic origin configuration**

```js
export function validatePublicHost(host) {
  if (
    !/^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
      host,
    ) ||
    host.endsWith('.invalid')
  ) {
    throw new Error('host must be a registered hostname without protocol or path')
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
  if (withRelease === source || !withRelease.includes(`trial: '${origin}'`)) {
    throw new Error('mini environment source did not match the expected contract')
  }
  return withRelease
}
```

The CLI must write through a temporary sibling file and rename it over `env.ts` only after replacement succeeds.

- [ ] **Step 4: Add readiness matching**

Extend `production-readiness.mjs` so `validateMiniOrigins(rootDir, publicHost)` returns an error unless both `trial` and `release` equal `https://${publicHost}`.

Tests must cover:

- both values match: no error;
- one value differs: one stable error message;
- either value ends with `.invalid`: one stable error message;
- error messages never contain credentials.

- [ ] **Step 5: Keep sentinels until the external hostname exists**

Before domain purchase and ICP completion, run:

```powershell
npm --prefix mini test -- --run
npm --prefix mini run typecheck
```

Expected: existing safe-sentinel tests PASS. Do not run the configuration CLI yet.

After the user supplies the registered hostname, run exactly:

```powershell
node deploy/scripts/configure-mini-origin.mjs --host $env:PUBLIC_HOST
npm --prefix mini test -- --run
npm --prefix mini run typecheck
```

Then update `mini/tests/env.spec.ts` expected `trial` and `release` values to the exact configured HTTPS origin.

- [ ] **Step 6: Commit the reusable tooling**

Before the hostname exists, commit only the tooling and tests:

```powershell
git add deploy/scripts/configure-mini-origin.mjs deploy/scripts/configure-mini-origin.test.mjs deploy/scripts/production-readiness.mjs deploy/scripts/production-readiness.test.mjs
git commit -m "feat(deploy): configure mini program public origin"
```

The later hostname commit must explicitly stage only:

```powershell
git add mini/miniprogram/config/env.ts mini/tests/env.spec.ts
git commit -m "config(mini): set public API origin"
```

Never stage `mini/project.config.json` in either commit.

---

### Task 4: Add the domain, ICP, TLS, and WeChat trial runbook

**Files:**
- Create: `docs/operations/domain-and-wechat-trial.md`
- Modify: `docs/operations/deployment.md:1-55`
- Modify: `README.md:40-75`

**Interfaces:**
- Consumes: the approved design, Tencent Cloud account, registered domain, ICP result, server IP, TLS certificate, and WeChat public-platform administrator access.
- Produces: one linear operator checklist with explicit stop conditions and no secret values.

- [ ] **Step 1: Write the runbook**

The runbook must contain these ordered sections:

1. purchase approval gate: 2-core/2-GB mainland Lighthouse and one domain;
2. domain registrant must match the filing subject;
3. ICP filing steps and the 24-hour SMS-verification window;
4. DNS `A` record from the business subdomain to the server public IP;
5. Docker Engine, Compose v2, firewall `22/80/443`, and non-root deployment user;
6. TLS certificate placement at `deploy/certs/fullchain.pem` and `deploy/certs/privkey.pem`;
7. secure creation of `deploy/.env.production` without echoing secrets;
8. `node deploy/scripts/production-readiness.mjs --env-file deploy/.env.production`;
9. deployment and health/security checks;
10. WeChat `request` and `downloadFile` legal-domain configuration;
11. mini-origin configuration using `configure-mini-origin.mjs`;
12. developer-tool upload, experience-member assignment, and experience-version selection;
13. real-device login, image, order, cash, WeChat collection-code, and inventory checks;
14. the existing `docs/operations/trial-acceptance.md` sign-off gate;
15. rollback and secret-rotation instructions.

Include these explicit stop conditions:

- ICP filing not approved;
- certificate chain invalid;
- readiness checker fails;
- mini origin is still `.invalid`;
- WeChat mock login enabled;
- production environment file is tracked by Git;
- any required test fails.

- [ ] **Step 2: Link the runbook from deployment documentation**

Add before the production configuration section:

```markdown
购买域名、ICP备案、微信合法域名和体验版上传必须先按
[域名与微信体验版操作手册](domain-and-wechat-trial.md) 执行。
```

Add the readiness command before `docker compose ... config`:

```bash
node deploy/scripts/production-readiness.mjs \
  --env-file deploy/.env.production
```

- [ ] **Step 3: Link the runbook from README**

Add under “文档”:

```markdown
- [域名、备案与微信体验版](docs/operations/domain-and-wechat-trial.md)
```

- [ ] **Step 4: Verify documentation and commit**

Run:

```powershell
rg -n "production-readiness|ICP备案|request 合法域名|downloadFile|体验版" docs/operations README.md
git diff --check
```

Expected: every required topic is present and no whitespace errors exist.

Commit:

```powershell
git add docs/operations/domain-and-wechat-trial.md docs/operations/deployment.md README.md
git commit -m "docs: add WeChat trial release runbook"
```

---

### Task 5: Run the pre-purchase verification gate

**Files:**
- Verify only: all files changed in Tasks 1-4
- Do not modify or stage: `mini/project.config.json`

**Interfaces:**
- Consumes: the completed safe tooling and documentation.
- Produces: evidence that all repository-local work is ready while the public hostname, certificate, secrets, and paid resources remain external prerequisites.

- [ ] **Step 1: Run deployment-tool tests**

```powershell
node --test deploy/scripts/production-readiness.test.mjs
node --test deploy/scripts/configure-mini-origin.test.mjs
docker compose -f deploy/compose.production.yaml --env-file deploy/env.example config > $null
```

Expected: all Node tests PASS and Compose renders.

- [ ] **Step 2: Run application regression tests**

```powershell
cd server
.\mvnw.cmd test
cd ..\admin
npm.cmd test -- --run
npm.cmd run build
cd ..\mini
npm.cmd test -- --run
npm.cmd run typecheck
cd ..
```

Expected:

- backend: all tests PASS;
- admin: 39 tests PASS and production build succeeds;
- mini: 52 tests PASS and TypeScript check succeeds.

- [ ] **Step 3: Verify repository boundaries**

```powershell
git diff --check
git status --short
git ls-files --error-unmatch deploy/.env.production
```

Expected:

- `git diff --check` succeeds;
- `git status --short` shows only the user's existing `mini/project.config.json` change if all task commits are complete;
- `git ls-files --error-unmatch deploy/.env.production` exits non-zero, proving the production secret file is not tracked.

- [ ] **Step 4: Record the external prerequisites**

Report exactly these remaining inputs without requesting secret values:

- approved cloud budget;
- registered domain;
- completed ICP filing;
- resolved `PUBLIC_HOST`;
- installed TLS certificate;
- server-side AppSecret entry;
- WeChat public-platform legal-domain configuration.

The next action after this task is purchase confirmation. No cloud purchase, account change, DNS change, upload, or external submission is authorized by this implementation plan.

---

## Self-Review

- Spec coverage: Tasks 1-3 cover secret boundaries, hostname rendering, mock-login shutdown, certificates, Compose, and mini origins. Task 4 covers purchase through experience-version operations. Task 5 covers automated and manual gates.
- Scope: repository-local preparation is executable now; paid resources and external console changes remain a separate approval-gated phase.
- Type consistency: `parseDotEnv`, `validateEnvironment`, `validateDeploymentFiles`, `validatePublicHost`, `replaceMiniOrigins`, and `validateMiniOrigins` have one spelling and responsibility throughout the plan.
- Safety: no step prints, commits, uploads, or asks for AppSecret. The user's AppID file is explicitly excluded from staging.
- Sentinel behavior: `.invalid` values remain intentionally non-deployable until a registered hostname is supplied.
