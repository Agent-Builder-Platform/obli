import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { Save } from 'lucide-react'

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    bio: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadProfile() {
      setError('')
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setUser(user)
      if (!user) {
        setError('You must be signed in to view your profile.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, bio')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        setError(error.message)
      } else if (data) {
        setForm({
          username: data.username ?? '',
          display_name: data.display_name ?? '',
          bio: data.bio ?? '',
        })
      } else {
        const fallbackName = user.email ? user.email.split('@')[0] : ''
        setForm((prev) => ({ ...prev, display_name: fallbackName }))
      }

      setLoading(false)
    }

    loadProfile()
  }, [])

  function updateField(field) {
    return (e) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!user) {
      setError('You must be signed in to update your profile.')
      return
    }

    const username = form.username.trim()
    const displayName = form.display_name.trim()
    const bio = form.bio.trim()

    if (username && username.length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }

    setSaving(true)
    const payload = {
      id: user.id,
      username: username || null,
      display_name: displayName || null,
      bio: bio || null,
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })

    if (error) {
      setError(error.message)
    } else {
      setSuccess('Profile updated.')
    }

    setSaving(false)
  }

  return (
    <Layout title="Profile">
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-base-content">Profile</h1>
          <p className="text-base-content/50 text-sm mt-1">
            Manage the username and details shown across your workspace.
          </p>
        </div>

        <div className="bg-white border border-base-300 rounded-xl p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="loading loading-spinner loading-md opacity-40" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              {error && (
                <div className="alert alert-error py-3 text-sm">
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="alert alert-success py-3 text-sm">
                  <span>{success}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label pb-1.5">
                    <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                      Username
                    </span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered bg-base-100 focus:border-primary focus:outline-none w-full"
                    placeholder="your-handle"
                    value={form.username}
                    onChange={updateField('username')}
                  />
                  <p className="text-xs text-base-content/40 mt-1">
                    Used for sharing agents. Must be unique.
                  </p>
                </div>

                <div className="form-control">
                  <label className="label pb-1.5">
                    <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                      Display name
                    </span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered bg-base-100 focus:border-primary focus:outline-none w-full"
                    placeholder="Jane Smith"
                    value={form.display_name}
                    onChange={updateField('display_name')}
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label pb-1.5">
                  <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                    Bio
                  </span>
                </label>
                <textarea
                  className="textarea textarea-bordered bg-base-100 focus:border-primary focus:outline-none w-full min-h-[120px]"
                  placeholder="Share a little about yourself"
                  value={form.bio}
                  onChange={updateField('bio')}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="btn btn-primary gap-2"
                  disabled={saving}
                >
                  {saving ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <>
                      <Save size={16} />
                      Save profile
                    </>
                  )}
                </button>
                <span className="text-xs text-base-content/40">
                  Signed in as {user?.email ?? 'unknown'}
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  )
}
