export type CallMediaType = "VOICE" | "VIDEO";

export type CallStatus =
  | "RINGING"
  | "ONGOING"
  | "ENDED"
  | "MISSED"
  | "CANCELLED";

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
  status: CallStatus;
  roomId: string;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  endedReason?: string | null;
  token?: CallToken | null;
  participants: CallParticipant[];
}

export interface StartCallRequest {
  conversationId: number;
  mediaType: CallMediaType;
}

export interface CallActionRequest {
  reason?: string;
}

export interface CallParticipantStateRequest {
  audioMuted?: boolean;
  videoMuted?: boolean;
}

export interface CallHistoryItem {
  callId: number;
  conversationId: number;
  mediaType: CallMediaType;
  status: CallStatus;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  counterpartSummary?: string;
}
