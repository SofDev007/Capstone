# Simple Steps: Run Driver App on Android Emulator

## Step 1: Install Android Studio (One Time Setup)

1. Download from: https://developer.android.com/studio
2. Install it (takes 10-20 minutes)
3. Open Android Studio
4. Click **More Actions** → **Virtual Device Manager**
5. Click **Create Device**
6. Choose **Pixel 5** → **Next**
7. Download a system image (API 33 or 34) → **Next** → **Finish**
8. Click the **Play button** (▶) to start emulator
9. Wait for Android home screen to appear

## Step 2: Install Expo (One Time Setup)

Open Command Prompt and run:
```bash
npm install -g expo-cli
```

## Step 3: Setup Driver App (One Time)

1. Open Command Prompt
2. Go to driver app folder:
   ```bash
   cd D:\capstone\driver-app
   ```
3. Install packages:
   ```bash
   npm install
   ```

## Step 4: Update API URL (IMPORTANT!)

1. Open file: `D:\capstone\driver-app\utils\api.js`
2. Find line 8, change to:
   ```javascript
   const API_BASE_URL = 'http://10.0.2.2:5000/api';
   ```
3. Save the file

## Step 5: Start Everything

### Terminal 1: Start Backend
```bash
cd D:\capstone\backend
npm run dev
```
Keep this running!

### Terminal 2: Start Driver App
```bash
cd D:\capstone\driver-app
npm start
```

### In Expo Terminal:
1. Make sure Android emulator is running (from Step 1)
2. Press **`a`** (lowercase 'a')
3. Wait 2-5 minutes for app to install
4. App opens automatically!

## Step 6: Create Driver Account

1. Open browser: http://localhost:3000
2. Login: `admin@transport.com` / `admin123`
3. Go to **Drivers** → **Add Driver**
4. Fill form and save
5. Use those credentials in the app

## That's It! 🎉

If something doesn't work, see the detailed guide: `ANDROID_EMULATOR_GUIDE.md`

