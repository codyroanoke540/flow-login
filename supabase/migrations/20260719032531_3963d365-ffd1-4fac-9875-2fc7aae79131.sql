
-- 1) Move SECURITY DEFINER helpers out of the exposed public schema
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

ALTER FUNCTION public.is_org_member(uuid, uuid) SET SCHEMA app_private;
ALTER FUNCTION public.is_active_org_member(uuid, uuid) SET SCHEMA app_private;
ALTER FUNCTION public.has_org_role(uuid, uuid, text[]) SET SCHEMA app_private;

-- Ensure only intended callers have EXECUTE
REVOKE ALL ON FUNCTION app_private.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.is_active_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.has_org_role(uuid, uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_active_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.has_org_role(uuid, uuid, text[]) TO authenticated, service_role;

-- handle_new_user is only invoked by a trigger; revoke API-callability
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 2) Remove overly-permissive INSERT policy on organizations (always-true).
-- Organizations are created by the handle_new_user trigger (SECURITY DEFINER),
-- so no direct client insert path is needed.
DROP POLICY IF EXISTS "Authenticated create orgs" ON public.organizations;

-- 3) org_members: prevent role/status self-escalation on INSERT
DROP POLICY IF EXISTS "Users insert own membership" ON public.org_members;
CREATE POLICY "Users self-insert pending member only"
  ON public.org_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND status = 'pending'
  );

-- Allow owners/admins to add members directly with any role/status
CREATE POLICY "Owners and admins add memberships"
  ON public.org_members
  FOR INSERT
  TO authenticated
  WITH CHECK (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));

-- 4) org_members: add UPDATE and DELETE policies restricted to owners/admins
CREATE POLICY "Owners and admins update memberships"
  ON public.org_members
  FOR UPDATE
  TO authenticated
  USING (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));

CREATE POLICY "Owners and admins remove memberships"
  ON public.org_members
  FOR DELETE
  TO authenticated
  USING (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));

-- Allow a member to leave (delete their own membership) — but not the last owner.
CREATE POLICY "Users can leave their memberships"
  ON public.org_members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
