
-- 1. Fix permission denied for has_role / role_priority
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.role_priority(uuid) TO authenticated, anon;

-- 2. Asset lifecycle fields
DO $$ BEGIN
  CREATE TYPE public.asset_status AS ENUM ('available','rented','under_maintenance','retired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS status public.asset_status NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS maintenance_interval_days int,
  ADD COLUMN IF NOT EXISTS maintenance_after_bookings int,
  ADD COLUMN IF NOT EXISTS usage_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_maintenance_at timestamptz;

-- 3. Maintenance logs table
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  performed_by uuid,
  log_type text NOT NULL DEFAULT 'manual',
  notes text,
  performed_at timestamptz NOT NULL DEFAULT now(),
  next_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view maintenance logs" ON public.maintenance_logs;
CREATE POLICY "view maintenance logs" ON public.maintenance_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff add maintenance logs" ON public.maintenance_logs;
CREATE POLICY "staff add maintenance logs" ON public.maintenance_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

DROP POLICY IF EXISTS "admins manage maintenance logs" ON public.maintenance_logs;
CREATE POLICY "admins manage maintenance logs" ON public.maintenance_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. After-insert: when admin logs maintenance, mark asset available + reset counter
CREATE OR REPLACE FUNCTION public.apply_maintenance_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.assets
     SET last_maintenance_at = NEW.performed_at,
         usage_count = 0,
         status = CASE WHEN status = 'under_maintenance' THEN 'available' ELSE status END
   WHERE id = NEW.asset_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_apply_maintenance_log ON public.maintenance_logs;
CREATE TRIGGER trg_apply_maintenance_log
AFTER INSERT ON public.maintenance_logs
FOR EACH ROW EXECUTE FUNCTION public.apply_maintenance_log();

-- 5. Update booking processor: block if asset not available, increment usage, auto-flag maintenance
CREATE OR REPLACE FUNCTION public.process_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_priority int;
  v_conflict_id uuid;
  v_auto_role app_role;
  v_status asset_status;
  v_threshold int;
  v_count int;
begin
  SELECT status, maintenance_after_bookings INTO v_status, v_threshold
    FROM public.assets WHERE id = NEW.asset_id;

  IF v_status IN ('under_maintenance','retired') THEN
    RAISE EXCEPTION 'Asset is % and cannot be booked', v_status;
  END IF;

  v_priority := public.role_priority(NEW.user_id);
  NEW.priority := v_priority;

  SELECT id INTO v_conflict_id
    FROM public.bookings
   WHERE asset_id = NEW.asset_id
     AND id <> COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid)
     AND status = 'approved'
     AND start_time < NEW.end_time
     AND end_time > NEW.start_time
   LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    NEW.status := 'rejected';
    RETURN NEW;
  END IF;

  SELECT auto_approve_role INTO v_auto_role FROM public.assets WHERE id = NEW.asset_id;
  IF v_auto_role IS NOT NULL AND public.has_role(NEW.user_id, v_auto_role) THEN
    NEW.status := 'approved';
  END IF;
  IF public.has_role(NEW.user_id, 'admin') THEN
    NEW.status := 'approved';
  END IF;

  RETURN NEW;
end $$;

DROP TRIGGER IF EXISTS trg_process_booking ON public.bookings;
CREATE TRIGGER trg_process_booking
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.process_booking();

-- 6. After-insert: increment usage count + auto flag maintenance
CREATE OR REPLACE FUNCTION public.bump_asset_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v_threshold int; v_new_count int;
begin
  IF NEW.status = 'approved' THEN
    UPDATE public.assets
       SET usage_count = usage_count + 1
     WHERE id = NEW.asset_id
     RETURNING usage_count, maintenance_after_bookings INTO v_new_count, v_threshold;

    IF v_threshold IS NOT NULL AND v_new_count >= v_threshold THEN
      UPDATE public.assets SET status = 'under_maintenance'
       WHERE id = NEW.asset_id AND status = 'available';
    END IF;
  END IF;
  RETURN NEW;
end $$;

DROP TRIGGER IF EXISTS trg_bump_asset_usage ON public.bookings;
CREATE TRIGGER trg_bump_asset_usage
AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.bump_asset_usage();
