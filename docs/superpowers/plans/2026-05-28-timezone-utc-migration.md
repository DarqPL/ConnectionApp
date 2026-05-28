# Timezone UTC Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all timestamps from `LocalDateTime` (naive, timezone-ignorant) to `Instant` (UTC-aware) across the entire backend, with backward-compatible MongoDB parsing and MariaDB data migration.

**Architecture:** Store all timestamps as `Instant` (UTC) in backend entities/DTOs. Jackson serializes as ISO-8601 with `Z` suffix. Custom MongoDB converters handle old naive strings. Hibernate JDBC timezone forced to UTC. Docker containers set to `TZ=UTC`. Frontend requires zero changes.

**Tech Stack:** Spring Boot 3.5, Java 21, JPA/Hibernate (MariaDB), Spring Data MongoDB, Jackson, Lombok

---

## File Structure

| Responsibility | Files |
|---|---|
| **MongoDB converters** | `config/MongoConfig.java` (new) |
| **Spring properties** | `resources/application.properties` (add 2 lines) |
| **SQL Entities (9)** | `domain/entity/sql/User.java`, `Conversation.java`, `Friend.java`, `RefreshToken.java`, `ConversationUser.java`, `ConversationPendingMember.java`, `ConversationBlockedUser.java`, `CallSession.java`, `CallParticipant.java` |
| **MongoDB Entities (4)** | `domain/entity/mongodb/Message.java`, `embedded/MessageReaction.java`, `embedded/ReminderInfo.java`, `embedded/Poll.java` |
| **DTOs (14)** | All `domain/dto/*.java` with `LocalDateTime` fields |
| **Exception classes (2)** | `exception/ErrorResponse.java`, `GlobalExceptionHandler.java` |
| **Services (14)** | All `service/*.java` using `LocalDateTime.now()` or `LocalDateTime` params |
| **Controllers (1)** | `controller/AuthController.java` |
| **Docker (5)** | `ConnectionAppBackend/Dockerfile`, `Dockerfile.production`, `ConnectionAppWeb/Dockerfile`, `docker-compose.yml`, `ConnectionAppBackend/docker-compose.production.yml` |

---

## Important: Migration Ordering

**CRITICAL:** The SQL data migration must run BEFORE the entity code changes are deployed. The plan is structured so that:
1. Tasks 1-2 add new infrastructure (MongoConfig, application.properties) — safe to deploy first
2. Tasks 3-10 change entity/DTO/service code — requires SQL migration to run between Task 2 and Task 3 in production
3. Task 11 adds Docker TZ settings

For local development, all tasks can be applied together.

---

### Task 1: Add Jackson and Hibernate timezone config

**Files:**
- Modify: `ConnectionAppBackend/src/main/resources/application.properties`

- [ ] **Step 1: Add timezone and Jackson config to application.properties**

Add these two lines at the end of `application.properties` (after line 106):

```properties
# Timezone: force JDBC to use UTC for all datetime reads/writes
spring.jpa.properties.hibernate.jdbc.time_zone=UTC
# Jackson: serialize dates as ISO-8601 strings, not epoch timestamps
spring.jackson.serialization.write-dates-as-timestamps=false
```

- [ ] **Step 2: Commit**

```bash
git add ConnectionAppBackend/src/main/resources/application.properties
git commit -m "config: add UTC timezone for Hibernate JDBC and Jackson serialization"
```

---

### Task 2: Create MongoDB custom converters

**Files:**
- Create: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/config/MongoConfig.java`

- [ ] **Step 1: Create MongoConfig.java with custom converters**

```java
package iuh.fit.ConnectionAppBackend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Arrays;

@Configuration
@EnableMongoAuditing
public class MongoConfig {

    private static final ZoneId SERVER_TZ = ZoneId.of("Asia/Singapore");

    /**
     * Converts old naive datetime strings (without Z) to Instant.
     * Assumes old timestamps were in Singapore time (EC2 deployment timezone).
     */
    @Bean
    public MongoCustomConversions mongoCustomConversions() {
        return new MongoCustomConversions(Arrays.asList(
            new StringToInstantConverter(),
            new LocalDateTimeToInstantConverter()
        ));
    }

