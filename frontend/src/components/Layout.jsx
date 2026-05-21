import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Bot,
  FileText,
  FlaskConical,
  LogOut,
  Menu,
  ChevronRight,
  Database,
} from 'lucide-react'
import Logo from './Logo'

const DEFAULT_AVATAR = '/default_logo.png'

const NAV_ITEMS = [
  { label: 'Your Agents', href: '/agents', icon: Bot },
  { label: 'System Prompt Library', href: '/prompts', icon: FileText },
  { label: 'Knowledge Base', href: '/knowledge', icon: Database },
  // { label: 'Testing', href: '/testing', icon: FlaskConical, comingSoon: true },
]

export default function Layout({ children, title }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR)

  useEffect(() => {
    let isMounted = true

    async function loadAvatar() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      if (!error && data?.avatar_url && isMounted) {
        setAvatarUrl(data.avatar_url)
      }
    }

    loadAvatar()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-black text-white w-64 shrink-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="w-8 h-8 object-contain rounded" />
          <span className="font-semibold text-lg tracking-tight">Obli.</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
        <p className="px-3 mb-2 text-[10px] font-medium uppercase tracking-widest text-white/30">
          Navigation
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all group
                ${
                  isActive
                    ? 'bg-white text-black font-medium'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }
                ${item.comingSoon ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}
              `}
              onClick={(e) => item.comingSoon && e.preventDefault()}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              <span className="flex-1">{item.label}</span>
              {item.comingSoon && (
                <span className="text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded font-mono">
                  soon
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-white transition-all"
        >
          <LogOut size={16} strokeWidth={2} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-base-200 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 flex">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-base-300 px-6 py-4 flex items-center gap-4 shrink-0">
          <button
            className="md:hidden btn btn-ghost btn-sm btn-square"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2 text-sm text-base-content/40">
            <span>Obli.</span>
            <ChevronRight size={14} />
            <span className="text-base-content font-medium">{title}</span>
          </div>

          <div className="ml-auto">
            <Link
              to="/profile"
              className="w-9 h-9 rounded-full flex items-center justify-center"
              aria-label="Profile"
              title="Profile"
            >
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-7 h-7 rounded-full bg-white object-cover"
                onError={() => setAvatarUrl(DEFAULT_AVATAR)}
              />
            </Link>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">{children}</div>
      </main>
    </div>
  )
}