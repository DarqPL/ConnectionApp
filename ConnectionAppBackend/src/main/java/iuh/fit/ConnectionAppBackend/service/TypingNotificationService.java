package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.ConversationType;
import iuh.fit.ConnectionAppBackend.domain.dto.TypingNotificationDTO;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.Conversation;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.ConversationUser;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.ResourceNotFoundException;
import iuh.fit.ConnectionAppBackend.exception.UnauthorizedException;
import iuh.fit.ConnectionAppBackend.repo.ConversationRepository;
import iuh.fit.ConnectionAppBackend.repo.ConversationUserRepository;
import iuh.fit.ConnectionAppBackend.repo.FriendRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TypingNotificationService {

    @Autowired
    private UserService userService;

    @Autowired
    private ConversationUserRepository conversationUserRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private FriendRepository friendRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public void notifyTyping(String username, Long conversationId) {
        notify(username, conversationId, true);
    }

    public void notifyStoppedTyping(String username, Long conversationId) {
        notify(username, conversationId, false);
    }

    private void notify(String username, Long conversationId, boolean isTyping) {
        User sender = userService.getUserByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Long senderId = sender.getId();
        boolean isMember = conversationUserRepository.isMember(conversationId, senderId);
        if (!isMember) {
            throw new UnauthorizedException("User is not a member of this conversation");
        }

        validatePrivateConversationBlock(conversationId, senderId);

        TypingNotificationDTO payload = TypingNotificationDTO.builder()
                .conversationId(conversationId)
                .userId(senderId)
                .displayName(sender.getDisplayName())
                .typedAt(LocalDateTime.now())
                .build();

        List<ConversationUser> members = conversationUserRepository.findByConversationId(conversationId);
        String topicSuffix = isTyping ? "/typing" : "/stopped-typing";

        for (ConversationUser member : members) {
            Long memberId = member.getUser().getId();
            if (memberId.equals(senderId)) {
                continue;
            }
            messagingTemplate.convertAndSend("/topic/user." + memberId + topicSuffix, payload);
        }
    }

    private void validatePrivateConversationBlock(Long conversationId, Long senderId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));

        if (conversation.getType() != ConversationType.PRIVATE) {
            return;
        }

        List<ConversationUser> members = conversationUserRepository.findByConversationId(conversationId);
        Long otherUserId = members.stream()
                .map(member -> member.getUser().getId())
                .filter(memberId -> !memberId.equals(senderId))
                .findFirst()
                .orElse(null);

        if (otherUserId == null) {
            return;
        }

        boolean blockedByOther = friendRepository.isBlockedBy(otherUserId, senderId);
        boolean blockedByMe = friendRepository.isBlockedBy(senderId, otherUserId);

        if (blockedByOther || blockedByMe) {
            throw new UnauthorizedException("Typing is not allowed in this private conversation");
        }
    }
}