    static class StringToInstantConverter implements Converter<String, Instant> {
        @Override
        public Instant convert(String source) {
            try {
                // New data: proper ISO-8601 with Z suffix
                return Instant.parse(source);
            } catch (DateTimeParseException e) {
                // Old data: naive string without timezone — interpret as Singapore time
                LocalDateTime ldt = LocalDateTime.parse(source);
                return ldt.atZone(SERVER_TZ).toInstant();
            }
        }
    }

    static class LocalDateTimeToInstantConverter implements Converter<LocalDateTime, Instant> {
        @Override
        public Instant convert(LocalDateTime source) {
            // Fallback for any remaining LocalDateTime values stored by Spring Data
            return source.atZone(SERVER_TZ).toInstant();
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/config/MongoConfig.java
git commit -m "feat: add MongoDB custom converters for backward-compatible Instant parsing"
```

---

### Task 3: Migrate SQL entities — User, Conversation, Friend

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/User.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/Conversation.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/Friend.java`

- [ ] **Step 1: Read each file and change `LocalDateTime` → `Instant` for timestamp fields**

**User.java** — change import and fields:
```java
// Change import:
import java.time.Instant;

// Change fields:
@CreatedDate
private Instant createdAt;

@LastModifiedDate
private Instant updateAt;

// Also change lockUntil (used by UserService for lock expiry):
private Instant lockUntil;

// NOTE: Keep `dob` as LocalDate (it's a date-of-birth, not a timestamp)
```

**Conversation.java** — change import and fields:
```java
import java.time.Instant;

@CreatedDate
private Instant createdAt;

@LastModifiedDate
private Instant updateAt;

private Instant lastMessageAt;
```

**Friend.java** — change import and fields:
```java
import java.time.Instant;

@CreatedDate
private Instant createdAt;

@LastModifiedDate
private Instant updateAt;
```

- [ ] **Step 2: Commit**

```bash
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/User.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/Conversation.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/Friend.java
git commit -m "refactor: migrate User, Conversation, Friend entities from LocalDateTime to Instant"
```

---

### Task 4: Migrate SQL entities — RefreshToken, ConversationUser, ConversationPendingMember, ConversationBlockedUser

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/RefreshToken.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/ConversationUser.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/ConversationPendingMember.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/ConversationBlockedUser.java`

- [ ] **Step 1: Change `LocalDateTime` → `Instant` for timestamp fields**

**RefreshToken.java:**
```java
import java.time.Instant;

private Instant createdAt;
private Instant lastUsedAt;
private Instant expiryDate;
```

**ConversationUser.java:**
```java
import java.time.Instant;

private Instant joinedAt;
```

**ConversationPendingMember.java:**
```java
import java.time.Instant;

@CreatedDate
private Instant requestedAt;
```

**ConversationBlockedUser.java:**
```java
import java.time.Instant;

@CreatedDate
private Instant blockedAt;
```

- [ ] **Step 2: Commit**

```bash
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/RefreshToken.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/ConversationUser.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/ConversationPendingMember.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/ConversationBlockedUser.java
git commit -m "refactor: migrate RefreshToken, ConversationUser, ConversationPendingMember, ConversationBlockedUser to Instant"
```

---

### Task 5: Migrate SQL entities — CallSession, CallParticipant

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/CallSession.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/CallParticipant.java`

- [ ] **Step 1: Change `LocalDateTime` → `Instant` for timestamp fields**

**CallSession.java:**
```java
import java.time.Instant;

@CreatedDate
private Instant createdAt;

private Instant startedAt;

private Instant endedAt;
```

**CallParticipant.java:**
```java
import java.time.Instant;

private Instant joinedAt;

private Instant leftAt;
```

- [ ] **Step 2: Commit**

```bash
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/CallSession.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/sql/CallParticipant.java
git commit -m "refactor: migrate CallSession, CallParticipant entities to Instant"
```

---

### Task 6: Migrate MongoDB entities

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/mongodb/Message.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/mongodb/embedded/MessageReaction.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/mongodb/embedded/ReminderInfo.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/mongodb/embedded/Poll.java`

- [ ] **Step 1: Change `LocalDateTime` → `Instant` for all timestamp fields**

**Message.java:**
```java
// Change import:
import java.time.Instant;

// Change fields:
@LastModifiedDate
private Instant updateAt;

@CreatedDate
private Instant createdAt;

@Field("recalled_at")
private Instant recalledAt;

// Update setter methods:
public void setUpdateAt(Instant updateAt) {
    this.updateAt = updateAt;
}

public void setRecalledAt(Instant recalledAt) {
    this.recalledAt = recalledAt;
}
```

**MessageReaction.java:**
```java
import java.time.Instant;

private Instant reactedAt;
```

**ReminderInfo.java:**
```java
import java.time.Instant;

private Instant reminderTime;
```

**Poll.java:**
```java
import java.time.Instant;

private Instant expiredAt;
```

- [ ] **Step 2: Commit**

```bash
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/mongodb/Message.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/mongodb/embedded/MessageReaction.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/mongodb/embedded/ReminderInfo.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/entity/mongodb/embedded/Poll.java
git commit -m "refactor: migrate MongoDB entities (Message, MessageReaction, ReminderInfo, Poll) to Instant"
```

---

### Task 7: Migrate DTOs (batch 1 — core chat DTOs)

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/MessageResponse.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/ConversationResponse.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/FriendResponse.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/ConversationUserResponse.java`

- [ ] **Step 1: Change `LocalDateTime` → `Instant` in each DTO**

**MessageResponse.java:**
```java
import java.time.Instant;

private Instant createdAt;
private Instant updatedAt;
private Instant recalledAt;

// Inner class MessageReactionResponse:
private Instant reactedAt;
```

**ConversationResponse.java:**
```java
import java.time.Instant;

private Instant lastMessageAt;
private Instant createdAt;
private Instant updatedAt;
```

**FriendResponse.java:**
```java
import java.time.Instant;

private Instant createdAt;
private Instant updatedAt;
```

**ConversationUserResponse.java:**
```java
import java.time.Instant;

private Instant joinedAt;
```

- [ ] **Step 2: Commit**

```bash
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/MessageResponse.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/ConversationResponse.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/FriendResponse.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/ConversationUserResponse.java
git commit -m "refactor: migrate core chat DTOs to Instant"
```

---

### Task 8: Migrate DTOs (batch 2 — call, reminder, poll DTOs)

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/CallSessionResponse.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/CallHistoryItemResponse.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/CallParticipantResponse.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/CallTokenResponse.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/ReminderResponse.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/ReminderRequest.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/PollResponse.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/PollRequest.java`

- [ ] **Step 1: Change `LocalDateTime` → `Instant` in each DTO**

**CallSessionResponse.java:**
```java
import java.time.Instant;

private Instant createdAt;
private Instant startedAt;
private Instant endedAt;
```

**CallHistoryItemResponse.java:**
```java
import java.time.Instant;

private Instant createdAt;
private Instant startedAt;
private Instant endedAt;
```

**CallParticipantResponse.java:**
```java
import java.time.Instant;

private Instant joinedAt;
private Instant leftAt;
```

**CallTokenResponse.java:**
```java
import java.time.Instant;

private Instant expiresAt;
```

**ReminderResponse.java:**
```java
import java.time.Instant;

private Instant reminderTime;
private Instant createdAt;
```

**ReminderRequest.java:**
```java
import java.time.Instant;

private Instant reminderTime;
```

**PollResponse.java:**
```java
import java.time.Instant;

private Instant expiredAt;
```

**PollRequest.java:**
```java
import java.time.Instant;

private Instant expiredAt;
```

- [ ] **Step 2: Commit**

```bash
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/CallSessionResponse.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/CallHistoryItemResponse.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/CallParticipantResponse.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/CallTokenResponse.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/ReminderResponse.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/ReminderRequest.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/PollResponse.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/PollRequest.java
git commit -m "refactor: migrate call, reminder, poll DTOs to Instant"
```

---

### Task 9: Migrate DTOs (batch 3 — notification DTOs)

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/TypingNotificationDTO.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/SecurityNotificationDTO.java`

- [ ] **Step 1: Change `LocalDateTime` → `Instant`**

**TypingNotificationDTO.java:**
```java
import java.time.Instant;

private Instant typedAt;
```

**SecurityNotificationDTO.java:**
```java
import java.time.Instant;

private Instant loginAt;
private Instant lockUntil;
```

- [ ] **Step 2: Commit**

```bash
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/TypingNotificationDTO.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/SecurityNotificationDTO.java
git commit -m "refactor: migrate notification DTOs to Instant"
```

---

### Task 10: Migrate ErrorResponse and GlobalExceptionHandler

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/exception/ErrorResponse.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/exception/GlobalExceptionHandler.java`

- [ ] **Step 1: Change ErrorResponse.java**

```java
import java.time.Instant;

private Instant timestamp;
private Instant lockUntil;
```

- [ ] **Step 2: Change GlobalExceptionHandler.java**

Replace all `LocalDateTime.now()` calls with `Instant.now()` (approximately 15 occurrences). Change import:

```java
// Change:
import java.time.Instant;

// Replace all occurrences:
//   LocalDateTime.now() → Instant.now()
```

- [ ] **Step 3: Commit**

```bash
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/exception/ErrorResponse.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/exception/GlobalExceptionHandler.java
git commit -m "refactor: migrate ErrorResponse and GlobalExceptionHandler to Instant"
```

---

### Task 11: Migrate services (batch 1 — MessageService, ConversationService)

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/MessageService.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/ConversationService.java`

- [ ] **Step 1: MessageService.java — change all LocalDateTime to Instant**

```java
// Change import:
import java.time.Instant;

// Replace all occurrences:
//   LocalDateTime.now() → Instant.now()
//   LocalDateTime parameter types → Instant

// Specifically, in sendMessage() builder:
.createdAt(Instant.now())
```

- [ ] **Step 2: ConversationService.java — change all LocalDateTime to Instant**

```java
// Change import:
import java.time.Instant;

// Replace all occurrences:
//   LocalDateTime.now() → Instant.now()
//   Return type LocalDateTime → Instant (for any method returning lastMessageAt etc.)
```

- [ ] **Step 3: Commit**

```bash
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/MessageService.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/ConversationService.java
git commit -m "refactor: migrate MessageService and ConversationService to Instant"
```

---

### Task 12: Migrate services (batch 2 — UserService, UserAccountLockService, CustomerUserDetails)

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/UserService.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/UserAccountLockService.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/CustomerUserDetails.java`

- [ ] **Step 1: UserService.java — change LocalDateTime to Instant**

```java
// Change import:
import java.time.Instant;

// Replace all:
//   LocalDateTime.now() → Instant.now()

// Change record:
//   record TemporaryLockInfo(Instant lockUntil, ...)

// Change method params:
//   LocalDateTime → Instant (for lockUntil comparisons)
```

**IMPORTANT:** User entity's `lockUntil` was already changed to `Instant` in Task 3. No additional entity changes needed here.

- [ ] **Step 2: UserAccountLockService.java**

```java
// Change import:
import java.time.Instant;

// Replace all:
//   LocalDateTime.now() → Instant.now()
//   Method param LocalDateTime → Instant
```

- [ ] **Step 3: CustomerUserDetails.java**

```java
// Change import:
import java.time.Instant;

// Replace:
//   LocalDateTime.now() → Instant.now()
```

- [ ] **Step 4: Commit**

```bash
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/UserService.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/UserAccountLockService.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/CustomerUserDetails.java
git commit -m "refactor: migrate UserService, UserAccountLockService, CustomerUserDetails to Instant"
```

---

### Task 13: Migrate services (batch 3 — remaining services)

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/ReminderService.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/UserPresenceService.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/TypingNotificationService.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/SecurityNotificationService.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/RefreshTokenService.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/OtpService.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/FriendService.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/CallService.java`

- [ ] **Step 1: Change all `LocalDateTime.now()` → `Instant.now()` and `LocalDateTime` → `Instant` in each file**

**ReminderService.java:**
```java
import java.time.Instant;
// LocalDateTime.now() → Instant.now() (6 usages)
```

**UserPresenceService.java:**
```java
import java.time.Instant;
// ConcurrentHashMap<Long, LocalDateTime> → ConcurrentHashMap<Long, Instant>
// LocalDateTime.now() → Instant.now() (5 usages)
```

**TypingNotificationService.java:**
```java
import java.time.Instant;
// LocalDateTime.now() → Instant.now() (1 usage)
```

**SecurityNotificationService.java:**
```java
import java.time.Instant;
// LocalDateTime.now() → Instant.now() (4 usages)
// Method param LocalDateTime → Instant
```

**RefreshTokenService.java:**
```java
import java.time.Instant;
// LocalDateTime.now() → Instant.now() (8 usages)
```

**OtpService.java:**
```java
import java.time.Instant;
// Map stores with LocalDateTime → Instant
// LocalDateTime.now() → Instant.now() (7 usages)
// record OtpEntry(..., Instant expiresAt)
```

**FriendService.java:**
```java
import java.time.Instant;
// LocalDateTime.now() → Instant.now() (4 usages)
```

**CallService.java:**
```java
import java.time.Instant;
// LocalDateTime.now() → Instant.now() (9 usages)
```

- [ ] **Step 2: Commit**

```bash
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/ReminderService.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/UserPresenceService.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/TypingNotificationService.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/SecurityNotificationService.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/RefreshTokenService.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/OtpService.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/FriendService.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/CallService.java
git commit -m "refactor: migrate remaining services to Instant"
```

---

### Task 14: Migrate AdminService and AuthController

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/AdminService.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/controller/AuthController.java`

- [ ] **Step 1: AdminService.java — remove manual DateTimeFormatter, use Instant**

```java
// Change import:
import java.time.Instant;
// REMOVE: import java.time.LocalDateTime;
// REMOVE: private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

// Replace usages of:
//   user.getCreatedAt().format(ISO_FORMATTER) → user.getCreatedAt()
// (Jackson will serialize Instant directly as ISO-8601 string)
```

- [ ] **Step 2: AuthController.java — change LocalDateTime.now() → Instant.now()**

```java
// Change import:
import java.time.Instant;

// Replace:
//   LocalDateTime.now() → Instant.now()
```

- [ ] **Step 3: Commit**

```bash
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/AdminService.java
git add ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/controller/AuthController.java
git commit -m "refactor: migrate AdminService and AuthController to Instant"
```

---

### Task 15: Add TZ=UTC to Docker files

**Files:**
- Modify: `ConnectionAppBackend/Dockerfile`
- Modify: `ConnectionAppBackend/Dockerfile.production`
- Modify: `docker-compose.yml`
- Modify: `ConnectionAppBackend/docker-compose.production.yml`

- [ ] **Step 1: Add `ENV TZ=UTC` to Dockerfiles**

**ConnectionAppBackend/Dockerfile** — add after the `FROM` line in both build and run stages:
```dockerfile
ENV TZ=UTC
```

**ConnectionAppBackend/Dockerfile.production** — add after the `FROM` line:
```dockerfile
ENV TZ=UTC
```

**ConnectionAppWeb/Dockerfile** — add after the `FROM` line:
```dockerfile
ENV TZ=UTC
```

- [ ] **Step 2: Add `TZ=UTC` to docker-compose.yml**

Add `environment: TZ=UTC` to each service (mariadb, mongodb, backend, web):
```yaml
services:
  mariadb:
    environment:
      TZ: UTC
      # ... existing env vars
  mongodb:
    environment:
      TZ: UTC
  backend:
    environment:
      TZ: UTC
      # ... existing env vars
  web:
    environment:
      TZ: UTC
```

- [ ] **Step 3: Add `TZ=UTC` to docker-compose.production.yml**

Add `TZ: UTC` to each service (mariadb, backend, nginx):
```yaml
services:
  mariadb:
    environment:
      TZ: UTC
      # ... existing env vars
  backend:
    environment:
      TZ: UTC
      # ... existing env vars
  nginx:
    environment:
      TZ: UTC
```

- [ ] **Step 4: Commit**

```bash
git add ConnectionAppBackend/Dockerfile
git add ConnectionAppBackend/Dockerfile.production
git add docker-compose.yml
git add ConnectionAppBackend/docker-compose.production.yml
git commit -m "config: set TZ=UTC in all Dockerfiles and docker-compose files"
```

---

### Task 16: Build verification and SQL migration script

**Files:**
- Create: `ConnectionAppBackend/scripts/migrate-timezones.sql`

- [ ] **Step 1: Create SQL migration script**

```sql
-- Timezone Migration Script
-- Run this BEFORE deploying the new Instant-based entity code.
-- Converts existing DATETIME values from Singapore time (UTC+8) to UTC.
--
-- Usage: mysql -u root -p appChat < migrate-timezones.sql

-- Users
UPDATE users SET createdAt = DATE_SUB(createdAt, INTERVAL 8 HOUR) WHERE createdAt IS NOT NULL;
UPDATE users SET updateAt = DATE_SUB(updateAt, INTERVAL 8 HOUR) WHERE updateAt IS NOT NULL;
UPDATE users SET lockUntil = DATE_SUB(lockUntil, INTERVAL 8 HOUR) WHERE lockUntil IS NOT NULL;

-- Conversations
UPDATE conversations SET createdAt = DATE_SUB(createdAt, INTERVAL 8 HOUR) WHERE createdAt IS NOT NULL;
UPDATE conversations SET updateAt = DATE_SUB(updateAt, INTERVAL 8 HOUR) WHERE updateAt IS NOT NULL;
UPDATE conversations SET lastMessageAt = DATE_SUB(lastMessageAt, INTERVAL 8 HOUR) WHERE lastMessageAt IS NOT NULL;

-- Friends
UPDATE friends SET createdAt = DATE_SUB(createdAt, INTERVAL 8 HOUR) WHERE createdAt IS NOT NULL;
UPDATE friends SET updateAt = DATE_SUB(updateAt, INTERVAL 8 HOUR) WHERE updateAt IS NOT NULL;

-- Refresh tokens
UPDATE refresh_tokens SET createdAt = DATE_SUB(createdAt, INTERVAL 8 HOUR) WHERE createdAt IS NOT NULL;
UPDATE refresh_tokens SET lastUsedAt = DATE_SUB(lastUsedAt, INTERVAL 8 HOUR) WHERE lastUsedAt IS NOT NULL;
UPDATE refresh_tokens SET expiryDate = DATE_SUB(expiryDate, INTERVAL 8 HOUR) WHERE expiryDate IS NOT NULL;

-- Conversation users
UPDATE conversation_users SET joined_at = DATE_SUB(joined_at, INTERVAL 8 HOUR) WHERE joined_at IS NOT NULL;

-- Conversation pending members
UPDATE conversation_pending_members SET requested_at = DATE_SUB(requested_at, INTERVAL 8 HOUR) WHERE requested_at IS NOT NULL;

-- Conversation blocked users
UPDATE conversation_blocked_users SET blocked_at = DATE_SUB(blocked_at, INTERVAL 8 HOUR) WHERE blocked_at IS NOT NULL;

-- Call sessions
UPDATE call_sessions SET createdAt = DATE_SUB(createdAt, INTERVAL 8 HOUR) WHERE createdAt IS NOT NULL;
UPDATE call_sessions SET startedAt = DATE_SUB(startedAt, INTERVAL 8 HOUR) WHERE startedAt IS NOT NULL;
UPDATE call_sessions SET endedAt = DATE_SUB(endedAt, INTERVAL 8 HOUR) WHERE endedAt IS NOT NULL;

-- Call participants
UPDATE call_participants SET joinedAt = DATE_SUB(joinedAt, INTERVAL 8 HOUR) WHERE joinedAt IS NOT NULL;
UPDATE call_participants SET leftAt = DATE_SUB(leftAt, INTERVAL 8 HOUR) WHERE leftAt IS NOT NULL;
```

- [ ] **Step 2: Run Maven build to verify compilation**

```bash
cd ConnectionAppBackend
./mvnw clean compile -q
```

Expected: BUILD SUCCESS with no errors.

- [ ] **Step 3: Commit**

```bash
git add ConnectionAppBackend/scripts/migrate-timezones.sql
git commit -m "feat: add SQL migration script for timezone conversion (Singapore → UTC)"
```

---

### Task 17: Run tests and final verification

- [ ] **Step 1: Run backend tests**

```bash
cd ConnectionAppBackend
./mvnw test
```

Expected: All tests pass.

- [ ] **Step 2: Verify compilation of the full project**

```bash
cd ConnectionAppBackend
./mvnw clean package -DskipTests
```

Expected: BUILD SUCCESS, jar created in `target/`.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: verify build passes after timezone migration"
```
