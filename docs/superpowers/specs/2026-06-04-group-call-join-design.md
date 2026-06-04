# Group Call Auto-Join Design Spec

**Date**: 2026-06-04
**Author**: opencode
**Status**: Draft — awaiting review

## 1. Problem Statement

Hiện tại, cuộc gọi nhóm (group call) hoạt động giống hệt cuộc gọi private:
- Người bắt đầu call → tất cả thành viên nhận chuông reo (RINGING)
- Phải có người accept → call mới chuyển sang ONGOING
- Nếu người bắt đầu call end → toàn bộ call kết thúc, dù có người đang join

Yêu cầu:
- **Group call**: Tự động start (ONGOING ngay), thành viên thấy "Đang có cuộc gọi nhóm, bạn có muốn tham gia?" với nút "Tham gia" (không có nút "Không"). Call chỉ kết thúc khi KHÔNG CÒN AI trong phòng.
- **Private call**: Giữ nguyên logic hiện tại (RINGING → accept → ONGOING → end = kết thúc).

## 2. Architecture Overview

### 2.1 Backend (Spring Boot 3.5, Java 21)

**Không thay đổi database schema.** Phân biệt group/private qua `CallSession.getConversation().getType()`.

#### 2.1.1 New Enum Value
- `CallParticipantStatus.WAITING` — thành viên nhóm chưa join vào call

#### 2.1.2 DTO Changes
- `CallSessionResponse`: thêm `isGroupCall: Boolean` (computed từ conversation type, không persist)

#### 2.1.3 CallService Changes

**`startCall`**:
- Private call: giữ nguyên (RINGING, send `/call-invite`, initiator=JOINED, others=RINGING)
- Group call:
  - **Kiểm tra duplicate call**: Query xem conversation đã có call `ONGOING` chưa. Nếu có → trả về call session hiện tại (200) thay vì tạo mới, frontend tự merge user vào phòng. Nếu chưa có → tiếp tục tạo mới (201).
  - status = `ONGOING` ngay (không qua RINGING)
  - initiator = `JOINED`, others = `WAITING`
  - KHÔNG gửi `/call-invite`
  - Gửi `/call-status` với status = `ONGOING`
  - Gửi `/call-participants` để notify tất cả members

**`acceptCall`** (dùng cho cả accept private và join group):
- Private call: participant `RINGING` → `JOINED`, call `RINGING` → `ONGOING`
- Group call:
  - Nếu participant đã có record → `WAITING` → `JOINED`
  - Nếu participant CHƯA có record (thành viên mới được add vào nhóm khi call đang diễn ra) → **upsert**: tạo mới `CallParticipant` với status = `JOINED`, verify user là thành viên hợp lệ của conversation
  - call status không đổi (đã ONGOING)
- Publish `/call-status` và `/call-participants`

**`rejectCall`**:
- Private call: giữ nguyên (`RINGING` → `DECLINED`, check missed)
- Group call: Ném `BadRequestException("Không thể từ chối cuộc gọi nhóm")`. Frontend KHÔNG gọi API này cho group call — banner chỉ có nút "Tham gia", user có thể phớt lờ và tiếp tục nhắn tin bình thường. Group call participant lifecycle: `WAITING` → `JOINED` → `LEFT` (hoặc `MISSED` nếu call kết thúc trước khi user join). Không có trạng thái `DECLINED` cho group call.

**`endCall`**:
- Private call: giữ nguyên (set ENDED, all RINGING → MISSED, all JOINED → LEFT)
- Group call:
  1. Set participant của caller = `LEFT`
  2. Check: còn participant nào `JOINED` không?
     - Nếu CÓ → chỉ save participant update, return (call tiếp tục)
     - Nếu KHÔNG → set call = `ENDED`, tính `durationSeconds`, set all WAITING → MISSED

#### 2.1.4 CallTimeoutScheduler
- Skip group calls (không timeout)
- Chỉ scan private calls với status = `RINGING`

