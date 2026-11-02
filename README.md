# Real-Time Public Transport Tracking System

A complete full-stack solution for tracking public transport buses in real-time, designed for small cities. The system consists of four main components:

1. **Backend API** - Node.js + Express + MongoDB + WebSocket
2. **Admin Panel** - React + Vite + TailwindCSS + ShadCN UI
3. **Driver App** - React Native (Expo)
4. **User App** - React + Vite passenger tracking app

## Features

### Admin Panel
- Admin authentication
- Bus management (Add/Edit/Delete)
- Driver management (Add/Edit/Delete)
- Assign drivers to buses
- Live map dashboard with real-time bus locations
- Real-time location updates via WebSocket
- Alerts for delays and breakdowns
- Trip history and analytics

### Driver App
- Driver authentication
- Start/End trip functionality
- GPS location tracking (every 5 seconds)
- Background location tracking (works when app is minimized)
- Display assigned route on map
- Report breakdown functionality
- Simple, intuitive UI

### Backend
- JWT-based authentication (Admin & Driver)
- RESTful API for all operations
- WebSocket server for real-time updates
- MongoDB for data persistence
- Real-time location streaming

## Project Structure

```
.
├── backend/              # Node.js + Express backend
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── middleware/      # Auth middleware
│   └── server.js        # Main server file
├── admin-panel/         # React admin panel
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   └── lib/         # Utilities and API
├── driver-app/          # React Native driver app
│   ├── screens/         # App screens
│   ├── utils/           # Utilities and API
│   └── App.js           # Main app file
├── user-app/            # React passenger tracking app
│   ├── src/
│   │   ├── lib/         # Public API and socket config
│   │   └── App.jsx      # Live route tracking app
└── README.md           # This file
```

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **MongoDB** (v5 or higher) - Make sure MongoDB is running
- **npm** or **yarn**
- **Expo CLI** (for driver app) - `npm install -g expo-cli`
- **Android Studio** or **Xcode** (for running the driver app on device/emulator)

## Setup Instructions

### 1. Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/transport_tracking
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
NODE_ENV=development
```

4. Start MongoDB (if not already running):
```bash
# On Windows
net start MongoDB

# On macOS/Linux
mongod
```

5. Create default admin account (optional):
```bash
# Start the server first, then make a POST request to:
# http://localhost:5000/api/auth/admin/create-default
# Or use curl:
curl -X POST http://localhost:5000/api/auth/admin/create-default
```

Default admin credentials:
- Email: `admin@transport.com`
- Password: `admin123`

6. Start the backend server:
```bash
npm run dev
# or
npm start
```

The backend will run on `http://localhost:5000`

### 2. Admin Panel Setup

1. Navigate to the admin-panel directory:
```bash
cd admin-panel
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (optional, defaults to localhost:5000):
```env
VITE_API_URL=http://localhost:5000/api
```

4. Start the development server:
```bash
npm run dev
```

The admin panel will run on `http://localhost:3000`

5. Login with default credentials:
- Email: `admin@transport.com`
- Password: `admin123`

### 3. Driver App Setup

1. Navigate to the driver-app directory:
```bash
cd driver-app
```

2. Install dependencies:
```bash
npm install
```

3. Update the API URL in `driver-app/utils/api.js`:
```javascript
const API_BASE_URL = 'http://YOUR_IP_ADDRESS:5000/api';
// For Android emulator, use: http://10.0.2.2:5000/api
// For iOS simulator, use: http://localhost:5000/api
// For physical device, use your computer's IP address
```

4. Add required assets:
   - Create `icon.png` (1024x1024) in `driver-app/assets/`
   - Create `splash.png` (1242x2436) in `driver-app/assets/`
   - Create `adaptive-icon.png` (1024x1024) in `driver-app/assets/`
   - Create `favicon.png` (48x48) in `driver-app/assets/`

5. Start the Expo development server:
```bash
npm start
# or
expo start
```

6. Run on device/emulator:
   - Press `a` for Android emulator
   - Press `i` for iOS simulator
   - Scan QR code with Expo Go app on physical device

### 4. User App Setup

1. Navigate to the user app directory:
```bash
cd user-app
```

2. Install dependencies:
```bash
npm install
```

3. (Optional) Create a `.env` file:
```env
VITE_API_URL=https://transport-backend-xtva.onrender.com/api
VITE_SOCKET_URL=https://transport-backend-xtva.onrender.com
```

4. Start the user app:
```bash
npm run dev
```

The user app will run on `http://localhost:3001`

## Usage Guide

### Admin Panel

1. **Login**: Use admin credentials to login
2. **Add Buses**: Go to Buses page → Click "Add Bus" → Fill in details
3. **Add Drivers**: Go to Drivers page → Click "Add Driver" → Fill in details
4. **Assign Driver to Bus**: Go to Buses page → Click "Assign Driver" on a bus → Select driver
5. **View Live Map**: Go to Live Map page to see real-time bus locations
6. **View Analytics**: Go to Analytics page to see trip history and statistics

