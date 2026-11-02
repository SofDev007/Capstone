# Driver App - Transport Tracking System

React Native (Expo) mobile app for drivers to track their trips and send GPS locations.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Update API URL in `utils/api.js`:
```javascript
const API_BASE_URL = 'http://YOUR_IP_ADDRESS:5000/api';
```

3. Add required assets (icon.png, splash.png, etc.) to `assets/` folder

4. Start Expo:
```bash
npm start
# or
expo start
```

5. Run on device/emulator:
- Press `a` for Android
- Press `i` for iOS
- Scan QR code for physical device

## Important Notes

- Update API_BASE_URL for your network setup
- Grant location permissions when prompted
- Background location tracking requires proper permissions
- For physical devices, use your computer's IP address instead of localhost

