-- Enable RLS on vitals tables
ALTER TABLE public.hr_day ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spo2_day ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steps_day ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp_readings ENABLE ROW LEVEL SECURITY;

-- HR Day
DROP POLICY IF EXISTS "Allow anon select hr_day" ON public.hr_day;
DROP POLICY IF EXISTS "Allow public select hr_day" ON public.hr_day;
CREATE POLICY "Allow public select hr_day" ON public.hr_day FOR SELECT USING (true);

-- SpO2 Day
DROP POLICY IF EXISTS "Allow anon select spo2_day" ON public.spo2_day;
DROP POLICY IF EXISTS "Allow public select spo2_day" ON public.spo2_day;
CREATE POLICY "Allow public select spo2_day" ON public.spo2_day FOR SELECT USING (true);

-- Steps Day
DROP POLICY IF EXISTS "Allow anon select steps_day" ON public.steps_day;
DROP POLICY IF EXISTS "Allow public select steps_day" ON public.steps_day;
CREATE POLICY "Allow public select steps_day" ON public.steps_day FOR SELECT USING (true);

-- BP Readings
DROP POLICY IF EXISTS "Allow anon select bp_readings" ON public.bp_readings;
DROP POLICY IF EXISTS "Allow public select bp_readings" ON public.bp_readings;
CREATE POLICY "Allow public select bp_readings" ON public.bp_readings FOR SELECT USING (true);

-- Allow insert for BP readings (public/anon)
DROP POLICY IF EXISTS "Allow anon insert bp_readings" ON public.bp_readings;
DROP POLICY IF EXISTS "Allow public insert bp_readings" ON public.bp_readings;
CREATE POLICY "Allow public insert bp_readings" ON public.bp_readings FOR INSERT WITH CHECK (true);
