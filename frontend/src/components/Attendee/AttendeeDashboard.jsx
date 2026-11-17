
import { useEffect, useState } from 'react'
import EventCard from './EventCard'
import EventFilters from './EventFilters'
import SeatSelection from './SeatSelection'

const API_URL = '/api'

function AttendeeDashboard({ user }) {
  const [events, setEvents] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)

  async function loadEvents() {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()

      if (search.trim()) {
        params.set('search', search.trim())
      }

      if (category) {
        params.set('category', category)
      }

      const query = params.toString()
      const url = query
        ? `${API_URL}/events?${query}`
        : `${API_URL}/events`

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load events.')
      }

      setEvents(data.events || [])
    } catch (err) {
      setError(err.message || 'Unable to load events.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [search, category])

  function handleClearFilters() {
    setSearch('')
    setCategory('')
  }

  function handleViewDetails(event) {
    setSelectedEvent(event)
  }

  function handleCloseSeatSelection() {
    setSelectedEvent(null)
  }

  return (
    <section className="mx-auto max-w-6xl space-y-8 p-6 sm:p-10">
      {selectedEvent ? (
        <SeatSelection
          event={selectedEvent}
          onClose={handleCloseSeatSelection}
        />
      ) : (
        <>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Attendee portal
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Welcome, {user.name}!
            </h1>

            <p className="mt-2 text-slate-600">
              Discover technology events and explore upcoming conferences.
            </p>
          </div>

          <EventFilters
            search={search}
            category={category}
            onSearchChange={setSearch}
            onCategoryChange={setCategory}
            onClear={handleClearFilters}
          />

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <p className="py-8 text-center text-slate-600">
              Loading events...
            </p>
          ) : events.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-bold text-slate-800">
                No Events Found
              </h2>
              <p className="mt-2 text-slate-600">
                Try changing your search or category filters.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">
                  Explore Events
                </h2>

                <span className="text-sm text-slate-500">
                  {events.length} event{events.length === 1 ? '' : 's'} found
                </span>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                  <EventCard
                    key={event._id}
                    event={event}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}

export default AttendeeDashboard
