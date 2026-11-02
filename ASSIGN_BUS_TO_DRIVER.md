# How to Assign a Bus to a Driver

You're getting "no bus assigned to driver" error. Here's how to fix it:

## Step-by-Step Instructions

### Step 1: Login to Admin Panel

1. Open your browser
2. Go to: http://localhost:3000
3. Login with:
   - **Email:** `admin@transport.com`
   - **Password:** `admin123`

### Step 2: Create a Bus (If You Don't Have One)

1. In the admin panel, click **"Buses"** in the sidebar
2. Click **"Add Bus"** button (top right)
3. Fill in the form:
   - **Bus Number:** e.g., "BUS-001"
   - **Plate Number:** e.g., "ABC-1234"
   - **Capacity:** e.g., "50"
   - **Route:** e.g., "Route A - Downtown to Airport"
4. Click **"Save"**

### Step 3: Create a Driver (If You Don't Have One)

1. Click **"Drivers"** in the sidebar
2. Click **"Add Driver"** button (top right)
3. Fill in the form:
   - **Name:** e.g., "John Doe"
   - **Email:** e.g., "driver@test.com" (use this to login in driver app)
   - **Phone:** e.g., "1234567890"
   - **License Number:** e.g., "DL12345"
   - **Password:** e.g., "driver123" (remember this!)
4. Click **"Save"**

### Step 4: Assign Bus to Driver

1. Go to **"Buses"** page
2. Find the bus you want to assign
3. In the **"Driver"** column, you'll see either:
   - "Not assigned" or an "Assign Driver" button
4. Click **"Assign Driver"** button
5. A dialog will open showing available drivers
6. Click **"Assign"** next to the driver you want
7. The bus is now assigned to that driver!

### Step 5: Verify Assignment

1. Go to **"Drivers"** page
2. Find your driver
3. Check the **"Assigned Bus"** column
4. It should show the bus number and route

### Step 6: Login to Driver App

1. Open the driver app on your emulator
2. Login with the driver credentials you created
3. Now you should be able to start a trip!

## Quick Checklist

- [ ] Bus created in admin panel
- [ ] Driver created in admin panel
- [ ] Bus assigned to driver (via Buses page → Assign Driver)
- [ ] Driver logged in to driver app
- [ ] Try starting trip again

## Alternative: Assign Driver to Bus from Drivers Page

You can also assign a bus from the Drivers page:

1. Go to **"Drivers"** page
2. Find your driver
3. Click **"Edit"** (pencil icon)
4. In the edit dialog, you can assign a bus (if this option is available)

## Troubleshooting

### "No drivers available to assign"
- Make sure you've created at least one driver
- Check that the driver is marked as "Active"

### "Bus already assigned to another driver"
- Unassign the bus from the current driver first
- Then assign it to the new driver

### Still getting "no bus assigned" error
- Make sure you're logged in with the correct driver account
- Verify the assignment in the admin panel
- Try logging out and logging back in to the driver app

