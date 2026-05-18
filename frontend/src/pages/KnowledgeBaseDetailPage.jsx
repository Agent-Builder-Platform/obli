import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import Layout from '../components/Layout'
import {
  UploadCloud,
  FileText,
  Trash2,
  Loader2,
  Layers,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Database,
} from 'lucide-react'

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export default function KnowledgeBaseDetailPage() {
  const { kbId } = useParams()
  const [kb, setKb] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    load()
  }, [kbId])

  async function load() {
    try {
      const res = await api.knowledge.getBase(kbId)
      setKb(res.knowledge_base)
      setDocuments(res.documents ?? [])
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(Boolean)
    if (files.length === 0) return
    setUploading(true)
    setError('')
    setNotice(null)
    try {
      const res = await api.knowledge.uploadDocuments(kbId, files)
      const uploaded = res.uploaded ?? []
      const failed = res.failed ?? []
      if (uploaded.length) {
        setDocuments((prev) => [...uploaded, ...prev])
      }
      if (failed.length) {
        setNotice({
          kind: 'warn',
          text: `${uploaded.length} uploaded, ${failed.length} failed: ${failed
            .map((f) => `${f.filename} (${f.error})`)
            .join('; ')}`,
        })
      } else {
        setNotice({
          kind: 'ok',
          text: `Uploaded ${uploaded.length} document${uploaded.length === 1 ? '' : 's'}.`,
        })
      }
    } catch (err) {
      setError(err.message)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDelete(id) {
    if (!confirm('Delete this document? Its chunks will be removed from the knowledge base.'))
      return
    setDeletingId(id)
    try {
      await api.knowledge.deleteDocument(id)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      setError(err.message)
    }
    setDeletingId(null)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files)
  }

  return (
    <Layout title={kb ? kb.name : 'Knowledge Base'}>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <Link
          to="/knowledge"
          className="inline-flex items-center gap-1 text-xs text-base-content/40 hover:text-base-content mb-4"
        >
          <ChevronLeft size={14} />
          All knowledge bases
        </Link>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-md opacity-30" />
          </div>
        ) : (
          <>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Database size={22} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold">{kb?.name}</h1>
                {kb?.description && (
                  <p className="text-sm text-base-content/50 mt-1">{kb.description}</p>
                )}
                <p className="text-xs text-base-content/40 mt-1">
                  {documents.length} document{documents.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-10 text-center transition-all
                ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-base-300 bg-white hover:border-primary/40'
                }
                ${uploading ? 'opacity-60 cursor-wait' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md,.markdown,.docx,.doc"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              {uploading ? (
                <Loader2
                  size={36}
                  className="mx-auto mb-3 animate-spin text-base-content/40"
                  strokeWidth={1.5}
                />
              ) : (
                <UploadCloud
                  size={36}
                  className="mx-auto mb-3 text-base-content/30"
                  strokeWidth={1.5}
                />
              )}
              <p className="font-medium text-sm">
                {uploading ? 'Uploading and indexing…' : 'Drop files here or click to upload'}
              </p>
              <p className="text-xs text-base-content/40 mt-1">
                PDF, TXT, MD, DOCX — multi-file supported
              </p>
            </div>

            {error && (
              <div className="alert alert-error mt-4 text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            {notice && !error && (
              <div
                className={`alert mt-4 text-sm ${
                  notice.kind === 'ok' ? 'alert-success' : 'alert-warning'
                }`}
              >
                {notice.kind === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{notice.text}</span>
              </div>
            )}

            {/* Documents */}
            <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-base-content/50 mb-3">
                Documents
              </h2>

              {documents.length === 0 ? (
                <div className="bg-white border border-dashed border-base-300 rounded-xl py-12 text-center">
                  <FileText
                    size={32}
                    className="mx-auto text-base-content/15 mb-2"
                    strokeWidth={1}
                  />
                  <p className="font-medium text-sm">No documents yet</p>
                  <p className="text-base-content/40 text-xs mt-1">
                    Drop files above to populate this knowledge base.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white border border-base-300 rounded-xl px-4 py-3 flex items-center gap-4"
                    >
                      <FileText
                        size={18}
                        className="text-base-content/30 shrink-0"
                        strokeWidth={1.75}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">
                            {doc.filename}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-base-200 text-base-content/60">
                            v{doc.version}
                          </span>
                          {doc.is_latest ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-success/10 text-success">
                              latest
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-base-200 text-base-content/40">
                              superseded
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-base-content/40">
                          <span className="flex items-center gap-1">
                            <Layers size={11} />
                            {doc.num_chunks} chunks
                          </span>
                          <span>{formatBytes(doc.byte_size)}</span>
                          <span>{new Date(doc.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error hover:bg-error/10"
                        title="Delete"
                      >
                        {deletingId === doc.id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
