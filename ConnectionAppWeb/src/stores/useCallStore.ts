import { create } from "zustand";
import { callService } from "@/services/callService";
import type {
  CallHistoryItem,
  CallMediaType,
  CallSession,
  CallParticipantStateRequest,
} from "@/types/call";
import { useAuthStore } from "./useAuthStore";

interface CallState {
  activeCall: CallSession | null;
  incomingCall: CallSession | null;
  history: CallHistoryItem[];
  loading: boolean;
  startCall: (
    conversationId: number,
    mediaType: CallMediaType,
  ) => Promise<CallSession>;
  acceptCall: (callId: number) => Promise<CallSession>;
  rejectCall: (callId: number) => Promise<CallSession>;
  endCall: (callId: number, reason?: string) => Promise<CallSession>;
  updateParticipantState: (
    callId: number,
    payload: CallParticipantStateRequest,
  ) => Promise<CallSession>;
  ensureActiveCallToken: (callId: number) => Promise<CallSession | null>;
  fetchHistory: (page?: number, size?: number) => Promise<void>;
  setIncomingCall: (call: CallSession) => void;
  handleCallStatus: (call: CallSession) => void;
  clearIncomingCall: () => void;
  clearActiveCall: () => void;
  reset: () => void;
}

const isFinishedStatus = (status: string): boolean =>
  status === "ENDED" || status === "MISSED" || status === "CANCELLED";

export const useCallStore = create<CallState>((set, get) => ({
  activeCall: null,
  incomingCall: null,
  history: [],
  loading: false,

  startCall: async (conversationId, mediaType) => {
    const call = await callService.startCallSession({
      conversationId,
      mediaType,
    });
    set({ activeCall: call, incomingCall: null });
    return call;
  },

  acceptCall: async (callId) => {
    const call = await callService.acceptCall(callId);
    set({ activeCall: call, incomingCall: null });
    return call;
  },

  rejectCall: async (callId) => {
    const call = await callService.rejectCall(callId);
    set((state) => ({
      activeCall: state.activeCall?.callId === callId ? null : state.activeCall,
      incomingCall:
        state.incomingCall?.callId === callId ? null : state.incomingCall,
    }));
    return call;
  },

  endCall: async (callId, reason) => {
    const call = await callService.endCall(
      callId,
      reason ? { reason } : undefined,
    );
    set((state) => ({
      activeCall: state.activeCall?.callId === callId ? null : state.activeCall,
      incomingCall:
        state.incomingCall?.callId === callId ? null : state.incomingCall,
    }));
    return call;
  },

  updateParticipantState: async (callId, payload) => {
    const call = await callService.updateParticipantState(callId, payload);
    get().handleCallStatus(call);
    return call;
  },

  ensureActiveCallToken: async (callId) => {
    const current = get().activeCall;
    if (!current || current.callId !== callId) {
      return null;
    }

    if (current.token?.token) {
      return current;
    }

    const issuedToken = await callService.issueToken(callId);
    let mergedCall: CallSession | null = null;

    set((state) => {
      if (!state.activeCall || state.activeCall.callId !== callId) {
        mergedCall = null;
        return state;
      }

      mergedCall = {
        ...state.activeCall,
        token: issuedToken,
      };

      return {
        ...state,
        activeCall: mergedCall,
      };
    });

    return mergedCall;
  },

  fetchHistory: async (page = 0, size = 20) => {
    set({ loading: true });
    try {
      const response = await callService.fetchHistory(page, size);
      set({ history: response.content });
    } finally {
      set({ loading: false });
    }
  },

  setIncomingCall: (call) => {
    const myUserId = useAuthStore.getState().user?.id;
    const isIncoming = myUserId != null && call.initiatedBy !== myUserId;

    if (isIncoming) {
      set({ incomingCall: call });
      return;
    }

    set({ activeCall: call, incomingCall: null });
  },

  handleCallStatus: (call) => {
    const myUserId = useAuthStore.getState().user?.id;
    const isIncoming = myUserId != null && call.initiatedBy !== myUserId;

    if (isFinishedStatus(call.status)) {
      set((state) => ({
        activeCall:
          state.activeCall?.callId === call.callId ? null : state.activeCall,
        incomingCall:
          state.incomingCall?.callId === call.callId
            ? null
            : state.incomingCall,
      }));
      void get().fetchHistory(0, 20);
      return;
    }

    if (call.status === "RINGING" && isIncoming) {
      set({ incomingCall: call });
      return;
    }

    set((state) => {
      const previousToken =
        state.activeCall?.callId === call.callId
          ? state.activeCall.token
          : null;

      return {
        activeCall: {
          ...call,
          token: call.token ?? previousToken ?? null,
        },
        incomingCall: null,
      };
    });
  },

  clearIncomingCall: () => set({ incomingCall: null }),
  clearActiveCall: () => set({ activeCall: null }),
  reset: () =>
    set({ activeCall: null, incomingCall: null, history: [], loading: false }),
}));
