-- Insert sample data for the last 30 days for ALL patients
-- This ensures that the charts have something to show.

-- HR Day (Random values between 60 and 100)
INSERT INTO public.hr_day (patient_id, date, hr_min, hr_max, hr_avg, hr_count)
SELECT 
    p.patient_id, 
    (CURRENT_DATE - (n || ' days')::interval)::date, 
    floor(random() * (70-60+1) + 60)::smallint, -- min
    floor(random() * (120-100+1) + 100)::smallint, -- max
    floor(random() * (90-70+1) + 70)::real, -- avg
    1
FROM public.patients p
CROSS JOIN generate_series(0, 29) n
ON CONFLICT (patient_id, date) DO NOTHING;

-- SpO2 Day (Random values between 95 and 100)
INSERT INTO public.spo2_day (patient_id, date, spo2_min, spo2_max, spo2_avg, spo2_count)
SELECT 
    p.patient_id, 
    (CURRENT_DATE - (n || ' days')::interval)::date, 
    floor(random() * (96-90+1) + 90)::real, -- min
    100::real, -- max
    floor(random() * (100-95+1) + 95)::real, -- avg
    1
FROM public.patients p
CROSS JOIN generate_series(0, 29) n
ON CONFLICT (patient_id, date) DO NOTHING;

-- Steps Day (Random values between 2000 and 10000)
INSERT INTO public.steps_day (patient_id, date, steps_total)
SELECT 
    p.patient_id, 
    (CURRENT_DATE - (n || ' days')::interval)::date, 
    floor(random() * (10000-2000+1) + 2000)::integer
FROM public.patients p
CROSS JOIN generate_series(0, 29) n
ON CONFLICT (patient_id, date) DO NOTHING;
