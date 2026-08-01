# Task 5 report: merchant contact actions

## Delivered

- Added the anonymous mini-program contact service for `GET /api/mini/store/contact` with the `StoreContact` contract.
- Added `loadStoreContact()` with the local emergency fallback `18653045492`; a failed configuration request disables only online support.
- Added `callStorePhone()` around native `wx.makePhoneCall`; dialing failures show a non-cancelable modal with the complete telephone number.
- Added exactly one native `open-type="contact"` button and one telephone action to the profile store-service card and the compact order-detail merchant-contact card.
- Contact loading is independent of login and does not alter the existing profile or order request flows.

## TDD evidence

`mini/tests/merchant-contact.spec.ts` was added before implementation and initially failed because `miniprogram/services/store` did not exist. It now covers the exact public endpoint, fallback contact configuration, native dialing, dialer failure modal, and both page markup contracts.

## Verification

- `mini: npm test -- merchant-contact.spec.ts` — passed, 1 file / 6 tests.
- `mini: npm run typecheck` — passed.
- `mini: npm test` — passed, 36 files / 128 tests.
- `admin: npm test` — passed, 14 files / 66 tests.
- `admin: npm run build` — passed.
- `server: .\\mvnw.cmd test` — blocked before application tests by Testcontainers. The Java process reports `InvalidPathException: Illegal char <:>` for the malformed PATH segment `C:\\Users\\k\\AppData\\Local\\Microsoft\\WindowsAppsC:\\Program Files\\Git\\cmd` while detecting Docker.

## Concern

The server regression suite needs a corrected Windows PATH/Testcontainers environment before it can run. This is environmental and no server code was changed by Task 5.
