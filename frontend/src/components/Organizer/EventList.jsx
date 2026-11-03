
function EventList({
  events = [],
  loading = false,
  onEdit,
  onDelete,
  deletingId = null,
}) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-slate-500">Loading your events...</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">
          No events created yet
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Create your first event to see it listed here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <article
          key={event._id}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-slate-900">
                {event.name}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {event.category} · {event.venue}
              </p>

              <p className="mt-2 text-sm text-slate-600">
                {event.date
                  ? new Date(event.date).toLocaleString()
                  : 'Date not available'}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(event)}
                className="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() => onDelete(event._id)}
                disabled={deletingId === event._id}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deletingId === event._id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Event Capacity</p>
              <p className="mt-1 font-semibold text-slate-900">
                {event.capacity} seats
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Ticket Tiers</p>
              <div className="mt-1 space-y-1">
                {event.priceTiers?.map((tier, index) => (
                  <p
                    key={`${event._id}-${tier._id || index}`}
                    className="text-sm font-medium text-slate-900"
                  >
                    {tier.name}: ₹{tier.price} ({tier.quantity} tickets)
                  </p>
                ))}
              </div>
            </div>
          </div>

          {event.description && (
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {event.description}
            </p>
          )}
        </article>
      ))}
    </div>
  )
}

export default EventList
