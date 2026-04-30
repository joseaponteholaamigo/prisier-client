import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true'

const DEMO_USERS = [
  { label: 'Cliente — Editor', email: 'editor@congrupo.com', password: '123456', role: 'cliente_editor' },
  { label: 'Cliente — Visualizador', email: 'visualizador@congrupo.com', password: '123456', role: 'cliente_visualizador' },
]

export default function LoginPage() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch {
      setError('Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-p-bg flex items-center justify-center px-4">
      <div className="glass-panel p-10 w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-block bg-white border border-white/20 rounded-xl px-4 py-2 mb-3">
            <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Prisier" className="h-10 object-contain" />
          </div>
          <p className="text-p-muted text-sm">Portal Cliente</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="badge-red px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-p-muted uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input w-full"
              placeholder="tu@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-p-muted uppercase tracking-wider mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input w-full"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center h-12 text-base disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {MOCK_MODE && (
          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-xs font-semibold text-p-muted uppercase tracking-wider mb-3">
              Acceso rápido (modo demo)
            </p>
            <div className="space-y-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => { setEmail(u.email); setPassword(u.password) }}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left"
                >
                  <span className="text-sm text-p-text font-medium">{u.label}</span>
                  <span className="text-xs text-p-muted">{u.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
