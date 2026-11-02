# Quick Setup Guide

Follow these steps to get the entire system running:

## Step 1: Install MongoDB

1. Download and install MongoDB from https://www.mongodb.com/try/download/community
2. Start MongoDB service:
   - Windows: MongoDB should start automatically as a service
   - macOS: `brew services start mongodb-community`
   - Linux: `sudo systemctl start mongod`

## Step 2: Setup Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and set your MongoDB URI and JWT_SECRET
npm run dev
```

Create default admin:
```bash
curl -X POST http://localhost:5000/api/auth/admin/create-default
```

## Step 3: Setup Admin Panel

```bash
cd admin-panel
npm install
npm run dev
```

Open http://localhost:3000 and login with:
- Email: `admin@transport.com`
- Password: `admin123`

## Step 4: Setup Driver App

```bash
cd driver-app
npm install
```

Update `driver-app/utils/api.js`:
```javascript
const API_BASE_URL = 'http://YOUR_COMPUTER_IP:5000/api';
// For Android emulator: http://10.0.2.2:5000/api
// For iOS simulator: http://localhost:5000/api
```

Add placeholder assets or create:
- `assets/icon.png` (1024x1024)
- `assets/splash.png` (1242x2436)
- `assets/adaptive-icon.png` (1024x1024)
- `assets/favicon.png` (48x48)

Start Expo:
```bash
npm start
```

## Step 5: Create Test Data

1. Login to admin panel
2. Add a bus (Buses → Add Bus)
3. Add a driver (Drivers → Add Driver)
4. Assign driver to bus (Buses → Assign Driver)

## Step 6: Test the System

1. Login to driver app with driver credentials
2. Start a trip
3. View live location in admin panel (Live Map page)

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running: `mongosh` should connect
- Check MongoDB URI in backend/.env

### Port Already in Use
- Backend: Change PORT in backend/.env
- Admin Panel: Change port in admin-panel/vite.config.js

### Driver App Can't Connect
- Check API_BASE_URL in driver-app/utils/api.js
- Ensure backend is accessible from device/emulator
- Check firewall settings

### Location Permission Issues
- Grant location permissions in device settings
- For Android: Enable "Allow all the time" for location
- For iOS: Enable "Always" location permission

