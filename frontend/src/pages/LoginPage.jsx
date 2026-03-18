import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      navigate('/')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-base-100 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-black flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
            <span className="text-black font-black text-base tracking-tighter">O</span>
          </div>
          <span className="text-white font-semibold text-xl tracking-tight">obli</span>
        </div>

        <div>
          <h1 className="text-white text-5xl font-light leading-tight mb-6">
            Your team's AI agents,<br />
            <span className="font-bold">all in one place.</span>
          </h1>
          <p className="text-white/40 text-lg font-light max-w-sm leading-relaxed">
            The internal platform for building, deploying, testing and sharing AI agents across your organisation without the chaos of everyone using different tools and fears of data misuse.
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-white text-2xl font-bold">3</p>
            <p className="text-white/40 text-xs uppercase tracking-widest mt-1">AI Providers</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-white text-2xl font-bold">∞</p>
            <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Agents</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-white text-2xl font-bold">1</p>
            <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Platform</p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
            <span className="text-white font-black text-base tracking-tighter">O</span>
          </div>
          <span className="text-base-content font-semibold text-xl tracking-tight">obli</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-base-content mb-1">Welcome back</h2>
            <p className="text-base-content/50 text-sm">Sign in to your workspace</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="alert alert-error py-3 text-sm">
                <span>{error}</span>
              </div>
            )}

            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                  Email address
                </span>
              </label>
              <input
                type="email"
                className="input input-bordered bg-base-100 focus:border-black focus:outline-none w-full"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
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

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mt-2 gap-2 font-medium"
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-base-content/50">
            New to Obli?{' '}
            <Link
              to="/signup"
              className="text-base-content font-medium underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}