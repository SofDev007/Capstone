# 10. USER MANUAL

This chapter is a user manual for the Real-Time Public Transport Tracking System. This chapter walks the user through system setup and installation, and user guides for passengers and drivers.

## 10.1. System Setup and Installation

### 10.1.1. Prerequisites
In order to run and use the deployed system, the following are required:
- Node.js v18 or later (available from https://nodejs.org/) if running services locally.
- MongoDB Atlas account or local MongoDB Community Server (for local backend execution).
- Google Chrome 90+, Mozilla Firefox 88+ or Microsoft Edge 90+.
- Android mobile device for installing Expo-generated builds (driver and user apps).
- Stable internet connection for real-time map and WebSocket updates.

### 10.1.2. Backend setup steps (for local development)
1. Open a terminal. Change your current working directory to the backend folder:
   ```bash
   cd backend
   ```
2. Run the following command to install dependencies:
   ```bash
   npm install
   ```
3. Create a file at `backend/.env` to store these values:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/transport_tracking
   JWT_SECRET=your_long_random_secret_key_here
   NODE_ENV=development
   ```
4. Start the backend in development mode:
   ```bash
   npm run dev
   ```
5. Test the server by checking startup logs. You should see messages for MongoDB connection and server port.
6. Optional health check: open `http://localhost:5000/api/health`.

### 10.1.3. Frontend/Admin setup steps
1. Open another terminal. Go to the admin panel folder:
   ```bash
   cd admin-panel
   ```
2. Run:
   ```bash
   npm install
   npm run dev
   ```
3. Open the admin panel in browser:
   - `https://admin-panel-eight-sooty.vercel.app/` (deployed)
   - or local Vite URL (if running locally).
4. Buses management page:
   - `https://admin-panel-eight-sooty.vercel.app/buses`

### 10.1.4. Mobile app installation steps
1. Driver App build:
   - `https://expo.dev/accounts/nitin1222/projects/transport-driver-capstone/builds/0fea5f56-e708-4441-b659-19633e8e7228`
2. User App build:
   - `https://expo.dev/accounts/nitin1222/projects/bus-tracker-user/builds/e569f3f2-fb5e-49b7-b3b7-74b700bf3722`
3. Install APK/package on Android device and allow required permissions.

## 10.2. Passenger (Citizen) User Guide

### 10.2.1. Installing and opening the user app
1. Open the User App build link.
2. Install the generated app package on your phone.
3. Launch the app to open the live tracking dashboard.

### 10.2.2. Viewing active buses
1. The app shows active buses on map and in a list.
2. Select a route filter to view buses for a specific route.
3. Keep "All Active Routes" selected to view all available active buses.

### 10.2.3. Viewing bus details and route
1. Tap a bus marker on the map or tap a bus card from the list.
2. View bus number, route, and current status.
3. If route coordinates are available, route polyline is shown on the map.

### 10.2.4. Real-time updates
1. Bus locations update automatically through socket events.
2. Trip start/end and breakdown updates are reflected without manual refresh.

## 10.3. Driver (Pickup Agent Equivalent) User Guide

### 10.3.1. Logging in as a driver
1. Open the Driver App.
2. Enter email and password provided by the system administrator.
3. After login, you are directed to the driver home dashboard.

### 10.3.2. Starting a trip
1. Ensure your account is assigned to a bus by admin.
2. Tap **Start Trip**.
3. The app captures your current GPS location and starts the trip.
4. Background and foreground location tracking are activated.

### 10.3.3. Reporting a breakdown
1. Tap **Report Breakdown** during an active trip.
2. Enter a clear reason for the issue.
3. Submit the report to alert admin in real time.

### 10.3.4. Completing a trip
1. Tap **End Trip** when route service is completed.
2. Confirm the action.
3. The system marks trip as completed and sets bus status accordingly.

## 10.4. Admin Panel User Guide

### 10.4.1. Logging in as admin
1. Open `https://admin-panel-eight-sooty.vercel.app/`.
2. Enter admin credentials and click login.
3. Dashboard opens with key transport statistics.

### 10.4.2. Managing buses
1. Open the **Buses** section.
2. Add, edit, or delete bus records.
3. Assign drivers to buses using **Assign Driver** action.

### 10.4.3. Managing drivers
1. Open the **Drivers** section.
2. Add driver name, email, phone, license number, and password.
3. Update or remove driver records when required.

### 10.4.4. Live map and analytics
1. Open **Live Map** to monitor active buses in real time.
2. Open **Analytics** to view trip history, status, and breakdown reports.

## 10.5. Troubleshooting

### 10.5.1. Admin panel not loading
- Verify internet connection.
- Retry using Chrome/Firefox/Edge.
- Confirm the deployment URL is reachable.

### 10.5.2. Driver cannot start trip
- Ensure driver is assigned to a bus.
- Ensure location permission is granted.
- Ensure backend/API is reachable for the app build.

### 10.5.3. No real-time updates in apps
- Confirm GPS is enabled.
- Confirm an active trip is running.
- Check network connectivity.

### 10.5.4. User app shows no buses
- Verify at least one bus is currently active.
- Remove strict route filter and retry.
