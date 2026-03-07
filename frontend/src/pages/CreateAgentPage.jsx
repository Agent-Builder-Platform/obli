import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import Layout from '../components/Layout'
import { ArrowLeft, Plus, X, Check, ChevronDown, Bot } from 'lucide-react'

const PROVIDER_LABELS = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
}

export default function CreateAgentPage() {
  const navigate = useNavigate()

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedPromptIds, setSelectedPromptIds] = useState([])
  const [visibility, setVisibility] = useState('private')

  // Data
  const [models, setModels] = useState([])
  const [groupedModels, setGroupedModels] = useState({})
  const [prompts, setPrompts] = useState([])

  // UI
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState('')
  const [promptDropdownOpen, setPromptDropdownOpen] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [modelsRes, promptsRes] = await Promise.all([
          api.models.list(),
          api.prompts.list(),
        ])
        setModels(modelsRes.models ?? [])
        setGroupedModels(modelsRes.grouped ?? {})
        setPrompts(promptsRes.prompts ?? [])

        // Select first model by default
        if (modelsRes.models?.length > 0) {
          setSelectedModel(modelsRes.models[0].id)
        }
      } catch (err) {
        setError('Failed to load data: ' + err.message)
      }
      setDataLoading(false)
    }
    loadData()
  }, [])

  function togglePrompt(id) {
    setSelectedPromptIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Agent name is required')
      return
    }
    if (!selectedModel) {
      setError('Please select a model')
      return
    }

    setError('')
    setLoading(true)

    try {
      const res = await api.agents.create({
        name: name.trim(),
        description: description.trim() || null,
        model: selectedModel,
        system_prompt_ids: selectedPromptIds,
        visibility,
      })
      navigate(`/agents/${res.agent.id}/chat`)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const selectedPromptsData = prompts.filter((p) => selectedPromptIds.includes(p.id))

  return (
    <Layout title="Create Agent">
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate('/agents')}
          className="btn btn-ghost btn-sm gap-2 mb-6 -ml-2 text-base-content/50 hover:text-base-content"
        >
          <ArrowLeft size={15} />
          Back to agents
        </button>

        <div className="mb-6">
          <h1 className="text-xl font-bold">Create Agent</h1>
          <p className="text-base-content/50 text-sm mt-1">
            Configure your AI agent's identity and capabilities.
          </p>
        </div>

        {error && (
          <div className="alert alert-error mb-4 text-sm">
            <span>{error}</span>
          </div>
        )}

        {dataLoading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-md opacity-30" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                  Agent Name <span className="text-error">*</span>
                </span>
              </label>
              <input
                type="text"
                className="input input-bordered bg-white focus:border-black focus:outline-none w-full"
                placeholder="e.g. Customer Support Agent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
              />
            </div>

            {/* Description */}
            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                  Description
                </span>
                <span className="label-text-alt text-base-content/30">Optional</span>
              </label>
              <textarea
                className="textarea textarea-bordered bg-white focus:border-black focus:outline-none w-full resize-none"
                placeholder="What does this agent do?"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
              />
            </div>

            {/* Model */}
            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                  Model <span className="text-error">*</span>
                </span>
              </label>

              <div className="space-y-3">
                {Object.entries(groupedModels).map(([provider, providerModels]) => (
                  <div key={provider}>
                    <p className="text-xs text-base-content/30 uppercase tracking-widest mb-2 font-medium">
                      {PROVIDER_LABELS[provider] ?? provider}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {providerModels.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => setSelectedModel(model.id)}
                          className={`text-left p-3 rounded-lg border text-sm transition-all
                            ${
                              selectedModel === model.id
                                ? 'border-black bg-black text-white'
                                : 'border-base-300 bg-white hover:border-black/40'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-medium">{model.name}</span>
                            {selectedModel === model.id && (
                              <Check size={13} strokeWidth={3} />
                            )}
                          </div>
                          <p
                            className={`text-xs leading-relaxed ${
                              selectedModel === model.id
                                ? 'text-white/60'
                                : 'text-base-content/40'
                            }`}
                          >
                            {model.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Prompts */}
            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                  System Prompts
                </span>
                <span className="label-text-alt text-base-content/30">Optional</span>
              </label>

              {prompts.length === 0 ? (
                <div className="text-sm text-base-content/40 border border-dashed border-base-300 rounded-lg p-4 text-center">
                  No system prompts yet.{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/prompts')}
                    className="underline hover:text-base-content transition-colors"
                  >
                    Create one first
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPromptDropdownOpen(!promptDropdownOpen)}
                    className="input input-bordered bg-white w-full text-left flex items-center justify-between focus:border-black focus:outline-none"
                  >
                    <span className="text-sm text-base-content/60">
                      {selectedPromptIds.length === 0
                        ? 'Select system prompts...'
                        : `${selectedPromptIds.length} selected`}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-base-content/40 transition-transform ${
                        promptDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {promptDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-base-300 rounded-lg shadow-lg overflow-hidden">
                      <div className="max-h-52 overflow-y-auto scrollbar-thin">
                        {prompts.map((prompt) => {
                          const isSelected = selectedPromptIds.includes(prompt.id)
                          return (
                            <button
                              key={prompt.id}
                              type="button"
                              onClick={() => togglePrompt(prompt.id)}
                              className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-base-100 transition-colors text-sm border-b border-base-200 last:border-0
                                ${isSelected ? 'bg-base-100' : ''}
                              `}
                            >
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all
                                  ${
                                    isSelected
                                      ? 'bg-black border-black'
                                      : 'border-base-300'
                                  }`}
                              >
                                {isSelected && (
                                  <Check size={10} strokeWidth={3} className="text-white" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="font-medium truncate block">{prompt.name}</span>
                                <span className="text-xs text-base-content/40 truncate block">
                                  {prompt.content.slice(0, 60)}...
                                </span>
                              </div>
                              {!prompt.is_active && (
                                <span className="text-xs text-base-content/30 shrink-0">disabled</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Selected chips */}
              {selectedPromptsData.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedPromptsData.map((p) => (
                    <span
                      key={p.id}
                      className="flex items-center gap-1.5 bg-black text-white text-xs px-2.5 py-1 rounded-full"
                    >
                      {p.name}
                      <button
                        type="button"
                        onClick={() => togglePrompt(p.id)}
                        className="hover:opacity-70 transition-opacity"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Visibility */}
            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/50">
                  Visibility
                </span>
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'private', label: 'Private' },
                  { value: 'team', label: 'Team' },
                  { value: 'public', label: 'Public' },
                ].map((opt) => (
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
                {visibility === 'private' && 'Only you can see and use this agent.'}
                {visibility === 'team' && 'Everyone in your organisation can use this agent.'}
                {visibility === 'public' && 'Anyone with the link can use this agent.'}
              </p>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary flex-1 gap-2"
              >
                {loading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <>
                    <Bot size={16} />
                    Create Agent
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/agents')}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  )
}