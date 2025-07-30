"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Avatar, Button, Card } from "antd";
import {
    AudioOutlined,
    VideoCameraOutlined,
    PhoneOutlined,
    SettingOutlined,
    MessageOutlined,
    AudioMutedOutlined,
} from "@ant-design/icons";
import { callChannel, CallEvent } from '@/utils/callChannel';
const stunServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};



const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
        .toString()
        .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
};


const CallWindowPage = () => {
    const searchParams = useSearchParams();
    const name = searchParams.get("name") || "Trương Huyền Hân";
    const role = searchParams.get("role") || 'caller';
    const [status, setStatus] = useState(role === 'callee' ? 'incoming' : 'connecting');
    const callId = searchParams.get("callId");
    const [startTime, setStartTime] = useState<string | null>(null);
    const otherUserId = searchParams.get('otherUserId');

    const [duration, setDuration] = useState(0);
    const [isCallConnected, setIsCallConnected] = useState(false);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);

    const localStreamRef = useRef<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMicMuted, setIsMicMuted] = useState(false);



    useEffect(() => {

        const setupPeerConnection = async () => {
            const pc = new RTCPeerConnection(stunServers);
            peerConnectionRef.current = pc;

            // Lấy luồng audio của chính mình
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            // Lắng nghe và gửi ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate && otherUserId) {
                    const command: CallEvent = {
                        type: 'send_ice_candidate',
                        payload: {
                            targetId: otherUserId,
                            candidate: event.candidate.toJSON()
                        }
                    };
                    callChannel.postMessage(command);
                }
            };

            // Lắng nghe và hiển thị luồng audio từ xa
            pc.ontrack = (event) => {
                setRemoteStream(event.streams[0]);
            };
        };

        const handleChannelMessage = async (event: MessageEvent<CallEvent>) => {
            const command = event.data;

            if (!peerConnectionRef.current) {
                await setupPeerConnection();
            }
            const pc = peerConnectionRef.current!;

            switch (command.type) {
                case 'call_connected':
                    setIsCallConnected(true);
                    setStartTime(command.payload.startTime);
                    if (role === 'caller' && otherUserId) {
                        try {
                            console.log("Creating offer...");
                            const offer = await pc.createOffer();

                            console.log("Setting local description with offer...");
                            await pc.setLocalDescription(offer);

                            console.log("Broadcasting send_webrtc_offer command...");
                            const offerCommand: CallEvent = {
                                type: 'send_webrtc_offer',
                                payload: { targetId: otherUserId, offer: (offer as RTCSessionDescription).toJSON() }
                            };
                            callChannel.postMessage(offerCommand);
                            console.log("Offer sent.");

                        } catch (error) {
                            // Log lỗi ra để xem chính xác nó là gì
                            console.error("Failed to create or set WebRTC offer:", error);
                        }
                    }
                    break;
                case 'webrtc_offer_received':
                    try {
                        const offerInit = command.payload.offer;
                        if (offerInit) {
                            // BƯỚC 1: Set remote description
                            await pc.setRemoteDescription(new RTCSessionDescription(offerInit));

                            // --- PHẦN MỚI: Xử lý hàng đợi ---
                            // Ngay sau khi setRemoteDescription, xử lý các candidate đã chờ sẵn
                            console.log('Processing queued ICE candidates after offer...');
                            iceCandidateQueueRef.current.forEach(candidate => {
                                pc.addIceCandidate(new RTCIceCandidate(candidate));
                            });
                            // Xóa hàng đợi
                            iceCandidateQueueRef.current = [];

                            // BƯỚC 2: Tạo và gửi answer (như cũ)
                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);
                            // ... gửi answer đi
                        }
                    } catch (error) { /* ... */ }
                    break;

                case 'webrtc_answer_received':
                    try {
                        const answerInit = command.payload.answer;
                        if (answerInit) {
                            // BƯỚC 1: Set remote description
                            await pc.setRemoteDescription(new RTCSessionDescription(answerInit));

                            // --- PHẦN MỚI: Xử lý hàng đợi ---
                            console.log('Processing queued ICE candidates after answer...');
                            iceCandidateQueueRef.current.forEach(candidate => {
                                pc.addIceCandidate(new RTCIceCandidate(candidate));
                            });
                            // Xóa hàng đợi
                            iceCandidateQueueRef.current = [];
                        }
                    } catch (error) { /* ... */ }
                    break;

                // CallWindowPage.tsx

                case 'webrtc_ice_candidate_received':
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(command.payload));

                    } catch (error) {
                        console.error("Error constructing or adding ICE candidate:", error, "Payload was:", command.payload);
                    }
                    break;
                case 'call_ended_by_user':
                    callChannel.postMessage({ type: 'end_call', payload: { callId } });
                    window.close();
                    break;

                case 'accept_call':
                    setStatus('connecting');
                    callChannel.postMessage({ type: 'accept_call', payload: { callId } });
                    break;

                case 'decline_call':
                    callChannel.postMessage({ type: 'decline_call', payload: { callId } });
                    window.close();
                    break;
            }
        };

        callChannel.addEventListener('message', handleChannelMessage);

        return () => {
            callChannel.removeEventListener('message', handleChannelMessage);
            localStreamRef.current?.getTracks().forEach(track => track.stop());
            peerConnectionRef.current?.close();
        };
    }, []);


    useEffect(() => {
        if (!isCallConnected || !startTime) {
            return;
        }

        const timer = setInterval(() => {
            const elapsedMilliseconds = Date.now() - new Date(startTime).getTime();
            const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
            setDuration(elapsedSeconds);
        }, 1000);
        return () => clearInterval(timer);
    }, [isCallConnected, startTime]);



    const handleAccept = () => {
        if (!callId) return;
        const command: CallEvent = { type: 'accept_call', payload: { callId } };
        callChannel.postMessage(command);
        setStatus('connecting');
    };

    const handleCancel = () => {
        if (!callId) return;
        var type: CallEvent['type'] = !isCallConnected ? 'decline_call' : 'end_call';
        const command: CallEvent = { type: type, payload: { callId } };
        callChannel.postMessage(command);
        window.close();
    };


    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTracks = localStreamRef.current.getAudioTracks();
            if (audioTracks.length > 0) {
                const newMutedState = !isMicMuted;
                audioTracks.forEach(track => {
                    track.enabled = !newMutedState;
                });
                setIsMicMuted(newMutedState);
                console.log(`Microphone is now ${newMutedState ? 'muted' : 'unmuted'}`);
            }
        }
    };
    return (
        <div className="w-screen h-screen bg-[#fcfcff] flex flex-col items-center justify-between p-4 sm:p-6 lg:p-8 xl:p-12">
            {remoteStream && (
                <audio autoPlay playsInline ref={(audioEl) => {
                    if (audioEl) audioEl.srcObject = remoteStream;
                }} />
            )}
            <div className="flex-grow flex flex-col items-center justify-center w-full">
                {!isCallConnected ? (
                    <div className="flex flex-col items-center gap-4">
                        <Avatar
                            size={{ xs: 100, sm: 120, md: 150, lg: 180, xl: 500 }}
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                                name
                            )}&background=random`}
                        />
                        <div className="text-gray-500 text-lg animate-pulse">
                            {status == 'incoming' ? 'Đang chờ kết nối...' : 'Đang kết nối...'}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-white">
                        <AudioOutlined style={{ fontSize: '100px', color: '#ccc' }} />
                        <p className="mt-4 text-xl text-gray-400">Audio Call</p>
                    </div>
                )}
            </div>

            <div className="flex flex-col items-center gap-4 sm:gap-6 w-full">
                <div className="text-center">
                    <div className="text-black text-xl sm:text-2xl lg:text-3xl font-semibold">
                        {name}
                    </div>
                    <div className={`text-gray-400 text-base sm:text-lg transition-opacity duration-300 ${isCallConnected ? 'opacity-100' : 'opacity-0'}`}>
                        {formatDuration(duration)}
                    </div>
                </div>

                <div className="flex gap-6 sm:gap-8 lg:gap-10 items-center justify-center mb-4 sm:mb-6 lg:mb-8">

                    {status == 'incoming' ? (
                        <>
                            <Button
                                shape="circle"
                                size="large"
                                icon={<PhoneOutlined className="text-xl sm:text-2xl lg:text-3xl" />}
                                className="bg-green-500 text-white flex items-center justify-center p-0"
                                onClick={handleAccept}
                            />
                            <Button
                                shape="circle"
                                size="large"
                                icon={<PhoneOutlined className="text-xl sm:text-2xl lg:text-3xl" />}
                                className="bg-red-500 text-white flex items-center justify-center p-0"
                                onClick={handleCancel}
                            />
                        </>
                    ) : (
                        <>
                            <Button
                                shape="circle"
                                size="large"
                                icon={
                                    isMicMuted
                                        ? <AudioMutedOutlined className="text-xl sm:text-2xl lg:text-3xl text-red-500" />
                                        : <AudioOutlined className="text-xl sm:text-2xl lg:text-3xl" />
                                }
                                className="bg-[#2f57ef] text-white flex items-center justify-center p-0"
                                onClick={toggleMic}
                            />
                            {/* <Button
                                shape="circle"
                                size="large"
                                icon={<VideoCameraOutlined className="text-xl sm:text-2xl lg:text-3xl" />}
                                className="bg-[#2f57ef] text-white flex items-center justify-center p-0"
                            /> */}
                            <Button
                                shape="circle"
                                size="large"
                                icon={<PhoneOutlined className="text-xl sm:text-2xl lg:text-3xl" />}
                                className="bg-red-500 text-white flex items-center justify-center p-0"
                                onClick={handleCancel}
                            />

                        </>


                    )}
                </div>
            </div>
        </div >
    );
};

export default CallWindowPage;