# Complete Guide: Running Driver App on Android Emulator

This guide will walk you through everything from installing Android Studio to running the app on an emulator.

## Part 1: Install Android Studio

### Step 1: Download Android Studio

1. Go to: https://developer.android.com/studio
2. Click **"Download Android Studio"**
3. The file will be named something like `android-studio-2023.x.x-windows.exe`
4. Save it to your Downloads folder

### Step 2: Install Android Studio

1. **Run the installer** (double-click the downloaded file)
2. Click **Next** on the welcome screen
3. **Select components** (default is fine):
   - ✅ Android Studio
   - ✅ Android SDK
   - ✅ Android Virtual Device
   - ✅ Performance (Intel HAXM)
4. Click **Next**
5. **Accept the license agreements** and click **Next**
6. Choose installation location (default is fine) and click **Next**
7. Click **Install** (this may take 10-20 minutes)
8. Click **Finish** when done

### Step 3: First Launch Setup

1. **Launch Android Studio** (from Start Menu)
2. If asked to import settings, choose **"Do not import settings"**
3. Click **Next** on the welcome screen
4. Choose **Standard** installation type
5. Click **Next** and wait for components to download
6. Click **Finish** when setup completes

## Part 2: Create an Android Virtual Device (AVD)

### Step 1: Open AVD Manager

1. In Android Studio, click **More Actions** → **Virtual Device Manager**
   OR
   Click the **Device Manager** icon in the toolbar (phone icon)

### Step 2: Create New Virtual Device

1. Click **"Create Device"** button (top left)
2. **Select a device definition:**
   - Choose **"Phone"** category
   - Select **"Pixel 5"** or **"Pixel 6"** (recommended)
   - Click **Next**

3. **Select a system image:**
   - Choose the latest **API Level** (e.g., API 34, API 33)
   - Make sure it says **"Download"** next to it if not installed
   - Click **Download** if needed (this may take 10-30 minutes)
   - After download, click **Next**

4. **Verify Configuration:**
   - Device name: Keep default or change (e.g., "Pixel 5 API 34")
   - Click **Finish**

### Step 3: Start the Emulator

1. In the **Device Manager**, you'll see your virtual device
2. Click the **Play button** (▶) next to your device
3. Wait for the emulator to start (first time may take 2-5 minutes)
4. You should see an Android phone screen appear

**Note:** Keep the emulator running - don't close it!

## Part 3: Install Required Tools

### Step 1: Install Node.js (if not already installed)

1. Go to: https://nodejs.org/
2. Download the **LTS version** (recommended)
3. Run the installer
4. Click **Next** through all steps (defaults are fine)
5. Restart your computer if prompted

### Step 2: Install Expo CLI

1. Open **Command Prompt** or **PowerShell**
2. Run this command:
   ```bash
   npm install -g expo-cli
   ```
3. Wait for installation to complete

### Step 3: Verify Installation

1. Open Command Prompt
2. Run these commands to verify:
   ```bash
   node --version
   npm --version
   expo --version
   ```
3. You should see version numbers (not errors)

## Part 4: Setup the Driver App

### Step 1: Navigate to Driver App Folder

1. Open **Command Prompt** or **PowerShell**
2. Navigate to your project:
   ```bash
   cd D:\capstone\driver-app
   ```

### Step 2: Install Dependencies

1. Run this command:
   ```bash
   npm install
   ```
2. Wait for installation (may take 2-5 minutes)
3. You should see "added X packages" when done

### Step 3: Update API URL for Android Emulator

1. Open `driver-app/utils/api.js` in a text editor
2. Find this line (around line 8):
   ```javascript
   const API_BASE_URL = 'http://localhost:5000/api';
   ```
3. Change it to:
   ```javascript
   const API_BASE_URL = 'http://10.0.2.2:5000/api';
   ```
4. **Save the file**

**Why?** Android emulator uses `10.0.2.2` to access your computer's localhost.

### Step 4: Make Sure Backend is Running

1. Open a **new** Command Prompt/PowerShell window
2. Navigate to backend:
   ```bash
   cd D:\capstone\backend
   ```
3. Start the backend:
   ```bash
   npm run dev
   ```
4. You should see: "Server running on port 5000"
5. **Keep this window open** - don't close it!

