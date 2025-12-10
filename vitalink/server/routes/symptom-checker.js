// AI Symptom Checker Route
app.post('/api/chat/symptoms', async (req, res) => {
    try {
        const { message, patientId } = req.body

        if (!message) {
            return res.status(400).json({ error: 'Message is required' })
        }

        if (!patientId) {
            return res.status(400).json({ error: 'Patient ID is required' })
        }

        // Fetch patient health data from Supabase
        const healthData = await fetchPatientHealthData(patientId)

        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: `You are a helpful medical assistant for Vitalink, a heart failure monitoring application. 

CRITICAL DISCLAIMERS:
- You are NOT a doctor and cannot provide medical diagnoses
- Always advise users to consult their healthcare provider for medical advice
- If symptoms indicate an emergency (chest pain, difficulty breathing, stroke symptoms, severe bleeding), immediately tell them to call emergency services (911 or local emergency number)

YOUR ROLE:
- Provide general health information and potential causes of symptoms
- Suggest home remedies for minor ailments
- Help interpret health data trends
- Provide educational information about heart failure management
- Encourage medication adherence and lifestyle modifications

PATIENT CONTEXT:
The patient you're assisting has heart failure and is being monitored through Vitalink. You have access to their recent health data:

${healthData.summary}

RECENT VITALS:
- Heart Rate: ${healthData.hr}
- Blood Pressure: ${healthData.bp}
- SpO2: ${healthData.spo2}
- Weight: ${healthData.weight}
- Steps: ${healthData.steps}
- Recent Symptoms: ${healthData.symptoms}
- Current Medications: ${healthData.medications}

Use this data to provide personalized, contextual advice. If you notice concerning trends (e.g., rapid weight gain, low SpO2, irregular heart rate), mention them and strongly recommend contacting their doctor.

Be empathetic, clear, and concise. Use simple language that patients can understand.`
        })

        // Generate response
        const result = await model.generateContent(message)
        const response = result.response
        const text = response.text()

        return res.status(200).json({
            response: text,
            timestamp: new Date().toISOString()
        })

    } catch (error) {
        console.error('Symptom checker error:', error)
        return res.status(500).json({
            error: 'Failed to process your request. Please try again.',
            details: error.message
        })
    }
})

