// utils/callChannel.ts
import { any, string } from "zod";

export const CHANNEL_NAME = 'webrtc_call_channel';
let channel: BroadcastChannel | null = null;

export const getCallChannel = (): BroadcastChannel => {
    if (typeof window === 'undefined') {
        return {
            postMessage: () => {},
            close: () => {},
        } as any;
    }

    if (!channel) {
        channel = new BroadcastChannel(CHANNEL_NAME);
    }
    return channel;
};

export const callChannel = getCallChannel();

export type CallEvent =
    // Sự kiện từ Home -> Call
    | { type: 'call_connected', payload: { callId: string, startTime: string } }
    | { type: 'call_ended_by_user', payload: { callId: string; targetId: string } }
    // --- PHẦN MỚI: Sự kiện WebRTC từ Home -> Call ---
    | { type: 'webrtc_offer_received', payload: { senderId: string, targetId: string, offer: RTCSessionDescriptionInit } }
    | { type: 'webrtc_answer_received', payload: { senderId: string, targetId: string, answer: RTCSessionDescriptionInit } }
    | { type: 'webrtc_ice_candidate_received', payload: { senderId: string, targetId: string, candidate: RTCIceCandidateInit } }

    // Mệnh lệnh từ Call -> Home
    | { type: 'accept_call', payload: { callId: string } }
    | { type: 'end_call', payload: { callId: string } }
    | { type: 'decline_call', payload: { callId: string } }
    // --- PHẦN MỚI: Mệnh lệnh WebRTC từ Call -> Home ---
    | { type: 'send_webrtc_offer', payload: { senderId: string, targetId: string, offer: RTCSessionDescriptionInit } }
    | { type: 'send_webrtc_answer', payload: { senderId: string, targetId: string, answer: RTCSessionDescriptionInit } }
    | { type: 'send_ice_candidate', payload: { senderId: string, targetId: string, candidate: RTCIceCandidateInit } };