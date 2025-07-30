'use client'
import { List, Avatar, Typography, Space } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/utils/apiClient';
import { UserData } from '@/interfaces/types';
import { CallResponse } from '@/app/call/types';

const ContactList = () => {
 const [loading, setLoading] = useState(true)
 const {user,isAuthenticated } = useAuth()
 const [error, setError] = useState<string | null>(null);
 const [contacts, setContacts] = useState<UserData[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      const fetchProfile = async () => {
        try {
          const res = await apiClient('/auth/users');
          if (!res.ok) {
            throw new Error(`Failed to fetch users: ${res.statusText}`);
          }
          const data: any = await res.json();
          setContacts(data.result.filter((item: UserData) => item.username !== user?.username))
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setLoading(false);
        }
      };
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);
  
  const handleCallClick = async (e: React.MouseEvent<HTMLSpanElement>, callee : UserData) => {
    e.stopPropagation()
    const w = 400;
    const h = 500;
    const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
    const width = window.innerWidth
    const height = window.innerHeight
    const left = ((width / 2) - (w / 2)) + dualScreenLeft;
    const top = ((height / 2) - (h / 2)) + dualScreenTop;
      
    const res = await apiClient('/signaling/call', {
      method: 'POST',
      body: JSON.stringify({
        caller_id: user?.id,
        callee_id: callee.id,
      }),
      headers: {
        'Content-Type': 'application/json',
      }
    })
    const callResponse : CallResponse = await res.json()
    window.open(
      `/call?callId=${callResponse.call.id}&otherUserId=${callee.id}&name=${callee.username}&role=caller`,
      '_blank',
      `popup=yes,width=${w},height=${h},top=${top},left=${left},toolbar=no,menubar=no,location=no,status=no`
    );
  }

  return (
    <div className="w-[300px] h-[calc(100vh-64px)] p-4 overflow-y-auto">
      <Typography.Title level={5} className="text-black">Người liên hệ</Typography.Title>
      <List
        itemLayout="horizontal"
        dataSource={contacts}
        loading={loading}
        renderItem={(item) => (
          <List.Item 
            className="hover:bg-[#b7b7bd] rounded px-2 py-1 cursor-pointer"
            onClick={() => console.log(`Mở cửa sổ chat với ${item.username}`)}
          >
            <List.Item.Meta
              avatar={
                <Avatar src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.username)}&background=random`} />
              }
              title={
                <Space>
                  <span className="text-black">{item.username}</span>
                  <VideoCameraOutlined
                    onClick={(e) => handleCallClick(e, item)}
                    className="text-black hover:text-blue-500"
                  />
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
};

export default ContactList;
