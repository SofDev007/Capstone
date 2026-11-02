import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, TileLayer } from 'react-leaflet';
import { io } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { publicAPI, SOCKET_URL } from './lib/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
});

const defaultCenter = [28.6139, 77.209];

function App() {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    loadRoutes();
  }, []);

  useEffect(() => {
    loadBuses(selectedRoute);
  }, [selectedRoute]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('location-update', ({ busId, location }) => {
      setBuses((prev) =>
        prev.map((bus) =>
          bus._id === String(busId)
            ? { ...bus, currentLocation: { ...location } }
            : bus
        )
      );
    });

    socket.on('trip-started', () => {
      loadBuses(selectedRoute);
    });

    socket.on('trip-ended', () => {
      loadBuses(selectedRoute);
    });

    socket.on('breakdown-alert', () => {
      loadBuses(selectedRoute);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [selectedRoute]);

  useEffect(() => {
    if (!socketRef.current) return;
    buses.forEach((bus) => socketRef.current.emit('subscribe', bus._id));
  }, [buses]);

  const loadRoutes = async () => {
    try {
      const response = await publicAPI.getRoutes();
      setRoutes(response.data || []);
    } catch (err) {
      setError('Unable to load routes right now.');
    }
  };

  const loadBuses = async (route) => {
    setLoading(true);
    setError('');
    try {
      const response = await publicAPI.getActiveBuses(route);
      setBuses(response.data || []);
      setSelectedBusId('');
    } catch (err) {
      setError('Unable to load active buses.');
    } finally {
      setLoading(false);
    }
  };

  const selectedBus = useMemo(
    () => buses.find((bus) => bus._id === selectedBusId) || null,
    [buses, selectedBusId]
  );

  const mapCenter = useMemo(() => {
    const withLocation = buses.find((bus) => bus.currentLocation?.lat && bus.currentLocation?.lng);
    return withLocation ? [withLocation.currentLocation.lat, withLocation.currentLocation.lng] : defaultCenter;
  }, [buses]);

  const getBusIcon = (status) => {
    const color = status === 'breakdown' ? '#dc2626' : '#16a34a';
    return L.divIcon({
      className: 'bus-dot-wrapper',
      html: `<span class="bus-dot" style="background:${color}"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Live Bus Tracker</h1>
        <p>Track active buses by route in real time.</p>
      </header>

      <section className="controls">
        <label htmlFor="routeFilter">Route</label>
        <select
          id="routeFilter"
          value={selectedRoute}
          onChange={(e) => setSelectedRoute(e.target.value)}
        >
          <option value="">All Active Routes</option>
          {routes.map((route) => (
            <option key={route} value={route}>
              {route}
            </option>
          ))}
        </select>
        <button onClick={() => loadBuses(selectedRoute)}>Refresh</button>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <main className="layout">
        <div className="map-wrap">
          <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {buses.map((bus) => {
              if (!bus.currentLocation?.lat || !bus.currentLocation?.lng) {
                return null;
              }

              return (
                <Marker
                  key={bus._id}
                  position={[bus.currentLocation.lat, bus.currentLocation.lng]}
                  icon={getBusIcon(bus.status)}
                  eventHandlers={{ click: () => setSelectedBusId(bus._id) }}
                >
                  <Popup>
                    <strong>Bus {bus.busNumber}</strong>
                    <br />
                    Route: {bus.route}
                    <br />
                    Status: {bus.status}
                  </Popup>
                </Marker>
              );
            })}
            {selectedBus?.routeCoordinates?.length > 0 ? (
              <Polyline
                positions={selectedBus.routeCoordinates.map((point) => [point.lat, point.lng])}
                pathOptions={{ color: '#2563eb', weight: 4 }}
              />
            ) : null}
          </MapContainer>
        </div>

        <aside className="list-panel">
          <h2>Active Buses {loading ? '(loading...)' : `(${buses.length})`}</h2>
          {buses.length === 0 && !loading ? <p>No active buses for this route.</p> : null}
          {buses.map((bus) => (
            <button
              key={bus._id}
              className={`bus-item ${selectedBusId === bus._id ? 'selected' : ''}`}
              onClick={() => setSelectedBusId(bus._id)}
              type="button"
            >
              <strong>Bus {bus.busNumber}</strong>
              <span>{bus.route}</span>
              <span>Status: {bus.status}</span>
              {bus.currentLocation?.timestamp ? (
                <span>Updated: {new Date(bus.currentLocation.timestamp).toLocaleTimeString()}</span>
              ) : (
                <span>Location unavailable</span>
              )}
            </button>
          ))}
        </aside>
      </main>
    </div>
  );
}

export default App;
