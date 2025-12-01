const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function checkDuplicateReading(supabase, patientId, sys, dia, pulse) {
    try {
        const tenSecondsAgo = new Date(Date.now() - 10000);
        const { data, error } = await supabase
            .from('bp_readings')
            .select('*')
            .eq('patient_id', patientId)
            .gte('created_at', tenSecondsAgo.toISOString())
            .limit(1);

        if (error) {
            console.error('Error checking duplicates:', error);
            return false;
        }

        if (data && data.length > 0) {
            const lastReading = data[0];
            // Check if values are similar (within 5 units)
            if (
                Math.abs(lastReading.systolic - sys) <= 5 &&
                Math.abs(lastReading.diastolic - dia) <= 5 &&
                Math.abs(lastReading.pulse - pulse) <= 5
            ) {
                return true; // Duplicate found
            }
        }
        return false;
    } catch (err) {
        console.error('Error in duplicate check:', err);
        return false;
    }
}

module.exports = (supabase, uploadMiddleware) => async (req, res) => {
    console.log('[processImage] Route called');
    uploadMiddleware(req, res, async (err) => {
        console.log('[processImage] Upload middleware executed');
        if (err) {
            console.error('[processImage] Upload error:', err);
            return res.status(400).json({ error: 'File upload failed.', details: err.message });
        }

        if (!req.file) {
            console.error('[processImage] No file in request');
            return res.status(400).json({ error: 'No image file provided.' });
        }

        // Get patientId from request body
        const patientId = req.body.patientId;
        if (!patientId) {
            console.error('[processImage] No patientId provided');
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Patient ID is required.' });
        }

        console.log('[processImage] File received:', req.file.filename);
        console.log('[processImage] Patient ID:', patientId);

        const imagePath = req.file.path;
        const scriptPath = path.join(__dirname, '../../digit_recognition_backend.py');

        console.log('[processImage] Image path:', imagePath);
        console.log('[processImage] Script path:', scriptPath);

        if (!fs.existsSync(scriptPath)) {
            console.error('[processImage] Python script not found at:', scriptPath);
            fs.unlinkSync(imagePath);
            return res.status(500).json({ error: 'OCR script not found on server.' });
        }

        console.log('[processImage] Starting Python process...');
        // Use python3 explicitly for Linux/Docker environments
        const pythonArgs = ['python3', scriptPath, imagePath];
        const pythonProcess = spawn(pythonArgs[0], pythonArgs.slice(1));

        pythonProcess.on('error', (err) => {
            console.error('[processImage] Failed to start Python process:', err);
            return res.status(500).json({ error: 'Failed to start OCR process.', details: err.message });
        });

        let rawOutput = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            rawOutput += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            console.log('[processImage] Python process closed with code:', code);
            fs.unlinkSync(imagePath);

            if (code !== 0) {
                console.error('[processImage] Python error output:', errorOutput);
                return res.status(500).json({
                    error: 'OCR processing failed.',
                    details: errorOutput || rawOutput
                });
            }

            try {
                console.log('[processImage] Parsing Python output...');
                console.log('[processImage] Raw output:', rawOutput.substring(0, 200)); // Log first 200 chars

                // Find the JSON in the output (it starts with '{')
                const jsonStartIndex = rawOutput.indexOf('{');
                if (jsonStartIndex === -1) {
                    throw new Error('No JSON found in Python output');
                }
                const jsonString = rawOutput.substring(jsonStartIndex);
                const jsonResult = JSON.parse(jsonString);
                console.log('[processImage] Parsed result:', jsonResult);

                if (jsonResult.error) {
                    return res.status(400).json({ error: jsonResult.error, debugImage: jsonResult.debugImage });
                }

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

                    // REMOVED AUTO-SAVE: The frontend will handle saving after user verification.
                    // console.log('[processImage] Inserting to database...');
                    // ... insertion code removed ...
                    console.log('[processImage] OCR successful, returning values for verification.');
                }

                console.log('[processImage] Sending response...');
                res.json(jsonResult);
            } catch (e) {
                console.error('[processImage] Error parsing/processing:', e);
                res.status(500).json({ error: 'Failed to parse result from script.', details: rawOutput });
            }
        });
    });
};
