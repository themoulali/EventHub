import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'

const API_URL = '/api'

function getStoredToken() {
  return localStorage.getItem('eventhub_token')
}

function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <Link
          to="/"
          className="mb-2 block text-center text-sm font-semibold uppercase tracking-widest text-indigo-600"
        >
          EventHub
        </Link>

        <h1 className="mb-2 text-center text-3xl font-bold text-slate-900">
          {title}
        </h1>

        <p className="mb-6 text-center text-sm text-slate-600">
          {subtitle}
        </p>

        {children}
      </section>
    </main>
  )
}

function Home() {
  return (
    <AuthLayout
      title="Discover your next event"
      subtitle="Find technology conferences and manage your event experience."
    >
      <div className="grid gap-3">
        <Link
          to="/login"
          className="rounded-lg bg-indigo-600 px-4 py-3 text-center font-semibold text-white hover:bg-indigo-700"
        >
          Sign in
        </Link>

        <Link
          to="/register"
          className="rounded-lg border border-slate-300 px-4 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50"
        >
          Create an account
        </Link>
      </div>
    </AuthLayout>
  )
}

function Register() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'attendee',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Registration failed.')
      }

      navigate('/login', {
        state: { message: 'Registration successful. Please sign in.' },
      })
    } catch (err) {
      setError(err.message || 'Unable to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join EventHub as an attendee or organizer."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            Full name
          </label>
          <input
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            minLength={2}
            maxLength={80}
            autoComplete="name"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="register-email" className="mb-1 block text-sm font-medium">
            Email address
          </label>
          <input
            id="register-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="register-password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <input
            id="register-password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            minLength={8}
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            Use at least 8 characters.
          </p>
        </div>

        <div>
          <label htmlFor="role" className="mb-1 block text-sm font-medium">
            Account type
          </label>
          <select
            id="role"
            name="role"
            value={form.role}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500"
          >
            <option value="attendee">Attendee</option>
            <option value="organizer">Organizer</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok || !data.success || !data.token) {
        throw new Error(data.message || 'Login failed.')
      }

      localStorage.setItem('eventhub_token', data.token)

      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Unable to connect to the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to EventHub."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="mb-1 block text-sm font-medium">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        New to EventHub?{' '}
        <Link to="/register" className="font-semibold text-indigo-600 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}

function Dashboard({ allowedRole }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadProfile() {
      const token = getStoredToken()

      if (!token) {
        navigate('/login', { replace: true })
        return
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Your session is no longer valid.')
        }

        if (active) setUser(data.user)
      } catch (err) {
        localStorage.removeItem('eventhub_token')
        if (active) {
          setError(err.message || 'Unable to load your profile.')
          navigate('/login', { replace: true })
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [navigate])

  function handleLogout() {
    localStorage.removeItem('eventhub_token')
    navigate('/login', { replace: true })
  }

  if (loading) {
    return <main className="p-8 text-center">Loading your profile...</main>
  }

  if (error || !user) return null

if (allowedRole && user.role !== allowedRole) {
  return (
    <Navigate
      to={user.role === 'organizer' ? '/organizer' : '/attendee'}
      replace
    />
  )
}

const isOrganizer = user.role === 'organizer'

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-white px-6 py-4 shadow-sm">
        <Link to="/" className="text-xl font-bold text-indigo-600">
          EventHub
        </Link>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
            {user.name} · {isOrganizer ? 'Organizer' : 'Attendee'}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-4xl p-6 sm:p-10">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-600">
            {isOrganizer ? 'Organizer portal' : 'Attendee portal'}
          </p>

          <h1 className="mb-3 text-3xl font-bold text-slate-900">
            Welcome, {user.name}!
          </h1>

          {isOrganizer ? (
            <p className="text-slate-600">
              Your organizer dashboard is ready for event creation and management.
              Those features will be added in the upcoming project steps.
            </p>
          ) : (
            <p className="text-slate-600">
              Your attendee dashboard is ready for event discovery and ticket
              reservations. Those features will be added in the upcoming project steps.
            </p>
          )}

          <div className="mt-6 rounded-xl bg-indigo-50 p-4">
            <p className="font-semibold text-indigo-900">Signed-in account</p>
            <p className="mt-1 text-sm text-indigo-800">{user.email}</p>
            <p className="mt-1 text-sm text-indigo-800">
              Role: {user.role}
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

function ProtectedRoute({ allowedRole }) {
  return (
    <Dashboard allowedRole={allowedRole} />
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute />
          }
        />

        <Route
          path="/attendee"
          element={
            <ProtectedRoute allowedRole="attendee" />
          }
        />

        <Route
          path="/organizer"
          element={
            <ProtectedRoute allowedRole="organizer" />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App