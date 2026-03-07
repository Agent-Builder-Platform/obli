import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import Layout from '../components/Layout'
import {
  Plus,
  Trash2,
  FileText,
  Edit2,
  X,
  Check,
  Globe,
  Lock,
  Users,
} from 'lucide-react'

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private', icon: Lock },
  { value: 'team', label: 'Team', icon: Users },
  { value: 'public', label: 'Public', icon: Globe },
]

function PromptModal({ prompt, onClose, onSave }) {
  const [name, setName] = useState(prompt?.name ?? '')
  const [content, setContent] = useState(prompt?.content ?? '')
  const [visibility, setVisibility] = useState(prompt?.visibility ?? 'private')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !content.trim()) {
      setError('Name and content are required')
      return
    }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), content: content.trim(), visibility })
      onClose()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-200">
          <h3 className="font-semibold">{prompt ? 'Edit Prompt' : 'New System Prompt'}</h3>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-xs btn-square text-base-content/40"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="alert alert-error text-sm py-2">
              <span>{error}</span>
            </div>
          )}

          <div className="form-control">
            <label className="label pb-1.5">
              <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                Prompt Name
              </span>
            </label>
            <input
              type="text"
              className="input input-bordered bg-white focus:border-black focus:outline-none w-full"
              placeholder="e.g. Formal Tone"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-control">
            <label className="label pb-1.5">
              <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                Prompt Content
              </span>
            </label>
            <textarea
              className="textarea textarea-bordered bg-white focus:border-black focus:outline-none w-full resize-none font-mono text-sm"
              placeholder="You are a helpful assistant that..."
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
            <label className="label pt-1">
              <span className="label-text-alt text-base-content/30">
                {content.length} characters
              </span>
            </label>
          </div>

          <div className="form-control">
            <label className="label pb-1.5">
              <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                Visibility
              </span>
            </label>
            <div className="flex gap-2">
              {VISIBILITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all
                    ${
                      visibility === opt.value
                        ? 'bg-black text-white border-black'
                        : 'bg-white border-base-300 text-base-content/60 hover:border-black/40'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-base-content/40 mt-1.5">
              {visibility === 'private' && 'Only you can see and use this prompt.'}
              {visibility === 'team' && 'Everyone in your organisation can use this prompt.'}
              {visibility === 'public' && 'Anyone can use this prompt.'}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn btn-primary flex-1 gap-2">
              {saving ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <>
                  <Check size={15} />
                  {prompt ? 'Save changes' : 'Create prompt'}
                </>
              )}
            </button>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SystemPromptsPage() {
  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState(null)

  useEffect(() => {
    loadPrompts()
  }, [])

  async function loadPrompts() {
    try {
      const res = await api.prompts.list()
      setPrompts(res.prompts ?? [])
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this system prompt? Agents using it will still work but without this prompt.')) return
    setDeletingId(id)
    try {
      await api.prompts.delete(id)
      setPrompts((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setError(err.message)
    }
    setDeletingId(null)
  }

  async function handleSave(data) {
    if (editingPrompt) {
      const res = await api.prompts.update(editingPrompt.id, data)
      setPrompts((prev) =>
        prev.map((p) => (p.id === editingPrompt.id ? res.prompt : p))
      )
    } else {
      const res = await api.prompts.create(data)
      setPrompts((prev) => [res.prompt, ...prev])
    }
  }

  function openCreate() {
    setEditingPrompt(null)
    setModalOpen(true)
  }

  function openEdit(prompt) {
    setEditingPrompt(prompt)
    setModalOpen(true)
  }

  return (
    <Layout title="System Prompt Library">
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold">System Prompt Library</h1>
            <p className="text-base-content/50 text-sm mt-0.5">
              {prompts.length} prompt{prompts.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="btn btn-primary gap-2 self-start sm:self-auto"
          >
            <Plus size={16} />
            New Prompt
          </button>
        </div>

        {error && (
          <div className="alert alert-error mb-4 text-sm">
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-md opacity-30" />
          </div>
        )}

        {/* Empty state */}
        {!loading && prompts.length === 0 && (
          <div className="bg-white border border-dashed border-base-300 rounded-xl py-20 text-center">
            <FileText
              size={40}
              className="mx-auto text-base-content/15 mb-4"
              strokeWidth={1}
            />
            <h3 className="font-semibold mb-1">No system prompts yet</h3>
            <p className="text-base-content/40 text-sm mb-6 max-w-xs mx-auto">
              System prompts define your agent's behaviour, tone, and capabilities.
            </p>
            <button onClick={openCreate} className="btn btn-primary btn-sm gap-2">
              <Plus size={14} />
              Create your first prompt
            </button>
          </div>
        )}

        {/* Prompt list */}
        {!loading && prompts.length > 0 && (
          <div className="space-y-3">
            {prompts.map((prompt) => {
              const vis = VISIBILITY_OPTIONS.find((o) => o.value === (prompt.visibility ?? 'private'))
              const VisIcon = vis.icon
              return (
                <div
                  key={prompt.id}
                  className="bg-white border border-base-300 rounded-xl p-5 transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-sm">{prompt.name}</h3>
                        <span className="flex items-center gap-1 text-xs text-base-content/40 ml-auto">
                          <VisIcon size={11} />
                          {vis.label}
                        </span>
                      </div>
                      <p className="text-sm text-base-content/50 leading-relaxed font-mono bg-base-50 rounded-lg p-3 whitespace-pre-wrap line-clamp-4">
                        {prompt.content}
                      </p>
                      <p className="text-xs text-base-content/30 mt-2">
                        {prompt.content.length} chars
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(prompt)}
                        className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content"
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(prompt.id)}
                        disabled={deletingId === prompt.id}
                        className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error hover:bg-error/10"
                        title="Delete"
                      >
                        {deletingId === prompt.id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <PromptModal
          prompt={editingPrompt}
          onClose={() => {
            setModalOpen(false)
            setEditingPrompt(null)
          }}
          onSave={handleSave}
        />
      )}
    </Layout>
  )
}