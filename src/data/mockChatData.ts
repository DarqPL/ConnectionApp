import type { Conversation, Message } from "@/types/chat";
import type { User } from "@/types/user";

// ============================================================
// MOCK CURRENT USER
// ============================================================
export const MOCK_CURRENT_USER: User = {
    _id: "user-me",
    username: "johndoe",
    displayName: "John Doe",
    email: "johndoe@example.com",
    avatarUrl: "https://i.pravatar.cc/150?img=3",
    bio: "Passionate about technology and connecting with people.",
    phone: "+84 123 456 789",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2026-02-09T00:00:00.000Z",
};

// ============================================================
// MOCK CONVERSATIONS
// ============================================================
export const MOCK_CONVERSATIONS: Conversation[] = [
    // -------- DIRECT 1: Chat với Nguyễn Văn An --------
    {
        _id: "conv-direct-1",
        type: "direct",
        group: { name: "", createdBy: "" },
        participants: [
            {
                _id: "user-me",
                displayName: "John Doe",
                avatarUrl: "https://i.pravatar.cc/150?img=3",
                joinedAt: "2024-01-01T00:00:00.000Z",
            },
            {
                _id: "user-an",
                displayName: "Nguyễn Văn An",
                avatarUrl: "https://i.pravatar.cc/150?img=11",
                joinedAt: "2024-01-01T00:00:00.000Z",
            },
        ],
        lastMessageAt: "2026-02-10T14:30:00.000Z",
        seenBy: [
            {
                _id: "user-me",
                displayName: "John Doe",
                avatarUrl: "https://i.pravatar.cc/150?img=3",
            },
        ],
        lastMessage: {
            _id: "msg-d1-5",
            content: "Ok, mai gặp nhé! 👋",
            createdAt: "2026-02-10T14:30:00.000Z",
            sender: {
                _id: "user-an",
                displayName: "Nguyễn Văn An",
                avatarUrl: "https://i.pravatar.cc/150?img=11",
            },
        },
        unreadCounts: { "user-me": 2, "user-an": 0 },
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2026-02-10T14:30:00.000Z",
    },

    // -------- DIRECT 2: Chat với Trần Thị Bình --------
    {
        _id: "conv-direct-2",
        type: "direct",
        group: { name: "", createdBy: "" },
        participants: [
            {
                _id: "user-me",
                displayName: "John Doe",
                avatarUrl: "https://i.pravatar.cc/150?img=3",
                joinedAt: "2024-02-01T00:00:00.000Z",
            },
            {
                _id: "user-binh",
                displayName: "Trần Thị Bình",
                avatarUrl: "https://i.pravatar.cc/150?img=5",
                joinedAt: "2024-02-01T00:00:00.000Z",
            },
        ],
        lastMessageAt: "2026-02-10T13:45:00.000Z",
        seenBy: [],
        lastMessage: {
            _id: "msg-d2-4",
            content: "Mình gửi file cho bạn rồi nhé!",
            createdAt: "2026-02-10T13:45:00.000Z",
            sender: {
                _id: "user-me",
                displayName: "John Doe",
                avatarUrl: "https://i.pravatar.cc/150?img=3",
            },
        },
        unreadCounts: { "user-me": 0, "user-binh": 1 },
        createdAt: "2024-02-01T00:00:00.000Z",
        updatedAt: "2026-02-10T13:45:00.000Z",
    },

    // -------- DIRECT 3: Chat với Lê Hoàng Cường --------
    {
        _id: "conv-direct-3",
        type: "direct",
        group: { name: "", createdBy: "" },
        participants: [
            {
                _id: "user-me",
                displayName: "John Doe",
                avatarUrl: "https://i.pravatar.cc/150?img=3",
                joinedAt: "2024-03-01T00:00:00.000Z",
            },
            {
                _id: "user-cuong",
                displayName: "Lê Hoàng Cường",
                avatarUrl: "https://i.pravatar.cc/150?img=8",
                joinedAt: "2024-03-01T00:00:00.000Z",
            },
        ],
        lastMessageAt: "2026-02-10T10:00:00.000Z",
        seenBy: [
            {
                _id: "user-cuong",
                displayName: "Lê Hoàng Cường",
                avatarUrl: "https://i.pravatar.cc/150?img=8",
            },
        ],
        lastMessage: {
            _id: "msg-d3-3",
            content: "Dạo này bạn có khỏe không?",
            createdAt: "2026-02-10T10:00:00.000Z",
            sender: {
                _id: "user-cuong",
                displayName: "Lê Hoàng Cường",
                avatarUrl: "https://i.pravatar.cc/150?img=8",
            },
        },
        unreadCounts: { "user-me": 1, "user-cuong": 0 },
        createdAt: "2024-03-01T00:00:00.000Z",
        updatedAt: "2026-02-10T10:00:00.000Z",
    },

    // -------- GROUP 1: Nhóm Dự Án BTL --------
    {
        _id: "conv-group-1",
        type: "group",
        group: { name: "Nhóm Dự Án BTL 🚀", createdBy: "user-me" },
        participants: [
            {
                _id: "user-me",
                displayName: "John Doe",
                avatarUrl: "https://i.pravatar.cc/150?img=3",
                joinedAt: "2024-01-15T00:00:00.000Z",
            },
            {
                _id: "user-an",
                displayName: "Nguyễn Văn An",
                avatarUrl: "https://i.pravatar.cc/150?img=11",
                joinedAt: "2024-01-15T00:00:00.000Z",
            },
            {
                _id: "user-binh",
                displayName: "Trần Thị Bình",
                avatarUrl: "https://i.pravatar.cc/150?img=5",
                joinedAt: "2024-01-15T00:00:00.000Z",
            },
            {
                _id: "user-cuong",
                displayName: "Lê Hoàng Cường",
                avatarUrl: "https://i.pravatar.cc/150?img=8",
                joinedAt: "2024-01-16T00:00:00.000Z",
            },
        ],
        lastMessageAt: "2026-02-10T14:20:00.000Z",
        seenBy: [
            { _id: "user-an", displayName: "Nguyễn Văn An" },
            { _id: "user-binh", displayName: "Trần Thị Bình" },
        ],
        lastMessage: {
            _id: "msg-g1-6",
            content: "Em đã push code lên rồi ạ 🎉",
            createdAt: "2026-02-10T14:20:00.000Z",
            sender: {
                _id: "user-binh",
                displayName: "Trần Thị Bình",
                avatarUrl: "https://i.pravatar.cc/150?img=5",
            },
        },
        unreadCounts: { "user-me": 3, "user-an": 0, "user-binh": 0, "user-cuong": 2 },
        createdAt: "2024-01-15T00:00:00.000Z",
        updatedAt: "2026-02-10T14:20:00.000Z",
    },

    // -------- GROUP 2: Hội Bạn Thân --------
    {
        _id: "conv-group-2",
        type: "group",
        group: { name: "Hội Bạn Thân 💖", createdBy: "user-an" },
        participants: [
            {
                _id: "user-me",
                displayName: "John Doe",
                avatarUrl: "https://i.pravatar.cc/150?img=3",
                joinedAt: "2024-05-01T00:00:00.000Z",
            },
            {
                _id: "user-an",
                displayName: "Nguyễn Văn An",
                avatarUrl: "https://i.pravatar.cc/150?img=11",
                joinedAt: "2024-05-01T00:00:00.000Z",
            },
            {
                _id: "user-duong",
                displayName: "Phạm Minh Dương",
                avatarUrl: "https://i.pravatar.cc/150?img=12",
                joinedAt: "2024-05-01T00:00:00.000Z",
            },
        ],
        lastMessageAt: "2026-02-10T12:00:00.000Z",
        seenBy: [],
        lastMessage: {
            _id: "msg-g2-5",
            content: "Cuối tuần đi cà phê không mọi người? ☕",
            createdAt: "2026-02-10T12:00:00.000Z",
            sender: {
                _id: "user-duong",
                displayName: "Phạm Minh Dương",
                avatarUrl: "https://i.pravatar.cc/150?img=12",
            },
        },
        unreadCounts: { "user-me": 0, "user-an": 1, "user-duong": 0 },
        createdAt: "2024-05-01T00:00:00.000Z",
        updatedAt: "2026-02-10T12:00:00.000Z",
    },
];

