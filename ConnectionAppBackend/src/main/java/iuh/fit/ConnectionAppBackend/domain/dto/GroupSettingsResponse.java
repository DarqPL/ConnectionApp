package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupSettingsResponse {
    private Long conversationId;
    private boolean allowMemberEditInfo;
    private boolean allowMemberCreateNotes;
    private boolean allowMemberCreatePolls;
    private boolean allowMemberSendMessage;
    private boolean approvalMode;
    private boolean markAdminMessages;
    private boolean allowNewMembersReadHistory;
    private boolean allowLinkJoin;
    private String inviteToken;
    private List<ConversationUserResponse> blockedMembers;
    private List<ConversationUserResponse> pendingMembers;
}
