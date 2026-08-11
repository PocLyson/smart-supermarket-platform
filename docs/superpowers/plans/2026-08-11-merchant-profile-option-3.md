# Merchant Profile Option 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the merchant mini-program profile page to faithfully match the third selected visual while preserving all existing account, WeChat unbind, error-recovery, logout, and navigation behavior.

**Architecture:** Keep the existing page controller and backend contracts unchanged, and replace only the profile page presentation with a navy security header, overlapping employee identity card, grouped account rows, a security notice, and a quiet logout action. Reuse the existing floating `app-tab-bar`; use bundled product icons plus licensed Lucide SVG assets instead of CSS-drawn or text-symbol icons.

**Tech Stack:** WeChat Mini Program WXML/WXSS/TypeScript, TDesign Mini Program 1.15.3, Lucide Static 0.468.0 SVG assets, Vitest 4.1.10.

## Global Constraints

- Visual source of truth: `C:\Users\k\.codex\generated_images\019fa442-921b-77e3-9dc4-8c3354447a37\exec-9be5938a-21cc-4fcc-9b9d-1970ebaab3fc.png`.
- Preserve primary color `#082F6B`, page background `#F7F9FC`, existing theme tokens, safe-area handling, and the five-item floating navigation.
- Preserve `confirmUnbind`, `logout`, recoverable errors, role-based shortcuts, and login redirects without changing service APIs.
- Do not edit `merchant-mini/project.config.json` or `merchant-mini/project.private.config.json`.
- Do not use emoji, CSS-drawn icons, new gradients, new settings, or new routes.
- Do not control the owner's computer or WeChat Developer Tools; automated verification is required and visual QA remains blocked until owner inspection.

---

### Task 1: Rebuild the profile screen from the selected visual

**Files:**
- Create: `merchant-mini/miniprogram/assets/icons/shield-check.svg`
- Create: `merchant-mini/miniprogram/assets/icons/info.svg`
- Modify: `merchant-mini/miniprogram/pages/profile/index.wxml`
- Modify: `merchant-mini/miniprogram/pages/profile/index.wxss`
- Modify: `merchant-mini/tests/top-level-ui.spec.ts`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: `session.username`, `session.role`, `shortcuts`, `isLoading`, `isUnbinding`, `errorMessage`, `onShortcutTap`, `confirmUnbind`, and `logout` from the existing profile page controller.
- Produces: the selected profile hierarchy with real tap handlers and no controller or API contract changes.

- [x] **Step 1: Write the failing presentation contract**

```ts
test('profile matches the selected layered security layout', () => {
  const markup = pageSource('profile', 'wxml')
  const styles = pageSource('profile', 'wxss')

  expect(markup).toContain('class="profile-security-header"')
  expect(markup).toContain('class="profile-identity-card"')
  expect(markup).toContain('微信已绑定')
  expect(markup).toContain('class="profile-account-card"')
  expect(markup).toContain('class="security-notice"')
  expect(markup).toContain('管理微信绑定')
  expect(markup).toContain('bindtap="confirmUnbind"')
  expect(markup).toContain('bindtap="logout"')
  expect(styles).toMatch(/\.profile-identity-card\s*\{[^}]*margin:\s*-96rpx/s)
})
```

- [x] **Step 2: Run the focused test and confirm RED**

Run: `cd merchant-mini && npm test -- --run tests/top-level-ui.spec.ts`

Expected: FAIL because the selected security header, account card, security notice, and overlap contract do not exist.

- [x] **Step 3: Add licensed icon assets and implement the selected WXML/WXSS**

Use Lucide Static 0.468.0 `shield-check.svg` and `info.svg` with the ISC license comment. Render a navy header, overlapping identity card using `/assets/icons/profile.svg`, account rows using `/assets/icons/messages.svg` and `/assets/icons/shield-check.svg`, the existing `/assets/icons/chevron-right.svg`, a blue-tinted security notice, an outline `管理微信绑定` button wired to `confirmUnbind`, and a text-style `退出登录` control wired to `logout`.

- [x] **Step 4: Run focused and full verification**

Run: `cd merchant-mini && npm test -- --run tests/top-level-ui.spec.ts tests/profile.spec.ts`

Expected: PASS with the layout contract and existing unbind-flow tests green.

Run: `cd merchant-mini && npm test -- --run && npm run typecheck`

Expected: all tests pass and TypeScript exits 0.

Run: `git diff --check`

Expected: exit 0.

- [x] **Step 5: Record the visual verification boundary and commit**

Append the selected reference, implemented hierarchy, and automated evidence to `design-qa.md`, ending with `final result: blocked` because the owner prohibited computer control and no new runtime screenshot can be captured.

```powershell
git add -- docs/superpowers/plans/2026-08-11-merchant-profile-option-3.md design-qa.md merchant-mini/miniprogram/assets/icons/shield-check.svg merchant-mini/miniprogram/assets/icons/info.svg merchant-mini/miniprogram/pages/profile/index.wxml merchant-mini/miniprogram/pages/profile/index.wxss merchant-mini/tests/top-level-ui.spec.ts
git commit -m "feat: redesign merchant profile security page"
```

## Self-Review

- Spec coverage: all visible areas from the selected third design map to Task 1; existing interaction handlers remain wired.
- Placeholder scan: no deferred implementation or unspecified error handling remains.
- Type consistency: WXML uses only fields and handlers already present in `pages/profile/index.ts`; no new controller types are introduced.
