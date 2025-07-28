'use client'

import { useEffect, useState } from 'react'
import { Layout, Menu, Avatar, Button, Dropdown, Space, Card, Table, List } from 'antd'
import { UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons'
import Link from 'next/link'
import Image from 'next/image'
import { jwtDecode } from 'jwt-decode'
import { StarOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import ContactList from './components/ContactList'

const { Header, Content, Footer } = Layout

type JwtPayload = {
  email?: string
  username?: string
}

function UserDropdown({ user, onLogout }: { user: { email: string } | null, onLogout: () => void }) {
  if (!user) return null

  const menuItems = [
    { key: 'email', disabled: true, icon: <UserOutlined />, label: user.email },
    { type: 'divider' as const },
    { key: 'upgrade', icon: <StarOutlined />, label: 'Nâng cấp gói' },
    { key: 'customize', icon: <SettingOutlined />, label: 'Tuỳ chỉnh tài khoản' },
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
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [userLoading, setUserLoading] = useState(true) // Thêm state userLoading
  const router = useRouter() // Get router instance

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (token) {
      try {
        const decoded = jwtDecode<JwtPayload>(token)
        setUser({ email: decoded.email || decoded.username || 'User' })
      } catch {
        setUser({ email: 'User' })
      }
    } else {
      setUser(null)
    }
    setUserLoading(false) // Đặt userLoading thành false sau khi kiểm tra token
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    router.push('/login') // Chuyển hướng đến trang login sau khi logout
  }

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
            <UserDropdown user={user} onLogout={handleLogout} />
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
          </main>
        </div>
  
        {/* ContactList ở bên phải */}
        <div style={{ width: '300px', borderLeft: '1px solid #ddd' }}>
          <ContactList />
        </div>
      </Content>
    </Layout>
  )  
}
