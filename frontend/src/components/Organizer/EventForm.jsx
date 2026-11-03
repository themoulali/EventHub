
import { useEffect, useState } from 'react'

const initialForm = {
  name: '',
  description: '',
  date: '',
  venue: '',
  capacity: '',
  category: '',
  priceTiers: [
    {
      name: 'Standard',
      price: '',
      quantity: '',
    },
  ],
}

function EventForm({ onSubmit, editingEvent, onCancel, submitting = false }) {
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editingEvent) {
      setForm({
        name: editingEvent.name || '',
        description: editingEvent.description || '',
        date: editingEvent.date
          ? new Date(editingEvent.date).toISOString().slice(0, 16)
          : '',
        venue: editingEvent.venue || '',
        capacity: editingEvent.capacity || '',
        category: editingEvent.category || '',
        priceTiers: editingEvent.priceTiers?.length
          ? editingEvent.priceTiers.map((tier) => ({
              name: tier.name,
              price: tier.price,
              quantity: tier.quantity,
            }))
          : initialForm.priceTiers,
      })
    } else {
      setForm(initialForm)
    }

    setError('')
  }, [editingEvent])

  function handleChange(event) {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  function handleTierChange(index, field, value) {
    setForm((previous) => ({
      ...previous,
      priceTiers: previous.priceTiers.map((tier, i) =>
        i === index ? { ...tier, [field]: value } : tier
      ),
    }))
  }

  function addTier() {
    setForm((previous) => ({
      ...previous,
      priceTiers: [
        ...previous.priceTiers,
        { name: '', price: '', quantity: '' },
      ],
    }))
  }

  function removeTier(index) {
    if (form.priceTiers.length === 1) {
      setError('At least one ticket tier is required.')
      return
    }

    setForm((previous) => ({
      ...previous,
      priceTiers: previous.priceTiers.filter((_, i) => i !== index),
    }))

    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const capacity = Number(form.capacity)

    const eventDate = new Date(form.date)

    if (!form.date || Number.isNaN(eventDate.getTime())) {
      setError('Please select a valid event date and time.')
      return
    }

    if (form.name.trim().length < 3 || !form.venue.trim()) {
      setError('Please enter a valid event name and venue.')
      return
    }

    if (!Number.isInteger(capacity) || capacity < 1) {
      setError('Capacity must be a positive whole number.')
      return
    }

    const priceTiers = form.priceTiers.map((tier) => ({
      name: tier.name.trim(),
      price: Number(tier.price),
      quantity: Number(tier.quantity),
    }))

    const invalidTier = priceTiers.some(
      (tier) =>
        !tier.name ||
        !Number.isFinite(tier.price) ||
        tier.price < 0 ||
        !Number.isInteger(tier.quantity) ||
        tier.quantity < 1
    )

    if (invalidTier) {
      setError('Please provide valid details for every ticket tier.')
      return
    }

    const totalTickets = priceTiers.reduce(
      (total, tier) => total + tier.quantity,
      0
    )

    if (totalTickets > capacity) {
      setError('Total ticket quantities cannot exceed event capacity.')
      return
    }

    const eventData = {
      name: form.name.trim(),
      description: form.description.trim(),
      date: eventDate.toISOString(),
      venue: form.venue.trim(),
      capacity,
      category: form.category.trim(),
      priceTiers,
    }

    try {
      await onSubmit(eventData)

      if (!editingEvent) {
        setForm(initialForm)
      }
    } catch (err) {
      setError(err.message || 'Unable to save event.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          {editingEvent ? 'Edit Event' : 'Create New Event'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter your event information and ticket details.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Event Name
        </label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          minLength={3}
          maxLength={120}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Enter event name"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Description
        </label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          maxLength={2000}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Describe your event"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Event Date and Time
          </label>
          <input
            type="datetime-local"
            name="date"
            value={form.date}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Venue
          </label>
          <input
            name="venue"
            value={form.venue}
            onChange={handleChange}
            maxLength={200}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Enter event venue"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Capacity
          </label>
          <input
            type="number"
            name="capacity"
            min="1"
            step="1"
            value={form.capacity}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Category
          </label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">Select category</option>
            <option value="Technology">Technology</option>
            <option value="Workshop">Workshop</option>
            <option value="Conference">Conference</option>
            <option value="Networking">Networking</option>
            <option value="Startup">Startup</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-slate-900">
            Ticket Pricing Tiers
          </h3>

          <button
            type="button"
            onClick={addTier}
            className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            + Add Ticket Tier
          </button>
        </div>

        {form.priceTiers.map((tier, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-3"
          >
            <div>
              <label className="mb-1 block text-sm font-medium">
                Tier Name
              </label>
              <input
                value={tier.name}
                onChange={(event) =>
                  handleTierChange(index, 'name', event.target.value)
                }
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Standard / VIP"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={tier.price}
                onChange={(event) =>
                  handleTierChange(index, 'price', event.target.value)
                }
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={tier.quantity}
                onChange={(event) =>
                  handleTierChange(index, 'quantity', event.target.value)
                }
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            {form.priceTiers.length > 1 && (
              <button
                type="button"
                onClick={() => removeTier(index)}
                className="text-left text-sm font-semibold text-red-600 hover:underline sm:col-span-3"
              >
                Remove this tier
              </button>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting
            ? 'Saving...'
            : editingEvent
              ? 'Update Event'
              : 'Create Event'}
        </button>

        {editingEvent && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export default EventForm
