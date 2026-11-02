import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { busAPI, tripAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { io } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export default function LiveMap() {
  const [buses, setBuses] = useState([]);
  const [activeTrips, setActiveTrips] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);
  const [socket, setSocket] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    fetchActiveBuses();
    fetchActiveTrips();

    // Initialize Socket.IO connection
    const newSocket = io('http://localhost:5000', {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    newSocket.on('location-update', (data) => {
      setBuses((prevBuses) =>
        prevBuses.map((bus) =>
          bus._id === data.busId
            ? {
                ...bus,
                currentLocation: {
                  lat: data.location.lat,
                  lng: data.location.lng,
                  timestamp: data.location.timestamp,
                },
              }
            : bus
        )
      );
    });

    newSocket.on('trip-started', (trip) => {
      fetchActiveBuses();
      fetchActiveTrips();
    });

    newSocket.on('trip-ended', (trip) => {
      fetchActiveBuses();
      fetchActiveTrips();
    });

    newSocket.on('breakdown-alert', (data) => {
      alert(`Breakdown Alert: ${data.bus.busNumber} - ${data.reason}`);
      fetchActiveBuses();
      fetchActiveTrips();
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const fetchActiveBuses = async () => {
    try {
      const response = await busAPI.getActive();
      setBuses(response.data);
      
      // Subscribe to location updates for all active buses
      response.data.forEach((bus) => {
        if (socket) {
          socket.emit('subscribe', bus._id);
        }
      });
    } catch (error) {
      console.error('Error fetching active buses:', error);
    }
  };

  const fetchActiveTrips = async () => {
    try {
      const response = await tripAPI.getActive();
      setActiveTrips(response.data);
    } catch (error) {
      console.error('Error fetching active trips:', error);
    }
  };

  const getBusIcon = (status) => {
    const iconColor = status === 'breakdown' ? 'red' : status === 'active' ? 'green' : 'gray';
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${iconColor}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  const defaultCenter = [28.6139, 77.209]; // Default to a city center (Delhi)
  const hasValidLocations = buses.some(
    (bus) => bus.currentLocation?.lat && bus.currentLocation?.lng
  );

  const mapCenter = hasValidLocations
    ? [
        buses.find((b) => b.currentLocation?.lat)?.currentLocation.lat || defaultCenter[0],
        buses.find((b) => b.currentLocation?.lng)?.currentLocation.lng || defaultCenter[1],
      ]
    : defaultCenter;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Live Map</h1>
        <p className="text-gray-600 mt-2">Real-time bus location tracking</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <div style={{ height: '600px', width: '100%' }}>
                <MapContainer
                  center={mapCenter}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  ref={mapRef}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
                        eventHandlers={{
                          click: () => setSelectedBus(bus),
                        }}
                      >
                        <Popup>
                          <div>
                            <p className="font-bold">Bus {bus.busNumber}</p>
                            <p>Route: {bus.route}</p>
                            <p>Plate: {bus.plateNumber}</p>
                            <p>Status: {bus.status}</p>
                            {bus.assignedDriver && (
                              <p>Driver: {bus.assignedDriver.name}</p>
                            )}
                            {bus.currentLocation.timestamp && (
                              <p className="text-xs text-gray-500">
                                Updated: {new Date(bus.currentLocation.timestamp).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                  {selectedBus?.routeCoordinates && selectedBus.routeCoordinates.length > 0 && (
                    <Polyline
                      positions={selectedBus.routeCoordinates.map((coord) => [
                        coord.lat,
                        coord.lng,
                      ])}
                      color="blue"
                      weight={3}
                    />
                  )}
                </MapContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Buses ({buses.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {buses.length === 0 ? (
                  <p className="text-gray-500 text-sm">No active buses</p>
                ) : (
                  buses.map((bus) => (
                    <div
                      key={bus._id}
                      className={`p-3 border rounded-md cursor-pointer transition-colors ${
                        selectedBus?._id === bus._id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedBus(bus)}
                    >
                      <p className="font-medium">Bus {bus.busNumber}</p>
                      <p className="text-sm opacity-80">{bus.route}</p>
                      <p className="text-xs opacity-60 mt-1">
                        Status: {bus.status}
                      </p>
                      {bus.assignedDriver && (
                        <p className="text-xs opacity-60">
                          Driver: {bus.assignedDriver.name}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {selectedBus && (
            <Card>
              <CardHeader>
                <CardTitle>Bus Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium">Bus Number</p>
                    <p className="text-sm text-gray-600">{selectedBus.busNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Plate Number</p>
                    <p className="text-sm text-gray-600">{selectedBus.plateNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Route</p>
                    <p className="text-sm text-gray-600">{selectedBus.route}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <p className="text-sm text-gray-600">{selectedBus.status}</p>
                  </div>
                  {selectedBus.currentLocation && (
                    <div>
                      <p className="text-sm font-medium">Location</p>
                      <p className="text-xs text-gray-600">
                        {selectedBus.currentLocation.lat.toFixed(6)},{' '}
                        {selectedBus.currentLocation.lng.toFixed(6)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