#### 2.1.5 WebSocket Disconnect Handler (Ghost Call Prevention)
- Lắng nghe `SessionDisconnectEvent` từ Spring WebSocket
- Khi user disconnect (đóng browser, rớt mạng, crash app):
  1. Kiểm tra user có đang `JOINED` trong group call nào không
  2. Nếu có → tự động trigger logic `LEFT` cho participant đó
  3. Check: còn participant nào `JOINED` không?
     - Nếu CÓ → chỉ save participant update, publish `/call-participants`
     - Nếu KHÔNG → set call = `ENDED`, tính `durationSeconds`, publish `/call-status` (ENDED)
- Private call: KHÔNG xử lý (giữ nguyên logic timeout hiện tại)

#### 2.1.6 New Endpoint
- `GET /api/calls/conversation/{convId}/active` — trả về active call của conversation (nếu có), dùng để sync trạng thái khi F5/reload
- Return 200 với `CallSessionResponse` nếu có active call, 204 nếu không

#### 2.1.7 Conversation API Enhancement (ChatListScreen Performance)
- `GET /api/conversations` — thêm field `hasActiveCall: Boolean` và `activeCallId: Long` vào mỗi conversation response
- Backend check nhanh: query `CallSession` với `conversationId` + `status = ONGOING`
- Frontend dùng field này để render icon call trong danh sách, KHÔNG cần subscribe hàng loạt topic
- Realtime update: backend bắn event nhẹ vào `/topic/user.{userId}/call-status` khi group call start/end, frontend update local state của conversation item

#### 2.1.8 WebSocket Topics (không thêm topic mới)
- `/topic/user.{userId}/call-invite` — chỉ cho private call
- `/topic/user.{userId}/call-status` — cho cả private và group (dùng cho ChatListScreen realtime update)
- `/topic/conversation.{convId}/call-participants` — frontend dùng để detect group call active (chỉ subscribe khi vào conversation, KHÔNG subscribe tại ChatListScreen)

### 2.2 Web Frontend (React 19, Vite 7, Zustand)

#### 2.2.1 Types (`call.ts`)
- Thêm `WAITING` vào `CallParticipantStatus`
- Thêm `isGroupCall: boolean` vào `CallSession`

#### 2.2.2 Zustand Store (`useCallStore.ts`)
- Thêm state: `groupCallActive: CallSession | null`
- Thêm action: `joinGroupCall(callId)` → `POST /calls/{callId}/accept`
- Sửa `setIncomingCall`: group call với status=ONGOING → set `groupCallActive`, KHÔNG set `incomingCall`
- Thêm action: `fetchActiveCall(convId)` → `GET /api/calls/conversation/{convId}/active`

#### 2.2.3 CallOverlay (`CallOverlay.tsx`)
- Khi mount: gọi `fetchActiveCall(convId)` để sync trạng thái (giải quyết F5)
- Thêm banner "Đang có cuộc gọi nhóm diễn ra, bạn có muốn tham gia?" (màu xanh dương)
  - Hiển thị khi `groupCallActive != null` && user chưa join
  - Button: "Tham gia" → gọi `joinGroupCall`
  - KHÔNG có nút "Không"
- Banner active call: giữ nguyên, render ZegoCallRoom

#### 2.2.4 ZegoCallRoom (`ZegoCallRoom.tsx`)
- Group call: luôn dùng `VideoConference` cho cả video và voice
- `onLeaveRoom`: dọn local UI + gọi `endCall` API

#### 2.2.5 WebSocket (`useSocketStore.ts`)
- Subscribe `/topic/conversation.{convId}/call-participants`:
  - Có participant `JOINED` → set `groupCallActive`
  - Tất cả `LEFT`/`DECLINED` → clear `groupCallActive`

#### 2.2.6 ChatWindowLayout
- Truyền `conversationType` vào `CallOverlay`

#### 2.2.7 Conversation List (Sidebar)
- Dùng `hasActiveCall` field từ API conversations để hiển thị icon điện thoại màu xanh bên cạnh group đang có call
- Subscribe `/topic/user.{userId}/call-status` để update realtime khi group call start/end
- KHÔNG subscribe `/topic/conversation.{convId}/call-participants` tại đây

