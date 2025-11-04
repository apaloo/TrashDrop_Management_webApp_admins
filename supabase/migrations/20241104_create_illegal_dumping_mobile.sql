-- Create illegal_dumping_mobile table
CREATE TABLE IF NOT EXISTS public.illegal_dumping_mobile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reported_by UUID NOT NULL,
  location TEXT NOT NULL,
  coordinates POINT NOT NULL,
  waste_type TEXT NOT NULL DEFAULT 'mixed',
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  size TEXT NOT NULL DEFAULT 'medium' CHECK (size IN ('small', 'medium', 'large')),
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  description TEXT,
  assigned_to UUID,
  cleanup_scheduled_date TIMESTAMPTZ,
  cleanup_completed_date TIMESTAMPTZ,
  notes TEXT,
  
  -- Foreign key constraints
  CONSTRAINT fk_reported_by FOREIGN KEY (reported_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT fk_assigned_to FOREIGN KEY (assigned_to) REFERENCES public.collectors(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_mobile_status ON public.illegal_dumping_mobile(status);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_mobile_reported_by ON public.illegal_dumping_mobile(reported_by);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_mobile_assigned_to ON public.illegal_dumping_mobile(assigned_to);
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_mobile_created_at ON public.illegal_dumping_mobile(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.illegal_dumping_mobile ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
CREATE POLICY "Enable read access for all users" ON public.illegal_dumping_mobile
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.illegal_dumping_mobile
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for assigned collectors and admins" ON public.illegal_dumping_mobile
  FOR UPDATE 
  USING (
    auth.uid() = reported_by OR 
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_illegal_dumping_mobile_updated_at
BEFORE UPDATE ON public.illegal_dumping_mobile
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create a function to log changes to the illegal_dumping_history_mobile table
CREATE OR REPLACE FUNCTION log_illegal_dumping_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.illegal_dumping_history_mobile (
      dumping_id, 
      status, 
      notes, 
      updated_by
    ) VALUES (
      NEW.id,
      NEW.status,
      COALESCE(NEW.notes, ''),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trigger_log_illegal_dumping_changes
AFTER UPDATE ON public.illegal_dumping_mobile
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION log_illegal_dumping_changes();

-- Create a function to get nearby illegal dumping reports
CREATE OR REPLACE FUNCTION public.get_nearby_illegal_dumping(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  location TEXT,
  distance_km DOUBLE PRECISION,
  waste_type TEXT,
  severity TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.location,
    ST_Distance(
      ST_MakePoint(lng, lat)::geography,
      ST_MakePoint(ST_X(d.coordinates::geometry), ST_Y(d.coordinates::geometry))::geography
    ) / 1000 AS distance_km,
    d.waste_type,
    d.severity,
    d.status,
    d.created_at
  FROM 
    public.illegal_dumping_mobile d
  WHERE 
    ST_DWithin(
      ST_MakePoint(lng, lat)::geography,
      ST_MakePoint(ST_X(d.coordinates::geometry), ST_Y(d.coordinates::geometry))::geography,
      radius_km * 1000  -- Convert km to meters
    )
    AND d.status IN ('pending', 'verified')
  ORDER BY 
    distance_km ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
