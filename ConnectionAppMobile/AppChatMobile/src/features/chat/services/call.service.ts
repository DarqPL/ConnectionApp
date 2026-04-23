import { authService } from "../../auth/services/auth.service";

export type CallMediaType = "VOICE" | "VIDEO";

export interface CallParticipant {
  userId: number;
  displayName: string;
  avatarUrl?: string | null;
  status: string;
  audioMuted: boolean;
  videoMuted: boolean;
  joinedAt?: string | null;
  leftAt?: string | null;
}

export interface CallToken {
  appId: number;
  roomId: string;
  userId: string;
  token: string;
  expiresAt: string;
}

export interface CallSession {
  callId: number;
  conversationId: number;
  initiatedBy: number;
  mediaType: CallMediaType;
  status: string;
  roomId: string;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  endedReason?: string | null;
  token?: CallToken | null;
  participants: CallParticipant[];
}

class CallService {
  private async parseError(
    response: Response,
    fallback: string,
  ): Promise<Error> {
    try {
      const data = await response.json();
      const message = data?.message || data?.error || fallback;
      return new Error(message);
    } catch {
      return new Error(fallback);
    }
  }

  async startCallSession(
    conversationId: number,
    mediaType: CallMediaType,
  ): Promise<CallSession> {
    const response = await authService.authFetch("/calls/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conversationId, mediaType }),
    });

    if (!response.ok) {
      throw await this.parseError(response, "Khong the bat dau cuoc goi");
    }

    return (await response.json()) as CallSession;
  }

  async acceptCall(callId: number): Promise<CallSession> {
    const response = await authService.authFetch(`/calls/${callId}/accept`, {
      method: "POST",
    });

    if (!response.ok) {
      throw await this.parseError(response, "Khong the nhan cuoc goi");
    }

    return (await response.json()) as CallSession;
  }

  async getCall(callId: number): Promise<CallSession> {
    const response = await authService.authFetch(`/calls/${callId}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw await this.parseError(response, "Khong the tai thong tin cuoc goi");
    }

    return (await response.json()) as CallSession;
  }

  async issueToken(callId: number): Promise<CallToken> {
    const response = await authService.authFetch(
      `/calls/token?callId=${callId}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      throw await this.parseError(response, "Khong the cap call token");
    }

    return (await response.json()) as CallToken;
  }

  async rejectCall(callId: number): Promise<CallSession> {
    const response = await authService.authFetch(`/calls/${callId}/reject`, {
      method: "POST",
    });

    if (!response.ok) {
      throw await this.parseError(response, "Khong the tu choi cuoc goi");
    }

    return (await response.json()) as CallSession;
  }

  async endCall(
    callId: number,
    reason = "ENDED_BY_USER",
  ): Promise<CallSession> {
    const response = await authService.authFetch(`/calls/${callId}/end`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      throw await this.parseError(response, "Khong the ket thuc cuoc goi");
    }

    return (await response.json()) as CallSession;
  }
}

export const callService = new CallService();
