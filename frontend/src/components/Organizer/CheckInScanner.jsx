
import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { io } from 'socket.io-client';

const API_URL = '/api';
const READER_ID = 'eventhub-qr-reader';

function CheckInScanner({ events = [], token }) {
  const [selectedEventId, setSelectedEventId] = useState('');
  const activeEventId =
  selectedEventId ||
  (events.length > 0
    ? String(events[0]._id || events[0].id)
    : '')
  const [cameraActive, setCameraActive] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [result, setResult] = useState(null);
  const [checkedInCount, setCheckedInCount] = useState(null);

  const scannerRef = useRef(null);
  const requestInProgress = useRef(false);

  const selectedEvent = events.find(
    event => String(event._id || event.id) === activeEventId
  )

  // Connect to the selected event's live attendance room.
  useEffect(() => {
    if (!selectedEventId) return;

    const socket = io();

    const joinRoom = () => {
      socket.emit('joinEvent', selectedEventId);
    };

    const handleAttendanceUpdate = (data) => {
      if (String(data.eventId) === selectedEventId) {
        setCheckedInCount(data.checkedInCount);
      }
    };

    socket.on('connect', joinRoom);
    socket.on('attendanceUpdated', handleAttendanceUpdate);

    if (socket.connected) {
      joinRoom();
    }

    return () => {
      if (socket.connected) {
        socket.emit('leaveEvent', selectedEventId);
      }

      socket.off('connect', joinRoom);
      socket.off('attendanceUpdated', handleAttendanceUpdate);
      socket.disconnect();
    };
  }, [selectedEventId]);

  // Submit a scanned or manually entered QR token.
  const handleCheckIn = useCallback(async (qrToken) => {
    if (!selectedEventId || !token || !qrToken.trim()) {
      setResult({
        success: false,
        message: 'Select an event and provide a valid QR token.',
      });
      return;
    }

    if (requestInProgress.current) return;

    requestInProgress.current = true;
    setResult(null);

    try {
      const response = await fetch(
        `${API_URL}/check-in/${selectedEventId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ token: qrToken.trim() }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setResult({
          success: false,
          message: data.message || 'Check-in failed.',
        });
        return;
      }

      setCheckedInCount(data.data.checkedInCount);
      setManualToken('');

      setResult({
        success: true,
        message: data.message,
        data: data.data,
      });

      // Stop the camera after a successful scan.
      setCameraActive(false);
    } catch {
      setResult({
        success: false,
        message: 'Unable to connect to the EventHub server.',
      });
    } finally {
      requestInProgress.current = false;
    }
  }, [selectedEventId, token]);

  // Start and clean up the camera scanner.
  useEffect(() => {
    if (!cameraActive || !selectedEventId) return;

    let scanner;
    let cancelled = false;

    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode(READER_ID);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            handleCheckIn(decodedText);
          },
          () => {
            // Ignore normal camera frame scan errors.
          }
        );

        if (cancelled) {
          if (scanner.isScanning) {
            await scanner.stop();
          }
          scanner.clear();
        }
      } catch {
        if (!cancelled) {
          setCameraActive(false);
          setResult({
            success: false,
            message:
              'Camera could not start. Check camera permission or use manual token entry.',
          });
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;

      if (scanner) {
        const stopScanner = scanner.isScanning
          ? scanner.stop()
          : Promise.resolve();

        stopScanner
          .catch(() => {})
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              // Scanner may already be cleared.
            }

            if (scannerRef.current === scanner) {
              scannerRef.current = null;
            }
          });
      }
    };
  }, [cameraActive, selectedEventId, handleCheckIn]);

  const handleEventChange = (event) => {
    setCameraActive(false);
    setSelectedEventId(event.target.value);
    setCheckedInCount(null);
    setResult(null);
  };

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-900">
          QR Ticket Check-in
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Scan attendee tickets and validate their entry.
        </p>
      </div>

      {/* Event selection */}
      <div className="mb-5">
        <label
          htmlFor="checkin-event"
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          Select Event
        </label>

        <select
          id="checkin-event"
          value={selectedEventId}
          onChange={handleEventChange}
          className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-indigo-500"
        >
          <option value="">Choose an event</option>

          {events.map((event) => (
            <option
              key={event._id || event.id}
              value={event._id || event.id}
            >
              {event.name}
            </option>
          ))}
        </select>
      </div>

      {events.length === 0 ? (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Create an event before checking in attendees.
        </p>
      ) : (
        <>
          {/* Live attendance */}
          <div className="mb-5 rounded-xl bg-indigo-50 p-4">
            <p className="text-sm font-medium text-indigo-700">
              Live attendance
            </p>

            <p className="mt-1 text-2xl font-bold text-indigo-900">
              {checkedInCount === null ? 'Waiting for update' : checkedInCount}
              {selectedEvent?.capacity
                ? ` / ${selectedEvent.capacity}`
                : ''}
            </p>
          </div>

          {/* Camera scanner */}
          <div className="mb-5">
            <div
              id={READER_ID}
              className="min-h-16 w-full overflow-hidden rounded-lg"
            />

            <div className="mt-3 flex flex-wrap gap-3">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setCameraActive(true);
                  }}
                  disabled={!selectedEventId}
                  className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Start Camera Scanner
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCameraActive(false)}
                  className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
                >
                  Stop Camera
                </button>
              )}
            </div>
          </div>

          {/* Manual token entry */}
          <div className="border-t border-slate-200 pt-5">
            <h3 className="mb-2 font-semibold text-slate-800">
              Manual QR Token Entry
            </h3>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleCheckIn(manualToken);
              }}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="text"
                value={manualToken}
                onChange={(event) => setManualToken(event.target.value)}
                placeholder="Paste ticket QR token here"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 p-3 outline-none focus:border-indigo-500"
              />

              <button
                type="submit"
                disabled={!selectedEventId || !manualToken.trim()}
                className="rounded-lg bg-slate-800 px-5 py-3 font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Check In
              </button>
            </form>
          </div>

          {/* Check-in result */}
          {result && (
            <div
              className={`mt-5 rounded-lg p-4 ${
                result.success
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              <p className="font-semibold">{result.message}</p>

              {result.success && result.data && (
                <div className="mt-2 space-y-1 text-sm">
                  <p>Ticket: {result.data.ticketNumber}</p>
                  <p>Seat: {result.data.seatNumber}</p>
                  <p>Event: {result.data.eventName}</p>
                  <p>
                    Checked in: {new Date(
                      result.data.checkedInAt
                    ).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default CheckInScanner;
