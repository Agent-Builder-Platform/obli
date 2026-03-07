import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function getHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  }
}

async function apiFetch(path, options = {}) {
  const headers = await getHeaders()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail ?? 'Request failed')
  }

  return res.json()
}

export const api = {
  // ── Models ────────────────────────────────────────────────
  models: {
    list: () => apiFetch('/api/models/'),
  },

  // ── Agents ────────────────────────────────────────────────
  agents: {
    list: () => apiFetch('/api/agents/'),
    get: (id) => apiFetch(`/api/agents/${id}`),
    create: (data) =>
      apiFetch('/api/agents/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) =>
      apiFetch(`/api/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => apiFetch(`/api/agents/${id}`, { method: 'DELETE' }),
  },

  // ── System Prompts ────────────────────────────────────────
  prompts: {
    list: () => apiFetch('/api/prompts/'),
    create: (data) =>
      apiFetch('/api/prompts/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) =>
      apiFetch(`/api/prompts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => apiFetch(`/api/prompts/${id}`, { method: 'DELETE' }),
    toggle: (id) => apiFetch(`/api/prompts/${id}/toggle`, { method: 'PATCH' }),
  },

  // ── Chat ──────────────────────────────────────────────────
  chat: {
    send: (data) =>
      apiFetch('/api/chat/', { method: 'POST', body: JSON.stringify(data) }),
    listConversations: (agentId) =>
      apiFetch(`/api/chat/conversations/${agentId}`),
    getConversation: (id) => apiFetch(`/api/chat/conversation/${id}`),
    deleteConversation: (id) =>
      apiFetch(`/api/chat/conversation/${id}`, { method: 'DELETE' }),
  },
}