### 2.3 Mobile Frontend (Expo 54, React Native 0.81)

#### 2.3.1 Types & Services (`call.service.ts`)
- Thêm `WAITING` vào `CallParticipantStatus`
- Thêm `isGroupCall: boolean` vào `CallSession`
- Thêm method `getActiveCallByConversation(convId)` → `GET /api/calls/conversation/{convId}/active`

#### 2.3.2 ChatContext (`ChatContext.tsx`)
- Thêm state: `groupCallActive: CallSession | null`
- Thêm action: `joinGroupCall(callId)` → `acceptCall` API
- Sửa `onCallInvite`: group call status=ONGOING → set `groupCallActive`
- Sửa `onCallStatusUpdate`: xử lý group call participants update

#### 2.3.3 ChatRoomScreen (`ChatRoomScreen.tsx`)
- Khi mount: gọi `getActiveCallByConversation(convId)` để sync trạng thái
- Lắng nghe `AppState`: khi `background` → `active`, gọi lại `getActiveCallByConversation`
- Thêm banner "Đang có cuộc gọi nhóm diễn ra, bạn có muốn tham gia?"
  - Button: "Tham gia" → `joinGroupCall`
  - KHÔNG có nút "Không", KHÔNG gọi API reject
  - Banner tự động biến mất khi nhận event ENDED
- Zego config: group call → `GROUP_VIDEO_CALL_CONFIG` / `GROUP_VOICE_CALL_CONFIG`
- `onLeaveRoom` (Zego): dọn local UI + gọi `endCall` API, Zego tự quản lý peer connections

#### 2.3.4 ChatListScreen
- Dùng `hasActiveCall` field từ API conversations để hiển thị icon điện thoại màu xanh hoặc text "Đang có cuộc gọi nhóm..." trong item
- Subscribe `/topic/user.{userId}/call-status` để update realtime khi group call start/end
- KHÔNG subscribe `/topic/conversation.{convId}/call-participants` tại đây

#### 2.3.5 Socket Service (`socket.service.ts`)
- Subscribe `/topic/user.{userId}/call-status` để sync group call state cho ChatListScreen
- Subscribe `/topic/conversation.{convId}/call-participants` chỉ khi vào conversation (ChatRoomScreen)

## 3. Data Flow

### 3.1 Group Call Start
```
User A (initiator)          Backend                    Other Members
     |                         |                            |
     |-- POST /calls/session -->|                            |
     |                          |-- CallSession (ONGOING)    |
     |                          |-- Participants:            |
     |                          |   A=JOINED, others=WAITING |
     |                          |                            |
     |<-- 201 (isGroupCall=true)|                            |
     |                          |-- /call-status (ONGOING) -->|
     |                          |-- /call-participants ------>|
     |                          |                            |
     |  [Zego room renders]     |    [Banner: "Tham gia"]    |
```

### 3.2 Member Joins Group Call
```
User B                      Backend                    User A
     |                         |                            |
     |-- POST /calls/{id}/accept -->|                        |
     |                          |-- B: WAITING -> JOINED     |
     |                          |                            |
     |<-- 200                   |                            |
     |                          |-- /call-status ----------->|
     |                          |-- /call-participants ------>|
     |                          |                            |
     |  [Zego room renders]     |    [B appears in room]     |
```

### 3.3 Initiator Leaves Group Call (others still joined)
```
User A                      Backend                    User B
     |                         |                            |
     |-- POST /calls/{id}/end -->|                          |
     |                          |-- A: JOINED -> LEFT        |
     |                          |-- Check: B still JOINED    |
     |                          |-- Call stays ONGOING       |
     |                          |                            |
     |<-- 200                   |                            |
     |                          |-- /call-status ----------->|
     |                          |-- /call-participants ------>|
     |                          |                            |
     |  [UI cleared]            |    [B still in call]       |
```