// ============================================================
// MOCK MESSAGES
// ============================================================

// Helper: tạo message nhanh
const msg = (
    id: string,
    convoId: string,
    senderId: string,
    content: string,
    createdAt: string,
    isOwn: boolean
): Message => ({
    _id: id,
    conversationId: convoId,
    senderId,
    content,
    imgUrl: null,
    updatedAt: null,
    createdAt,
    isOwn,
});

// -------- Messages cho Direct 1: Chat với An --------
const MESSAGES_DIRECT_1: Message[] = [
    msg("msg-d1-1", "conv-direct-1", "user-me", "Chào An! Dạo này bạn thế nào?", "2026-02-10T14:00:00.000Z", true),
    msg("msg-d1-2", "conv-direct-1", "user-an", "Chào John! Mình vẫn ổn, cảm ơn bạn 😊", "2026-02-10T14:05:00.000Z", false),
    msg("msg-d1-3", "conv-direct-1", "user-me", "Ngày mai mình gặp nhau để bàn về dự án nhé", "2026-02-10T14:10:00.000Z", true),
    msg("msg-d1-4", "conv-direct-1", "user-an", "Oke, mấy giờ bạn rảnh?", "2026-02-10T14:15:00.000Z", false),
    msg("msg-d1-5", "conv-direct-1", "user-an", "Ok, mai gặp nhé! 👋", "2026-02-10T14:30:00.000Z", false),
];

