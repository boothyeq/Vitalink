# Vitalink Deployment Configuration

## ✅ Changes Made

### Frontend API Configuration
Updated `vitalink/web/src/lib/api.ts` to support **two separate backend servers**:

1. **Main Server** (`https://vitalink-n78f.onrender.com`)
   - Admin login/authentication
   - Patient management
   - Vitals data (HR, SpO2, Steps)
   - Reminders, medications, etc.

2. **BP Processing Server** (`https://vitalink-backend-ghcf.onrender.com`)
   - BP image OCR processing (`/api/process-image`)
   - Manual BP entry (`/api/add-manual-event`)
   - BP health events (`/api/health-events`)

### New Functions Added
- `bpServerUrl()` - Returns the BP backend URL from `VITE_BP_SERVER_URL` env variable
- Falls back to main server if BP URL not specified

### Updated BP Functions
- `processImage()` - Now uses `bpServerUrl()`
- `addManualEvent()` - Now uses `bpServerUrl()`
- `getHealthEvents()` - Now uses `bpServerUrl()`

---

## 🚀 Deployment Instructions

### For Vercel/Netlify/Render (Frontend)

Set these environment variables:

```env
VITE_SERVER_URL=https://vitalink-n78f.onrender.com
VITE_BP_SERVER_URL=https://vitalink-backend-ghcf.onrender.com
```

### For Local Development

Create `vitalink/web/.env`:

```env
VITE_SERVER_URL=https://vitalink-n78f.onrender.com
VITE_BP_SERVER_URL=https://vitalink-backend-ghcf.onrender.com
```

Or for local testing with both servers running locally:

```env
VITE_SERVER_URL=http://localhost:3001
VITE_BP_SERVER_URL=http://localhost:3001
```

---

## 📋 Backend Status

### Main Server (`vitalink-n78f.onrender.com`)
✅ Admin login route added
✅ Patient info routes added
✅ All admin routes working
⚠️ Needs Supabase admin table setup

### BP Server (`vitalink-backend-ghcf.onrender.com`)
✅ Image processing working
✅ Python/OpenCV configured
✅ Roboflow integration active

---

## 🔧 Next Steps

1. **Setup Supabase Admin Table**
   - Run the SQL script in Supabase dashboard
   - Insert admin user: `myhfguard.host@gmail.com`

2. **Deploy Frontend**
   - Push changes to GitHub
   - Deploy to Vercel/Netlify/Render
   - Set environment variables

3. **Test Everything**
   - Admin login
   - BP image processing
   - Patient management

---

## 🎯 API Endpoints Summary

### Main Server
- `POST /api/admin/login` - Admin authentication
- `GET /admin/patient-info` - Get patient details
- `GET /api/admin/patients` - List all patients
- `GET /patient/vitals` - Get patient vitals
- `GET /patient/summary` - Get patient summary

### BP Server
- `POST /api/process-image` - Process BP monitor image
- `POST /api/add-manual-event` - Add manual BP reading
- `GET /api/health-events` - Get BP health events
