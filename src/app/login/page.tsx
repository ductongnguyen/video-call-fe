'use client'

import {
  AlipayCircleOutlined,
  LockOutlined,
  TaobaoCircleOutlined,
  UserOutlined,
  WeiboCircleOutlined,
} from '@ant-design/icons'
import {
  LoginForm,
  ProFormText,
} from '@ant-design/pro-components'
import { Space, App, Typography } from 'antd'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiBaseUrl } from '@/lib/config'

const iconStyles = {
  marginInlineStart: '16px',
  color: 'rgba(0, 0, 0, 0.2)',
  fontSize: '24px',
  verticalAlign: 'middle',
  cursor: 'pointer',
}

export default function Login() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { message } = App.useApp()

  return (
    <div style={{ background: '#f5f6fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoginForm
        logo="https://github.githubassets.com/favicons/favicon.png"
        title="Github"
        subTitle="The world’s largest code hosting platform"
        actions={
          <div style={{ width: '100%', textAlign: 'center' }}>
            <Typography.Text type="secondary">
              No account yet,{' '}
              <Typography.Link href="/register" style={{ color: '#1677ff' }}>Join now !</Typography.Link>
            </Typography.Text>
          </div>
        }
        submitter={{
          searchConfig: { submitText: 'Login' },
          submitButtonProps: { loading },
        }}
        onFinish={async (values) => {
          setLoading(true)
          try {
            const res = await fetch(`${apiBaseUrl}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: values.username,
                password: values.password,
              }),
            })
            const result = await res.json()
            if (!res.ok) {
              message.error(result.message || 'Login failed!')
              setLoading(false)
              return false
            }
            localStorage.setItem('token', result.token)
            localStorage.setItem('refresh_token', result.refresh_token)
            message.success('Login successful!')
            setTimeout(() => {
              router.push('/')
            }, 1000)
            setLoading(false)
            return true
          } catch (e) {
            message.error('Network error!')
            setLoading(false)
            return false
          }
        }}
      >
        <ProFormText
          name="username"
          fieldProps={{
            size: 'large',
            prefix: <UserOutlined className={'prefixIcon'} />,
          }}
          placeholder={'Username'}
          rules={[
            {
              required: true,
              message: 'Please enter your username!',
            },
          ]}
        />
        <ProFormText.Password
          name="password"
          fieldProps={{
            size: 'large',
            prefix: <LockOutlined className={'prefixIcon'} />,
          }}
          placeholder={'Password'}
          rules={[
            {
              required: true,
              message: 'Please enter your password!',
            },
          ]}
        />
      </LoginForm>
    </div>
  )
} 