### Driver App

1. **Login**: Use driver credentials (created by admin)
2. **Start Trip**: Click "Start Trip" button (requires location permission)
3. **Location Tracking**: App automatically sends location every 5 seconds
4. **View Route**: See assigned route displayed on map
5. **Report Breakdown**: Click "Report Breakdown" if needed
6. **End Trip**: Click "End Trip" when trip is complete

## API Endpoints

### Authentication
- `POST /api/auth/admin/login` - Admin login
- `POST /api/auth/driver/login` - Driver login
- `POST /api/auth/admin/create-default` - Create default admin

### Buses
- `GET /api/buses` - Get all buses
- `GET /api/buses/:id` - Get single bus
- `POST /api/buses` - Create bus
- `PUT /api/buses/:id` - Update bus
- `DELETE /api/buses/:id` - Delete bus
- `POST /api/buses/:id/assign-driver` - Assign driver to bus
- `GET /api/buses/active/all` - Get active buses

### Drivers
- `GET /api/drivers` - Get all drivers
- `GET /api/drivers/:id` - Get single driver
- `POST /api/drivers` - Create driver
- `PUT /api/drivers/:id` - Update driver
- `DELETE /api/drivers/:id` - Delete driver

### Trips
- `POST /api/trips/start` - Start trip (Driver)
- `POST /api/trips/:id/end` - End trip (Driver)
- `POST /api/trips/:id/breakdown` - Report breakdown (Driver)
- `GET /api/trips` - Get all trips (Admin)
- `GET /api/trips/active/all` - Get active trips (Admin)
- `GET /api/trips/driver/active` - Get driver's active trip

### Locations
- `POST /api/locations` - Send location update (Driver)
- `GET /api/locations/trip/:tripId` - Get location history for trip
- `GET /api/locations/bus/:busId` - Get location history for bus

### Public Tracking (User App)
- `GET /api/public/routes` - Get available route names
- `GET /api/public/buses/active` - Get all active/breakdown buses
- `GET /api/public/buses/active?route=<routeName>` - Filter active buses by route
- `GET /api/public/buses/:id` - Get public bus details

## WebSocket Events

### Client → Server
- `subscribe` - Subscribe to bus location updates
- `unsubscribe` - Unsubscribe from bus location updates

### Server → Client
- `location-update` - Real-time location update
- `trip-started` - Trip started event
- `trip-ended` - Trip ended event
- `breakdown-alert` - Breakdown alert event

## Environment Variables

### Backend (.env)
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/transport_tracking
JWT_SECRET=your_super_secret_jwt_key
NODE_ENV=development
```

### Admin Panel (.env)
```
VITE_API_URL=http://localhost:5000/api
```

### User App (.env)
```
VITE_API_URL=https://transport-backend-xtva.onrender.com/api
VITE_SOCKET_URL=https://transport-backend-xtva.onrender.com
```

## Troubleshooting

### Backend Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env file
   - Verify MongoDB is accessible on the specified port

2. **Port Already in Use**
   - Change PORT in .env file
   - Or stop the process using port 5000

### Admin Panel Issues

1. **API Connection Error**
   - Verify backend is running
   - Check VITE_API_URL in .env
   - Check CORS settings in backend

2. **Build Errors**
   - Delete node_modules and reinstall
   - Check Node.js version (should be v16+)

### Driver App Issues

1. **Location Permission Denied**
   - Grant location permissions in device settings
   - For Android: Settings → Apps → Transport Driver → Permissions
   - For iOS: Settings → Privacy → Location Services

2. **API Connection Error**
   - Update API_BASE_URL in utils/api.js
   - For physical device, use your computer's IP address
   - Ensure backend is accessible from device

3. **Background Location Not Working**
   - Check app permissions
   - Ensure foreground service is enabled
   - Check device battery optimization settings

## Development Notes

- The system uses JWT tokens for authentication
- Location updates are sent every 5 seconds when trip is active
- WebSocket connections are used for real-time updates in admin panel
- Background location tracking works on both Android and iOS
- All timestamps are stored in UTC

## Production Deployment

### Backend
1. Set `NODE_ENV=production` in .env
2. Use a strong JWT_SECRET
3. Use MongoDB Atlas or a production MongoDB instance
4. Deploy to services like Heroku, AWS, or DigitalOcean

### Admin Panel
1. Build: `npm run build`
2. Deploy `dist/` folder to static hosting (Vercel, Netlify, etc.)
3. Update API URL to production backend

### Driver App
1. Build: `expo build:android` or `expo build:ios`
2. Submit to Google Play Store or Apple App Store
3. Update API URL to production backend

## License

This project is open source and available for use.

## Support

For issues or questions, please check the troubleshooting section or create an issue in the repository.