## Part 5: Start the Driver App

### Step 1: Start Expo

1. In your **first** Command Prompt (the one in driver-app folder)
2. Make sure you're in the driver-app directory:
   ```bash
   cd D:\capstone\driver-app
   ```
3. Run:
   ```bash
   npm start
   ```
   OR
   ```bash
   expo start
   ```

### Step 2: What You'll See

You should see:
- A QR code in the terminal
- A message saying "Metro waiting on..."
- Options like:
  - Press `a` to open Android
  - Press `i` to open iOS simulator
  - Press `w` to open web

### Step 3: Open on Android Emulator

1. **Make sure your Android emulator is running** (from Part 2)
2. In the Expo terminal, press **`a`** (lowercase 'a')
3. Wait for the app to build and install (first time may take 2-5 minutes)
4. The app should open automatically in the emulator!

## Part 6: Create Driver Account (First Time)

Before you can login, you need to create a driver account:

### Step 1: Open Admin Panel

1. Open your web browser
2. Go to: http://localhost:3000
3. If admin panel isn't running, start it:
   ```bash
   cd D:\capstone\admin-panel
   npm run dev
   ```

### Step 2: Login to Admin Panel

- **Email:** `admin@transport.com`
- **Password:** `admin123`

### Step 3: Create a Driver

1. Click on **"Drivers"** in the sidebar
2. Click **"Add Driver"** button (top right)
3. Fill in the form:
   - **Name:** John Doe (or any name)
   - **Email:** driver@test.com (or any email)
   - **Phone:** 1234567890 (or any number)
   - **License Number:** DL12345 (or any number)
   - **Password:** driver123 (remember this!)
4. Click **"Save"**

### Step 4: Login to Driver App

1. In the Android emulator, you should see the login screen
2. Enter the email and password you just created
3. Click **"Login"**

## Troubleshooting

### Problem: "Cannot connect to server"

**Solution:**
1. Check that backend is running (should see "Server running on port 5000")
2. Verify API_BASE_URL in `utils/api.js` is `http://10.0.2.2:5000/api`
3. Make sure emulator is running

### Problem: "Expo CLI not found"

**Solution:**
```bash
npm install -g expo-cli
```

### Problem: "npm install" fails

**Solution:**
1. Delete `node_modules` folder
2. Delete `package-lock.json` file
3. Run `npm install` again

### Problem: Emulator is slow

**Solution:**
1. Close other applications
2. In Android Studio → AVD Manager → Edit (pencil icon) → Show Advanced Settings
3. Increase RAM: 2048 MB or 4096 MB
4. Enable "Use Host GPU"

### Problem: App won't install on emulator

**Solution:**
1. Make sure emulator is fully started (wait for home screen)
2. Try pressing `a` again in Expo terminal
3. Or click "Run on Android device/emulator" in the browser

### Problem: "Location permission denied"

**Solution:**
1. In the emulator, go to **Settings** (gear icon)
2. Go to **Apps** → **Expo Go** (or your app name)
3. Go to **Permissions**
4. Enable **Location** → Select **"Allow all the time"**

### Problem: Backend connection issues

**Solution:**
1. Make sure backend is running on port 5000
2. Check firewall isn't blocking port 5000
3. Verify API URL is `http://10.0.2.2:5000/api` (not localhost)

## Quick Reference Commands

```bash
# Start backend
cd D:\capstone\backend
npm run dev

# Start driver app
cd D:\capstone\driver-app
npm start
# Then press 'a' for Android

# Check if emulator is running
adb devices
```

## Summary Checklist

- [ ] Android Studio installed
- [ ] Android Virtual Device (AVD) created
- [ ] Emulator is running
- [ ] Node.js installed
- [ ] Expo CLI installed
- [ ] Driver app dependencies installed (`npm install`)
- [ ] API URL updated to `http://10.0.2.2:5000/api`
- [ ] Backend server is running
- [ ] Expo started (`npm start`)
- [ ] Pressed `a` to open on Android
- [ ] Driver account created in admin panel
- [ ] Logged in to driver app

## Need More Help?

If you get stuck:
1. Check the error message carefully
2. Make sure all steps are completed
3. Try restarting the emulator
4. Try restarting Expo (`Ctrl+C` then `npm start` again)

Good luck! 🚀

