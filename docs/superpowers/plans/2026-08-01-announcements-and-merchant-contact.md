# Announcements and Merchant Contact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner manage in-app store announcements and let customers reach the merchant through WeChat customer service or the configured store phone.

**Architecture:** Build a dedicated announcement aggregate with owner-only admin endpoints and anonymous read-only mini-program endpoints. Expose the store phone from one server-side configuration endpoint, while the customer-service button uses the WeChat native `open-type="contact"` capability. Add focused admin and mini-program presentation layers without coupling announcements to catalog or orders.

**Tech Stack:** Java 17, Spring Boot 3.5.9, JPA, Flyway/MySQL 8.4, Spring Security, Vue 3, Element Plus, Pinia/Vue Router, native WeChat Mini Program TypeScript/WXML/WXSS, TDesign 1.15.3, Vitest, JUnit 5/Testcontainers.

## Global Constraints

- This is in-app announcement publishing, not WeChat subscription/template-message push.
- Announcement statuses are exactly `DRAFT`, `PUBLISHED`, and `OFFLINE`.
- Title maximum is 60 characters; content maximum is 2000 characters; both render as plain text.
- Published announcements must be taken offline before editing or deleting.
- Mini-program queries return only published announcements ordered by `publishedAt DESC`.
- The home announcement bar is hidden when no announcement exists or loading fails.
- Only `OWNER` can manage announcements; `CASHIER` receives HTTP 403.
- Current store phone is exactly `18653045492` and must come from one centralized configuration source.
- If WeChat customer service is unavailable, direct the customer to the phone action.
- Do not store customer-service conversations.

---

### Task 1: Add announcement persistence and owner-only service operations

**Files:**
- Create: `server/src/main/resources/db/migration/V4__create_announcement.sql`
- Create: `server/src/main/java/com/luneng/smartstore/announcement/AnnouncementStatus.java`
- Create: `server/src/main/java/com/luneng/smartstore/announcement/Announcement.java`
- Create: `server/src/main/java/com/luneng/smartstore/announcement/AnnouncementRepository.java`
- Create: `server/src/main/java/com/luneng/smartstore/announcement/AnnouncementWriteRequest.java`
- Create: `server/src/main/java/com/luneng/smartstore/announcement/AnnouncementView.java`
- Create: `server/src/main/java/com/luneng/smartstore/announcement/AnnouncementService.java`
- Test: `server/src/test/java/com/luneng/smartstore/announcement/AnnouncementServiceTest.java`

**Interfaces:**
- Consumes: `CurrentPrincipal`, `AuditService.record(...)`, Spring Data JPA and the common `BusinessException` response mapping.
- Produces: `AnnouncementService.listAdmin`, `detailAdmin`, `create`, `update`, `publish`, `offline`, `delete`, `latestPublished`, `listPublished`, and `detailPublished`.

- [ ] **Step 1: Write failing aggregate/service tests**

Cover these transitions with explicit assertions:

```java
@Test
void publishedAnnouncementMustBeOfflineBeforeEditing() {
    AnnouncementView created = service.create(
        new AnnouncementWriteRequest("营业调整", "周日20点闭店"),
        owner,
        "announcement-create"
    );
    service.publish(created.id(), owner, "announcement-publish");

    assertThatThrownBy(() -> service.update(
        created.id(),
        new AnnouncementWriteRequest("新标题", "新正文"),
        owner,
        "announcement-update"
    )).isInstanceOf(BusinessException.class)
      .hasMessageContaining("请先下线");
}

@Test
void publishAndOfflineAreIdempotentWithoutDuplicateAuditRecords() {
    long id = createDraft();
    service.publish(id, owner, "publish-1");
    service.publish(id, owner, "publish-2");
    service.offline(id, owner, "offline-1");
    service.offline(id, owner, "offline-2");

    assertThat(jdbcTemplate.queryForObject(
        "select count(*) from operation_log where object_type = 'ANNOUNCEMENT'",
        Integer.class
    )).isEqualTo(2);
}
```

