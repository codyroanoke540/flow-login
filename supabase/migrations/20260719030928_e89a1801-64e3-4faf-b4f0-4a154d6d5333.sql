
-- 1. Organizations + membership
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members WHERE org_id = _org_id AND user_id = _user_id
  )
$$;

CREATE POLICY "Members view their orgs" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_org_member(id, auth.uid()));
CREATE POLICY "Members update their orgs" ON public.organizations
  FOR UPDATE TO authenticated USING (public.is_org_member(id, auth.uid()));
CREATE POLICY "Authenticated create orgs" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Members view their memberships" ON public.org_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_org_member(org_id, auth.uid()));
CREATE POLICY "Users insert own membership" ON public.org_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 2. Backfill: create an org per existing distinct org_id (which currently equals a user's auth.uid())
INSERT INTO public.organizations (id, name)
SELECT DISTINCT org_id, 'My Organization'
FROM (
  SELECT org_id FROM public.accounts
  UNION SELECT org_id FROM public.locations
  UNION SELECT org_id FROM public.resources
  UNION SELECT org_id FROM public.resource_availability
  UNION SELECT org_id FROM public.work_items
  UNION SELECT org_id FROM public.decision_constraints
  UNION SELECT org_id FROM public.policies
  UNION SELECT org_id FROM public.requirements
  UNION SELECT org_id FROM public.objectives
  UNION SELECT org_id FROM public.recommendations
  UNION SELECT org_id FROM public.outcomes
) s
WHERE org_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Membership backfill: treat existing org_id as the owner user's uid
INSERT INTO public.org_members (org_id, user_id, role)
SELECT o.id, o.id, 'owner'
FROM public.organizations o
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = o.id)
ON CONFLICT (org_id, user_id) DO NOTHING;

-- 3. Replace RLS policies on all org-scoped tables
DO $$
DECLARE
  t TEXT;
  polname TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','locations','resources','resource_availability','work_items','decision_constraints','policies','requirements','objectives','recommendations','outcomes']
  LOOP
    FOR polname IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', polname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "Org members full access" ON public.%I FOR ALL TO authenticated USING (public.is_org_member(org_id, auth.uid())) WITH CHECK (public.is_org_member(org_id, auth.uid()))', t);
  END LOOP;
END $$;

-- 4. Auto-create org + membership on new user signup (extend existing handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  INSERT INTO public.profiles (id, email, display_name, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'company_name'
  );

  INSERT INTO public.organizations (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Organization'))
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO new_org_id;

  IF new_org_id IS NULL THEN
    new_org_id := NEW.id;
  END IF;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner')
  ON CONFLICT (org_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Profiles DELETE policy
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);