// Helper function to fetch patient health data
async function fetchPatientHealthData(patientId) {
    try {
        const today = new Date()
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(today.getDate() - 7)
        const dateStr = sevenDaysAgo.toISOString().split('T')[0]

        // Fetch recent vitals
        const [hrData, bpData, spo2Data, weightData, stepsData, symptomsData, medicationsData] = await Promise.all([
            // Heart Rate - last 7 days
            supabase
                .from('hr_day')
                .select('date, hr_min, hr_max, hr_avg')
                .eq('patient_id', patientId)
                .gte('date', dateStr)
                .order('date', { ascending: false })
                .limit(7),

            // Blood Pressure - last 7 readings
            supabase
                .from('bp_readings')
                .select('reading_date, reading_time, systolic, diastolic, pulse')
                .eq('patient_id', patientId)
                .order('reading_date', { ascending: false })
                .order('reading_time', { ascending: false })
                .limit(7),

            // SpO2 - last 7 days
            supabase
                .from('spo2_day')
                .select('date, spo2_min, spo2_max, spo2_avg')
                .eq('patient_id', patientId)
                .gte('date', dateStr)
                .order('date', { ascending: false })
                .limit(7),

            // Weight - last 7 days
            supabase
                .from('weight_day')
                .select('date, kg_min, kg_max, kg_avg')
                .eq('patient_id', patientId)
                .gte('date', dateStr)
                .order('date', { ascending: false })
                .limit(7),

            // Steps - last 7 days
            supabase
                .from('steps_day')
                .select('date, steps_total')
                .eq('patient_id', patientId)
                .gte('date', dateStr)
                .order('date', { ascending: false })
                .limit(7),

            // Symptoms - last 7 days
            supabase
                .from('symptom_log')
                .select('date, cough, sob_activity, leg_swelling, sudden_weight_gain, abd_discomfort, orthopnea, notes')
                .eq('patient_id', patientId)
                .gte('date', dateStr)
                .order('date', { ascending: false })
                .limit(7),

            // Current medications
            supabase
                .from('medication')
                .select('name, class, dosage, instructions')
                .eq('patient_id', patientId)
                .eq('active', true)
        ])

        // Format the data
        const formatHR = (data) => {
            if (!data || data.length === 0) return 'No recent data'
            const latest = data[0]
            return `Latest: ${latest.hr_avg} bpm (range: ${latest.hr_min}-${latest.hr_max}), Trend: ${data.length} days recorded`
        }

        const formatBP = (data) => {
            if (!data || data.length === 0) return 'No recent data'
            const latest = data[0]
            return `Latest: ${latest.systolic}/${latest.diastolic} mmHg, Pulse: ${latest.pulse} bpm, ${data.length} readings in past week`
        }

        const formatSpO2 = (data) => {
            if (!data || data.length === 0) return 'No recent data'
            const latest = data[0]
            return `Latest: ${latest.spo2_avg}% (range: ${latest.spo2_min}-${latest.spo2_max}%), ${data.length} days recorded`
        }

        const formatWeight = (data) => {
            if (!data || data.length === 0) return 'No recent data'
            const latest = data[0]
            const oldest = data[data.length - 1]
            const change = latest.kg_avg - oldest.kg_avg
            return `Latest: ${latest.kg_avg} kg, Change over week: ${change > 0 ? '+' : ''}${change.toFixed(1)} kg`
        }

        const formatSteps = (data) => {
            if (!data || data.length === 0) return 'No recent data'
            const avg = data.reduce((sum, d) => sum + d.steps_total, 0) / data.length
            return `Average: ${Math.round(avg)} steps/day over ${data.length} days`
        }

        const formatSymptoms = (data) => {
            if (!data || data.length === 0) return 'No symptoms logged recently'
            const latest = data[0]
            const symptoms = []
            if (latest.cough > 0) symptoms.push(`Cough (${latest.cough}/5)`)
            if (latest.sob_activity > 0) symptoms.push(`Shortness of breath (${latest.sob_activity}/5)`)
            if (latest.leg_swelling > 0) symptoms.push(`Leg swelling (${latest.leg_swelling}/5)`)
            if (latest.sudden_weight_gain > 0) symptoms.push(`Weight gain (${latest.sudden_weight_gain}/5)`)
            if (latest.abd_discomfort > 0) symptoms.push(`Abdominal discomfort (${latest.abd_discomfort}/5)`)
            if (latest.orthopnea > 0) symptoms.push(`Difficulty sleeping flat (${latest.orthopnea}/5)`)
            if (latest.notes) symptoms.push(`Notes: ${latest.notes}`)
            return symptoms.length > 0 ? symptoms.join(', ') : 'No significant symptoms'
        }

        const formatMedications = (data) => {
            if (!data || data.length === 0) return 'No active medications'
            return data.map(m => `${m.name} (${m.class}) - ${m.dosage || 'As prescribed'}`).join('; ')
        }

        return {
            summary: 'Heart failure patient being monitored through Vitalink',
            hr: formatHR(hrData.data),
            bp: formatBP(bpData.data),
            spo2: formatSpO2(spo2Data.data),
            weight: formatWeight(weightData.data),
            steps: formatSteps(stepsData.data),
            symptoms: formatSymptoms(symptomsData.data),
            medications: formatMedications(medicationsData.data)
        }

    } catch (error) {
        console.error('Error fetching patient health data:', error)
        return {
            summary: 'Unable to fetch patient data',
            hr: 'N/A',
            bp: 'N/A',
            spo2: 'N/A',
            weight: 'N/A',
            steps: 'N/A',
            symptoms: 'N/A',
            medications: 'N/A'
        }
    }
}
