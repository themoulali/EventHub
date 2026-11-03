
function EventFilters({
  search,
  category,
  onSearchChange,
  onCategoryChange,
  onClear,
}) {
  return (
    <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-3">
      <div className="sm:col-span-2">
        <label
          htmlFor="event-search"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Search Events
        </label>

        <input
          id="event-search"
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by event name..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      <div>
        <label
          htmlFor="event-category"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Category
        </label>

        <select
          id="event-category"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
        >
          <option value="">All Categories</option>
          <option value="Technology">Technology</option>
          <option value="Workshop">Workshop</option>
          <option value="Conference">Conference</option>
          <option value="Networking">Networking</option>
          <option value="Startup">Startup</option>
        </select>
      </div>

      <div className="sm:col-span-3">
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Clear Filters
        </button>
      </div>
    </div>
  )
}

export default EventFilters
