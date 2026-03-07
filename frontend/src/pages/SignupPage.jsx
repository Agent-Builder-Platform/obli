import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react'

export default function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSignup(e) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center px-8">
        <div className="text-center max-w-sm">
          <div className="flex justify-center mb-6">
            <CheckCircle size={48} className="text-success" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Check your email</h2>
          <p className="text-base-content/50 text-sm mb-6">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account.
          </p>
          <Link to="/login" className="btn btn-primary btn-sm gap-2">
            Back to sign in
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
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
            <span className="text-black font-black text-base tracking-tighter">O</span>
          </div>
          <span className="text-white font-semibold text-xl tracking-tight">obli</span>
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
          <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
            <span className="text-white font-black text-base tracking-tighter">O</span>
          </div>
          <span className="text-base-content font-semibold text-xl tracking-tight">obli</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-base-content mb-1">Create your account</h2>
            <p className="text-base-content/50 text-sm">Get started with Obli today</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="alert alert-error py-3 text-sm">
                <span>{error}</span>
              </div>
            )}

            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                  Work email
                </span>
              </label>
              <input
                type="email"
                className="input input-bordered bg-base-100 focus:border-black focus:outline-none w-full"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                  Password
                </span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input input-bordered bg-base-100 focus:border-black focus:outline-none w-full pr-12"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                  Confirm password
                </span>
              </label>
              <input
                type="password"
                className="input input-bordered bg-base-100 focus:border-black focus:outline-none w-full"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mt-2 gap-2 font-medium"
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <>
                  Create account
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