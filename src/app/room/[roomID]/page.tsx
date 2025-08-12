// app/room/[roomID]/[userID]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, Row, Col, Typography, Spin, Alert, Button, Avatar } from 'antd';
import { AudioMutedOutlined, AudioOutlined, VideoCameraOutlined, StopOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { wsNotificationsUrl } from '@/lib/config';
const { Title } = Typography;


const servers = {
    iceServers: [
      {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      },
    ],
    iceCandidatePoolSize: 10,
}

export default function RoomPage() {
    const params = useParams();
    const { roomID } = params;
    const { user } = useAuth();

    const [status, setStatus] = useState<string>('connecting');
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
    const hasJoinedRef = useRef(false);

    const userVideoRef = useRef<HTMLVideoElement>(null);
    const userStreamRef = useRef<MediaStream>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const webSocketRef = useRef<WebSocket>(null);
    const messageQueueRef = useRef<Array<{ event: string; data: any }>>([]);

    useEffect(() => {
        if (!roomID || !user?.id || hasJoinedRef.current) return;
        hasJoinedRef.current = true;
        const getMedia = async () => {
            let stream: MediaStream;
            let hasVideoInitially = true;
            try {
                console.log("Attempting to get video and audio stream...");
                stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                stream.getAudioTracks().forEach(track => (track.enabled = !isMuted));
                stream.getVideoTracks().forEach(track => (track.enabled = !isVideoOff));
                userStreamRef.current = stream;

                stream.getTracks().forEach(track => {
                    peerConnectionsRef.current.forEach(pc => pc.addTrack(track, stream));
                });
            } catch (error: any) {
                if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                    console.warn("Camera not found. Falling back to audio-only.");
                    hasVideoInitially = false;
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                        stream.getAudioTracks().forEach(track => (track.enabled = !isMuted));
                        userStreamRef.current = stream;

                        stream.getTracks().forEach(track => {
                            peerConnectionsRef.current.forEach(pc => pc.addTrack(track, stream));
                        });
                    } catch (audioError: any) {
                        console.error("Could not get audio stream either.", audioError);
                        setStatus('error');
                        return;
                    }
                } else {
                    console.error("Error accessing media devices:", error);
                    setStatus('error');
                    return;
                }
            }

            if (stream) {
                userStreamRef.current = stream;
                if (userVideoRef.current) {
                    userVideoRef.current.srcObject = stream;
                }

                setIsVideoOff(!hasVideoInitially);

                connectToWebSocket();
            }
        };

        const connectToWebSocket = () => {
            if (webSocketRef.current && webSocketRef.current.readyState !== WebSocket.CLOSED) {
                return;
            }
            const wsURL = `${wsNotificationsUrl}?roomId=${roomID}&userId=${user?.id}`;
            webSocketRef.current = new WebSocket(wsURL);

            webSocketRef.current.onopen = () => {
                console.log("WebSocket connection established.");
                setStatus('connected');
                while (messageQueueRef.current.length > 0) {
                    const queuedMessage = messageQueueRef.current.shift();
                    if (queuedMessage && webSocketRef.current?.readyState === WebSocket.OPEN) {
                        webSocketRef.current.send(JSON.stringify(queuedMessage));
                    }
                }
            };

            webSocketRef.current.onmessage = (event) => {
                const message = JSON.parse(event.data);
                handleServerMessage(message);
            };

            webSocketRef.current.onclose = () => {
                console.log("WebSocket connection closed.");
                setStatus('disconnected');
            };

            webSocketRef.current.onerror = (error) => {
                console.error("WebSocket error:", error);
                console.log("I'm here");
                setStatus('error');
            };
        };

        getMedia();

        return () => {
            webSocketRef.current?.close();
            userStreamRef.current?.getTracks().forEach(track => track.stop());
            peerConnectionsRef.current.forEach(pc => pc.close());
            hasJoinedRef.current = false;
        };
    }, [roomID, user?.id]);

    const handleServerMessage = (message: any) => {
        const { event, data, senderId } = message;

        switch (event) {
            case "room-joined":
                console.log(`Joined room. Current participants:`, data.participants);
                data.participants.forEach((participantId: string) => {
                    if (participantId !== user?.id) {
                        createPeerConnectionAndOffer(participantId);
                    }
                });
                break;
            case "participant-joined":
                console.log(`Participant ${data.joinedId} joined the room.`);
                break;
            case "participant-left":
                console.log(`Participant ${data.leftId} left the room.`);
                closePeerConnection(data.leftId);
                break;
            case "webrtc-offer":
                console.log(`Received WebRTC offer from ${senderId}`);
                handleOffer(senderId, data.payload);
                break;
            case "webrtc-answer":
                console.log(`Received WebRTC answer from ${senderId}`);
                handleAnswer(senderId, data.payload);
                break;
            case "ice-candidate":
                console.log(`Received ICE candidate from ${senderId}`);
                handleIceCandidate(senderId, data.payload);
                break;
            default:
                console.warn("Unknown message event:", event);
        }
    };

    const sendMessageToServer = (event: string, data: any) => {
        const message = { event, data };
        
        if (webSocketRef.current?.readyState === WebSocket.OPEN) {
            webSocketRef.current.send(JSON.stringify(message));
        } else {
            console.log(webSocketRef.current?.readyState)
            console.warn('WebSocket not ready, queuing message:', event);
            messageQueueRef.current.push(message);
        }
    };

    const createPeerConnection = (peerId: string) => {
        if (peerConnectionsRef.current.has(peerId)) return peerConnectionsRef.current.get(peerId)!;

        const pc = new RTCPeerConnection(servers);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendMessageToServer('ice-candidate', { targetId: peerId, payload: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStreams(prev => new Map(prev).set(peerId, event.streams[0]));
        };

        userStreamRef.current?.getTracks().forEach(track => {
            pc.addTrack(track, userStreamRef.current!);
        });

        peerConnectionsRef.current.set(peerId, pc);
        return pc;
    };

    const createPeerConnectionAndOffer = async (peerId: string) => {
        console.log(`Creating offer for ${peerId}`);
        const pc = createPeerConnection(peerId);

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendMessageToServer('webrtc-offer', { targetId: peerId, payload: offer });
        } catch (error) {
            console.error(`Error creating offer for ${peerId}:`, error);
        }
    };

    const handleOffer = async (senderId: string, offer: RTCSessionDescriptionInit) => {
        const pc = createPeerConnection(senderId);

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendMessageToServer('webrtc-answer', { targetId: senderId, payload: answer });
        } catch (error) {
            console.error(`Error handling offer from ${senderId}:`, error);
        }
    };

    const handleAnswer = async (senderId: string, answer: RTCSessionDescriptionInit) => {
        const pc = peerConnectionsRef.current.get(senderId);
        if (pc) {
            if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } else {
                console.warn("Can't set answer: signaling state is", pc.signalingState);
            }
        }
    };

    const handleIceCandidate = async (senderId: string, candidate: RTCIceCandidateInit) => {
        const pc = peerConnectionsRef.current.get(senderId);
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    };

    const closePeerConnection = (peerId: string) => {
        peerConnectionsRef.current.get(peerId)?.close();
        peerConnectionsRef.current.delete(peerId);
        setRemoteStreams(prev => {
            const newMap = new Map(prev);
            newMap.delete(peerId);
            return newMap;
        });
    };

    const toggleAudio = () => {
        peerConnectionsRef.current.forEach((pc) => {
            pc.getSenders().forEach(sender => {
                if (sender.track?.kind === 'audio') {
                    sender.track.enabled = !sender.track.enabled;
                }
            });
        });
        setIsMuted(prev => !prev);
    };

    const toggleVideo = () => {
        peerConnectionsRef.current.forEach((pc) => {
            pc.getSenders().forEach(sender => {
                if (sender.track?.kind === 'video') {
                    sender.track.enabled = !sender.track.enabled;
                }
            });
        });
        setIsVideoOff(prev => !prev);
    };

    const getGridLayoutClass = (participantCount: number): string => {
        if (participantCount <= 1) return 'grid-cols-1';
        if (participantCount === 2) return 'grid-cols-2';
        if (participantCount <= 4) return 'grid-cols-2';
        if (participantCount <= 6) return 'grid-cols-3';
        if (participantCount <= 9) return 'grid-cols-3';
        return 'grid-cols-4';
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            {/* Status Alert */}
            {status !== 'connected' && (
                <div className="mb-6">
                    <Alert
                        message={status.charAt(0).toUpperCase() + status.slice(1)}
                        description={
                            status === 'connecting' ? 'Attempting to connect to the room...' :
                            status === 'error' ? 'A connection error occurred.' :
                            'You have been disconnected.'
                        }
                        type={status === 'connecting' ? 'info' : 'error'}
                        showIcon
                        icon={status === 'connecting' && <Spin />}
                    />
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-[calc(100vh-180px)] p-2">
                {/* Videos Grid */}
                <div className={`grid gap-2 flex-1 w-full h-full ${getGridLayoutClass(remoteStreams.size + 1)}`}>
                    {/* Local Video */}
                    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
                        <Card
                            title="You"
                            className="h-full w-full flex flex-col p-0"
                        >
                            <video
                                ref={userVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                        </Card>
                    </div>

                    {/* Remote Videos */}
                    {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
                        <div key={peerId} className="relative w-full h-full bg-black rounded-lg overflow-hidden">
                            <Card
                                title={`Peer: ${peerId}`}
                                className="h-full w-full flex flex-col p-0"
                            >
                                {stream && stream.getVideoTracks().length > 0 ? (
                                    <video
                                        autoPlay
                                        playsInline
                                        className="w-full h-full object-cover"
                                        ref={video => {
                                            if (video && video.srcObject !== stream) {
                                                video.srcObject = stream;
                                            }
                                        }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <div className="w-1/2 aspect-square flex items-center justify-center">
                                            <Avatar 
                                                icon={<UserOutlined />} 
                                                className="bg-blue-500 w-full h-full"
                                            />
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </div>
                    ))}
                </div>
            </div>

            {/* Controls */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex justify-center gap-4">
                <Button
                    size="large"
                    icon={isMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
                    onClick={toggleAudio}
                    danger={isMuted}
                    className="flex items-center gap-2 px-6"
                >
                    {isMuted ? 'Unmute' : 'Mute'}
                </Button>
                <Button
                    size="large"
                    icon={isVideoOff ? <StopOutlined /> : <VideoCameraOutlined />}
                    onClick={toggleVideo}
                    danger={isVideoOff}
                    className="flex items-center gap-2 px-6"
                >
                    {isVideoOff ? 'Cam On' : 'Cam Off'}
                </Button>
            </div>
        </div>
    );
}