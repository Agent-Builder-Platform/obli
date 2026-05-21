import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { Save } from 'lucide-react'

const DEFAULT_AVATAR = '/default_logo.png'
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const MAX_AVATAR_DIMENSION = 512

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    avatar_url: '',
    bio: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
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
        .select('username, display_name, avatar_url, bio')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        setError(error.message)
      } else if (data) {
        setForm({
          username: data.username ?? '',
          display_name: data.display_name ?? '',
          avatar_url: data.avatar_url ?? '',
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

  async function resizeAvatar(file) {
    const image = await createImageBitmap(file)
    const maxSide = Math.max(image.width, image.height)
    const scale = maxSide > MAX_AVATAR_DIMENSION ? MAX_AVATAR_DIMENSION / maxSide : 1
    const width = Math.round(image.width * scale)
    const height = Math.round(image.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Unable to process the image.')
    }

    ctx.drawImage(image, 0, 0, width, height)

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    )

    if (!blob) {
      throw new Error('Unable to process the image.')
    }

    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
  }

  function updateField(field) {
    return (e) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setSuccess('')

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Please choose a PNG or JPEG image.')
      e.target.value = ''
      return
    }

    if (!user) {
      setError('You must be signed in to update your profile.')
      e.target.value = ''
      return
    }

    setAvatarUploading(true)

    try {
      const resized = await resizeAvatar(file)
      if (resized.size > MAX_AVATAR_BYTES) {
        setError('Image is too large after resizing. Please choose a smaller file.')
        return
      }

      const filePath = `${user.id}/avatar.jpg`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, resized, {
          upsert: true,
          contentType: resized.type,
          cacheControl: '3600',
        })

      if (uploadError) {
        setError(uploadError.message)
        return
      }

      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)
      const avatarUrl = publicData?.publicUrl
        ? `${publicData.publicUrl}?v=${Date.now()}`
        : ''

      if (!avatarUrl) {
        setError('Unable to load the uploaded image.')
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, avatar_url: avatarUrl }, { onConflict: 'id' })

      if (profileError) {
        setError(profileError.message)
        return
      }

      setForm((prev) => ({ ...prev, avatar_url: avatarUrl }))
      setSuccess('Profile photo updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!user) {
      setError('Signed in to update your profile.')
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
      avatar_url: form.avatar_url || null,
      bio: bio || null,
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })

    //Ensures that the user's username is unqiue
    if (error) {
      if (error.code === '23505') {
        setError('That username is already taken.')
      } else {
        setError(error.message)
      }
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

              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center overflow-hidden">
                  <img
                    src={form.avatar_url || DEFAULT_AVATAR}
                    alt="Profile avatar"
                    className="w-16 h-16 object-cover rounded-md bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className={`btn btn-outline btn-sm ${avatarUploading ? 'btn-disabled' : ''}`}
                    htmlFor="avatar-upload"
                  >
                    {avatarUploading ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      'Upload photo'
                    )}
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={handleAvatarChange}
                    disabled={avatarUploading}
                  />
                  <p className="text-xs text-base-content/40">
                    PNG or JPG, up to 2MB. Large images will be resized.
                  </p>
                </div>
              </div>

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
                    Must be unique.
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
