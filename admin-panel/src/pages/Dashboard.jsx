import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { busAPI, tripAPI, driverAPI } from '../lib/api';
import { Bus, Users, MapPin, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalBuses: 0,
    activeBuses: 0,
    totalDrivers: 0,
    activeTrips: 0,
  });
  const [recentTrips, setRecentTrips] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [busesRes, activeBusesRes, driversRes, tripsRes, activeTripsRes] = await Promise.all([
        busAPI.getAll(),
        busAPI.getActive(),
        driverAPI.getAll(),
        tripAPI.getAll({ limit: 5 }),
        tripAPI.getActive(),
      ]);

      setStats({
        totalBuses: busesRes.data.length,
        activeBuses: activeBusesRes.data.length,
        totalDrivers: driversRes.data.length,
        activeTrips: activeTripsRes.data.length,
      });

      setRecentTrips(tripsRes.data);
      
      // Check for breakdowns
      const breakdownBuses = activeBusesRes.data.filter(bus => bus.status === 'breakdown');
      setAlerts(breakdownBuses.map(bus => ({
        type: 'breakdown',
        message: `Bus ${bus.busNumber} reported a breakdown`,
        bus: bus,
      })));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of your transport system</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Buses</CardTitle>
            <Bus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBuses}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeBuses} currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeTrips}</div>
            <p className="text-xs text-muted-foreground">
              Trips in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDrivers}</div>
            <p className="text-xs text-muted-foreground">
              Registered drivers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
            <p className="text-xs text-muted-foreground">
              Active alerts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-3"
                >
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-900">{alert.message}</p>
                    {alert.bus && (
                      <p className="text-sm text-red-700">
                        Driver: {alert.bus.assignedDriver?.name || 'N/A'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Trips */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trips</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTrips.length === 0 ? (
            <p className="text-gray-500">No trips found</p>
          ) : (
            <div className="space-y-4">
              {recentTrips.map((trip) => (
                <div
                  key={trip._id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div>
                    <p className="font-medium">
                      Bus {trip.bus?.busNumber} - {trip.bus?.route}
                    </p>
                    <p className="text-sm text-gray-600">
                      Driver: {trip.driver?.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Started: {new Date(trip.startTime).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      trip.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : trip.status === 'completed'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {trip.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

