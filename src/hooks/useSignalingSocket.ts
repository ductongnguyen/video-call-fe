// hooks/useSignalingSocket.ts
'use client'
import { useEffect, useRef, useCallback } from 'react'

type EventHandler = (data: any) => void

type Handlers = {
  onIncomingCall?: EventHandler
  onCallAccepted?: EventHandler
  onCallDeclined?: EventHandler
}

export const useSignalingSocket = (url: string, handlers: Handlers = {}) => {
  const socketRef = useRef<WebSocket | null>(null)

  const send = useCallback((event: string, payloadData: any = {}) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const messageToSend = {
        event: event,
        data: payloadData 
      };
      socketRef.current.send(JSON.stringify(messageToSend));
    }
  }, []);

  useEffect(() => {
    const socket = new WebSocket(url)
    socketRef.current = socket
    socket.onmessage = (event) => {
        try {

          const raw = JSON.parse(event.data)
          const { event: evt, data } = raw
          switch (evt) {
            case 'incoming_call':
              handlers.onIncomingCall?.(data)
              break
            case 'call_accepted':
              handlers.onCallAccepted?.(data)
              break
            case 'call_declined':
              handlers.onCallDeclined?.(data)
              break
            default:
              console.warn('Unhandled event:', evt)
          }
        } catch (err) {
          console.error('Invalid WS message:', err)
        }
      }

    return () => socket.close()
  }, [url])

  return { send }
}