// -------- Messages cho Direct 2: Chat với Bình --------
const MESSAGES_DIRECT_2: Message[] = [
    msg("msg-d2-1", "conv-direct-2", "user-binh", "Anh ơi, bài tập tuần này khó quá 😭", "2026-02-10T13:00:00.000Z", false),
    msg("msg-d2-2", "conv-direct-2", "user-me", "Bài nào khó thế? Để anh xem thử", "2026-02-10T13:15:00.000Z", true),
    msg("msg-d2-3", "conv-direct-2", "user-binh", "Bài về React hooks ấy anh. Em không hiểu useEffect lắm", "2026-02-10T13:30:00.000Z", false),
    msg("msg-d2-4", "conv-direct-2", "user-me", "Mình gửi file cho bạn rồi nhé!", "2026-02-10T13:45:00.000Z", true),
];

// -------- Messages cho Direct 3: Chat với Cường --------
const MESSAGES_DIRECT_3: Message[] = [
    msg("msg-d3-1", "conv-direct-3", "user-me", "Hey Cường! Lâu rồi không gặp", "2026-02-10T09:30:00.000Z", true),
    msg("msg-d3-2", "conv-direct-3", "user-cuong", "Ừ, lâu quá rồi nhỉ! 🤝", "2026-02-10T09:45:00.000Z", false),
    msg("msg-d3-3", "conv-direct-3", "user-cuong", "Dạo này bạn có khỏe không?", "2026-02-10T10:00:00.000Z", false),
];

// -------- Messages cho Group 1: Nhóm Dự Án BTL --------
const MESSAGES_GROUP_1: Message[] = [
    msg("msg-g1-1", "conv-group-1", "user-me", "Mọi người ơi, deadline dự án là thứ 6 tuần này nhé!", "2026-02-10T13:00:00.000Z", true),
    msg("msg-g1-2", "conv-group-1", "user-an", "Vâng anh, em đang làm phần backend", "2026-02-10T13:30:00.000Z", false),
    msg("msg-g1-3", "conv-group-1", "user-cuong", "Em lo phần database, sẽ xong trước thứ 4", "2026-02-10T13:45:00.000Z", false),
    msg("msg-g1-4", "conv-group-1", "user-me", "Tốt lắm! Bình làm phần frontend nhé", "2026-02-10T14:00:00.000Z", true),
    msg("msg-g1-5", "conv-group-1", "user-binh", "Dạ vâng ạ! Em đang code giao diện chat rồi 💻", "2026-02-10T14:10:00.000Z", false),
    msg("msg-g1-6", "conv-group-1", "user-binh", "Em đã push code lên rồi ạ 🎉", "2026-02-10T14:20:00.000Z", false),
];

// -------- Messages cho Group 2: Hội Bạn Thân --------
const MESSAGES_GROUP_2: Message[] = [
    msg("msg-g2-1", "conv-group-2", "user-an", "Mọi người ơi, bao giờ mình đi chơi đây?", "2026-02-10T10:00:00.000Z", false),
    msg("msg-g2-2", "conv-group-2", "user-me", "Cuối tuần này được nè!", "2026-02-10T10:30:00.000Z", true),
    msg("msg-g2-3", "conv-group-2", "user-duong", "Mình cũng rảnh cuối tuần 🙌", "2026-02-10T11:00:00.000Z", false),
    msg("msg-g2-4", "conv-group-2", "user-an", "Vậy thì quyết rồi nhé!", "2026-02-10T11:30:00.000Z", false),
    msg("msg-g2-5", "conv-group-2", "user-duong", "Cuối tuần đi cà phê không mọi người? ☕", "2026-02-10T12:00:00.000Z", false),
];

// ============================================================
// MOCK MESSAGES MAP (conversationId -> { items, hasMore, nextCursor })
// ============================================================
export const MOCK_MESSAGES: Record<
    string,
    { items: Message[]; hasMore: boolean; nextCursor?: string | null }
> = {
    "conv-direct-1": { items: MESSAGES_DIRECT_1, hasMore: false, nextCursor: null },
    "conv-direct-2": { items: MESSAGES_DIRECT_2, hasMore: false, nextCursor: null },
    "conv-direct-3": { items: MESSAGES_DIRECT_3, hasMore: false, nextCursor: null },
    "conv-group-1": { items: MESSAGES_GROUP_1, hasMore: false, nextCursor: null },
    "conv-group-2": { items: MESSAGES_GROUP_2, hasMore: false, nextCursor: null },
};

// ============================================================
// MOCK ONLINE USERS (for status badges)
// ============================================================
export const MOCK_ONLINE_USERS: string[] = [
    "user-me",
    "user-an",
    "user-duong",
    // user-binh và user-cuong sẽ hiện offline
];
