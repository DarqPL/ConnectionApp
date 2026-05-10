package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupSettingsRequest {
    private Boolean allowMemberEditInfo;
    private Boolean allowMemberCreateNotes;
    private Boolean allowMemberCreatePolls;
    private Boolean allowMemberSendMessage;
    private Boolean approvalMode;
    private Boolean markAdminMessages;
    private Boolean allowNewMembersReadHistory;
    private Boolean allowLinkJoin;
}
