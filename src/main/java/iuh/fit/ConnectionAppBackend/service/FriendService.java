package iuh.fit.ConnectionAppBackend.service;

import iuh.fit.ConnectionAppBackend.domain.common.FriendStatus;
import iuh.fit.ConnectionAppBackend.domain.dto.FriendResponse;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.Friend;
import iuh.fit.ConnectionAppBackend.domain.entity.sql.User;
import iuh.fit.ConnectionAppBackend.exception.BadRequestException;
import iuh.fit.ConnectionAppBackend.exception.ResourceNotFoundException;
import iuh.fit.ConnectionAppBackend.repo.FriendRepository;
import iuh.fit.ConnectionAppBackend.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class FriendService {

    @Autowired
    private FriendRepository friendRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Send friend request
     */
    @Transactional
    public FriendResponse sendFriendRequest(Long requesterId, Long receiverId) {
        if (requesterId.equals(receiverId)) {
            throw new BadRequestException("Cannot send friend request to yourself");
        }

        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new ResourceNotFoundException("Requester not found with id: " + requesterId));

        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new ResourceNotFoundException("Receiver not found with id: " + receiverId));

        // Check if friendship already exists
        if (friendRepository.findFriendship(requesterId, receiverId).isPresent()) {
            throw new BadRequestException("Friendship already exists between these users");
        }

        Friend friend = Friend.builder()
                .requester(requester)
                .receiver(receiver)
                .status(FriendStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        Friend savedFriend = friendRepository.save(friend);
        return mapToFriendResponse(savedFriend, requesterId);
    }

    /**
     * Accept friend request
     */
    @Transactional
    public FriendResponse acceptFriendRequest(Long userId, Long requesterId) {
        Friend friend = friendRepository.findFriendship(userId, requesterId)
                .orElseThrow(() -> new ResourceNotFoundException("Friend request not found"));

        if (!friend.getStatus().equals(FriendStatus.PENDING)) {
            throw new BadRequestException("This friend request is not pending");
        }

        friend.setStatus(FriendStatus.ACCEPTED);
        friend.setUpdateAt(LocalDateTime.now());

        Friend updatedFriend = friendRepository.save(friend);
        return mapToFriendResponse(updatedFriend, userId);
    }

    /**
     * Reject friend request
     */
    @Transactional
    public void rejectFriendRequest(Long userId, Long requesterId) {
        Friend friend = friendRepository.findFriendship(userId, requesterId)
                .orElseThrow(() -> new ResourceNotFoundException("Friend request not found"));

        friendRepository.delete(friend);
    }

    /**
     * Get all friends of a user
     */
    public List<FriendResponse> getFriends(Long userId) {
        List<Friend> friends = friendRepository.findFriendsByUserId(userId);
        return friends.stream()
                .map(f -> mapToFriendResponse(f, userId))
                // Dùng toMap để loại bỏ trùng lặp nếu database có record rác bị trùng
                .collect(Collectors.toMap(FriendResponse::getFriendId, f -> f, (existing, replacement) -> existing))
                .values()
                .stream()
                .collect(Collectors.toList());
    }

    /**
     * Get pending friend requests received
     */
    public List<FriendResponse> getPendingRequests(Long userId) {
        List<Friend> pendingRequests = friendRepository.findPendingRequestsReceived(userId);
        return pendingRequests.stream()
                .map(f -> mapToFriendResponse(f, userId))
                .collect(Collectors.toList());
    }

    /**
     * Block user
     */
    @Transactional
    public void blockUser(Long userId, Long blockedUserId) {
        if (userId.equals(blockedUserId)) {
            throw new BadRequestException("Cannot block yourself");
        }

        User blocker = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        User blockedUser = userRepository.findById(blockedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + blockedUserId));

        // Check if friendship exists
        if (friendRepository.findFriendship(userId, blockedUserId).isPresent()) {
            Friend friend = friendRepository.findFriendship(userId, blockedUserId).get();
            friend.setStatus(FriendStatus.BLOCKED);
            friend.setUpdateAt(LocalDateTime.now());
            friendRepository.save(friend);
        } else {
            Friend friend = Friend.builder()
                    .requester(blocker)
                    .receiver(blockedUser)
                    .status(FriendStatus.BLOCKED)
                    .createdAt(LocalDateTime.now())
                    .build();
            friendRepository.save(friend);
        }
    }

    /**
     * Unblock user
     */
    @Transactional
    public void unblockUser(Long userId, Long blockedUserId) {
        Friend friend = friendRepository.findFriendship(userId, blockedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Block does not exist"));

        if (friend.getStatus().equals(FriendStatus.BLOCKED)) {
            friendRepository.delete(friend);
        }
    }

    /**
     * Check if users are friends
     */
    public boolean areFriends(Long userId1, Long userId2) {
        return friendRepository.areFriends(userId1, userId2);
    }

    /**
     * Map Friend entity to FriendResponse DTO
     */
    private FriendResponse mapToFriendResponse(Friend friend, Long currentUserId) {
        User otherUser = friend.getRequester().getId().equals(currentUserId) 
                ? friend.getReceiver() 
                : friend.getRequester();

        return FriendResponse.builder()
                .id(friend.getId())
                .friendId(otherUser.getId())
                .username(otherUser.getUsername())
                .displayName(otherUser.getDisplayName())
                .avatarUrl(otherUser.getAvatarUrl())
                .status(friend.getStatus().name())
                .createdAt(friend.getCreatedAt())
                .updatedAt(friend.getUpdateAt())
                .isRequester(friend.getRequester().getId().equals(currentUserId))
                .build();
    }
}
