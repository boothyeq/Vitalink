// FILE: backend/routes/processImage.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// multer setup
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir); }
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage: storage });

// We need to wrap the multer middleware
const uploadMiddleware = upload.single('image');

module.exports = (req, res) => {
    uploadMiddleware(req, res, (err) => {
        if (err) {
            return res.status(500).json({ error: "File upload failed." });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided.' });
        }

        const imagePath = req.file.path;
        const scriptPath = path.join(__dirname, '..', 'digit_recognition_backend.py');
        const pythonArgs = [scriptPath, imagePath]; 
        const pythonProcess = spawn('python', pythonArgs);

        let rawOutput = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => { rawOutput += data.toString(); });
        pythonProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });

        pythonProcess.on('close', async (code) => {
            fs.unlink(imagePath, (err) => { if (err) console.error("Error deleting file:", err); });

            if (code !== 0 || errorOutput) {
                return res.status(500).json({ error: 'Python script failed.', details: errorOutput });
            }

            try {
                const jsonStartIndex = rawOutput.indexOf('{');
                if (jsonStartIndex === -1) throw new Error("No JSON in Python output.");
                const jsonString = rawOutput.substring(jsonStartIndex);
                const jsonResult = JSON.parse(jsonString);

                if (jsonResult.error) {
                    return res.status(400).json(jsonResult);
                }

                // --- SAVE TO NEW TABLE STRUCTURE ---
                if (jsonResult.sys && jsonResult.dia && jsonResult.pulse) {
                    const sys = parseInt(jsonResult.sys);
                    const dia = parseInt(jsonResult.dia);
                    const pulse = parseInt(jsonResult.pulse);

                    if (isNaN(sys) || isNaN(dia) || isNaN(pulse)) {
                        return res.status(400).json({ error: 'Invalid numeric values received from OCR.' });
                    }

                    if (sys < 70 || sys > 260) {
                        return res.status(400).json({ error: 'SYS value is out of range (70-260).' });
                    }
                    if (dia < 40 || dia > 160) {
                        return res.status(400).json({ error: 'DIA value is out of range (40-160).' });
                    }
                    if (pulse < 30 || pulse > 240) {
                        return res.status(400).json({ error: 'PULSE value is out of range (30-240).' });
                    }
                    const MOCK_USER_ID = process.env.MOCK_USER_ID || '00000000-0000-0000-0000-000000000001';
                    let { error: supabaseError } = await supabase.from('health_events').insert([{ 
                        type: 'blood_pressure',
                        value_1: sys, 
                        value_2: dia, 
                        value_3: pulse,
                        user_id: MOCK_USER_ID
                    }]);
                    if (supabaseError && supabaseError.code === '23503') {
                        const retry = await supabase.from('health_events').insert([{ 
                            type: 'blood_pressure',
                            value_1: parseInt(jsonResult.sys), 
                            value_2: parseInt(jsonResult.dia), 
                            value_3: parseInt(jsonResult.pulse)
                        }]);
                        supabaseError = retry.error;
                    }
                    if (supabaseError) console.error('Supabase insert error:', supabaseError);
                }

                res.json(jsonResult);
            } catch (e) {
                res.status(500).json({ error: 'Failed to parse result from script.', details: rawOutput });
            }
        });
    });
};