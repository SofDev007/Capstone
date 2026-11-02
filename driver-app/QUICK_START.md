# Quick Start - Driver App

## Your Computer's IP Address
**192.168.18.72** - Use this for physical device testing

## Step-by-Step Instructions

### 1. Install Dependencies
```bash
cd driver-app
npm install
```

### 2. Update API URL (IMPORTANT!)

Edit `driver-app/utils/api.js` and change line 4:

**For Android Emulator:**
```javascript
const API_BASE_URL = 'http://10.0.2.2:5000/api';
```

**For iOS Simulator:**
```javascript
const API_BASE_URL = 'http://localhost:5000/api';
```

**For Physical Device (Your Phone):**
```javascript
const API_BASE_URL = 'http://192.168.18.72:5000/api';
```

### 3. Make Sure Backend is Running
```bash
cd backend
npm run dev
```
Backend should be running on http://localhost:5000

### 4. Start the Driver App
```bash
cd driver-app
npm start
```

### 5. Run on Device

**Option A: Android Emulator**
- Open Android Studio
- Start an emulator
- In Expo terminal, press `a`

**Option B: Physical Device**
1. Install **Expo Go** app on your phone
2. Make sure phone and computer are on same WiFi
3. Scan QR code from terminal/browser
4. App opens in Expo Go

### 6. Create Driver Account (First Time)

Before you can login, create a driver account:

1. Open admin panel: http://localhost:3000
2. Login: `admin@transport.com` / `admin123`
3. Go to **Drivers** page
4. Click **Add Driver**
5. Fill in:
   - Name: (e.g., "John Doe")
   - Email: (e.g., "driver@test.com")
   - Phone: (e.g., "1234567890")
   - License Number: (e.g., "DL12345")
   - Password: (e.g., "driver123")
6. Click **Save**

### 7. Login to Driver App

Use the email and password you just created!

## Common Issues

**"Cannot connect to server"**
- Check API_BASE_URL matches your setup
- Make sure backend is running
- For physical device: ensure same WiFi network

**"Location permission denied"**
- Grant location permission in phone settings
- Android: Settings → Apps → Expo Go → Permissions → Location → Allow all the time

**Need to change API URL?**
- Edit `driver-app/utils/api.js` line 4
- Restart Expo (press `r` in terminal or restart)




