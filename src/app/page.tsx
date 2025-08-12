//home page
'use client'
import { Layout, Avatar, Button, Dropdown, Space } from 'antd'
import { UserOutlined, LogoutOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { redirect, useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiClient } from '@/utils/apiClient'
const { Header, Content } = Layout

function UserDropdown({ user, onLogout }: { user: { username: string } | null, onLogout: () => void }) {
  if (!user) return null

  const menuItems = [
    { key: 'username', disabled: true, icon: <UserOutlined />, label: user.username },
    { type: 'divider' as const },
    { key: 'help', icon: <QuestionCircleOutlined />, label: 'Trợ giúp' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: onLogout },
  ]

  return (
    <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
      <Avatar
        style={{ cursor: 'pointer', background: '#fde3cf', color: '#f56a00' }}
        icon={<UserOutlined />}
        src="https://api.dicebear.com/7.x/adventurer/svg?seed=User"
      />
    </Dropdown>
  )
}

export default function Home() {
    const { user, isAuthenticated, loading: userLoading, logout } = useAuth()
    const router = useRouter()
    const [roomId, setRoomId] = useState<string | null>();

  if (!isAuthenticated || !user) return (
    redirect('/login')
  )
  const handleLogout = () => {
    logout();
  };
  const createAndJoin = async () => {
   const res = await apiClient("/signaling/call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
    const result = await res.json()
    const roomId = result.room_id
    window.open(`/room/${roomId}`, '_blank');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
        }}
      >
        <Link href="/">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>Vivy</span>
          </div>
        </Link>
  
        <div style={{ marginLeft: 'auto' }}>
          {userLoading ? (
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f0f0f0' }}></div>
          ) : user ? (
            <UserDropdown user={{ username: user.username || '' }} onLogout={handleLogout} />
          ) : (
            <Space>
              <Link href="/login"><Button type="primary">Login</Button></Link>
              <Link href="/register"><Button>Register</Button></Link>
            </Space>
          )}
        </div>
      </Header>
  
      <Content style={{ flex: 1, display: 'flex' }}>
        <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <main style={{ width: '100%', maxWidth: '800px' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '16px' }}>Chào mừng bạn đến với MyApp!</h1>
            <p>Đây là trang chủ. Bạn đã đăng nhập thành công.</p>
            <Button type="primary" onClick={createAndJoin}>Start a meeting</Button>
          </main>
        </div>
      </Content>
    </Layout>
  )  
}
