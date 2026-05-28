-- Timezone Migration Script
-- Run this BEFORE deploying the new Instant-based entity code.
-- Converts existing DATETIME values from Singapore time (UTC+8) to UTC.
--
-- Usage: mysql -u root -p appChat < migrate-timezone.sql

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
