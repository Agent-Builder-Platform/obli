import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import Layout from '../components/Layout'
import {
  Database,
  Plus,
  Trash2,
  FileText,
  ChevronRight,
  X,
  Check,
  AlertCircle,
} from 'lucide-react'

function CreateModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description: description.trim() || null })
      onClose()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-200">
          <h3 className="font-semibold">New Knowledge Base</h3>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-xs btn-square text-base-content/40"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="alert alert-error text-sm py-2">
              <span>{error}</span>
            </div>
          )}
          <div className="form-control">
            <label className="label pb-1.5">
              <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                Name
              </span>
            </label>
            <input
              type="text"
              className="input input-bordered bg-white focus:border-primary focus:outline-none w-full"
              placeholder="e.g. Product Docs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-control">
            <label className="label pb-1.5">
              <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                Description (optional)
              </span>
            </label>
            <textarea
              className="textarea textarea-bordered bg-white focus:border-primary focus:outline-none w-full resize-none"
              rows={3}
              placeholder="What lives in this knowledge base?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn btn-primary flex-1 gap-2">
              {saving ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <>
                  <Check size={15} />
                  Create
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

export default function KnowledgeBasePage() {
  const [bases, setBases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const res = await api.knowledge.listBases()
      setBases(res.knowledge_bases ?? [])
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleCreate(data) {
    const res = await api.knowledge.createBase(data)
    setBases((prev) => [res.knowledge_base, ...prev])
  }

  async function handleDelete(id) {
    if (
      !confirm(
        'Delete this knowledge base? All documents and chunks will be permanently removed.'
      )
    )
      return
    setDeletingId(id)
    try {
      await api.knowledge.deleteBase(id)
      setBases((prev) => prev.filter((b) => b.id !== id))
    } catch (err) {
      setError(err.message)
    }
    setDeletingId(null)
  }

  return (
    <Layout title="Knowledge Base">
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold">Knowledge Bases</h1>
            <p className="text-base-content/50 text-sm mt-0.5">
              {bases.length} knowledge base{bases.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="btn btn-primary gap-2 self-start sm:self-auto"
          >
            <Plus size={16} />
            New Knowledge Base
          </button>
        </div>

        {error && (
          <div className="alert alert-error mb-4 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-md opacity-30" />
          </div>
        )}

        {!loading && bases.length === 0 && (
          <div className="bg-white border border-dashed border-base-300 rounded-xl py-20 text-center">
            <Database
              size={40}
              className="mx-auto text-base-content/15 mb-4"
              strokeWidth={1}
            />
            <h3 className="font-semibold mb-1">No knowledge bases yet</h3>
            <p className="text-base-content/40 text-sm mb-6 max-w-xs mx-auto">
              Create a knowledge base to group documents you want your agents to draw on.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="btn btn-primary btn-sm gap-2"
            >
              <Plus size={14} />
              Create your first KB
            </button>
          </div>
        )}

        {!loading && bases.length > 0 && (
          <div className="space-y-3">
            {bases.map((kb) => (
              <div
                key={kb.id}
                className="bg-white border border-base-300 rounded-xl p-5 transition-all hover:border-primary/30 group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Database size={18} strokeWidth={1.75} />
                  </div>
                  <Link to={`/knowledge/${kb.id}`} className="flex-1 min-w-0 block">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate">{kb.name}</h3>
                    </div>
                    {kb.description && (
                      <p className="text-sm text-base-content/50 mt-1 line-clamp-2">
                        {kb.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-base-content/40">
                      <span className="flex items-center gap-1">
                        <FileText size={11} />
                        {kb.document_count} document
                        {kb.document_count === 1 ? '' : 's'}
                      </span>
                      <span>{new Date(kb.created_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleDelete(kb.id)}
                      disabled={deletingId === kb.id}
                      className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error hover:bg-error/10"
                      title="Delete"
                    >
                      {deletingId === kb.id ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                    <Link
                      to={`/knowledge/${kb.id}`}
                      className="btn btn-ghost btn-xs btn-square text-base-content/40 group-hover:text-primary"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <CreateModal onClose={() => setModalOpen(false)} onSave={handleCreate} />
      )}
    </Layout>
  )
}
