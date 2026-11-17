
import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const API_URL = '/api'
const HOLD_DURATION_MS = 2 * 60 * 1000

function SeatSelection({ event, onClose }) {
  const [seats, setSeats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [selectedSeatId, setSelectedSeatId] = useState(null)
  const [heldSeatId, setHeldSeatId] = useState(null)
  const [holdExpiresAt, setHoldExpiresAt] = useState(null)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [actionLoading, setActionLoading] = useState(false)

  const loadSeats = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(
        `${API_URL}/events/${event._id}/seats`
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load seats.')
      }

      setSeats(data.seats || [])
    } catch (err) {
      setError(err.message || 'Unable to load seats.')
    } finally {
      setLoading(false)
    }
  }, [event._id])

  useEffect(() => {
    loadSeats()
  }, [loadSeats])

  // Real-time seat updates using Socket.IO
useEffect(() => {
  const socket = io({
    path: '/socket.io',
  })

  // Join the event room after connecting
  const handleConnect = () => {
    console.log('Socket connected:', socket.id)
    socket.emit('joinEvent', event._id)
  }

  // Update the changed seat without refreshing the page
  const handleSeatUpdated = (update) => {
    if (
      update.eventId !== event._id ||
      !update.seat?.id
    ) {
      return
    }

    const updatedSeat = update.seat

    console.log('Real-time seat update:', updatedSeat)

    setSeats((currentSeats) =>
      currentSeats.map((seat) =>
        seat._id === updatedSeat.id
          ? {
              ...seat,
              status: updatedSeat.status,
              holdExpiresAt: updatedSeat.holdExpiresAt,
              heldBy:
                updatedSeat.status === 'available'
                  ? null
                  : seat.heldBy,
            }
          : seat
      )
    )

    // Remove selection if another attendee holds the seat
    if (updatedSeat.status !== 'available') {
      setSelectedSeatId((currentId) =>
        currentId === updatedSeat.id ? null : currentId
      )
    }
  }

  socket.on('connect', handleConnect)
  socket.on('seatUpdated', handleSeatUpdated)

  // Clean up when leaving the event
  return () => {
    if (socket.connected) {
      socket.emit('leaveEvent', event._id)
    }

    socket.off('connect', handleConnect)
    socket.off('seatUpdated', handleSeatUpdated)
    socket.disconnect()

    console.log('Socket disconnected')
  }
}, [event._id])

  // Update the two-minute countdown.
  useEffect(() => {
    if (!holdExpiresAt) return

    function updateCountdown() {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(holdExpiresAt).getTime() - Date.now()) / 1000)
      )

      setSecondsRemaining(remaining)

      if (remaining === 0) {
        setHeldSeatId(null)
        setHoldExpiresAt(null)
        loadSeats()
      }
    }

    updateCountdown()

    const timer = setInterval(updateCountdown, 1000)

    return () => clearInterval(timer)
  }, [holdExpiresAt, loadSeats])

  if (!event) return null

  function handleSeatClick(seat) {
    if (seat.status !== 'available') return

    setActionError('')

    setSelectedSeatId((currentId) =>
      currentId === seat._id ? null : seat._id
    )
  }

  async function handleHoldSeat() {
    if (!selectedSeatId) return

    const token = localStorage.getItem('eventhub_token')

    if (!token) {
      setActionError('Please log in as an attendee to reserve a seat.')
      return
    }

    setActionLoading(true)
    setActionError('')

    try {
      const response = await fetch(
        `${API_URL}/events/${event._id}/seats/${selectedSeatId}/hold`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to hold this seat.')
      }

      setHeldSeatId(selectedSeatId)
      setHoldExpiresAt(
        data.seat?.holdExpiresAt ||
          new Date(Date.now() + HOLD_DURATION_MS).toISOString()
      )

      setSelectedSeatId(null)

      await loadSeats()
    } catch (err) {
      setActionError(err.message || 'Unable to hold this seat.')
      await loadSeats()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReleaseSeat() {
    if (!heldSeatId) return

    const token = localStorage.getItem('eventhub_token')

    if (!token) {
      setActionError('Please log in again to release your seat.')
      return
    }

    setActionLoading(true)
    setActionError('')

    try {
      const response = await fetch(
        `${API_URL}/events/${event._id}/seats/${heldSeatId}/hold`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to release this seat.')
      }

      setHeldSeatId(null)
      setHoldExpiresAt(null)
      setSecondsRemaining(0)

      await loadSeats()
    } catch (err) {
      setActionError(err.message || 'Unable to release this seat.')
    } finally {
      setActionLoading(false)
    }
  }

  function getSeatStyle(seat) {
    if (heldSeatId === seat._id || selectedSeatId === seat._id) {
      return 'bg-indigo-600 text-white border-indigo-700'
    }

    switch (seat.status) {
      case 'available':
        return 'bg-green-500 text-white border-green-600 hover:bg-green-600'

      case 'held':
        return 'bg-yellow-400 text-slate-900 border-yellow-500 cursor-not-allowed'

      case 'booked':
        return 'bg-red-500 text-white border-red-600 cursor-not-allowed'

      default:
        return 'bg-slate-300 text-slate-600 border-slate-400 cursor-not-allowed'
    }
  }

  const seatsByRow = seats.reduce((groups, seat) => {
    if (!groups[seat.row]) {
      groups[seat.row] = []
    }

    groups[seat.row].push(seat)
    return groups
  }, {})

  const rows = Object.keys(seatsByRow).sort()

  rows.forEach((row) => {
    seatsByRow[row].sort((a, b) => {
      const numberA = Number(a.seatNumber.replace(/\D/g, ''))
      const numberB = Number(b.seatNumber.replace(/\D/g, ''))
      return numberA - numberB
    })
  })

  const selectedSeat = seats.find(
    (seat) => seat._id === selectedSeatId
  )

  const heldSeat = seats.find(
    (seat) => seat._id === heldSeatId
  )

  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = secondsRemaining % 60

  return (
    <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

      {/* Event Information */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Select Your Seats
          </h2>

          <p className="mt-2 text-lg font-semibold text-indigo-600">
            {event.name}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {event.venue}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Close
        </button>
      </div>

      {/* Seat Layout */}
      <div className="rounded-xl bg-slate-50 p-6">
        <h3 className="mb-6 text-center font-semibold text-slate-700">
          Conference Seating Area
        </h3>

        <div className="mx-auto mb-8 max-w-2xl rounded-lg bg-slate-300 p-3 text-center font-semibold tracking-widest text-slate-700">
          STAGE
        </div>

        {loading ? (
          <p className="py-8 text-center text-slate-600">
            Loading seats...
          </p>
        ) : error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-4 text-center text-red-700">
            {error}
          </p>
        ) : seats.length === 0 ? (
          <p className="py-8 text-center text-slate-600">
            No seats are available for this event.
          </p>
        ) : (
          <div className="space-y-5 overflow-x-auto">
            {rows.map((row) => (
              <div
                key={row}
                className="flex min-w-max items-center justify-center gap-3"
              >
                <span className="w-6 font-bold text-slate-600">
                  {row}
                </span>

                <div className="flex flex-wrap justify-center gap-2">
                  {seatsByRow[row].map((seat) => (
                    <button
                      key={seat._id}
                      type="button"
                      disabled={seat.status !== 'available'}
                      aria-pressed={
                        selectedSeatId === seat._id ||
                        heldSeatId === seat._id
                      }
                      title={`${seat.seatNumber} - ${seat.status}`}
                      onClick={() => handleSeatClick(seat)}
                      className={`flex h-10 w-10 items-center justify-center rounded-md border text-xs font-bold transition ${getSeatStyle(seat)}`}
                    >
                      {seat.seatNumber}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seat Status Legend */}
      <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-green-500"></span>
          Available
        </div>

        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-yellow-400"></span>
          Held
        </div>

        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-red-500"></span>
          Booked
        </div>

        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-indigo-600"></span>
          Selected / Your Hold
        </div>
      </div>

      {/* Selected Seat */}
      {selectedSeat && !heldSeat && (
        <div className="mt-6 rounded-lg bg-indigo-50 p-4 text-center">
          <p className="font-semibold text-indigo-800">
            Selected Seat: {selectedSeat.seatNumber}
          </p>

          <p className="mt-1 text-sm text-indigo-600">
            Click below to reserve this seat for two minutes.
          </p>

          <button
            type="button"
            onClick={handleHoldSeat}
            disabled={actionLoading}
            className="mt-4 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionLoading ? 'Reserving...' : 'Hold Seat for 2 Minutes'}
          </button>
        </div>
      )}

      {/* Active Seat Hold */}
      {heldSeat && holdExpiresAt && (
        <div className="mt-6 rounded-lg bg-green-50 p-5 text-center">
          <p className="font-semibold text-green-800">
            Seat {heldSeat.seatNumber} reserved successfully!
          </p>

          <p className="mt-2 text-2xl font-bold text-green-700">
            {String(minutes).padStart(2, '0')}:
            {String(seconds).padStart(2, '0')}
          </p>

          <p className="mt-1 text-sm text-green-700">
            Time remaining to complete your booking.
          </p>

          <button
            type="button"
            onClick={handleReleaseSeat}
            disabled={actionLoading}
            className="mt-4 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {actionLoading ? 'Please wait...' : 'Release Seat'}
          </button>
        </div>
      )}

      {/* API Error */}
      {actionError && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-700"
        >
          {actionError}
        </p>
      )}
    </section>
  )
}

export default SeatSelection
