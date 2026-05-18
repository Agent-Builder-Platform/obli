import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { Bot, FileText, Database, Plus, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ agents: 0, prompts: 0, knowledgeBases: 0 })
  const [recentAgents, setRecentAgents] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)

      try {
        const [agentsRes, promptsRes, kbRes] = await Promise.all([
          api.agents.list(),
          api.prompts.list(),
          api.knowledge.listBases(),
        ])
        setStats({
          agents: agentsRes.total ?? agentsRes.agents.length,
          prompts: promptsRes.total ?? promptsRes.prompts.length,
          knowledgeBases:
            kbRes.total ?? (kbRes.knowledge_bases ?? []).length,
        })
        setRecentAgents((agentsRes.agents ?? []).slice(0, 3))
      } catch (err) {
        console.error('Dashboard load error:', err)
      }
      setLoading(false)
    }
    load()
  }, [])

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const PROVIDER_BADGE = {
    anthropic: { label: 'Claude', color: 'bg-orange-100 text-orange-700' },
    openai: { label: 'GPT', color: 'bg-green-100 text-green-700' },
    google: { label: 'Gemini', color: 'bg-blue-100 text-blue-700' },
  }

  function getProviderFromModel(model) {
    if (model?.startsWith('claude')) return 'anthropic'
    if (model?.startsWith('gpt') || model?.startsWith('o')) return 'openai'
    if (model?.startsWith('gemini')) return 'google'
    return null
  }

  return (
    <Layout title="Dashboard">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-base-content">
            {greeting()}{user?.email ? `, ${user.email.split('@')[0]}` : ''}
          </h1>
          <p className="text-base-content/50 text-sm mt-1">
            Here's a snapshot of your workspace.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            {
              label: 'Total Agents',
              value: loading ? '—' : stats.agents,
              icon: Bot,
              href: '/agents',
            },
            {
              label: 'System Prompts',
              value: loading ? '—' : stats.prompts,
              icon: FileText,
              href: '/prompts',
            },
            {
              label: 'Knowledge Bases',
              value: loading ? '—' : stats.knowledgeBases,
              icon: Database,
              href: '/knowledge',
            },
          ].map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.label}
                to={card.href}
                className={`bg-white border border-base-300 rounded-xl p-5 flex items-start gap-4 hover:border-black transition-all group ${
                  card.muted ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                <div className="w-10 h-10 bg-base-200 rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                  <Icon size={18} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs text-base-content/40 uppercase tracking-wider font-medium">
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold mt-0.5">{card.value}</p>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Recent agents */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-base-content/40">
            Recent Agents
          </h2>
          <Link
            to="/agents"
            className="text-xs text-base-content/50 hover:text-base-content flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="loading loading-spinner loading-md opacity-30" />
          </div>
        ) : recentAgents.length === 0 ? (
          <div className="bg-white border border-dashed border-base-300 rounded-xl p-12 text-center">
            <Bot size={32} className="mx-auto text-base-content/20 mb-3" strokeWidth={1} />
            <p className="text-base-content/50 text-sm mb-4">No agents yet</p>
            <Link to="/agents/new" className="btn btn-primary btn-sm gap-2">
              <Plus size={14} />
              Create your first agent
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {recentAgents.map((agent) => {
              const providerKey = getProviderFromModel(agent.model)
              const badge = providerKey ? PROVIDER_BADGE[providerKey] : null
              return (
                <div
                  key={agent.id}
                  className="bg-white border border-base-300 rounded-xl p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{agent.name}</p>
                      {agent.description && (
                        <p className="text-xs text-base-content/40 mt-0.5 line-clamp-2">
                          {agent.description}
                        </p>
                      )}
                    </div>
                    {badge && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ml-2 ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/agents/${agent.id}/chat`)}
                    className="btn btn-primary btn-sm w-full mt-auto"
                  >
                    Talk
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick actions */}
        {!loading && (
          <div className="mt-8 flex gap-3">
            <Link to="/agents/new" className="btn btn-primary btn-sm gap-2">
              <Plus size={14} />
              New Agent
            </Link>
            <Link to="/prompts" className="btn btn-outline btn-sm gap-2">
              <FileText size={14} />
              Manage Prompts
            </Link>
          </div>
        )}
      </div>
    </Layout>
  )
}