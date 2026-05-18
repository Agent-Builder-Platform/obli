import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import Layout from '../components/Layout'
import {
  Bot,
  Plus,
  MessageSquare,
  Trash2,
  Globe,
  Lock,
  Users,
  Search,
} from 'lucide-react'

const PROVIDER_INFO = {
  anthropic: { label: 'Claude', dot: 'bg-orange-400' },
  openai: { label: 'GPT', dot: 'bg-green-400' },
  google: { label: 'Gemini', dot: 'bg-blue-400' },
}

function getProvider(model) {
  if (model?.startsWith('claude')) return 'anthropic'
  if (model?.startsWith('gpt') || model?.startsWith('o3') || model?.startsWith('o1')) return 'openai'
  if (model?.startsWith('gemini')) return 'google'
  return null
}

const VISIBILITY_ICONS = {
  private: { icon: Lock, label: 'Private' },
  team: { icon: Users, label: 'Team' },
  public: { icon: Globe, label: 'Public' },
}

export default function ManageAgentsPage() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAgents()
  }, [])

  async function loadAgents() {
    try {
      const res = await api.agents.list()
      setAgents(res.agents ?? [])
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleDelete(agentId, e) {
    e.stopPropagation()
    if (!confirm('Delete this agent? This cannot be undone.')) return
    setDeletingId(agentId)
    try {
      await api.agents.delete(agentId)
      setAgents((prev) => prev.filter((a) => a.id !== agentId))
    } catch (err) {
      setError(err.message)
    }
    setDeletingId(null)
  }

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout title="Your Agents">
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold">Manage Your Agents</h1>
            <p className="text-base-content/50 text-sm mt-0.5">
              {agents.length} agent{agents.length !== 1 ? 's' : ''} in your workspace
            </p>
          </div>
          <Link to="/agents/new" className="btn btn-primary gap-2 self-start sm:self-auto">
            <Plus size={16} />
            Create Agent
          </Link>
        </div>

        {/* Search */}
        {agents.length > 0 && (
          <div className="relative mb-6">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/30"
            />
            <input
              type="text"
              placeholder="Search agents..."
              className="input input-bordered w-full sm:max-w-xs pl-10 bg-white focus:border-primary focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {error && (
          <div className="alert alert-error mb-4 text-sm">
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <span className="loading loading-spinner loading-md opacity-30" />
          </div>
        )}

        {/* Empty state */}
        {!loading && agents.length === 0 && (
          <div className="bg-white border border-dashed border-base-300 rounded-xl py-20 text-center">
            <Bot size={40} className="mx-auto text-base-content/15 mb-4" strokeWidth={1} />
            <h3 className="font-semibold mb-1">No agents yet</h3>
            <p className="text-base-content/40 text-sm mb-6 max-w-xs mx-auto">
              Create your first AI agent with a custom model and system prompts.
            </p>
            <Link to="/agents/new" className="btn btn-primary btn-sm gap-2">
              <Plus size={14} />
              Create your first agent
            </Link>
          </div>
        )}

        {/* Agent grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((agent) => {
              const providerKey = getProvider(agent.model)
              const provider = providerKey ? PROVIDER_INFO[providerKey] : null
              const vis = VISIBILITY_ICONS[agent.visibility] ?? VISIBILITY_ICONS.private
              const VisIcon = vis.icon

              return (
                <div
                  key={agent.id}
                  className="bg-white border border-base-300 rounded-xl p-5 flex flex-col gap-4 hover:border-black/30 hover:shadow-sm transition-all"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {provider && (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${provider.dot}`} />
                        )}
                        <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
                      </div>

                      {agent.description ? (
                        <p className="text-xs text-base-content/50 line-clamp-2 leading-relaxed">
                          {agent.description}
                        </p>
                      ) : (
                        <p className="text-xs text-base-content/25 italic">No description</p>
                      )}
                    </div>

                    <button
                      onClick={(e) => handleDelete(agent.id, e)}
                      disabled={deletingId === agent.id}
                      className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error hover:bg-error/10 shrink-0"
                    >
                      {deletingId === agent.id ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-base-content/40">
                    <span className="bg-base-200 px-2 py-0.5 rounded font-mono">
                      {agent.model}
                    </span>
                    <span className="flex items-center gap-1 ml-auto">
                      <VisIcon size={11} />
                      {vis.label}
                    </span>
                  </div>

                  {/* System prompts count */}
                  {(agent.system_prompt_ids ?? []).length > 0 && (
                    <p className="text-xs text-base-content/40">
                      {agent.system_prompt_ids.length} system prompt
                      {agent.system_prompt_ids.length !== 1 ? 's' : ''}
                    </p>
                  )}

                  {/* Action */}
                  <button
                    onClick={() => navigate(`/agents/${agent.id}/chat`)}
                    className="btn btn-primary btn-sm w-full gap-2 mt-auto"
                  >
                    <MessageSquare size={14} />
                    Talk
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* No search results */}
        {!loading && agents.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 text-base-content/40 text-sm">
            No agents match "{search}"
          </div>
        )}
      </div>
    </Layout>
  )
}