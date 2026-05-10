package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationResponse {
    private Long id;
    private String name;
    private String avatarUrl;
    private String inviteToken;
    private String type;
    private LocalDateTime lastMessageAt;
    private String lastMessageContent;
    private boolean activate;
    private Long createdById;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<ConversationUserResponse> participants;
    private List<MessageResponse> pinnedMessages;
    private long unreadCount = 0;

    // Group settings
    private boolean allowMemberEditInfo = true;
    private boolean allowMemberCreateNotes = true;
    private boolean allowMemberCreatePolls = true;
    private boolean allowMemberSendMessage = true;
    private boolean approvalMode = false;
    private boolean markAdminMessages = false;
    private boolean allowNewMembersReadHistory = true;
    private boolean allowLinkJoin = true;

    private List<ConversationUserResponse> blockedMembers;
    private List<ConversationUserResponse> pendingMembers;
}
