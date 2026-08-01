# Task 4 — Mini-program announcements report

## Delivered

- Added the `Announcement` type and `announcementsService` with public latest, paginated list, and detail endpoints.
- Added a home announcement strip immediately after the hero and before popular categories. It loads independently from the product catalog; no announcement or an announcement request failure leaves the strip hidden.
- Added paginated announcement list and detail pages. Detail renders plain text with `white-space: pre-wrap`; unavailable, offline, or invalid announcements show `该公告已结束` and a return action.
- Registered both announcement pages in the mini-program application manifest and added navy-token-based page styles.

## TDD evidence

1. Added `mini/tests/announcements.spec.ts` before implementation to specify service request paths, page registration, home layout order, independent failure hiding, and plain-text ended detail rendering.
2. Ran `cd mini && npm test -- announcements.spec.ts`; it failed as expected because `miniprogram/services/announcements` did not exist.
3. Implemented the minimum type, service, pages, home integration, and styles to satisfy the contract.

## Verification

- `cd mini && npm test -- announcements.spec.ts home-visual-contract.spec.ts` — 16 tests passed.
- `cd mini && npm test` — 35 files / 122 tests passed.
- `cd mini && npm run typecheck` — passed.
- `git diff --check` — passed.

## Notes

- The announcement endpoint's nullable latest response is normalized to `undefined` in home data so the WXML guard fully hides the strip.
- Detail intentionally treats any failed fetch (including 404 and offline) as an ended announcement as required.
