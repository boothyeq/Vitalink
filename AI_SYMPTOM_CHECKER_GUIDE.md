# AI Symptom Checker Implementation Guide

## ✅ Implementation Complete!

I've successfully implemented an AI Symptom Checker feature using Google Gemini API with full patient health data integration.

---

## 🎯 Features Implemented

### Backend (`server.js`)
1. **Google Gemini AI Integration**
   - Installed `@google/generative-ai` package
   - Using `gemini-1.5-flash` model
   - Comprehensive system instructions with medical disclaimers

2. **Patient Health Data Context**
   - Fetches last 7 days of patient vitals from Supabase:
     - Heart Rate (HR) - min/max/avg
     - Blood Pressure (BP) - systolic/diastolic/pulse
     - SpO2 - oxygen saturation levels
     - Weight - with weekly change tracking
     - Steps - daily activity
     - Symptom logs - all tracked symptoms
     - Current medications - active prescriptions

3. **API Endpoint**
   - `POST /api/chat/symptoms`
   - Requires: `message` (user question) and `patientId`
   - Returns: AI response with timestamp

### Frontend (`SymptomChecker.tsx`)
1. **Chat Interface**
   - Clean, modern UI using Shadcn components
   - Message history with user/AI distinction
   - Real-time loading indicators
   - Auto-scroll to latest messages

2. **User Experience**
   - Welcome message on load
   - Suggested questions for first-time users
   - Medical disclaimer prominently displayed
   - Error handling with user-friendly messages

3. **Navigation**
   - Added "AI Assistant" to main navigation
   - Sparkles icon for visual appeal
   - Accessible from all pages

---

## 📋 Setup Instructions

### 1. Environment Variables

Add to `vitalink/server/.env`:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

**How to get API key:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Copy and paste into `.env` file

### 2. Install Dependencies

Backend dependencies are already installed:
```bash
cd vitalink/server
npm install  # @google/generative-ai is already added
```

### 3. Deploy

**Backend (Render):**
- Add `GEMINI_API_KEY` to environment variables in Render dashboard
- Redeploy the service

**Frontend (Vercel/Netlify):**
- No additional env vars needed (uses existing `VITE_SERVER_URL`)
- Deploy as usual

---

## 🔒 Safety Features

### Medical Disclaimers
The AI is instructed to:
- ❌ **NOT** provide medical diagnoses
- ✅ Advise users to consult healthcare providers
- 🚨 Immediately direct to emergency services for serious symptoms
- 📊 Provide general health information only
- 💊 Encourage medication adherence

### Emergency Detection
The AI will recognize and respond appropriately to:
- Chest pain
- Difficulty breathing
- Stroke symptoms
- Severe bleeding
- Other emergency conditions

---

## 📊 Health Data Integration

The AI has access to:

| Data Type | Source Table | Time Range | Details |
|-----------|--------------|------------|---------|
| Heart Rate | `hr_day` | 7 days | Min/Max/Avg BPM |
| Blood Pressure | `bp_readings` | Last 7 readings | Systolic/Diastolic/Pulse |
| SpO2 | `spo2_day` | 7 days | Min/Max/Avg % |
| Weight | `weight_day` | 7 days | With weekly change |
| Steps | `steps_day` | 7 days | Daily totals |
| Symptoms | `symptom_log` | 7 days | All tracked symptoms |
| Medications | `medication` | Current | Active prescriptions |

---

## 🎨 UI Components Used

- `Card` - Main container
- `ScrollArea` - Message history
- `Input` - User message input
- `Button` - Send and suggested questions
- `Navigation` - Top nav bar
- Icons: `Bot`, `User`, `Sparkles`, `AlertCircle`, `Send`, `Loader2`

---

## 🔄 User Flow

1. User navigates to "AI Assistant" from main menu
2. Sees welcome message and suggested questions
3. Types question or clicks suggested question
4. AI fetches patient's health data from Supabase
5. AI generates personalized response using Gemini
6. Response displayed in chat with timestamp
7. User can continue conversation

---

## 📝 Example Interactions

**User:** "What do my recent vitals indicate?"
**AI:** *Analyzes HR, BP, SpO2, weight trends and provides personalized insights*

**User:** "I'm feeling short of breath"
**AI:** *Checks recent SpO2 and symptom logs, provides advice, recommends doctor visit*

**User:** "How can I manage my heart failure better?"
**AI:** *Provides education on medication adherence, lifestyle, monitoring*

---

## 🚀 Testing Checklist

- [ ] Backend server starts without errors
- [ ] `/api/chat/symptoms` endpoint responds
- [ ] Frontend loads AI Assistant page
- [ ] Welcome message displays
- [ ] Can send messages and receive responses
- [ ] Patient health data is included in AI context
- [ ] Error handling works (try without API key)
- [ ] Navigation link works
- [ ] Mobile responsive

---

## 🐛 Troubleshooting

### "Failed to process your request"
- Check `GEMINI_API_KEY` is set correctly
- Verify API key is valid and has quota
- Check server logs for detailed error

### "Patient ID is required"
- User must be logged in
- Check Supabase session is valid

### No health data in responses
- Verify patient has data in Supabase tables
- Check database table names match schema
- Review server logs for Supabase query errors

---

## 📁 Files Modified/Created

### Backend
- ✅ `vitalink/server/server.js` - Added AI route and helper function
- ✅ `vitalink/server/package.json` - Added `@google/generative-ai`
- ✅ `vitalink/server/routes/symptom-checker.js` - Standalone route file (reference)

### Frontend
- ✅ `vitalink/web/src/pages/SymptomChecker.tsx` - New chat interface
- ✅ `vitalink/web/src/lib/api.ts` - Added `sendSymptomMessage` function
- ✅ `vitalink/web/src/App.tsx` - Added route
- ✅ `vitalink/web/src/components/Navigation.tsx` - Added nav item

---

## 🎉 Success!

The AI Symptom Checker is now fully integrated with:
- ✅ Google Gemini AI
- ✅ Patient health data from Supabase
- ✅ Medical safety disclaimers
- ✅ Modern chat interface
- ✅ Navigation integration
- ✅ Error handling

**Next Steps:**
1. Add `GEMINI_API_KEY` to environment variables
2. Deploy to production
3. Test with real patient data
4. Monitor usage and feedback
