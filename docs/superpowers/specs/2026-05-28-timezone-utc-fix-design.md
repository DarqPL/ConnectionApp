# Timezone Fix: UTC Timestamps Design

**Date:** 2026-05-28
**Status:** Approved

## Problem

Backend deployed on EC2 (Singapore timezone, UTC+8) uses `LocalDateTime.now()` to capture timestamps. These are stored without timezone info and serialized as naive ISO-8601 strings (e.g., `"2024-05-28T14:30:00"`). Frontend's `new Date("2024-05-28T14:30:00")` interprets this as the browser's local time, causing incorrect display for users in different timezones.

## Solution

Store all timestamps as `Instant` (UTC) in the backend. Jackson serializes `Instant` with a `Z` suffix (e.g., `"2024-05-28T06:30:00Z"`). Frontend's `new Date()` auto-converts UTC to the browser's local timezone — zero frontend code changes needed.

## Changes

### Backend Entities (MariaDB - JPA)

| Entity | Fields | File |
|--------|--------|------|
| `User` | `createdAt`, `updateAt` | `domain/entity/User.java` |
| `Conversation` | `createdAt`, `updateAt`, `lastMessageAt` | `domain/entity/Conversation.java` |
| `Friend` | `createdAt`, `updateAt` | `domain/entity/Friend.java` |
| `CallSession` | `createdAt` | `domain/entity/CallSession.java` |
| `RefreshToken` | `createdAt` | `domain/entity/RefreshToken.java` |

Change: `LocalDateTime` → `Instant`, `import java.time.Instant`

### Backend Entity (MongoDB)

| Entity | Fields | File |
|--------|--------|------|
| `Message` | `createdAt`, `updateAt`, `recalledAt` | `domain/entity/mongodb/Message.java` |

Change: `LocalDateTime` → `Instant`, `import java.time.Instant`

### Backend Services

| Service | Change | File |
|---------|--------|------|
| `MessageService` | `LocalDateTime.now()` → `Instant.now()` | `service/MessageService.java` |
| `AdminService` | Remove manual `DateTimeFormatter` formatting; let Jackson serialize `Instant` directly | `service/AdminService.java` |

### Backend DTOs

All `*Response.java` DTOs with timestamp fields:
- `MessageResponse`: `createdAt`, `updatedAt`
- `ConversationResponse`: `createdAt`, `updatedAt`, `lastMessageAt`
- `FriendResponse`: `createdAt`
- `CallSessionResponse`: `createdAt`
- `ReminderResponse`: `reminderTime`, `createdAt`
- Any other DTOs with `LocalDateTime` fields

Change: `LocalDateTime` → `Instant`

### Docker

Add `TZ=UTC` environment variable to:
- `ConnectionAppBackend/Dockerfile`
- `ConnectionAppBackend/Dockerfile.production`
- `ConnectionAppWeb/Dockerfile`
- `docker-compose.yml` (all services)
- `ConnectionAppBackend/docker-compose.production.yml` (all services)

### Frontend

**Zero changes.** Existing `new Date()` + `toLocaleTimeString("vi-VN")` already handles UTC→local conversion correctly when timestamps include the `Z` suffix.

## Data Migration

Not required. `spring.jpa.hibernate.ddl-auto=update` will alter MariaDB column types automatically. MongoDB documents will store `Instant` as ISO-8601 strings with `Z` suffix. Pre-existing records without `Z` will be interpreted as local time by the browser — minor imprecision acceptable for historical messages.

## Risks

1. **Old messages**: Existing MongoDB records stored as naive `LocalDateTime` strings will be interpreted as local time by the browser. This is a one-time imprecision for historical data and is acceptable.
2. **MariaDB column type**: Hibernate's `update` mode should handle `DATETIME` → `TIMESTAMP` or equivalent. If migration fails, manual ALTER TABLE may be needed.

## Testing

- Verify backend returns timestamps with `Z` suffix in API responses
- Verify chat messages display correct local time in browser
- Verify conversation list timestamps are correct
- Verify mobile app displays correct local time
- Verify reminder creation still works (ReminderCreator.tsx already handles local time parsing)
