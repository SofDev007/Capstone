# How to Start the Driver App

## Prerequisites

1. **Node.js** installed (v16 or higher)
2. **Expo CLI** installed globally:
   ```bash
   npm install -g expo-cli
   ```
3. **Backend server** must be running on port 5000
4. **Android Studio** (for Android emulator) OR **Xcode** (for iOS simulator) OR **Expo Go app** on your phone

## Step 1: Install Dependencies

```bash
cd driver-app
npm install
```

## Step 2: Update API URL

**IMPORTANT:** Update the API URL in `driver-app/utils/api.js` based on where you're running:

### For Android Emulator:
```javascript
const API_BASE_URL = 'http://10.0.2.2:5000/api';
```

### For iOS Simulator:
```javascript
const API_BASE_URL = 'http://localhost:5000/api';
```

### For Physical Device (Phone):
1. Find your computer's IP address:
   - **Windows:** Open Command Prompt and run `ipconfig` (look for IPv4 Address)
   - **Mac/Linux:** Run `ifconfig` or `ip addr`
2. Update the URL:
   ```javascript
   const API_BASE_URL = 'http://YOUR_IP_ADDRESS:5000/api';
   // Example: http://192.168.1.100:5000/api
   ```

## Step 3: Add Assets (Optional but Recommended)

Create placeholder images in `driver-app/assets/`:
- `icon.png` (1024x1024)
- `splash.png` (1242x2436)
- `adaptive-icon.png` (1024x1024)
- `favicon.png` (48x48)

Or use online tools to generate them.

## Step 4: Start the App

### Option 1: Using npm
```bash
npm start
```

### Option 2: Using Expo CLI
```bash
expo start
```

This will open the Expo DevTools in your browser.

## Step 5: Run on Device/Emulator

### For Android Emulator:
1. Make sure Android emulator is running
2. In the Expo terminal, press `a`
3. Or click "Run on Android device/emulator" in the browser

### For iOS Simulator (Mac only):
1. Make sure Xcode is installed
2. In the Expo terminal, press `i`
3. Or click "Run on iOS simulator" in the browser

### For Physical Device:
1. Install **Expo Go** app on your phone:
   - [Android - Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS - App Store](https://apps.apple.com/app/expo-go/id982107779)
2. Make sure your phone and computer are on the same WiFi network
3. Scan the QR code shown in the terminal or browser
4. The app will open in Expo Go

## Step 6: Login

1. **Create a driver account first** (via admin panel):
   - Login to admin panel: http://localhost:3000
   - Go to "Drivers" page
   - Click "Add Driver"
   - Fill in details and set password
   - Save

2. **Login to driver app**:
   - Use the email and password you set when creating the driver

## Troubleshooting

### "Cannot connect to server"
- Check API_BASE_URL in `utils/api.js`
- Make sure backend is running on port 5000
- For physical device, ensure both devices are on same WiFi
- Check firewall settings

### "Location permission denied"
- Grant location permissions in device settings
- For Android: Settings → Apps → Transport Driver → Permissions → Location → Allow all the time
- For iOS: Settings → Privacy → Location Services → Expo Go → Always

### "Expo CLI not found"
```bash
npm install -g expo-cli
```

### App won't start
- Clear cache: `expo start -c`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

### QR code not working
- Make sure phone and computer are on same WiFi
- Try using tunnel mode: `expo start --tunnel`

## Quick Commands Reference

```bash
# Start app
npm start

# Start with cleared cache
expo start -c

# Start for Android only
npm run android

# Start for iOS only (Mac)
npm run ios

# Start for web
npm run web
```

