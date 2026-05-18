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
  },

  // ── Waitlist ──────────────────────────────────────────────
  waitlist: {
    join: (data) =>
      fetch(`${API_BASE}/api/waitlist/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
          throw new Error(err.detail ?? 'Request failed')
        }
        return res.json()
      }),
    count: () =>
      fetch(`${API_BASE}/api/waitlist/count`)
        .then((res) => res.json())
        .then((data) => data.count ?? 0)
        .catch(() => null),
  },

  // ── Knowledge Base ────────────────────────────────────────
  knowledge: {
    listBases: () => apiFetch('/api/knowledge/bases'),
    createBase: (data) =>
      apiFetch('/api/knowledge/bases', { method: 'POST', body: JSON.stringify(data) }),
    getBase: (kbId) => apiFetch(`/api/knowledge/bases/${kbId}`),
    updateBase: (kbId, data) =>
      apiFetch(`/api/knowledge/bases/${kbId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteBase: (kbId) =>
      apiFetch(`/api/knowledge/bases/${kbId}`, { method: 'DELETE' }),

    listDocuments: (kbId) => apiFetch(`/api/knowledge/bases/${kbId}/documents`),
    uploadDocuments: async (kbId, files) => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const formData = new FormData()
      for (const f of files) formData.append('files', f)
      const res = await fetch(`${API_BASE}/api/knowledge/bases/${kbId}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        const msg =
          typeof err.detail === 'string' ? err.detail : err.detail?.message ?? 'Upload failed'
        throw new Error(msg)
      }
      return res.json()
    },
    documentChunks: (docId) => apiFetch(`/api/knowledge/documents/${docId}/chunks`),
    deleteDocument: (docId) =>
      apiFetch(`/api/knowledge/documents/${docId}`, { method: 'DELETE' }),
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