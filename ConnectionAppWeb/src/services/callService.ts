import api from "@/lib/axios";
import type {
  CallActionRequest,
  CallHistoryItem,
  CallParticipantStateRequest,
  CallSession,
  CallToken,
  StartCallRequest,
} from "@/types/call";
import type { PageResponse } from "@/types/chat";

export const callService = {
  async startCallSession(payload: StartCallRequest): Promise<CallSession> {
    const res = await api.post("/calls/session", payload);
    return res.data;
  },

  async getCall(callId: number): Promise<CallSession> {
    const res = await api.get(`/calls/${callId}`);
    return res.data;
  },

  async issueToken(callId: number): Promise<CallToken> {
    const res = await api.get("/calls/token", { params: { callId } });
    return res.data;
  },

  async acceptCall(callId: number): Promise<CallSession> {
    const res = await api.post(`/calls/${callId}/accept`);
    return res.data;
  },

  async rejectCall(callId: number): Promise<CallSession> {
    const res = await api.post(`/calls/${callId}/reject`);
    return res.data;
  },

  async endCall(
    callId: number,
    payload?: CallActionRequest,
  ): Promise<CallSession> {
    const res = await api.post(`/calls/${callId}/end`, payload ?? {});
    return res.data;
  },

  async updateParticipantState(
    callId: number,
    payload: CallParticipantStateRequest,
  ): Promise<CallSession> {
    const res = await api.patch(`/calls/${callId}/participants/me`, payload);
    return res.data;
  },

  async fetchHistory(
    page = 0,
    size = 20,
  ): Promise<PageResponse<CallHistoryItem>> {
    const res = await api.get("/calls/history", { params: { page, size } });
    return res.data;
  },
};
