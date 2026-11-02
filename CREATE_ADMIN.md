# How to Create Default Admin Account

The default admin account needs to be created before you can login. Follow these steps:

## Step 1: Start the Backend Server

Make sure the backend is running:

```bash
cd backend
npm run dev
```

You should see: `Server running on port 5000`

## Step 2: Create Default Admin

### Option 1: Using Browser (Easiest)

1. Open your browser
2. Go to: `http://localhost:5000/api/auth/admin/create-default`
3. You'll see an error (because it's a POST request, not GET)
4. Use one of the methods below instead

### Option 2: Using curl (Command Line)

**Windows (PowerShell):**
```powershell
Invoke-WebRequest -Uri http://localhost:5000/api/auth/admin/create-default -Method POST
```

**Windows (Command Prompt):**
```cmd
curl -X POST http://localhost:5000/api/auth/admin/create-default
```

**Mac/Linux:**
```bash
curl -X POST http://localhost:5000/api/auth/admin/create-default
```

### Option 3: Using Postman or Similar Tool

1. Open Postman (or similar API tool)
2. Create a new POST request
3. URL: `http://localhost:5000/api/auth/admin/create-default`
4. Click Send

### Option 4: Using Node.js Script

Create a file `create-admin.js` in the backend folder:

```javascript
import axios from 'axios';

axios.post('http://localhost:5000/api/auth/admin/create-default')
  .then(response => {
    console.log('Success:', response.data);
  })
  .catch(error => {
    console.error('Error:', error.response?.data || error.message);
  });
```

Then run: `node create-admin.js`

## Step 3: Verify Success

You should see a response like:
```json
{
  "message": "Default admin created successfully",
  "email": "admin@transport.com",
  "password": "admin123"
}
```

## Step 4: Login

Now you can login to the admin panel:
- URL: http://localhost:3000
- Email: `admin@transport.com`
- Password: `admin123`

## Troubleshooting

### Error: "Default admin already exists"
- This means the admin is already created
- Try logging in with the credentials above
- If login still fails, check MongoDB connection

### Error: "Cannot connect to server"
- Make sure backend is running on port 5000
- Check if MongoDB is running
- Verify the URL is correct

### Still can't login after creating admin
- Check browser console for errors
- Verify backend is running
- Check MongoDB connection in backend logs
- Try clearing browser cache/cookies

