package iuh.fit.ConnectionAppBackend.repo;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import iuh.fit.ConnectionAppBackend.domain.entity.mongodb.Message;

@Repository
public interface MessageRepository extends MongoRepository<Message, String> {

    /**
     * Get all messages in a conversation with pagination
     */
    Page<Message> findByConversationIdAndIsDeletedFalseOrderByCreatedAtDesc(
            Long conversationId, Pageable pageable);

    /**
     * Get message by ID
     */
    Optional<Message> findByIdAndIsDeletedFalse(String id);

    /**
     * Get messages from a specific user in a conversation
     */
    List<Message> findByConversationIdAndSenderInfo_SenderIdAndIsDeletedFalse(
            Long conversationId, Long senderId);

    /**
     * Search messages by content
     */
    @Query("{ 'conversation_id': ?0, 'content': { $regex: ?1, $options: 'i' }, 'is_deleted': false }")
    List<Message> searchByContent(Long conversationId, String searchTerm);

    /**
     * Get messages between two timestamps
     */
    List<Message> findByConversationIdAndCreatedAtBetweenAndIsDeletedFalseOrderByCreatedAtDesc(
            Long conversationId, LocalDateTime start, LocalDateTime end);

    /**
     * Get latest message in conversation
     */
    Optional<Message> findFirstByConversationIdAndIsDeletedFalseOrderByCreatedAtDesc(Long conversationId);

    /**
     * Count messages in conversation
     */
    long countByConversationIdAndIsDeletedFalse(Long conversationId);

    /**
     * Get unread messages count for a user in conversation
     */
    @Query("{ 'conversation_id': ?0, 'senderInfo.sender_id': { $ne: ?1 }, 'is_deleted': false }")
    long countUnreadMessages(Long conversationId, Long userId);

    /**
     * Delete all messages in conversation (soft delete)
     */
    void deleteByConversationId(Long conversationId);

    /**
     * Delete all messages from a specific sender
     */
    void deleteBySenderInfo_SenderId(Long senderId);

    /**
     * Find messages with active reminders that are due
     */
    List<Message> findByReminderNotNullAndReminderNotifiedFalseAndReminderReminderTimeBefore(LocalDateTime time);

    /**
     * Find messages with reminders in a conversation
     */
    List<Message> findByConversationIdAndReminderNotNull(Long conversationId);

    /**
     * Find all messages (original + notification re-displays) sharing the same reminder title in a conversation
     */
    @Query("{ 'conversation_id': ?0, 'reminder.title': ?1 }")
    List<Message> findByConversationIdAndReminderTitle(Long conversationId, String title);

    @Query("{ 'conversation_id': ?0, 'reminder.reminderGroupId': ?1 }")
    List<Message> findByConversationIdAndReminderReminderGroupId(Long conversationId, String groupId);
}
