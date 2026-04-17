import { userService } from "./user.service";
import { friendService } from "./friend.service";
import type { User } from "../../auth/services/auth.service";

export type FriendStatus = "FRIEND" | "SENDING" | "RECEIVED" | "NONE";

export interface EmailUserCacheData {
  user: User | null;
  status: FriendStatus;
}

// In-memory cache: email → data
const cache = new Map<string, EmailUserCacheData>();
// Dedup concurrent fetches for same email
const pendingQueue = new Map<string, Promise<EmailUserCacheData>>();

export const getOrFetchEmailUser = async (
  email: string,
): Promise<EmailUserCacheData> => {
  const normEmail = email.toLowerCase().trim();

  if (cache.has(normEmail)) {
    return cache.get(normEmail)!;
  }

  if (pendingQueue.has(normEmail)) {
    return pendingQueue.get(normEmail)!;
  }

  const fetchPromise = (async (): Promise<EmailUserCacheData> => {
    try {
      const users = await userService.searchUsers(normEmail);
      const targetUser = users.find(
        (u: User) => u.email?.toLowerCase() === normEmail,
      );

      if (!targetUser) {
        const result: EmailUserCacheData = { user: null, status: "NONE" };
        cache.set(normEmail, result);
        return result;
      }

      // Resolve friendship status
      let status: FriendStatus = "NONE";
      const isFriend = await friendService
        .checkFriendship(targetUser.id)
        .catch(() => false);

      if (isFriend) {
        status = "FRIEND";
      } else {
        const isSending = await friendService
          .checkIsSending(targetUser.id)
          .catch(() => false);
        if (isSending) {
          status = "SENDING";
        } else {
          const isReceived = await friendService
            .checkIsReceived(targetUser.id)
            .catch(() => false);
          if (isReceived) status = "RECEIVED";
        }
      }

      const result: EmailUserCacheData = { user: targetUser, status };
      cache.set(normEmail, result);
      return result;
    } catch (e) {
      console.error("[EmailCard] Error loading user for", normEmail, e);
      return { user: null, status: "NONE" };
    } finally {
      pendingQueue.delete(normEmail);
    }
  })();

  pendingQueue.set(normEmail, fetchPromise);
  return fetchPromise;
};

/** Remove a single email from cache (e.g. after friend status change) */
export const invalidateEmailCache = (email: string): void => {
  cache.delete(email.toLowerCase().trim());
};
