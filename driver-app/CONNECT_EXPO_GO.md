# How to Connect Expo Go to Your Driver App

You're seeing Expo Go on your emulator - now you need to connect it to your running app!

## Method 1: Automatic Connection (Easiest)

1. **Make sure your Expo terminal is running:**
   - You should have a terminal with `npm start` or `expo start` running
   - You should see a QR code and options

2. **In the Expo terminal, press `a`** (lowercase 'a')
   - This should automatically open your app in the emulator
   - Wait 2-5 minutes for the first build

## Method 2: Manual URL Entry

If Method 1 doesn't work, use this:

1. **In Expo Go app** (on your emulator):
   - Tap **"Enter URL manually"** (the option with the arrow >)

2. **Get the connection URL from your terminal:**
   - Look at your Expo terminal
   - You should see something like:
     ```
     Metro waiting on exp://192.168.x.x:8081
     ```
   - Or look for a URL that starts with `exp://`

3. **Enter the URL in Expo Go:**
   - Type: `exp://localhost:8081` (for emulator)
   - OR use the IP address shown in your terminal
   - Tap **Connect** or **Go**

## Method 3: Scan QR Code (If Available)

1. **In Expo Go app:**
   - Tap the **"Scan QR code"** option (if visible)
   - Point at the QR code in your terminal/browser

## What You Should See

After connecting, you should see:
- A loading screen
- Then your **Driver Login** screen (not the Expo Go home screen)

## Troubleshooting

### "Unable to connect to server"
- Make sure `npm start` is running in the driver-app folder
- Check that backend is also running
- Try restarting Expo: Press `Ctrl+C` then `npm start` again

### App shows Expo Go home screen
- The app hasn't connected yet
- Try Method 2 (Enter URL manually)
- Use: `exp://localhost:8081`

### "Network request failed"
- Check API URL in `utils/api.js` is `http://10.0.2.2:5000/api`
- Make sure backend is running on port 5000

### Still stuck?
1. Close Expo Go app
2. In terminal, press `r` to reload
3. Press `a` again to open on Android

## Quick Steps Summary

1. ✅ Expo Go is open (you're here!)
2. ⏭️ In your terminal (where `npm start` is running), press **`a`**
3. ⏭️ Wait for app to load
4. ⏭️ You should see Driver Login screen

