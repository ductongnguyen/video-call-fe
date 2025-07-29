import { any, string } from "zod";

const CHANNEL_NAME = 'webrtc_call_channel';
let channel: BroadcastChannel | null = null;

const getCallChannel = (): BroadcastChannel => {
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
    //Home -> Call
    | { type: 'call_connected' }
    | { type: 'call_ended_by_user' }
    //Call -> Home
    | { type: 'accept_call', payload: { callId: string } }
    | { type: 'decline_call', payload: { callId: string } }  