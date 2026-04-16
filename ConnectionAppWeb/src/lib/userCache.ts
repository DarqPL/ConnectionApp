import { userService } from "@/services/userService";
import { friendService } from "@/services/friendService";
import type { User } from "@/types/user";

interface CacheData {
  user: User | null;
  status: "FRIEND" | "SENDING" | "RECEIVED" | "NONE";
}

const cache = new Map<string, CacheData>();
const pendingQueue = new Map<string, Promise<CacheData>>();

export const getOrFetchEmailUser = async (email: string): Promise<CacheData> => {
  const normEmail = email.toLowerCase().trim();

  // Return from cache if exist
  if (cache.has(normEmail)) {
    return cache.get(normEmail)!;
  }

  // If already fetching, join the queue
  if (pendingQueue.has(normEmail)) {
    return pendingQueue.get(normEmail)!;
  }

  // Define fetch promise
  const fetchPromise = (async () => {
    try {
      const users = await userService.searchUsers(normEmail);
      const targetUser = users.find(
        (u) => u.email?.toLowerCase() === normEmail
      );

      if (!targetUser) {
        const result: CacheData = { user: null, status: "NONE" as const };
        cache.set(normEmail, result);
        return result;
      }

      // Check relationship
      let status: "FRIEND" | "SENDING" | "RECEIVED" | "NONE" = "NONE";
      const isFriend = await friendService.checkFriendship(targetUser.id);

      if (isFriend) {
        status = "FRIEND";
      } else {
        const isSending = await friendService.checkIsSending(targetUser.id).catch(() => false);
        if (isSending) {
          status = "SENDING";
        } else {
          const isReceived = await friendService.checkIsReceived(targetUser.id).catch(() => false);
          if (isReceived) {
            status = "RECEIVED";
          }
        }
      }

      const result: CacheData = { user: targetUser, status };
      cache.set(normEmail, result);
      return result;
    } catch (e) {
      console.error("[EmailCard] Error loading email user for", normEmail, e);
      return { user: null, status: "NONE" as const };
    } finally {
      pendingQueue.delete(normEmail);
    }
  })();

  pendingQueue.set(normEmail, fetchPromise);
  return fetchPromise;
};