### 3.4 Last Member Leaves → Call Ends
```
User B                      Backend
     |                         |
     |-- POST /calls/{id}/end -->|
     |                          |-- B: JOINED -> LEFT
     |                          |-- Check: no JOINED left
     |                          |-- Call -> ENDED
     |                          |-- Calculate duration
     |                          |
     |<-- 200                   |
     |                          |-- /call-status (ENDED) --> all
     |                          |-- /call-participants ------> all
     |                          |
     |  [UI cleared]            |    [All see call ended]
```

## 4. Error Handling

- **User join call đã kết thúc**: Backend trả 400 "Call is no longer active"
- **User join call không thuộc conversation**: Backend trả 403 "Not a member of this conversation"
- **Zego token hết hạn**: Frontend gọi lại `GET /api/calls/token?callId=` để refresh
- **WebSocket disconnect**: Frontend gọi `fetchActiveCall` để sync lại trạng thái
- **Mobile app background/foreground**: `AppState` listener trigger `getActiveCallByConversation`
- **Ghost Call Prevention**: Backend lắng nghe `SessionDisconnectEvent`, auto LEFT user khỏi group call nếu đang JOINED
- **Reject group call**: Backend ném 400 "Không thể từ chối cuộc gọi nhóm" — frontend KHÔNG gọi API này cho group call
- **Duplicate call start**: Nếu conversation đã có call ONGOING → trả về call session hiện tại (200), frontend tự merge user vào phòng
- **New member join during call**: Backend upsert CallParticipant khi user bấm "Tham gia", verify là thành viên hợp lệ của conversation

## 5. Backward Compatibility

- **Database**: Không thay đổi schema, backward compatible hoàn toàn
- **API**: `POST /calls/{callId}/accept` giữ nguyên, tự phân biệt group/private bên trong
- **API**: `GET /api/conversations` thêm field `hasActiveCall` và `activeCallId` (nullable, frontend cũ ignore được)
- **WebSocket**: Không thêm topic mới, chỉ thay đổi payload (thêm `isGroupCall`, `WAITING` status)
- **Private call**: Không thay đổi behavior

## 6. CI/CD Considerations

- Backend deploy auto lên EC2 qua GitHub Actions (push to `main`)
- Không cần migration (không thay đổi DB schema)
- Frontend và mobile deploy thủ công hoặc qua pipeline riêng
- Zego config không thay đổi (app-id, server-secret giữ nguyên)

## 7. Testing Strategy

### Backend
- Unit test: `startCall` group vs private, `endCall` group last-leaver logic
- Unit test: `rejectCall` cho group call → ném BadRequestException
- Unit test: `startCall` duplicate → trả về existing call session
- Unit test: `acceptCall` upsert participant cho thành viên mới được add vào nhóm
- Integration test: WebSocket broadcast, timeout scheduler skip group calls
- Integration test: `SessionDisconnectEvent` → auto LEFT participant, end call nếu last leaver

### Web Frontend
- Manual test: F5 khi đang có group call → banner hiển thị
- Manual test: Join/leave group call, verify banner state transitions
- Manual test: Zego room renders correctly for group call
- Manual test: Conversation list hiển thị icon call active
- Manual test: KHÔNG có nút "Từ chối" cho group call banner
- Manual test: User mới được add vào nhóm khi call đang diễn ra → thấy banner "Tham gia"
- Manual test: 2 user cùng bấm gọi nhóm → chỉ 1 call session được tạo, user thứ 2 auto join

### Mobile Frontend
- Manual test: AppState background → foreground → sync trạng thái
- Manual test: ChatListScreen hiển thị icon call active
- Manual test: Join/leave group call trên mobile
- Manual test: KHÔNG có nút "Từ chối" cho group call banner
- Manual test: User mới được add vào nhóm khi call đang diễn ra → thấy banner "Tham gia"
- Manual test: 2 user cùng bấm gọi nhóm → chỉ 1 call session được tạo, user thứ 2 auto join
