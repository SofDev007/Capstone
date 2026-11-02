import { useState, useEffect } from 'react';
import { busAPI, driverAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Plus, Edit, Trash2 } from 'lucide-react';

export default function BusManagement() {
  const [buses, setBuses] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedBus, setSelectedBus] = useState(null);
  const [formData, setFormData] = useState({
    busNumber: '',
    plateNumber: '',
    capacity: '',
    route: '',
  });

  useEffect(() => {
    fetchBuses();
    fetchDrivers();
  }, []);

  const fetchBuses = async () => {
    try {
      const response = await busAPI.getAll();
      setBuses(response.data);
    } catch (error) {
      console.error('Error fetching buses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const response = await driverAPI.getAll();
      setDrivers(response.data);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    }
  };

  const handleOpenDialog = (bus = null) => {
    setSelectedBus(bus);
    if (bus) {
      setFormData({
        busNumber: bus.busNumber,
        plateNumber: bus.plateNumber,
        capacity: bus.capacity.toString(),
        route: bus.route,
      });
    } else {
      setFormData({
        busNumber: '',
        plateNumber: '',
        capacity: '',
        route: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedBus) {
        await busAPI.update(selectedBus._id, {
          ...formData,
          capacity: parseInt(formData.capacity),
        });
      } else {
        await busAPI.create({
          ...formData,
          capacity: parseInt(formData.capacity),
        });
      }
      setDialogOpen(false);
      fetchBuses();
    } catch (error) {
      console.error('Error saving bus:', error);
      alert(error.response?.data?.message || 'Error saving bus');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this bus?')) return;
    try {
      await busAPI.delete(id);
      fetchBuses();
    } catch (error) {
      console.error('Error deleting bus:', error);
      alert('Error deleting bus');
    }
  };

  const handleAssignDriver = async (busId, driverId) => {
    try {
      await busAPI.assignDriver(busId, driverId);
      fetchBuses();
      setAssignDialogOpen(false);
    } catch (error) {
      console.error('Error assigning driver:', error);
      alert(error.response?.data?.message || 'Error assigning driver');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'breakdown':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div>Loading buses...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bus Management</h1>
          <p className="text-gray-600 mt-2">Manage your fleet of buses</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Bus
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bus Number</TableHead>
                <TableHead>Plate Number</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500">
                    No buses found
                  </TableCell>
                </TableRow>
              ) : (
                buses.map((bus) => (
                  <TableRow key={bus._id}>
                    <TableCell className="font-medium">{bus.busNumber}</TableCell>
                    <TableCell>{bus.plateNumber}</TableCell>
                    <TableCell>{bus.route}</TableCell>
                    <TableCell>{bus.capacity}</TableCell>
                    <TableCell>
                      {bus.assignedDriver ? (
                        <span>{bus.assignedDriver.name}</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBus(bus);
                            setAssignDialogOpen(true);
                          }}
                        >
                          Assign Driver
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          bus.status
                        )}`}
                      >
                        {bus.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(bus)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(bus._id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedBus ? 'Edit Bus' : 'Add New Bus'}</DialogTitle>
            <DialogDescription>
              {selectedBus
                ? 'Update bus information'
                : 'Fill in the details to add a new bus'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="busNumber">Bus Number</Label>
                <Input
                  id="busNumber"
                  value={formData.busNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, busNumber: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plateNumber">Plate Number</Label>
                <Input
                  id="plateNumber"
                  value={formData.plateNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, plateNumber: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="route">Route</Label>
                <Input
                  id="route"
                  value={formData.route}
                  onChange={(e) =>
                    setFormData({ ...formData, route: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Driver Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Driver to Bus</DialogTitle>
            <DialogDescription>
              Select a driver to assign to {selectedBus?.busNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {drivers
              .filter((d) => d.isActive)
              .map((driver) => (
                <div
                  key={driver._id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div>
                    <p className="font-medium">{driver.name}</p>
                    <p className="text-sm text-gray-600">{driver.email}</p>
                  </div>
                  <Button
                    onClick={() => handleAssignDriver(selectedBus._id, driver._id)}
                    disabled={driver.assignedBus !== null}
                  >
                    {driver.assignedBus ? 'Already Assigned' : 'Assign'}
                  </Button>
                </div>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

