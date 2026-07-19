
-- =========================================================================
-- 1. Profiles: active organization pointer
-- =========================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Backfill: use personal org (id = user id) when present
UPDATE public.profiles p
SET active_organization_id = p.id
WHERE active_organization_id IS NULL
  AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p.id);

-- =========================================================================
-- 2. Org members: status + invitation lifecycle
-- =========================================================================
ALTER TABLE public.org_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.org_members
    ADD CONSTRAINT org_members_status_chk
    CHECK (status IN ('active','invited','suspended','removed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Membership check helper: only ACTIVE members grant access
CREATE OR REPLACE FUNCTION public.is_active_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = _org_id AND user_id = _user_id AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id uuid, _user_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = _org_id AND user_id = _user_id AND status = 'active'
      AND role = ANY(_roles)
  )
$$;

-- =========================================================================
-- 3. Column extensions on existing tables
-- =========================================================================
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS weekly_capacity_hours numeric NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS required_skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_duration_minutes int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS scheduled_end timestamptz,
  ADD COLUMN IF NOT EXISTS required_qualifications text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- =========================================================================
-- 4. Qualifications + join tables
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  category text,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qualifications TO authenticated;
GRANT ALL ON public.qualifications TO service_role;
ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qualifications org members" ON public.qualifications
  FOR ALL TO authenticated
  USING (public.is_active_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_active_org_member(org_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.resource_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  qualification_code text NOT NULL,
  issued_on date,
  expires_on date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, qualification_code)
);
CREATE INDEX IF NOT EXISTS idx_rq_org ON public.resource_qualifications(org_id);
CREATE INDEX IF NOT EXISTS idx_rq_resource ON public.resource_qualifications(resource_id);
CREATE INDEX IF NOT EXISTS idx_rq_expires ON public.resource_qualifications(expires_on);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_qualifications TO authenticated;
GRANT ALL ON public.resource_qualifications TO service_role;
ALTER TABLE public.resource_qualifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resource_quals org members" ON public.resource_qualifications
  FOR ALL TO authenticated
  USING (public.is_active_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_active_org_member(org_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.resource_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  skill text NOT NULL,
  proficiency int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, skill)
);
CREATE INDEX IF NOT EXISTS idx_rs_org ON public.resource_skills(org_id);
CREATE INDEX IF NOT EXISTS idx_rs_resource ON public.resource_skills(resource_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_skills TO authenticated;
GRANT ALL ON public.resource_skills TO service_role;
ALTER TABLE public.resource_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resource_skills org members" ON public.resource_skills
  FOR ALL TO authenticated
  USING (public.is_active_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_active_org_member(org_id, auth.uid()));

-- =========================================================================
-- 5. Time off
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.resource_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (status IN ('pending','approved','rejected','canceled'))
);
CREATE INDEX IF NOT EXISTS idx_time_off_resource ON public.resource_time_off(resource_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_time_off_org ON public.resource_time_off(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_time_off TO authenticated;
GRANT ALL ON public.resource_time_off TO service_role;
ALTER TABLE public.resource_time_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "time_off org members" ON public.resource_time_off
  FOR ALL TO authenticated
  USING (public.is_active_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_active_org_member(org_id, auth.uid()));

-- =========================================================================
-- 6. Work item requirements (relational)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.work_item_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  kind text NOT NULL,
  requirement text NOT NULL,
  weight numeric,
  hard boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind IN ('skill','qualification','preference','location','continuity','other'))
);
CREATE INDEX IF NOT EXISTS idx_wir_work_item ON public.work_item_requirements(work_item_id);
CREATE INDEX IF NOT EXISTS idx_wir_org ON public.work_item_requirements(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_item_requirements TO authenticated;
GRANT ALL ON public.work_item_requirements TO service_role;
ALTER TABLE public.work_item_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wir org members" ON public.work_item_requirements
  FOR ALL TO authenticated
  USING (public.is_active_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_active_org_member(org_id, auth.uid()));

-- =========================================================================
-- 7. Recommendation candidates (per-resource evaluation persisted)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.recommendation_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  resource_name text NOT NULL,
  eligible boolean NOT NULL,
  disqualification_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  factor_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  weighted_score numeric,
  rank int,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rc_rec ON public.recommendation_candidates(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_rc_org ON public.recommendation_candidates(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendation_candidates TO authenticated;
GRANT ALL ON public.recommendation_candidates TO service_role;
ALTER TABLE public.recommendation_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rc org members" ON public.recommendation_candidates
  FOR ALL TO authenticated
  USING (public.is_active_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_active_org_member(org_id, auth.uid()));

-- =========================================================================
-- 8. Approvals
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  approver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_role text,
  status text NOT NULL,
  reason text,
  approved_candidate_id uuid REFERENCES public.recommendation_candidates(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('approved','rejected'))
);
CREATE INDEX IF NOT EXISTS idx_appr_rec ON public.approvals(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_appr_org ON public.approvals(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals org members" ON public.approvals
  FOR ALL TO authenticated
  USING (public.is_active_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_active_org_member(org_id, auth.uid()));

-- =========================================================================
-- 9. Append-only audit events
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  previous_state jsonb,
  new_state jsonb,
  reason text,
  source text,
  correlation_id uuid,
  recommendation_id uuid REFERENCES public.recommendations(id) ON DELETE SET NULL,
  policy_version_id uuid,
  scoring_configuration_version text,
  pipeline_version text,
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_org_time ON public.audit_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_events(entity_type, entity_id);
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Read: owners and admins only
CREATE POLICY "audit read owners admins" ON public.audit_events
  FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));

-- Insert: any active member of the org (server-side helpers use this)
CREATE POLICY "audit insert members" ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_org_member(org_id, auth.uid()));

-- No update/delete policy: table is append-only for normal users.

-- =========================================================================
-- 10. Organization settings + terminology (industry module aliasing)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.organization_settings (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  industry text NOT NULL DEFAULT 'generic',
  terminology jsonb NOT NULL DEFAULT '{}'::jsonb,
  scoring_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_settings TO authenticated;
GRANT ALL ON public.organization_settings TO service_role;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_settings read members" ON public.organization_settings
  FOR SELECT TO authenticated
  USING (public.is_active_org_member(org_id, auth.uid()));
CREATE POLICY "org_settings write owners admins" ON public.organization_settings
  FOR ALL TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));

-- =========================================================================
-- 11. Service authorizations (ABA-friendly module)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.service_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  service_code text NOT NULL,
  authorized_units numeric NOT NULL DEFAULT 0,
  used_units numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (status IN ('active','expired','exhausted','canceled'))
);
CREATE INDEX IF NOT EXISTS idx_sa_account ON public.service_authorizations(account_id);
CREATE INDEX IF NOT EXISTS idx_sa_org ON public.service_authorizations(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_authorizations TO authenticated;
GRANT ALL ON public.service_authorizations TO service_role;
ALTER TABLE public.service_authorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa org members" ON public.service_authorizations
  FOR ALL TO authenticated
  USING (public.is_active_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_active_org_member(org_id, auth.uid()));

-- =========================================================================
-- 12. Useful indexes on existing tables
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_work_items_org_start ON public.work_items(org_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_work_items_assigned ON public.work_items(assigned_resource_id);
CREATE INDEX IF NOT EXISTS idx_work_items_status ON public.work_items(status);
CREATE INDEX IF NOT EXISTS idx_resources_org_status ON public.resources(org_id, status);
CREATE INDEX IF NOT EXISTS idx_recs_org_status ON public.recommendations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.org_members(user_id, status);

-- =========================================================================
-- 13. Updated signup trigger: also create organization_settings + active org
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  INSERT INTO public.profiles (id, email, display_name, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'company_name'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organizations (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Organization'))
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO new_org_id;

  IF new_org_id IS NULL THEN
    new_org_id := NEW.id;
  END IF;

  INSERT INTO public.org_members (org_id, user_id, role, status, accepted_at)
  VALUES (new_org_id, NEW.id, 'owner', 'active', now())
  ON CONFLICT (org_id, user_id) DO UPDATE SET status = 'active';

  INSERT INTO public.organization_settings (org_id, industry)
  VALUES (new_org_id, 'generic')
  ON CONFLICT (org_id) DO NOTHING;

  UPDATE public.profiles SET active_organization_id = new_org_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill organization_settings for existing orgs
INSERT INTO public.organization_settings (org_id, industry)
SELECT o.id, 'generic' FROM public.organizations o
ON CONFLICT (org_id) DO NOTHING;

-- Backfill org_members.status = active for existing rows
UPDATE public.org_members SET status = 'active' WHERE status IS NULL OR status = '';

-- =========================================================================
-- 14. updated_at triggers on new tables
-- =========================================================================
DO $$ BEGIN
  CREATE TRIGGER trg_qualifications_updated BEFORE UPDATE ON public.qualifications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_rq_updated BEFORE UPDATE ON public.resource_qualifications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_time_off_updated BEFORE UPDATE ON public.resource_time_off
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_org_settings_updated BEFORE UPDATE ON public.organization_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_sa_updated BEFORE UPDATE ON public.service_authorizations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_org_members_updated BEFORE UPDATE ON public.org_members
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
