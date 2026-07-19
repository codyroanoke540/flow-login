
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

-- Owners/admins can update org name/website/timezone; keeps existing view/update policies.
-- (existing policy "Members update their orgs" already allows update; that's fine for pilot,
--  but tighten to owner/admin via new policy without removing existing one.)
DROP POLICY IF EXISTS "Owners admins update orgs" ON public.organizations;
CREATE POLICY "Owners admins update orgs"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (app_private.has_org_role(id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (app_private.has_org_role(id, auth.uid(), ARRAY['owner','admin']));

-- Drop the broader "Members update their orgs" so only owners/admins can rename.
DROP POLICY IF EXISTS "Members update their orgs" ON public.organizations;
