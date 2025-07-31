"use client";

import { useSearchParams } from "next/navigation";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    PhoneFilled, 
    AudioOutlined, 
    AudioMutedOutlined, 
    VideoCameraOutlined, 
    VideoCameraAddOutlined, 
    SettingOutlined, 
    UserOutlined 
} from '@ant-design/icons';
import { Modal, Select } from 'antd';
import { CallEvent, getCallChannel } from '@/utils/callChannel';

// Configuration for STUN servers
const stunServers: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ]
};

const CallWindowPage = () => {
    // Get URL parameters
    const searchParams = useSearchParams();
    const name = searchParams.get('name') || 'Unknown';
    const callId = searchParams.get('callId') || '';
    const otherUserId = searchParams.get('otherUserId') || '';
    const isCaller = searchParams.get('role') === 'caller';

    // State variables
    const [status, setStatus] = useState<string>(isCaller ? 'calling' : 'incoming');
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [duration, setDuration] = useState('00:00');
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    // Refs for WebRTC objects and media elements
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const callChannelRef = useRef<BroadcastChannel | null>(null);
    const callTimerRef = useRef<NodeJS.Timeout | null>(null);
    const remoteOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
    const isCallEndedRef = useRef(false);



    const endCall = useCallback(() => {
        if (isCallEndedRef.current) {
            return;
        }
        isCallEndedRef.current = true;
        setStatus('ended');

        if (callTimerRef.current) {
            clearInterval(callTimerRef.current);
            callTimerRef.current = null;
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (callChannelRef.current) {
            try {
                callChannelRef.current.postMessage({ type: 'end_call', payload: { callId } });
            } catch (err) {
                console.log("Could not send end_call message, channel might be closed.");
            }
        }
        setRemoteStream(null);
    }, [callId]);

    const handleChannelMessage = useCallback(async (event: MessageEvent<CallEvent>) => {
        const command = event.data;

        // For targeted messages, ensure they are for the current user.
        if ('targetId' in command.payload && command.payload.targetId !== name) {
            return;
        }

        const pc = peerConnectionRef.current;

        try {
            switch (command.type) {
                case 'send_webrtc_offer':
                    if (isCaller) return;
                    console.log("Offer received, storing it.");
                    remoteOfferRef.current = command.payload.offer;
                    break;

                case 'send_webrtc_answer':
                    if (!pc) return;
                    await pc.setRemoteDescription(new RTCSessionDescription(command.payload.answer));
                    break;

                case 'send_ice_candidate':
                    if (!pc) return;
                    await pc.addIceCandidate(new RTCIceCandidate(command.payload.candidate));
                    break;

                case 'call_ended_by_user':
                case 'end_call':
                    if ('callId' in command.payload && command.payload.callId !== callId) return;
                    endCall();
                    break;
            }
        } catch (err) {
            console.error(`Error handling ${command.type}:`, err);
        }
    }, [name, callId, endCall, isCaller]);

    const initializeMedia = useCallback(async (pc: RTCPeerConnection) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
            localStreamRef.current = stream;
        } catch (err) {
            console.error("Error accessing media devices.", err);
            setStatus('error');
        }
    }, []);

    const startCallTimer = useCallback(() => {
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        const startTime = Date.now();
        callTimerRef.current = setInterval(() => {
            const seconds = Math.floor((Date.now() - startTime) / 1000);
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            setDuration(`${mins}:${secs}`);
        }, 1000);
    }, []);

    const initializePeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection(stunServers);

        pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate) {
                callChannelRef.current?.postMessage({ 
                    type: 'send_ice_candidate', 
                    payload: { targetId: otherUserId, candidate: event.candidate.toJSON(), senderId: name } 
                });
            }
        };

        pc.ontrack = (event: RTCTrackEvent) => {
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
            }
        };

        pc.onconnectionstatechange = () => {
            if (peerConnectionRef.current) {
                switch (peerConnectionRef.current.connectionState) {
                    case 'connected':
                        setStatus('in-call');
                        startCallTimer();
                        break;
                    case 'closed':
                    case 'failed':
                        endCall();
                        break;
                }
            }
        };

        peerConnectionRef.current = pc;
        return pc;
    }, [name, otherUserId, endCall, startCallTimer]);

    const handleAccept = useCallback(async () => {
        if (!remoteOfferRef.current) {
            console.error("Cannot accept call, offer not available.");
            return;
        }
        setStatus('connected');
        const pc = initializePeerConnection();

        try {
            // 1. Get local media and add tracks
            await initializeMedia(pc);

            // 2. Set the remote offer
            await pc.setRemoteDescription(new RTCSessionDescription(remoteOfferRef.current));
            
            // 3. Create and set local answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // 4. Send the answer to the caller
            if (pc.localDescription) {
                callChannelRef.current?.postMessage({ 
                    type: 'send_webrtc_answer', 
                    payload: { targetId: otherUserId, answer: pc.localDescription.toJSON(), senderId: name } 
                });
            }
        } catch (err) {
            console.error("Error on handleAccept", err);
            setStatus('error');
        }
    }, [otherUserId, initializeMedia, name, initializePeerConnection]);

    // Use refs for callbacks to avoid stale closures in event listeners
    const endCallRef = useRef(endCall);
    const handleChannelMessageRef = useRef(handleChannelMessage);

    // Keep callback refs updated
    useEffect(() => {
        endCallRef.current = endCall;
        handleChannelMessageRef.current = handleChannelMessage;
    }, [endCall, handleChannelMessage]);

    // Main setup effect
    useEffect(() => {
        const channel = getCallChannel();
        callChannelRef.current = channel;
        const messageHandler = (event: MessageEvent<CallEvent>) => handleChannelMessageRef.current(event);
        channel.addEventListener('message', messageHandler);

        if (isCaller) {
            const pc = initializePeerConnection();
            initializeMedia(pc).then(() => {
                pc.createOffer().then(offer => {
                    pc.setLocalDescription(offer);
                    channel.postMessage({ 
                        type: 'send_webrtc_offer', 
                        payload: { senderId: name, targetId: otherUserId, offer: offer.toJSON() }
                    });
                });
            });
        }

        return () => {
            channel.removeEventListener('message', messageHandler);
            endCallRef.current();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCaller, name, otherUserId]);

    // Effect to handle remote stream
    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    // UI handlers
    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    const toggleSettings = () => setIsSettingsOpen(prev => !prev);

    if (!callId || !otherUserId) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Invalid call link.</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            <header className="p-4 text-center">
                <h1 className="text-2xl font-bold">{otherUserId}</h1>
                <p className="text-sm text-gray-400">{status === 'in-call' ? duration : status.charAt(0).toUpperCase() + status.slice(1)}</p>
            </header>

            <main className="flex-1 flex items-center justify-center relative">
                <div className="w-full h-full bg-black flex items-center justify-center">
                    {remoteStream ? (
                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-gray-500">
                            <UserOutlined style={{ fontSize: '80px', color: '#666' }} />
                            <p className="absolute bottom-4 text-gray-400">{status === 'incoming' ? 'Incoming call...' : 'Connecting...'}</p>
                        </div>
                    )}
                    {/* Local Video (Picture-in-Picture) */}
                    <div className="absolute bottom-4 right-4 w-1/4 max-w-xs bg-black rounded-lg overflow-hidden border-2 border-gray-700 md:w-1/5">
                        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    </div>
                </div>
            </main>

            <footer className="p-4 bg-gray-800 flex justify-center items-center space-x-4">
                {status === 'incoming' ? (
                    <>
                        <button onClick={endCall} className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors" aria-label="Decline call">
                            <PhoneFilled className="text-2xl transform rotate-135" />
                        </button>
                        <button onClick={handleAccept} className="p-4 rounded-full bg-green-500 hover:bg-green-600 transition-colors" aria-label="Accept call">
                            <PhoneFilled className="text-2xl" />
                        </button>
                    </>
                ) : (
                    <>
                        <button onClick={toggleMute} className={`p-3 rounded-full transition-colors ${isMicMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`} aria-label={isMicMuted ? 'Unmute' : 'Mute'}>
                            {isMicMuted ? <AudioMutedOutlined className="text-2xl" /> : <AudioOutlined className="text-2xl" />}
                        </button>
                        <button onClick={toggleVideo} className={`p-3 rounded-full transition-colors ${isVideoOff ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`} aria-label={isVideoOff ? 'Turn on video' : 'Turn off video'}>
                            {isVideoOff ? <VideoCameraAddOutlined className="text-2xl" /> : <VideoCameraOutlined className="text-2xl" />}
                        </button>
                        <button onClick={endCall} className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors" aria-label="End call">
                            <PhoneFilled className="text-2xl transform rotate-135" />
                        </button>
                        <button onClick={toggleSettings} className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors" aria-label="Settings">
                            <SettingOutlined className="text-2xl" />
                        </button>
                    </>
                )}
            </footer>

            <Modal
                title="Call Settings"
                open={isSettingsOpen}
                onCancel={toggleSettings}
                footer={null}
                destroyOnHidden
            >
                <div className="space-y-4 p-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Audio Input</label>
                        <Select defaultValue="default" className="w-full" options={[{ value: 'default', label: 'Default Microphone' }]} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Video Input</label>
                        <Select defaultValue="default" className="w-full" options={[{ value: 'default', label: 'Default Camera' }]} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Audio Output</label>
                        <Select defaultValue="default" className="w-full" options={[{ value: 'default', label: 'Default Speakers' }]} />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CallWindowPage;
