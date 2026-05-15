'use client'

import { useState } from 'react'

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

export default function HelpPage() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Hello. I am the IRONBID support assistant. Describe your issue and include any lot number, auction ID, haul job ID, or transaction ID if available.',
    },
  ])

  async function send() {
    const message = input.trim()
    if (!message || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: message }])
    setLoading(true)

    try {
      const res = await fetch('/api/support/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })

      const data = await res.json()
      const reply = typeof data?.reply === 'string'
        ? data.reply
        : 'I could not generate a support response. Please try again.'

      setMessages((prev) => [...prev, { role: 'assistant', text: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Support is temporarily unavailable. Please retry in a moment or contact the operations team.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Customer Support</h1>
      <p style={{ marginBottom: 24 }}>
        Ask the support agent for help with sign-in, auctions, bidding, payments, or haul jobs.
      </p>

      <section
        style={{
          border: '1px solid #ddd',
          borderRadius: 12,
          padding: 16,
          minHeight: 360,
          marginBottom: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={`${msg.role}-${index}`}
            style={{
              justifySelf: msg.role === 'user' ? 'end' : 'start',
              maxWidth: '80%',
              background: msg.role === 'user' ? '#1f2937' : '#f3f4f6',
              color: msg.role === 'user' ? '#fff' : '#111827',
              borderRadius: 10,
              padding: '10px 12px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {msg.text}
          </div>
        ))}
      </section>

      <section style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder="Describe your issue"
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            border: '1px solid #ccc',
          }}
          disabled={loading}
        />
        <button
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid #111',
            background: '#111',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </section>
    </main>
  )
}
