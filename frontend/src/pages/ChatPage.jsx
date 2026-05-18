import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft,
  Send,
  Bot,
  Plus,
  Trash2,
  ChevronDown,
  User,
} from 'lucide-react'

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5
          ${isUser ? 'bg-black text-white' : 'bg-base-200 text-base-content'}`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} strokeWidth={1.5} />}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${
            isUser
              ? 'bg-black text-white rounded-tr-sm'
              : 'bg-white border border-base-200 text-base-content rounded-tl-sm'
          }`}
      >
        {message.content.split('\n').map((line, i) => (
          <span key={i}>
            {line}
            {i < message.content.split('\n').length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { agentId } = useParams()
  const navigate = useNavigate()

  const [agent, setAgent] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    loadAgentAndConversations()
  }, [agentId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadAgentAndConversations() {
    try {
      const [agentRes, convsRes] = await Promise.all([
        api.agents.get(agentId),
        api.chat.listConversations(agentId),
      ])
      setAgent(agentRes.agent)
      setConversations(convsRes.conversations ?? [])
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function loadConversation(convId) {
    try {
      const res = await api.chat.getConversation(convId)
      setMessages(res.conversation.messages ?? [])
      setConversationId(convId)
      setSidebarOpen(false)
    } catch (err) {
      setError(err.message)
    }
  }

  function startNewConversation() {
    setMessages([])
    setConversationId(null)
    setSidebarOpen(false)
    inputRef.current?.focus()
  }

  async function handleDeleteConversation(convId, e) {
    e.stopPropagation()
    try {
      await api.chat.deleteConversation(convId)
      setConversations((prev) => prev.filter((c) => c.id !== convId))
      if (conversationId === convId) startNewConversation()
    } catch (err) {
      console.error(err)
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    const userMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)
    setError('')

    try {
      const allMessages = [...messages, userMessage]
      const res = await api.chat.send({
        agent_id: agentId,
        messages: allMessages,
        conversation_id: conversationId,
      })

      setMessages((prev) => [...prev, { role: 'assistant', content: res.response }])
      setConversationId(res.conversation_id)

      // Refresh conversation list
      const convsRes = await api.chat.listConversations(agentId)
      setConversations(convsRes.conversations ?? [])
    } catch (err) {
      setError(err.message)
      // Remove the optimistic user message
      setMessages((prev) => prev.slice(0, -1))
    }
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-md opacity-30" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-base-100 overflow-hidden">
      {/* Conversation sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-black text-white flex flex-col
          transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex
        `}
      >
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
          <Link
            to="/agents"
            className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={14} />
            Agents
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/40 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Agent info */}
        {agent && (
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 bg-white/10 rounded flex items-center justify-center">
                <Bot size={13} />
              </div>
              <span className="font-semibold text-sm truncate">{agent.name}</span>
            </div>
            <span className="text-[11px] font-mono text-white/30">{agent.model}</span>
          </div>
        )}

        {/* New chat button */}
        <div className="px-3 py-3">
          <button
            onClick={startNewConversation}
            className="btn btn-sm w-full gap-2 bg-white/10 hover:bg-white/20 text-white border-0"
          >
            <Plus size={14} />
            New conversation
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2">
          {conversations.length === 0 ? (
            <p className="text-center text-white/30 text-xs py-8">No conversations yet</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 group flex items-center gap-2 transition-all
                  ${
                    conversationId === conv.id
                      ? 'bg-white/20 text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <span className="flex-1 text-xs truncate">{conv.title}</span>
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                >
                  <Trash2 size={11} />
                </button>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <header className="bg-white border-b border-base-200 px-4 lg:px-6 py-3.5 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden btn btn-ghost btn-xs btn-square"
          >
            <ChevronDown size={16} className="-rotate-90" />
          </button>

          {agent && (
            <>
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                <Bot size={15} className="text-white" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-semibold text-sm">{agent.name}</h2>
                <p className="text-xs text-base-content/40 font-mono">{agent.model}</p>
              </div>
            </>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 lg:px-8 py-6">
          {error && (
            <div className="alert alert-error mb-4 text-sm max-w-2xl mx-auto">
              <span>{error}</span>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
              <div className="w-14 h-14 bg-base-200 rounded-full flex items-center justify-center mb-4">
                <Bot size={24} strokeWidth={1} className="text-base-content/30" />
              </div>
              <h3 className="font-semibold mb-1">{agent?.name ?? 'Agent'}</h3>
              <p className="text-base-content/40 text-sm leading-relaxed">
                {agent?.description
                  ? agent.description
                  : 'Start a conversation below.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((message, index) => (
                <MessageBubble key={index} message={message} />
              ))}
              {sending && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-base-200 flex items-center justify-center shrink-0">
                    <Bot size={14} strokeWidth={1.5} />
                  </div>
                  <div className="bg-white border border-base-200 rounded-2xl rounded-tl-sm px-4 py-3">
                    <span className="loading loading-dots loading-xs opacity-40" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-base-200 px-4 lg:px-8 py-4 shrink-0">
          <form
            onSubmit={handleSend}
            className="flex gap-2 items-end max-w-3xl mx-auto"
          >
            <textarea
              ref={inputRef}
              className="flex-1 textarea textarea-bordered bg-base-50 focus:border-primary focus:outline-none resize-none min-h-[44px] max-h-36 py-3 text-sm leading-relaxed"
              placeholder={`Message ${agent?.name ?? 'agent'}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              style={{
                height: 'auto',
                minHeight: '44px',
              }}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 144) + 'px'
              }}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="btn btn-primary btn-square h-11 w-11 shrink-0"
            >
              {sending ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </form>
          <p className="text-[11px] text-base-content/25 text-center mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}