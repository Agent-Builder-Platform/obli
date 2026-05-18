import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, ArrowRight, Users, Building2 } from 'lucide-react'
import { api } from '../lib/api'

const USE_TYPES = [
  { value: 'team', label: 'Team', icon: Users, desc: 'Small group or department' },
  { value: 'enterprise', label: 'Enterprise', icon: Building2, desc: 'Company-wide rollout' },
]

const TEAM_SIZES = [
  '2–5', '6–10', '11–25', '26–50', '51–100', '101–250', '250+'
]

export default function SignupPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: '',
    company: '',
    reason: '',
    use_type: '',
    team_size: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.use_type) {
      setError('Please select how you plan to use Obli')
      return
    }
    if (!form.team_size) {
      setError('Please select your team size')
      return
    }

    setLoading(true)
    try {
      await api.waitlist.join({
        name: form.name,
        email: form.email,
        role: form.role || undefined,
        company: form.company || undefined,
        reason: form.reason,
        use_type: form.use_type,
        team_size: form.team_size,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center px-8">
        <div className="text-center max-w-sm">
          <div className="flex justify-center mb-6">
            <CheckCircle size={48} className="text-success" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold mb-2">You're on the list!</h2>
          <p className="text-base-content/50 text-sm mb-6">
            Thanks, <strong>{form.name.split(' ')[0]}</strong>! We'll reach out to{' '}
            <strong>{form.email}</strong> when your spot is ready.
          </p>
          <Link to="/landing" className="btn btn-primary btn-sm gap-2">
            Back to home
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-100 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-black flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="w-9 h-9 object-contain rounded" />
          <span className="text-white font-semibold text-xl tracking-tight">Obli.</span>
        </div>

        <div>
          <h1 className="text-white text-5xl font-light leading-tight mb-6">
            Your team's<br />
            <span className="font-bold">AI, unified.</span>
          </h1>
          <p className="text-white/40 text-lg font-light max-w-sm leading-relaxed">
            Create agents tailored to your workflow. Backed by Claude, GPT, and Gemini.
          </p>
        </div>

        <ul className="space-y-3">
          {[
            'Create agents with custom system prompts',
            'Choose from Claude, OpenAI & Gemini',
            'Share across your organisation',
          ].map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-white/60">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <img src="/logo.png" alt="" className="w-9 h-9 object-contain" />
          <span className="text-base-content font-semibold text-xl tracking-tight">Obli.</span>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-base-content mb-1">Join the waitlist</h2>
            <p className="text-base-content/50 text-sm">
              Early access is limited. Tell us about yourself and we'll be in touch.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="alert alert-error py-3 text-sm">
                <span>{error}</span>
              </div>
            )}

            {/* Name */}
            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                  Full name
                </span>
              </label>
              <input
                type="text"
                className="input input-bordered bg-base-100 focus:border-primary focus:outline-none w-full"
                placeholder="Jane Smith"
                value={form.name}
                onChange={set('name')}
                required
              />
            </div>

            {/* Email */}
            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                  Work email
                </span>
              </label>
              <input
                type="email"
                className="input input-bordered bg-base-100 focus:border-primary focus:outline-none w-full"
                placeholder="you@company.com"
                value={form.email}
                onChange={set('email')}
                required
              />
            </div>

            {/* Role + Company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label pb-1.5">
                  <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                    Job title
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered bg-base-100 focus:border-primary focus:outline-none w-full"
                  placeholder="e.g. Product Manager"
                  value={form.role}
                  onChange={set('role')}
                />
              </div>

              <div className="form-control">
                <label className="label pb-1.5">
                  <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                    Company
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered bg-base-100 focus:border-primary focus:outline-none w-full"
                  placeholder="Acme Inc."
                  value={form.company}
                  onChange={set('company')}
                />
              </div>
            </div>

            {/* Use type */}
            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                  How will you use Obli?
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto w-full">
                {USE_TYPES.map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, use_type: value, team_size: '' }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer text-center ${
                      form.use_type === value
                        ? 'border-primary bg-primary text-white'
                        : 'border-base-300 bg-base-100 hover:border-primary/40'
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.5} />
                    <span className="text-xs font-semibold">{label}</span>
                    <span className={`text-[10px] leading-tight ${form.use_type === value ? 'text-primary-content/70' : 'text-base-content/40'}`}>
                      {desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Team size */}
            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                  Team size
                </span>
              </label>
              <select
                className="select select-bordered bg-base-100 focus:border-primary focus:outline-none w-full"
                value={form.team_size}
                onChange={set('team_size')}
                required
              >
                <option value="" disabled>Select team size</option>
                {TEAM_SIZES.map((s) => (
                  <option key={s} value={s}>{s} people</option>
                ))}
              </select>
            </div>

            {/* Reason */}
            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                  Why do you want to use Obli?
                </span>
              </label>
              <textarea
                className="textarea textarea-bordered bg-base-100 focus:border-primary focus:outline-none w-full resize-none"
                placeholder="Tell us what you're trying to build or solve..."
                rows={3}
                value={form.reason}
                onChange={set('reason')}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full gap-2 font-medium"
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <>
                  Join the waitlist
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-base-content/50">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-base-content font-medium underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