Also test: blank title/content rejected, title 61 rejected, content 2001 rejected, offline content can be edited, published list excludes drafts/offline records, and published ordering uses newest `published_at` first.

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
cd server
.\mvnw.cmd -Dtest=AnnouncementServiceTest test
```

Expected: FAIL because the announcement package and schema are absent.

- [ ] **Step 3: Create the announcement schema**

Use this migration:

```sql
CREATE TABLE announcement (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(60) NOT NULL,
    content VARCHAR(2000) NOT NULL,
    status VARCHAR(32) NOT NULL,
    published_at TIMESTAMP(6) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    updated_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_announcement_status_published (status, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 4: Implement the aggregate and DTO contracts**

Define state methods that report whether a transition changed state:

```java
public boolean publish(long actorId) {
    if (status == AnnouncementStatus.PUBLISHED) return false;
    status = AnnouncementStatus.PUBLISHED;
    publishedAt = Instant.now();
    updatedBy = actorId;
    return true;
}

public boolean offline(long actorId) {
    if (status == AnnouncementStatus.OFFLINE) return false;
    if (status != AnnouncementStatus.PUBLISHED) {
        throw conflict("只有已发布公告可以下线");
    }
    status = AnnouncementStatus.OFFLINE;
    updatedBy = actorId;
    return true;
}
```

`updateContent` and `delete` service validation must reject `PUBLISHED`. Normalize title/content with `trim()` and reject empty values before constructing or updating the entity.

- [ ] **Step 5: Implement repository queries and service auditing**

Repository signatures:

```java
Page<Announcement> findAllByStatus(
    AnnouncementStatus status,
    Pageable pageable
);

Page<Announcement> findAllByStatusOrderByPublishedAtDesc(
    AnnouncementStatus status,
    Pageable pageable
);

Optional<Announcement> findFirstByStatusOrderByPublishedAtDesc(
    AnnouncementStatus status
);
```

Record these exact actions only when state changes: `ANNOUNCEMENT_CREATE`, `ANNOUNCEMENT_UPDATE`, `ANNOUNCEMENT_PUBLISH`, `ANNOUNCEMENT_OFFLINE`, and `ANNOUNCEMENT_DELETE`. Use object type `ANNOUNCEMENT` and the numeric id as `objectId`.

- [ ] **Step 6: Verify the service tests pass**

Run:

```powershell
cd server
.\mvnw.cmd -Dtest=AnnouncementServiceTest test
```

Expected: PASS.

- [ ] **Step 7: Commit the announcement domain slice**

```powershell
git add -- server/src/main/resources/db/migration/V4__create_announcement.sql server/src/main/java/com/luneng/smartstore/announcement server/src/test/java/com/luneng/smartstore/announcement/AnnouncementServiceTest.java
git commit -m "feat: add announcement domain"
```

### Task 2: Publish admin, mini-program and store-contact APIs with security rules

**Files:**
- Create: `server/src/main/java/com/luneng/smartstore/announcement/AdminAnnouncementController.java`
- Create: `server/src/main/java/com/luneng/smartstore/announcement/MiniAnnouncementController.java`
- Create: `server/src/main/java/com/luneng/smartstore/store/StoreContactProperties.java`
- Create: `server/src/main/java/com/luneng/smartstore/store/StoreContactController.java`
- Modify: `server/src/main/java/com/luneng/smartstore/auth/SecurityConfig.java:31-63`
- Modify: `server/src/main/resources/application.yml:25-45`
- Modify: `server/src/test/java/com/luneng/smartstore/support/IntegrationTestBase.java:26-40`
- Test: `server/src/test/java/com/luneng/smartstore/announcement/AnnouncementApiTest.java`
- Test: `server/src/test/java/com/luneng/smartstore/store/StoreContactApiTest.java`

**Interfaces:**
- Consumes: Task 1 service operations and the existing `ApiResponse`, `PageResult`, `RequestIdFilter` conventions.
- Produces: admin announcement CRUD/state endpoints, public mini announcement endpoints, and `GET /api/mini/store/contact`.

- [ ] **Step 1: Add failing API and permission tests**

Assert these routes and policies:

```text
GET    /api/admin/announcements?status=DRAFT&page=0&size=20
POST   /api/admin/announcements
GET    /api/admin/announcements/{id}
PUT    /api/admin/announcements/{id}
POST   /api/admin/announcements/{id}/publish
POST   /api/admin/announcements/{id}/offline
DELETE /api/admin/announcements/{id}
GET    /api/mini/announcements/latest
GET    /api/mini/announcements?page=0&size=20
GET    /api/mini/announcements/{id}
GET    /api/mini/store/contact
```

Tests must assert owner success, cashier HTTP 403 on every admin mutation family, anonymous success on mini reads, draft/offline detail returns 404 to mini, and contact response equals:

```json
{"phone":"18653045492","customerServiceEnabled":true}
```

- [ ] **Step 2: Run API tests and verify failure**

Run:

```powershell
cd server
.\mvnw.cmd -Dtest=AnnouncementApiTest,StoreContactApiTest test
```

Expected: FAIL with missing controllers/routes.

- [ ] **Step 3: Implement controller contracts**

Use `@Valid` write bodies and `RequestIdFilter.requestId(request)` for every response/audit call. The admin list accepts optional `AnnouncementStatus status`, while the mini list is fixed to published data.

The contact response is:

```java
public record StoreContactView(
    String phone,
    boolean customerServiceEnabled
) { }
```

Bind configuration with:

```java
@ConfigurationProperties(prefix = "smart-store.store-contact")
public record StoreContactProperties(
    String phone,
    boolean customerServiceEnabled
) { }
```

- [ ] **Step 4: Add centralized environment-backed contact configuration**

Add to `application.yml`:

```yaml
smart-store:
  store-contact:
    phone: ${STORE_PHONE:18653045492}
    customer-service-enabled: ${WECHAT_CUSTOMER_SERVICE_ENABLED:true}
```

Enable the properties on the controller or application configuration and register the same deterministic values in `IntegrationTestBase`.

- [ ] **Step 5: Apply exact security rules**

Add the mini read routes to the `permitAll()` group:

```java
"/api/mini/announcements",
"/api/mini/announcements/**",
"/api/mini/store/contact"
```

Add `"/api/admin/announcements/**"` to the owner-only group before the general `/api/admin/**` matcher.

- [ ] **Step 6: Verify API tests pass and commit**

Run:

```powershell
cd server
.\mvnw.cmd -Dtest=AnnouncementApiTest,StoreContactApiTest test
```

Expected: PASS.

```powershell
git add -- server/src/main/java/com/luneng/smartstore/announcement server/src/main/java/com/luneng/smartstore/store server/src/main/java/com/luneng/smartstore/auth/SecurityConfig.java server/src/main/resources/application.yml server/src/test/java/com/luneng/smartstore
git commit -m "feat: expose announcement and store contact APIs"
```

### Task 3: Add owner announcement management to the admin app

**Files:**
- Create: `admin/src/api/announcements.ts`
- Create: `admin/src/views/announcements/AnnouncementView.vue`
- Create: `admin/tests/AnnouncementView.spec.ts`
- Modify: `admin/src/router/index.ts:8-62`
- Modify: `admin/src/layouts/AdminLayout.vue:35-62`
- Modify: `admin/src/components/AppIcon.vue:2-48`

**Interfaces:**
- Consumes: Task 2 admin API, `useAuthStore().isOwner`, common API `request/jsonBody`, Element Plus dialogs/messages.
- Produces: owner-only `/announcements` route and announcement list/editor interactions.

- [ ] **Step 1: Write failing API and view tests**

Mock the API and assert:

```ts
expect(listAnnouncements).toHaveBeenCalledWith({ status: 'DRAFT', page: 0, size: 20 })
expect(createAnnouncement).toHaveBeenCalledWith({
  title: '营业调整',
  content: '周日20点闭店',
})
expect(publishAnnouncement).toHaveBeenCalledWith(1)
expect(offlineAnnouncement).toHaveBeenCalledWith(1)
```

Mount the view and verify: status filter, title/content counters, 60/2000 limits, published rows do not show edit/delete, offline rows show edit/delete/republish, and destructive deletion requires confirmation.

- [ ] **Step 2: Run the view test and verify failure**

Run:

```powershell
cd admin
npm test -- AnnouncementView.spec.ts
```

Expected: FAIL because the API module, route and view do not exist.

- [ ] **Step 3: Implement typed API functions**

Export these exact types and functions:

```ts
export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'OFFLINE'

export interface Announcement {
  id: number
  title: string
  content: string
  status: AnnouncementStatus
  publishedAt: string | null
  createdBy: number
  updatedBy: number
  createdAt: string
  updatedAt: string
}

export const listAnnouncements: (query: AnnouncementQuery) => Promise<PageResult<Announcement>>
export const createAnnouncement: (payload: AnnouncementWriteRequest) => Promise<Announcement>
export const updateAnnouncement: (id: number, payload: AnnouncementWriteRequest) => Promise<Announcement>
export const publishAnnouncement: (id: number) => Promise<Announcement>
export const offlineAnnouncement: (id: number) => Promise<Announcement>
export const deleteAnnouncement: (id: number) => Promise<{ deleted: boolean }>
```

- [ ] **Step 4: Implement the view, route, menu and icon**

Use one page with a status filter, responsive table/mobile cards and an editor dialog. Before publish, offline, or delete call:

```ts
await ElMessageBox.confirm(message, title, {
  confirmButtonText,
  cancelButtonText: '取消',
  type: action === 'delete' ? 'warning' : 'info',
})
```

Add `/announcements` to `ownerOnlyRoutes`, add the lazy route with `meta: { ownerOnly: true, title: '公告管理' }`, render it inside the owner-only sidebar block, and add an `announcements` megaphone SVG path to `AppIcon`.

- [ ] **Step 5: Verify admin tests and production build**

Run:

```powershell
cd admin
npm test -- AnnouncementView.spec.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit the admin slice**

```powershell
git add -- admin/src/api/announcements.ts admin/src/views/announcements admin/src/router/index.ts admin/src/layouts/AdminLayout.vue admin/src/components/AppIcon.vue admin/tests/AnnouncementView.spec.ts
git commit -m "feat: manage store announcements"
```

### Task 4: Show announcements on the mini-program home, list and detail pages

**Files:**
- Create: `mini/miniprogram/types/announcement.ts`
- Create: `mini/miniprogram/services/announcements.ts`
- Create: `mini/miniprogram/pages/announcements/index.ts`
- Create: `mini/miniprogram/pages/announcements/index.wxml`
- Create: `mini/miniprogram/pages/announcements/index.wxss`
- Create: `mini/miniprogram/pages/announcement-detail/index.ts`
- Create: `mini/miniprogram/pages/announcement-detail/index.wxml`
- Create: `mini/miniprogram/pages/announcement-detail/index.wxss`
- Modify: `mini/miniprogram/app.json:2-18`
- Modify: `mini/miniprogram/pages/home/index.ts:1-70`
- Modify: `mini/miniprogram/pages/home/index.wxml:30-55`
- Modify: `mini/miniprogram/pages/home/index.wxss`
- Test: `mini/tests/announcements.spec.ts`

**Interfaces:**
- Consumes: Task 2 public announcement endpoints and the existing unauthenticated `http` client.
- Produces: `announcementsService.latest/list/detail`, a home announcement strip, list page and detail page.

- [ ] **Step 1: Write failing service and visual contract tests**

Test exact service requests:

```ts
expect(client.get).toHaveBeenCalledWith('/api/mini/announcements/latest')
expect(client.get).toHaveBeenCalledWith('/api/mini/announcements', { page: 0, size: 20 })
expect(client.get).toHaveBeenCalledWith('/api/mini/announcements/7')
```

Read the WXML and assert the home bar is placed after `home-hero` and before `category-heading`, is guarded by `wx:if="{{latestAnnouncement}}"`, and has `bindtap="onOpenAnnouncement"`. Assert both new pages are registered in `app.json`.

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
cd mini
npm test -- announcements.spec.ts
```

Expected: FAIL because the service, pages and markup are absent.

- [ ] **Step 3: Implement announcement types and service**

Use:

```ts
export interface Announcement {
  id: number
  title: string
  content: string
  publishedAt: string
}

export const announcementsService = {
  latest: () => http.get<Announcement | null>('/api/mini/announcements/latest'),
  list: (page = 0, size = 20) =>
    http.get<PageResult<Announcement>>('/api/mini/announcements', { page, size }),
  detail: (id: number) => http.get<Announcement>(`/api/mini/announcements/${id}`),
}
```

- [ ] **Step 4: Add non-blocking home loading and navigation**

Load the latest announcement separately from catalog loading:

```ts
async loadLatestAnnouncement() {
  try {
    this.setData({ latestAnnouncement: await announcementsService.latest() })
  } catch {
    this.setData({ latestAnnouncement: undefined })
  }
}
```

Call it from `onLoad()` without awaiting it before `loadInitial()`. Use the confirmed compact bar after the hero. Clicking the title opens `/pages/announcement-detail/index?id=...`; clicking a small “全部” affordance opens `/pages/announcements/index`.

- [ ] **Step 5: Implement list/detail loading and ended state**

The list supports pagination and shows title plus formatted `publishedAt`. The detail catches a 404/offline response and renders `该公告已结束` with a back button. Render content in `<text>` with `white-space: pre-wrap`; do not use `<rich-text>`.

- [ ] **Step 6: Verify mini-program tests and type checking**

Run:

```powershell
cd mini
npm test -- announcements.spec.ts home-visual-contract.spec.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit the mini announcement slice**

```powershell
git add -- mini/miniprogram/types/announcement.ts mini/miniprogram/services/announcements.ts mini/miniprogram/pages/announcements mini/miniprogram/pages/announcement-detail mini/miniprogram/pages/home mini/miniprogram/app.json mini/tests/announcements.spec.ts mini/tests/home-visual-contract.spec.ts
git commit -m "feat: show store announcements in mini program"
```

### Task 5: Add resilient merchant contact actions to profile and order detail

**Files:**
- Create: `mini/miniprogram/types/store.ts`
- Create: `mini/miniprogram/services/store.ts`
- Create: `mini/miniprogram/utils/merchant-contact.ts`
- Modify: `mini/miniprogram/pages/profile/index.ts:1-92`
- Modify: `mini/miniprogram/pages/profile/index.wxml:45-66`
- Modify: `mini/miniprogram/pages/profile/index.wxss`
- Modify: `mini/miniprogram/pages/order-detail/index.ts:1-105`
- Modify: `mini/miniprogram/pages/order-detail/index.wxml:84-98`
- Modify: `mini/miniprogram/pages/order-detail/index.wxss`
- Test: `mini/tests/merchant-contact.spec.ts`

**Interfaces:**
- Consumes: `GET /api/mini/store/contact`, WeChat `wx.makePhoneCall`, and native button `open-type="contact"`.
- Produces: reusable `loadStoreContact()` and `callStorePhone(phone)` helpers plus contact actions in two pages.

- [ ] **Step 1: Write failing contact service, fallback and markup tests**

Test the exact phone and failure fallback:

```ts
await callStorePhone('18653045492', wxApi)
expect(wxApi.makePhoneCall).toHaveBeenCalledWith(
  expect.objectContaining({ phoneNumber: '18653045492' }),
)

wxApi.makePhoneCall.mockImplementation(({ fail }) => fail?.({ errMsg: 'fail' }))
await callStorePhone('18653045492', wxApi)
expect(wxApi.showModal).toHaveBeenCalledWith(
  expect.objectContaining({ content: expect.stringContaining('18653045492') }),
)
```

Assert both profile and order-detail WXML contain one `open-type="contact"` button and one `bindtap="onCallStore"` button.

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
cd mini
npm test -- merchant-contact.spec.ts
```

Expected: FAIL because the service, helper and buttons are absent.

- [ ] **Step 3: Implement centralized contact loading and phone fallback**

Use:

```ts
export interface StoreContact {
  phone: string
  customerServiceEnabled: boolean
}

export const storeService = {
  contact: () => http.get<StoreContact>('/api/mini/store/contact'),
}
```

`callStorePhone` must pass the configured number to `wx.makePhoneCall`. On failure, show a modal titled `联系门店` with the complete number and `showCancel: false`.

- [ ] **Step 4: Add contact actions using the approved layout**

In profile, place two equal-width actions inside the existing `store-service` card. In order detail, replace the passive contact sentence with a compact `联系商家` card directly after order information.

Use native customer-service markup:

```xml
<button
  wx:if="{{storeContact.customerServiceEnabled}}"
  class="merchant-contact-button is-secondary"
  open-type="contact"
>
  联系在线客服
</button>
<button class="merchant-contact-button is-primary" bindtap="onCallStore">
  拨打门店电话
</button>
```

If contact loading fails, retain a local emergency fallback of `18653045492` for the phone action and hide only the online-service button.

- [ ] **Step 5: Verify all communication tests and full regression**

Run:

```powershell
cd server
.\mvnw.cmd test
cd ..\admin
npm test
npm run build
cd ..\mini
npm test
npm run typecheck
```

Expected: all suites pass; the mini home remains usable when announcements fail; cashier cannot access announcement management.

- [ ] **Step 6: Commit the contact and regression slice**

```powershell
git add -- mini/miniprogram/types/store.ts mini/miniprogram/services/store.ts mini/miniprogram/utils/merchant-contact.ts mini/miniprogram/pages/profile mini/miniprogram/pages/order-detail mini/tests/merchant-contact.spec.ts
git commit -m "feat: add merchant contact actions"
```
