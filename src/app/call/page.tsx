"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Avatar, Button, Card } from "antd";
import {
    AudioOutlined,
    VideoCameraOutlined,
    PhoneOutlined,
    SettingOutlined,
    MessageOutlined,
} from "@ant-design/icons";
import { callChannel, CallEvent } from '@/utils/callChannel';


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

    const [duration, setDuration] = useState(0);
    const [isCallConnected, setIsCallConnected] = useState(false);

    useEffect(() => {
        const handleChannelMessage = (event: MessageEvent<CallEvent>) => {
            const { type } = event.data;

            switch (type) {
                case 'call_connected':
                    setIsCallConnected(true);
                    setStartTime(event.data.payload.startTime);
                    break;

                case 'call_ended_by_user':
                    window.close();
                    break;
                
                case 'accept_call':
                    setStatus('connecting');
                    break;
                
                case 'decline_call':
                    window.close();
                    break;
            }
        };

        callChannel.addEventListener('message', handleChannelMessage);

        return () => {
            callChannel.removeEventListener('message', handleChannelMessage);
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
    }, [isCallConnected,startTime]);



    const handleAccept = () => {
        if (!callId) return;
        const command: CallEvent = { type: 'accept_call', payload: { callId } };
        callChannel.postMessage(command);
        setStatus('connecting');
    };

    const handleCancel = () => {
        if (!callId) return;
        var type : CallEvent['type'] = !isCallConnected ? 'decline_call' : 'end_call';
        const command: CallEvent = { type: type, payload: { callId } };
        callChannel.postMessage(command);
        window.close();
    };

    return (
        <div className="w-screen h-screen bg-[#fcfcff] flex flex-col items-center justify-between p-4 sm:p-6 lg:p-8 xl:p-12">

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
                            {status === 'incoming' ? 'Đang chờ kết nối...' : 'Đang kết nối...'}
                        </div>
                    </div>
                ) : (
                    <div
                        className="w-full max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-[80vw]"
                        style={{ padding: 0, overflow: "hidden", borderRadius: '12px' }}
                    >
                        <div className="w-full aspect-[16/9]">
                            <iframe
                                className="w-full h-full border-0"
                                src="https://www.youtube.com/embed/TWWNZWWm3Ss?autoplay=1&mute=1&controls=0&loop=1&playlist=TWWNZWWm3Ss"
                                title="YouTube video player"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allowFullScreen
                            ></iframe>
                        </div>
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

                    {status === 'incoming' ? (
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
                                icon={<AudioOutlined className="text-xl sm:text-2xl lg:text-3xl" />}
                                className="bg-[#2f57ef] text-white flex items-center justify-center p-0"
                            />
                            <Button
                                shape="circle"
                                size="large"
                                icon={<VideoCameraOutlined className="text-xl sm:text-2xl lg:text-3xl" />}
                                className="bg-[#2f57ef] text-white flex items-center justify-center p-0"
                            />
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