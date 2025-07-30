'use client'

import { useState, useRef, useCallback, useEffect } from 'react';

// Cấu hình STUN server của Google. Đây là yêu cầu tối thiểu để
// các peer có thể tìm thấy nhau khi chúng ở sau các mạng NAT khác nhau.
const stunServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// Định nghĩa một kiểu cho hàm gửi tín hiệu
type SignalingSendFunction = (event: string, data: any) => void;

export const useWebRTC = (signalingSend: SignalingSendFunction) => {
  const pcRef = useRef<RTCPeerConnection | null>(null); // Dùng ref cho PeerConnection
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);


  const setupWebRTC = useCallback(async () => {
    // 1. Tạo đối tượng PeerConnection
    const pc = new RTCPeerConnection(stunServers);
    pcRef.current = pc;

    // 2. Thiết lập các trình lắng nghe sự kiện
    // Sự kiện này được kích hoạt khi WebRTC engine tìm thấy một "địa chỉ mạng" (candidate)
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            // Gửi candidate này cho peer còn lại qua server signaling
            signalingSend('ice_candidate', {
                // targetId sẽ cần được truyền vào hoặc quản lý ở state ngoài
                payload: event.candidate,
            });
        }
    };

    // Sự kiện này được kích hoạt khi nhận được luồng media từ peer còn lại
    pc.ontrack = (event) => {
        console.log('Remote track received!');
        setRemoteStream(event.streams[0]);
    };

    // 3. Lấy audio từ microphone của người dùng
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(stream);

        // 4. Thêm các track audio vào PeerConnection để gửi đi
        stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
        });
    } catch (error) {
        console.error("Error getting user media:", error);
    }
}, [signalingSend]);


const createOffer = useCallback(async (targetId: string) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        console.log('Sending WebRTC Offer...');
        signalingSend('webrtc_offer', {
            targetId: targetId,
            payload: offer,
        });
    } catch (error) {
        console.error("Error creating offer:", error);
    }
}, [signalingSend]);

const handleReceivedOffer = useCallback(async (offer: RTCSessionDescriptionInit, senderId: string) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        console.log('Sending WebRTC Answer...');
        signalingSend('webrtc_answer', {
            targetId: senderId,
            payload: answer,
        });
    } catch (error) {
        console.error("Error handling offer:", error);
    }
}, [signalingSend]);
const handleReceivedAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('WebRTC Answer received, connection established.');
    } catch (error) {
        console.error("Error handling answer:", error);
    }
}, []);

const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error("Error adding ICE candidate:", error);
    }
}, []);

const closeConnection = useCallback(() => {
    pcRef.current?.close();
    localStream?.getTracks().forEach(track => track.stop());
    pcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, [localStream]);


  return {
    localStream,
    remoteStream,
    setupWebRTC,
    createOffer,
    handleReceivedOffer,
    handleReceivedAnswer,
    handleIceCandidate,
    closeConnection,
  };
};