# Quick Start - Login Credentials

## Admin Panel Login

**Default Admin Credentials:**
- **Email:** `admin@transport.com`
- **Password:** `admin123`

### Creating Default Admin

If the default admin doesn't exist, you need to create it first:

1. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Create default admin** (choose one method):

   **Method 1: Using curl**
   ```bash
   curl -X POST http://localhost:5000/api/auth/admin/create-default
   ```

   **Method 2: Using browser**
   - Open: http://localhost:5000/api/auth/admin/create-default
   - Change method to POST (use Postman or similar tool)

   **Method 3: Using PowerShell (Windows)**
   ```powershell
   Invoke-WebRequest -Uri http://localhost:5000/api/auth/admin/create-default -Method POST
   ```

3. **Login to Admin Panel:**
   - Go to http://localhost:3000
   - Use email: `admin@transport.com`
   - Use password: `admin123`

## Driver Login

Drivers are created by the admin through the admin panel. To login as a driver:

1. **Create a driver** (via admin panel):
   - Login to admin panel
   - Go to "Drivers" page
   - Click "Add Driver"
   - Fill in driver details (name, email, phone, license number, password)
   - Save

2. **Login to driver app:**
   - Use the email and password you set when creating the driver

## Important Notes

- The default admin can only be created once
- If you get "Default admin already exists", the admin is already created
- Change the default password after first login (you'll need to add this feature or update it via database)
- Driver passwords are set when creating the driver in the admin panel

