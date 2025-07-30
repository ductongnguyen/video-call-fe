// hooks/useSignalingSocket.ts
'use client'
import { useEffect, useRef, useCallback } from 'react'

type EventHandler = (data: any) => void

type Handlers = {
  onIncomingCall?: EventHandler
  onCallAccepted?: EventHandler
  onCallDeclined?: EventHandler
  onWebRTCOffer?: EventHandler
  onWebRTCAnswer?: EventHandler
  onWebRTCIceCandidate?: EventHandler
}

export const useSignalingSocket = (url: string, handlers: Handlers = {}) => {
  const socketRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);
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
          const currentHandlers = handlersRef.current;

          switch (evt) {
            case 'incoming_call':
              currentHandlers.onIncomingCall?.(data)
              break
            case 'call_accepted':
              currentHandlers.onCallAccepted?.(data)
              break
            case 'call_declined':
              currentHandlers.onCallDeclined?.(data)
              break
            case 'call_ended':
              currentHandlers.onCallDeclined?.(data)
              break
            case 'webrtc_offer':
              currentHandlers.onWebRTCOffer?.(data)
              break
            case 'webrtc_answer':
              currentHandlers.onWebRTCAnswer?.(data)
              break
            case 'ice_candidate':
              currentHandlers.onWebRTCIceCandidate?.(data)
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
