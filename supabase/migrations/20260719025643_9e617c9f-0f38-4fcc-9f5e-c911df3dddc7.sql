
-- Shared updated_at trigger already exists (update_updated_at_column). Reuse it.

-- ============ LOCATIONS ============
CREATE TABLE public.locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  timezone text,
  region text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own locations" ON public.locations FOR ALL TO authenticated
  USING (auth.uid() = org_id) WITH CHECK (auth.uid() = org_id);
CREATE TRIGGER trg_locations_updated BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RESOURCES ============
CREATE TABLE public.resources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'employee',
  skills text[] NOT NULL DEFAULT '{}',
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  capacity numeric NOT NULL DEFAULT 40,
  cost_rate numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT ALL ON public.resources TO service_role;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own resources" ON public.resources FOR ALL TO authenticated
  USING (auth.uid() = org_id) WITH CHECK (auth.uid() = org_id);
CREATE TRIGGER trg_resources_updated BEFORE UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RESOURCE AVAILABILITY ============
CREATE TABLE public.resource_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_availability TO authenticated;
GRANT ALL ON public.resource_availability TO service_role;
ALTER TABLE public.resource_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own availability" ON public.resource_availability FOR ALL TO authenticated
  USING (auth.uid() = org_id) WITH CHECK (auth.uid() = org_id);

-- ============ ACCOUNTS ============
CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'customer',
  tier text NOT NULL DEFAULT 'standard',
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.accounts FOR ALL TO authenticated
  USING (auth.uid() = org_id) WITH CHECK (auth.uid() = org_id);
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ WORK ITEMS ============
CREATE TABLE public.work_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'appointment',
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  required_skills text[] NOT NULL DEFAULT '{}',
  duration_minutes integer NOT NULL DEFAULT 60,
  priority smallint NOT NULL DEFAULT 3,
  deadline timestamptz,
  scheduled_start timestamptz,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  assigned_resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_items TO authenticated;
GRANT ALL ON public.work_items TO service_role;
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own work_items" ON public.work_items FOR ALL TO authenticated
  USING (auth.uid() = org_id) WITH CHECK (auth.uid() = org_id);
CREATE TRIGGER trg_work_items_updated BEFORE UPDATE ON public.work_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ REQUIREMENTS ============
CREATE TABLE public.requirements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('hard','soft')),
  description text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirements TO authenticated;
GRANT ALL ON public.requirements TO service_role;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own requirements" ON public.requirements FOR ALL TO authenticated
  USING (auth.uid() = org_id) WITH CHECK (auth.uid() = org_id);

-- ============ CONSTRAINTS ============
CREATE TABLE public.decision_constraints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('hard','soft')),
  scope text NOT NULL DEFAULT 'global',
  rule_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_constraints TO authenticated;
GRANT ALL ON public.decision_constraints TO service_role;
ALTER TABLE public.decision_constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own constraints" ON public.decision_constraints FOR ALL TO authenticated
  USING (auth.uid() = org_id) WITH CHECK (auth.uid() = org_id);
CREATE TRIGGER trg_constraints_updated BEFORE UPDATE ON public.decision_constraints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ POLICIES ============
CREATE TABLE public.policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  name text NOT NULL,
  industry text,
  scope text NOT NULL DEFAULT 'global',
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policies TO authenticated;
GRANT ALL ON public.policies TO service_role;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own policies" ON public.policies FOR ALL TO authenticated
  USING (auth.uid() = org_id) WITH CHECK (auth.uid() = org_id);
CREATE TRIGGER trg_policies_updated BEFORE UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ OBJECTIVES ============
CREATE TABLE public.objectives (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('maximize','minimize','balance')),
  metric text NOT NULL,
  weight numeric NOT NULL DEFAULT 0.5,
  scope text NOT NULL DEFAULT 'global',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.objectives TO authenticated;
GRANT ALL ON public.objectives TO service_role;
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own objectives" ON public.objectives FOR ALL TO authenticated
  USING (auth.uid() = org_id) WITH CHECK (auth.uid() = org_id);
CREATE TRIGGER trg_objectives_updated BEFORE UPDATE ON public.objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RECOMMENDATIONS ============
CREATE TABLE public.recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL,
  trigger text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_option jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasoning jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score integer NOT NULL DEFAULT 0,
  impact_assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_level smallint NOT NULL DEFAULT 1 CHECK (approval_level BETWEEN 0 AND 4),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
GRANT ALL ON public.recommendations TO service_role;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recommendations" ON public.recommendations FOR ALL TO authenticated
  USING (auth.uid() = org_id) WITH CHECK (auth.uid() = org_id);
CREATE TRIGGER trg_recommendations_updated BEFORE UPDATE ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ OUTCOMES ============
CREATE TABLE public.outcomes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  recommendation_id uuid REFERENCES public.recommendations(id) ON DELETE SET NULL,
  work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL,
  actual_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  variance jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outcomes TO authenticated;
GRANT ALL ON public.outcomes TO service_role;
ALTER TABLE public.outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own outcomes" ON public.outcomes FOR ALL TO authenticated
  USING (auth.uid() = org_id) WITH CHECK (auth.uid() = org_id);

-- Helpful indexes
CREATE INDEX idx_resources_org ON public.resources(org_id);
CREATE INDEX idx_accounts_org ON public.accounts(org_id);
CREATE INDEX idx_work_items_org_status ON public.work_items(org_id, status);
CREATE INDEX idx_recommendations_org_status ON public.recommendations(org_id, status, created_at DESC);
CREATE INDEX idx_availability_resource ON public.resource_availability(resource_id);
