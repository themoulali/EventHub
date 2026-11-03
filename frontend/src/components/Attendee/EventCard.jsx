
function EventCard({ event, onViewDetails }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="bg-indigo-600 p-5 text-white">
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
          {event.category}
        </span>

        <h3 className="mt-3 text-xl font-bold">
          {event.name}
        </h3>
      </div>

      <div className="space-y-3 p-5">
        <p className="text-sm text-slate-600">
          {event.description || 'Discover this exciting event.'}
        </p>

        <div>
          <p className="text-xs text-slate-500">Date and Time</p>
          <p className="font-medium text-slate-800">
            {event.date
              ? new Date(event.date).toLocaleString()
              : 'Date not available'}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Venue</p>
          <p className="font-medium text-slate-800">
            {event.venue}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Capacity</p>
          <p className="font-medium text-slate-800">
            {event.capacity} seats
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Starting Price</p>
          <p className="font-semibold text-indigo-700">
            {event.priceTiers?.length
              ? `₹${Math.min(
                  ...event.priceTiers.map((tier) => tier.price)
                )}`
              : 'Price unavailable'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onViewDetails(event)}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700"
        >
          View Details
        </button>
      </div>
    </article>
  )
}

export default EventCard
