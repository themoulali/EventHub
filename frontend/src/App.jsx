function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-xl rounded-2xl bg-white p-8 text-center shadow-xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">
          Tech Conference Platform
        </p>

        <h1 className="mb-4 text-4xl font-bold text-slate-900">
          Welcome to EventHub
        </h1>

        <p className="mb-6 text-slate-600">
          Discover technology conferences, reserve seats, and manage your event tickets.
        </p>

        <button
          type="button"
          className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700"
        >
          Explore Events
        </button>

        <p className="mt-6 text-sm font-medium text-green-700">
          Tailwind CSS verification test
        </p>
      </section>
    </main>
  )
}

export default App