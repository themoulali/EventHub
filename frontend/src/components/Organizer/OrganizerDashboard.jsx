import { useCallback, useEffect, useState } from 'react'
import EventForm from './EventForm'
import EventList from './EventList'
import CheckInScanner from './CheckInScanner'
import { API_URL } from '../../config/api'

function getOrganizerId(organizer) {
  if (!organizer) return null

  return typeof organizer === 'object'
    ? organizer._id || organizer.id
    : organizer
}

function OrganizerDashboard({ user, token }) {
  const [events, setEvents] = useState([])
  const [editingEvent, setEditingEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadEvents = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/events`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load events.')
      }

      const organizerEvents = (data.events || []).filter(
        (event) =>
          String(getOrganizerId(event.organizer)) ===
          String(user._id || user.id)
      )

      setError('')
      setEvents(organizerEvents)
    } catch (err) {
      setError(err.message || 'Unable to load events.')
    } finally {
      setLoading(false)
    }
  }, [user._id, user.id])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEvents()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadEvents])

  async function handleSubmit(eventData) {
    setSubmitting(true)
    setError('')
    setMessage('')

    const isEditing = Boolean(editingEvent)

    try {
      const url = isEditing
        ? `${API_URL}/events/${editingEvent._id}`
        : `${API_URL}/events`

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(eventData),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to save event.')
      }

      setEditingEvent(null)
      setMessage(
        isEditing
          ? 'Event updated successfully.'
          : 'Event created successfully.'
      )

      await loadEvents()
    } catch (err) {
      setError(err.message || 'Unable to save event.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(eventId) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this event?'
    )

    if (!confirmed) return

    setDeletingId(eventId)
    setError('')
    setMessage('')

    try {
      const response = await fetch(`${API_URL}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to delete event.')
      }

      setEvents((currentEvents) =>
        currentEvents.filter((event) => event._id !== eventId)
      )

      if (editingEvent?._id === eventId) {
        setEditingEvent(null)
      }

      setMessage('Event deleted successfully.')
    } catch (err) {
      setError(err.message || 'Unable to delete event.')
    } finally {
      setDeletingId(null)
    }
  }

  function handleEdit(event) {
    setEditingEvent(event)
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancel() {
    setEditingEvent(null)
    setError('')
  }

  return (
    <section className="mx-auto max-w-6xl space-y-8 p-6 sm:p-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
          Organizer portal
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Welcome, {user.name}!
        </h1>

        <p className="mt-2 text-slate-600">
          Create, manage, and monitor your events from one place.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="rounded-lg bg-green-50 p-4 text-sm text-green-700"
        >
          {message}
        </p>
      )}

      <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h2 className="mb-6 text-xl font-bold text-slate-900">
          {editingEvent ? 'Edit Event' : 'Create a New Event'}
        </h2>

        <EventForm
          key={editingEvent?._id || 'new'}
          onSubmit={handleSubmit}
          editingEvent={editingEvent}
          onCancel={handleCancel}
          submitting={submitting}
        />
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Your Events
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {events.length} event{events.length === 1 ? '' : 's'} found
            </p>
          </div>

          <button
            type="button"
            onClick={loadEvents}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <EventList
          events={events}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      </div>
      {/* QR Ticket Check-in */}
      <CheckInScanner
        events={events}
        token={token}
      />
    </section>
  )
}

export default OrganizerDashboard