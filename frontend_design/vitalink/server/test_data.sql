-- Test Data for VitaLink Database
-- Run these queries in your Supabase SQL Editor to create sample data

-- 1. Create sample patients
INSERT INTO public.patients (patient_id, first_name, last_name, dob, date_of_birth)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'John', 'Doe', '1980-05-15', '1980-05-15'),
    ('22222222-2222-2222-2222-222222222222', 'Jane', 'Smith', '1975-08-22', '1975-08-22'),
    ('33333333-3333-3333-3333-333333333333', 'Bob', 'Johnson', '1990-03-10', '1990-03-10')
ON CONFLICT (patient_id) DO NOTHING;

-- 2. Create sample BP readings for John Doe
INSERT INTO public.bp_readings (patient_id, reading_date, reading_time, systolic, diastolic, pulse)
VALUES 
    ('11111111-1111-1111-1111-111111111111', CURRENT_DATE, '08:30:00', 120, 80, 72),
    ('11111111-1111-1111-1111-111111111111', CURRENT_DATE, '14:15:00', 125, 82, 75),
    ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - 1, '09:00:00', 118, 78, 70),
    ('22222222-2222-2222-2222-222222222222', CURRENT_DATE, '10:00:00', 130, 85, 78),
    ('33333333-3333-3333-3333-333333333333', CURRENT_DATE, '16:30:00', 115, 75, 68);

-- 3. Create sample heart rate data
INSERT INTO public.hr_sample (patient_id, time_ts, bpm, record_uid)
VALUES 
    ('11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '1 hour', 72, 'hr_001'),
    ('11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '2 hours', 75, 'hr_002'),
    ('22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '30 minutes', 80, 'hr_003');

-- 4. Create sample steps data
INSERT INTO public.steps_event (patient_id, start_ts, end_ts, count, record_uid)
VALUES 
    ('11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours', 1500, 'steps_001'),
    ('22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours', 2000, 'steps_002');

-- 5. Create admin account (if not exists)
INSERT INTO public.admins (email, password_hash, first_name, last_name, is_active)
VALUES (
    'myhfguard.host@gmail.com',
    encode(digest('don''tmissabeat', 'sha256'), 'hex'),
    'Admin',
    'User',
    true
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = encode(digest('don''tmissabeat', 'sha256'), 'hex'),
    is_active = true;

-- Verify the data was inserted
SELECT 'Patients' as table_name, COUNT(*) as count FROM public.patients
UNION ALL
SELECT 'BP Readings', COUNT(*) FROM public.bp_readings
UNION ALL
SELECT 'HR Samples', COUNT(*) FROM public.hr_sample
UNION ALL
SELECT 'Steps Events', COUNT(*) FROM public.steps_event
UNION ALL
SELECT 'Admins', COUNT(*) FROM public.admins;

-- View sample data
SELECT * FROM public.patients ORDER BY created_at DESC LIMIT 5;
SELECT * FROM public.bp_readings ORDER BY created_at DESC LIMIT 10;
SELECT * FROM public.admins;
