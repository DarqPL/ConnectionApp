package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.dto.ReminderRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.ReminderResponse;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.Message;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.ReminderInfo;
import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.embedded.SenderInfo;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.ConversationUser;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.ResourceNotFoundException;
import iuh.fit.ConnectionAppBackend.repo.ConversationRepository;
import iuh.fit.ConnectionAppBackend.repo.ConversationUserRepository;
import iuh.fit.ConnectionAppBackend.repo.MessageRepository;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ReminderService {

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private ConversationUserRepository conversationUserRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    @Lazy
    private MessageService messageService;

    @Transactional
    public ReminderResponse createReminder(Long creatorId, ReminderRequest request) {
        User creator = userRepository.findById(creatorId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        ReminderInfo reminderInfo = ReminderInfo.builder()
                .title(request.getTitle())
                .content(request.getContent())
                .reminderTime(request.getReminderTime())
                .notified(false)
                .creatorId(creator.getId())
                .creatorName(creator.getDisplayName())
                .participantIds(new ArrayList<>())
                .build();

        SenderInfo senderInfo = SenderInfo.builder()
                .senderId(creator.getId())
                .displayName(creator.getDisplayName())
                .avatarUrl(creator.getAvatarUrl())
                .build();

        Message message = Message.builder()
                .conversationId(request.getConversationId())
                .senderInfo(senderInfo)
                .content("[Nhắc hẹn] " + request.getTitle())
                .reminder(reminderInfo)
                .isDeleted(false)
                .createdAt(LocalDateTime.now())
                .build();

        Message saved = messageRepository.save(message);
        
        ReminderResponse response = mapToResponse(saved);
        
        // Notify members about new reminder message - Fix: Notify individually for immediate visibility
        notifyMembers(request.getConversationId(), "", messageService.mapToMessageResponse(saved));

        // Notify conversation about new reminder list update
        notifyMembers(request.getConversationId(), "/reminders", response);
        
        return response;
    }

    public List<ReminderResponse> getRemindersByConversation(Long conversationId) {
        return messageRepository.findByConversationIdAndReminderNotNull(conversationId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteReminder(String messageId, Long userId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder message not found"));

        if (message.getReminder() == null) {
            throw new RuntimeException("This message is not a reminder");
        }

        if (!message.getSenderInfo().getSenderId().equals(userId)) {
            throw new RuntimeException("Only creator can delete reminder");
        }

        String reminderTitle = message.getReminder().getTitle();
        Long conversationId = message.getConversationId();

        // Find ALL messages sharing this reminder title in the conversation
        // (original + any notification re-display messages sent at trigger time)
        List<Message> allRelatedMessages = messageRepository
                .findByConversationIdAndReminderTitle(conversationId, reminderTitle);

        for (Message related : allRelatedMessages) {
            messageRepository.delete(related);
            // Broadcast deletion so every client removes the card immediately
            notifyMembers(conversationId, "/reminder-deleted", related.getId());
        }
    }

    @Scheduled(fixedRate = 60000)
    public void checkAndSendReminders() {
        LocalDateTime now = LocalDateTime.now();
        List<Message> dueMessages = messageRepository.findByReminderNotNullAndReminderNotifiedFalseAndReminderReminderTimeBefore(now);

        for (Message message : dueMessages) {
            sendReminderNotification(message);
            message.getReminder().setNotified(true);
            messageRepository.save(message);
        }
    }

    private void sendReminderNotification(Message message) {
        ReminderResponse response = mapToResponse(message);
        // Toast notification via personal topic
        notifyMembers(message.getConversationId(), "/reminder-trigger", response);

        ReminderInfo originalInfo = message.getReminder();

        // Build a copy of the reminder with notified=true so the scheduler
        // does NOT pick up this notification message again on the next run.
        ReminderInfo notifiedCopy = ReminderInfo.builder()
                .title(originalInfo.getTitle())
                .content(originalInfo.getContent())
                .reminderTime(originalInfo.getReminderTime())
                .notified(true)   // <-- critical: prevents re-trigger
                .creatorId(originalInfo.getCreatorId())
                .creatorName(originalInfo.getCreatorName())
                .participantIds(originalInfo.getParticipantIds())
                .declinedIds(originalInfo.getDeclinedIds())
                .build();

        SenderInfo systemSender = SenderInfo.builder()
                .senderId(0L)
                .displayName("Hệ thống nhắc hẹn")
                .build();

        Message notificationMsg = Message.builder()
                .conversationId(message.getConversationId())
                .senderInfo(systemSender)
                .content("🔔 ĐẾN GIỜ: " + originalInfo.getTitle())
                .reminder(notifiedCopy)   // use the notified=true copy
                .isDeleted(false)
                .createdAt(LocalDateTime.now())
                .build();

        Message saved = messageRepository.save(notificationMsg);
        notifyMembers(message.getConversationId(), "", messageService.mapToMessageResponse(saved));
    }

    private void notifyMembers(Long conversationId, String suffix, Object payload) {
        List<ConversationUser> members = conversationUserRepository.findByConversationId(conversationId);
        for (ConversationUser member : members) {
            messagingTemplate.convertAndSend("/topic/user." + member.getUser().getId() + suffix, payload);
        }
    }

    private ReminderResponse mapToResponse(Message message) {
        ReminderInfo info = message.getReminder();
        return ReminderResponse.builder()
                .id(message.getId())
                .title(info.getTitle())
                .content(info.getContent())
                .reminderTime(info.getReminderTime())
                .isNotified(info.isNotified())
                .conversationId(message.getConversationId())
                .creatorId(info.getCreatorId())
                .creatorName(info.getCreatorName())
                .participantIds(info.getParticipantIds())
                .declinedIds(info.getDeclinedIds())
                .createdAt(message.getCreatedAt())
                .build();
    }

    @Transactional
    public ReminderResponse joinReminder(String messageId, Long userId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder not found"));

        ReminderInfo info = message.getReminder();
        if (info == null) {
            String title = message.getContent() != null ? message.getContent().replace("[Nhắc hẹn] ", "") : "Nhắc hẹn";
            info = ReminderInfo.builder()
                    .title(title)
                    .reminderTime(message.getCreatedAt())
                    .notified(true)
                    .creatorId(message.getSenderInfo().getSenderId())
                    .creatorName(message.getSenderInfo().getDisplayName())
                    .build();
            message.setReminder(info);
        }

        List<Long> participants = info.getParticipantIds();
        if (participants == null) participants = new ArrayList<>();
        // Remove from declined if switching
        List<Long> declined = info.getDeclinedIds();
        if (declined == null) declined = new ArrayList<>();
        declined.remove(userId);

        if (!participants.contains(userId)) {
            participants.add(userId);
        }
        info.setParticipantIds(participants);
        info.setDeclinedIds(declined);
        Message saved = messageRepository.save(message);

        // Broadcast updated message card to all members (updates in-place via addMessage dedup)
        notifyMembers(message.getConversationId(), "", messageService.mapToMessageResponse(saved));

        ReminderResponse response = mapToResponse(saved);
        notifyMembers(message.getConversationId(), "/reminders", response);
        return response;
    }

    @Transactional
    public ReminderResponse declineReminder(String messageId, Long userId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder not found"));

        ReminderInfo info = message.getReminder();
        if (info == null) {
            String title = message.getContent() != null ? message.getContent().replace("[Nhắc hẹn] ", "") : "Nhắc hẹn";
            info = ReminderInfo.builder()
                    .title(title)
                    .reminderTime(message.getCreatedAt())
                    .notified(true)
                    .creatorId(message.getSenderInfo().getSenderId())
                    .creatorName(message.getSenderInfo().getDisplayName())
                    .build();
            message.setReminder(info);
        }

        List<Long> declined = info.getDeclinedIds();
        if (declined == null) declined = new ArrayList<>();
        // Remove from participants if switching
        List<Long> participants = info.getParticipantIds();
        if (participants == null) participants = new ArrayList<>();
        participants.remove(userId);

        if (!declined.contains(userId)) {
            declined.add(userId);
        }
        info.setDeclinedIds(declined);
        info.setParticipantIds(participants);
        Message saved = messageRepository.save(message);

        // Broadcast updated message card
        notifyMembers(message.getConversationId(), "", messageService.mapToMessageResponse(saved));

        ReminderResponse response = mapToResponse(saved);
        notifyMembers(message.getConversationId(), "/reminders", response);
        return response;
    }
}
