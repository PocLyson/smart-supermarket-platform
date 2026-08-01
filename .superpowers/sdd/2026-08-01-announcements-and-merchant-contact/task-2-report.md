# Task 2 Report: Announcement and Store Contact APIs

## Implemented

- Added owner-only admin announcement routes for list, create, detail, update, publish, offline, and delete.
- Added anonymous mini-program announcement latest, list, and detail routes. Public detail delegates to the published-only service method, so draft and offline records are returned as 404.
- Added the anonymous mini store-contact route, backed exclusively by `smart-store.store-contact` configuration.
- Added environment-backed defaults: phone `18653045492` and `customerServiceEnabled=true`.
- Added deterministic contact properties to `IntegrationTestBase`.
- Added public mini security matchers and inserted the owner-only announcement matcher before the general `/api/admin/**` matcher.
- Added API-level coverage for all requested routes, owner success, cashier 403s, public mini reads, public 404 behavior, and exact contact payload.

## TDD and verification evidence

1. Added `AnnouncementApiTest` and `StoreContactApiTest` before production controllers and configuration.
2. Ran `./mvnw.cmd '-Dtest=AnnouncementApiTest,StoreContactApiTest' test` before implementation. The test source compiled, but Testcontainers stopped before the Spring context or routes were reached because the process `PATH` had a malformed entry.
3. Retried after repairing that malformed `PATH` entry only for the command process. Testcontainers then reported that no Docker environment is available. Both test classes remain blocked before any test method runs, so endpoint assertions cannot be executed in this environment.
4. Ran `./mvnw.cmd package -DskipTests`: **PASS**. This compiled main and test sources and produced `target/smart-store-server-0.0.1-SNAPSHOT.jar`.
5. Ran `git diff --check`: **PASS**.

## Concern

Docker/Testcontainers is unavailable in this environment. API integration tests need Docker Desktop (or another valid Docker daemon) running before they can establish the MySQL and Redis containers. No test assertion failures were observed; execution is blocked during Testcontainers setup.
