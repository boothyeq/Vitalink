-- Enable RLS on patients table
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Allow public select on patients
DROP POLICY IF EXISTS "Allow public select patients" ON public.patients;
CREATE POLICY "Allow public select patients" ON public.patients FOR SELECT USING (true);

-- Allow public insert/update on patients (if needed during dev)
DROP POLICY IF EXISTS "Allow public insert patients" ON public.patients;
CREATE POLICY "Allow public insert patients" ON public.patients FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update patients" ON public.patients;
CREATE POLICY "Allow public update patients" ON public.patients FOR UPDATE USING (true);
