# Timezone Fix: UTC Timestamps Design

**Date:** 2026-05-28
**Status:** Approved (v2 — with migration strategy)

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

### Backend Configuration (NEW)

**`application.properties` — add:**
```properties
# Force UTC for JDBC reads/writes
spring.jpa.properties.hibernate.jdbc.time_zone=UTC
# Ensure Jackson serializes Instant as ISO-8601 string, not epoch timestamp
spring.jackson.serialization.write-dates-as-timestamps=false
```

**New file: `MongoConfig.java`** — register custom converters for backward-compatible Instant parsing:
- `String → Instant` converter: handles both `"2024-05-28T14:30:00"` (fallback UTC) and `"2024-05-28T06:30:00Z"` (proper ISO)
- `Instant → String` converter: always writes with `Z` suffix
- `LocalDateTime → Instant` converter: treats old LocalDateTime values as UTC during transition

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

### MongoDB Migration (REQUIRED — prevents API crash)

Old documents store timestamps as naive strings like `"2024-05-28T14:30:00"`. Without migration, `Instant.parse()` throws `DateTimeParseException`.

**Approach: Custom Converter + optional data patch**

1. **Custom `Converter<String, Instant>`** in `MongoConfig` (PRIMARY — handles everything automatically):
   - Try `Instant.parse(str)` first (handles new data with `Z`)
   - On `DateTimeParseException`, parse as `LocalDateTime` and convert from Singapore to UTC: `LocalDateTime.parse(str).atZone(ZoneId.of("Asia/Singapore")).toInstant()`
   - Result: old `"2024-05-28T14:30:00"` (Singapore) → `2024-05-28T06:30:00Z` (UTC) → frontend displays correct local time
   - **Old messages will display correctly** — the converter does the timezone math automatically

2. **Optional one-time MongoDB script** (run via mongosh or MongoCompass — NOT needed if using the converter above):
   ```javascript
   db.messages.updateMany(
     { createdAt: { $type: "string" }, createdAt: { $not: { $regex: "Z$" } } },
     [{ $set: { createdAt: { $concat: ["$createdAt", "Z"] } } }]
   )
   // Repeat for updateAt, recalledAt
   ```
   This appends `Z` to old strings so they parse as UTC without a custom converter. Note: this treats old timestamps AS-IS (14:30 stored → 14:30 UTC), causing an 8-hour display shift. Only use this if you don't want a custom converter.

### MariaDB Migration (REQUIRED — prevents data misread)

Old columns store `DATETIME` values in Singapore local time. With `hibernate.jdbc.time_zone=UTC`, JDBC will interpret them as UTC, shifting display by 8 hours.

**Approach: SQL migration + Hibernate config**

**Execution order (CRITICAL):**
1. **FIRST**: Run SQL to shift existing data from Singapore time to UTC (BEFORE deploying new code):
   ```sql
   -- Convert existing DATETIME values: subtract 8 hours (Singapore = UTC+8)
   UPDATE users SET createdAt = DATE_SUB(createdAt, INTERVAL 8 HOUR) WHERE createdAt IS NOT NULL;
   UPDATE users SET updateAt = DATE_SUB(updateAt, INTERVAL 8 HOUR) WHERE updateAt IS NOT NULL;
   -- Repeat for: conversations, friends, call_sessions, refresh_tokens
   ```
2. **THEN**: Deploy new code with `Instant` entities + `hibernate.jdbc.time_zone=UTC`
3. On startup, `ddl-auto=update` will handle column type changes (`DATETIME` → `DATETIME(6)`)
4. Alternatively, use Flyway/Liquibase for versioned migrations (recommended for production)

## Risks

1. **Old MongoDB messages**: With the custom converter approach, old messages are automatically converted from Singapore time to UTC and will display correctly. No data shift occurs. If using the optional "append Z" script instead, old messages will have an 8-hour display shift (acceptable for chat history).

2. **MariaDB migration ordering**: The SQL data shift MUST run before deploying new entity code. If deployed first, the app will misread old data as UTC (8-hour shift) before the migration script runs. For safety, run SQL migration during a brief maintenance window.

3. **Rollback complexity**: Once data is migrated, rolling back requires reversing the SQL shifts and removing the MongoDB converter. Keep a database backup before migration.

## Testing

- Verify backend returns timestamps with `Z` suffix in API responses
- Verify chat messages display correct local time in browser
- Verify conversation list timestamps are correct
- Verify mobile app displays correct local time
- Verify reminder creation still works (ReminderCreator.tsx already handles local time parsing)
- Verify old messages load without crash (MongoDB converter fallback)
- Verify old SQL records display correct shifted time
