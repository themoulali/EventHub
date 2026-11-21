import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '../../config/api'

function formatDate(date) {
  if (!date) return 'Date unavailable'

  return new Date(date).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function MyTickets({ token }) {
  const [bookings, setBookings] = useState([])
  const [upcomingBookings, setUpcomingBookings] = useState([])
  const [pastBookings, setPastBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [cancellingId, setCancellingId] = useState(null)

  const loadBookings = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/bookings/my-bookings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to load your tickets.')
      }

      const data = result.data || {}
      setError('')

      setBookings(data.bookings || [])
      setUpcomingBookings(data.upcomingBookings || [])
      setPastBookings(data.pastBookings || [])
    } catch (err) {
      setError(err.message || 'Unable to load your tickets.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBookings()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadBookings])

  async function handleCancelBooking(booking) {
    const confirmed = window.confirm(
      `Are you sure you want to cancel booking ${booking.bookingReference}?`
    )

    if (!confirmed) return

    setCancellingId(booking.id)
    try {
      const response = await fetch(
        `${API_URL}/bookings/${booking.id}/cancel`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to cancel booking.')
      }

      setMessage(
        `Booking ${result.booking.bookingReference} cancelled successfully. Simulated refund: ₹${result.booking.refund.amount}.`
      )

      await loadBookings()
    } catch (err) {
      setError(err.message || 'Unable to cancel booking.')
    } finally {
      setCancellingId(null)
    }
  }

  function renderBooking(booking) {
    const event = booking.event
    const tickets = booking.tickets || []

    const canCancel =
      booking.status === 'confirmed' &&
      booking.payment?.status === 'successful' &&
      event &&
      new Date(event.date) > new Date() &&
      tickets.length > 0 &&
      tickets.every(
        (ticket) => ticket.status === 'valid' && !ticket.checkedInAt
      )

    return (
      <article
        key={booking.id}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {event?.name || 'Event unavailable'}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {event?.venue || 'Venue unavailable'}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {formatDate(event?.date)}
            </p>
          </div>

          <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
            {booking.status}
          </span>
        </div>

        <div className="mt-5 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
          <p className="text-sm text-slate-600">
            Booking reference:{' '}
            <strong className="text-slate-900">
              {booking.bookingReference}
            </strong>
          </p>

          <p className="text-sm text-slate-600">
            Total amount:{' '}
            <strong className="text-slate-900">
              ₹{Number(booking.totalAmount).toFixed(2)}
            </strong>
          </p>

          <p className="text-sm text-slate-600">
            Payment status:{' '}
            <strong className="text-slate-900">
              {booking.payment?.status || 'Unknown'}
            </strong>
          </p>

          <p className="text-sm text-slate-600">
            Booked on:{' '}
            <strong className="text-slate-900">
              {formatDate(booking.createdAt)}
            </strong>
          </p>
        </div>

        <div className="mt-5">
          <h4 className="font-semibold text-slate-800">Your Tickets</h4>

          {tickets.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No tickets found for this booking.
            </p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {tickets.map((ticket) => (
                <div
                  key={ticket.ticketNumber}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <p className="font-semibold text-slate-900">
                    {ticket.ticketNumber}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Seat: {ticket.seatNumber}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Price: ₹{Number(ticket.price).toFixed(2)}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Ticket status: {ticket.status}
                  </p>

                  {ticket.qrCode && ticket.status === 'valid' ? (
                    <img
                      src={ticket.qrCode}
                      alt={`QR ticket ${ticket.ticketNumber}`}
                      className="mx-auto mt-4 h-40 w-40"
                    />
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                        {ticket.status === 'cancelled'
                            ? 'This ticket has been cancelled.'
                            : ticket.status === 'used'
                                ? 'This ticket has already been checked in.'
                                : 'QR code unavailable for this ticket.'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {booking.status === 'cancelled' && booking.payment?.refund && (
          <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Simulated refund recorded</p>
            <p className="mt-1">
              Amount: ₹{Number(booking.payment.refund.amount).toFixed(2)}
            </p>
            <p className="mt-1 break-all">
              Transaction: {booking.payment.refund.transactionId}
            </p>
            {booking.payment.refund.refundedAt && (
                <p className="mt-1">
                    Refunded on: {formatDate(booking.payment.refund.refundedAt)}
                </p>
            )}
          </div>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={() => handleCancelBooking(booking)}
            disabled={cancellingId === booking.id}
            className="mt-5 rounded-lg bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancellingId === booking.id
              ? 'Cancelling...'
              : 'Cancel Booking'}
          </button>
        )}
      </article>
    )
  }

  if (loading) {
    return <p className="py-10 text-center text-slate-600">Loading your tickets...</p>
  }

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Tickets</h2>
        <p className="mt-2 text-slate-600">
          View your bookings, tickets, QR codes, and cancellation details.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
          {message}
        </p>
      )}

      <div>
        <h3 className="mb-4 text-xl font-bold text-slate-900">
          Upcoming Bookings ({upcomingBookings.length})
        </h3>

        {upcomingBookings.length === 0 ? (
          <p className="rounded-lg bg-white p-5 text-slate-500">
            You have no upcoming bookings.
          </p>
        ) : (
          <div className="space-y-5">
            {upcomingBookings.map(renderBooking)}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-4 text-xl font-bold text-slate-900">
          Past Bookings ({pastBookings.length})
        </h3>

        {pastBookings.length === 0 ? (
          <p className="rounded-lg bg-white p-5 text-slate-500">
            You have no past bookings.
          </p>
        ) : (
          <div className="space-y-5">
            {pastBookings.map(renderBooking)}
          </div>
        )}
      </div>

      <p className="text-sm text-slate-500">
        Total booking records: {bookings.length}
      </p>
    </section>
  )
}

export default MyTickets
