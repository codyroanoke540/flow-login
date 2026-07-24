-- Cadence pilot hardening: active-membership RLS, role-restricted writes,
-- and database checks for the scheduling fields used by the decision engine.

-- Organizations: active members may read; only owners/admins may update.
DO $$
DECLARE p text;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organizations'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations', p); END LOOP;
END $$;
CREATE POLICY "organizations active members read" ON public.organizations
  FOR SELECT TO authenticated
  USING (app_private.is_active_org_member(id, auth.uid()));
CREATE POLICY "organizations owners admins update" ON public.organizations
  FOR UPDATE TO authenticated
  USING (app_private.has_org_role(id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (app_private.has_org_role(id, auth.uid(), ARRAY['owner','admin']));

-- Membership records
DO $$
DECLARE p text;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'org_members'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.org_members', p); END LOOP;
END $$;
CREATE POLICY "org members read own or active roster" ON public.org_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.is_active_org_member(org_id, auth.uid()));
CREATE POLICY "org members owners admins insert" ON public.org_members
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY "org members owners admins update" ON public.org_members
  FOR UPDATE TO authenticated
  USING (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY "org members owners admins delete" ON public.org_members
  FOR DELETE TO authenticated
  USING (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));

DO $$
DECLARE
  t text;
  p text;
  write_roles text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts','locations','resources','resource_availability','qualifications',
    'resource_qualifications','resource_skills','resource_time_off','work_items',
    'work_item_requirements','requirements','service_authorizations'
  ] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t); END LOOP;

    write_roles := CASE WHEN t = 'work_items'
      THEN 'ARRAY[''owner'',''admin'',''operations_manager'',''scheduler'',''supervisor'']'
      ELSE 'ARRAY[''owner'',''admin'',''operations_manager'',''scheduler'']' END;

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (app_private.is_active_org_member(org_id, auth.uid()))', t || ' active read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (app_private.has_org_role(org_id, auth.uid(), %s))', t || ' role insert', t, write_roles);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (app_private.has_org_role(org_id, auth.uid(), %s)) WITH CHECK (app_private.has_org_role(org_id, auth.uid(), %s))', t || ' role update', t, write_roles, write_roles);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (app_private.has_org_role(org_id, auth.uid(), %s))', t || ' role delete', t, write_roles);
  END LOOP;
END $$;

DO $$
DECLARE t text; p text;
BEGIN
  FOREACH t IN ARRAY ARRAY['recommendations','recommendation_candidates','approvals','outcomes']
  LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t); END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (app_private.is_active_org_member(org_id, auth.uid()))', t || ' active read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (app_private.has_org_role(org_id, auth.uid(), ARRAY[''owner'',''admin'',''operations_manager'',''scheduler'',''supervisor'']))', t || ' decision insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (app_private.has_org_role(org_id, auth.uid(), ARRAY[''owner'',''admin'',''operations_manager'',''scheduler'',''supervisor''])) WITH CHECK (app_private.has_org_role(org_id, auth.uid(), ARRAY[''owner'',''admin'',''operations_manager'',''scheduler'',''supervisor'']))', t || ' decision update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (app_private.has_org_role(org_id, auth.uid(), ARRAY[''owner'',''admin'']))', t || ' decision delete', t);
  END LOOP;
END $$;

DO $$
DECLARE t text; p text;
BEGIN
  FOREACH t IN ARRAY ARRAY['decision_constraints','policies','objectives']
  LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t); END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (app_private.is_active_org_member(org_id, auth.uid()))', t || ' active read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (app_private.has_org_role(org_id, auth.uid(), ARRAY[''owner'',''admin'']))', t || ' admin insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (app_private.has_org_role(org_id, auth.uid(), ARRAY[''owner'',''admin''])) WITH CHECK (app_private.has_org_role(org_id, auth.uid(), ARRAY[''owner'',''admin'']))', t || ' admin update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (app_private.has_org_role(org_id, auth.uid(), ARRAY[''owner'',''admin'']))', t || ' admin delete', t);
  END LOOP;
END $$;

DO $$
DECLARE p text;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='audit_events'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_events', p); END LOOP;
END $$;
CREATE POLICY "audit owners admins read" ON public.audit_events
  FOR SELECT TO authenticated
  USING (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY "audit operational insert" ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin','operations_manager','scheduler','supervisor']));

DO $$
DECLARE p text;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='organization_settings'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.organization_settings', p); END LOOP;
END $$;
CREATE POLICY "org settings active read" ON public.organization_settings
  FOR SELECT TO authenticated
  USING (app_private.is_active_org_member(org_id, auth.uid()));
CREATE POLICY "org settings admin insert" ON public.organization_settings
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY "org settings admin update" ON public.organization_settings
  FOR UPDATE TO authenticated
  USING (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY "org settings admin delete" ON public.organization_settings
  FOR DELETE TO authenticated
  USING (app_private.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));

DO $$ BEGIN
  ALTER TABLE public.resource_availability ADD CONSTRAINT resource_availability_time_order_chk CHECK (end_time > start_time) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.resource_time_off ADD CONSTRAINT resource_time_off_order_chk CHECK (ends_at > starts_at) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.resource_qualifications ADD CONSTRAINT resource_qualifications_status_chk CHECK (status IN ('active','inactive','suspended','revoked')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.resources ADD CONSTRAINT resources_status_chk CHECK (status IN ('active','inactive')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.accounts ADD CONSTRAINT accounts_status_chk CHECK (status IN ('active','inactive')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_resource_availability_window
  ON public.resource_availability(resource_id, weekday, start_time, end_time);

ALTER TABLE public.recommendations DROP CONSTRAINT IF EXISTS recommendations_status_check;
ALTER TABLE public.recommendations
  ADD CONSTRAINT recommendations_status_check
  CHECK (status IN ('pending','approved','rejected','executed','superseded','no_match')) NOT VALID;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY org_id, work_item_id ORDER BY created_at DESC, id DESC) AS rn
  FROM public.recommendations
  WHERE work_item_id IS NOT NULL AND status IN ('pending','no_match')
)
UPDATE public.recommendations r
SET status = 'superseded'
FROM ranked x
WHERE r.id = x.id AND x.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_open_recommendation_per_work_item
  ON public.recommendations(org_id, work_item_id)
  WHERE work_item_id IS NOT NULL AND status IN ('pending','no_match');

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY recommendation_id ORDER BY created_at DESC, id DESC) AS rn
  FROM public.approvals
)
DELETE FROM public.approvals a USING ranked x WHERE a.id = x.id AND x.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_per_recommendation
  ON public.approvals(recommendation_id);

CREATE OR REPLACE FUNCTION public.replace_resource_availability(_resource_id uuid, _slots jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  _org_id uuid;
BEGIN
  SELECT org_id INTO _org_id FROM public.resources WHERE id = _resource_id;
  IF _org_id IS NULL THEN RAISE EXCEPTION 'Resource not found'; END IF;
  IF NOT app_private.has_org_role(_org_id, auth.uid(), ARRAY['owner','admin','operations_manager','scheduler']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.resource_availability WHERE resource_id = _resource_id AND org_id = _org_id;
  INSERT INTO public.resource_availability (resource_id, org_id, weekday, start_time, end_time)
  SELECT
    _resource_id,
    _org_id,
    (slot->>'weekday')::smallint,
    (slot->>'start_time')::time,
    (slot->>'end_time')::time
  FROM jsonb_array_elements(COALESCE(_slots, '[]'::jsonb)) AS slot;

  INSERT INTO public.audit_events (
    org_id, actor_user_id, actor_role, action, entity_type, entity_id, new_state, source
  ) VALUES (
    _org_id, auth.uid(),
    (SELECT role FROM public.org_members WHERE org_id = _org_id AND user_id = auth.uid() AND status = 'active'),
    'availability.updated', 'resource', _resource_id,
    jsonb_build_object('slots', COALESCE(_slots, '[]'::jsonb)), 'app'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.replace_resource_availability(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_resource_availability(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.execute_recommendation_approval(
  _recommendation_id uuid,
  _expected_resource_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  _org_id uuid;
  _work_item_id uuid;
  _selected_resource_id uuid;
  _role text;
BEGIN
  SELECT org_id, work_item_id, NULLIF(selected_option->>'resource_id','')::uuid
  INTO _org_id, _work_item_id, _selected_resource_id
  FROM public.recommendations
  WHERE id = _recommendation_id AND status = 'pending'
  FOR UPDATE;

  IF _org_id IS NULL THEN RAISE EXCEPTION 'Recommendation is not pending'; END IF;
  SELECT role INTO _role FROM public.org_members
    WHERE org_id = _org_id AND user_id = auth.uid() AND status = 'active';
  IF _role IS NULL OR NOT (_role = ANY(ARRAY['owner','admin','operations_manager','scheduler','supervisor'])) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _work_item_id IS NULL OR _selected_resource_id IS NULL OR _selected_resource_id <> _expected_resource_id THEN
    RAISE EXCEPTION 'Recommendation selection changed';
  END IF;

  UPDATE public.work_items
    SET assigned_resource_id = _selected_resource_id, status = 'assigned'
    WHERE id = _work_item_id AND org_id = _org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Work item not found'; END IF;

  UPDATE public.recommendations SET status = 'approved' WHERE id = _recommendation_id;
  INSERT INTO public.approvals (
    org_id, recommendation_id, approver_user_id, approver_role, status, approved_at
  ) VALUES (
    _org_id, _recommendation_id, auth.uid(), _role, 'approved', now()
  );
  INSERT INTO public.audit_events (
    org_id, actor_user_id, actor_role, action, entity_type, entity_id,
    new_state, source, recommendation_id
  ) VALUES
    (_org_id, auth.uid(), _role, 'recommendation.approved', 'recommendation', _recommendation_id,
      jsonb_build_object('assigned_resource_id', _selected_resource_id, 'work_item_id', _work_item_id), 'app', _recommendation_id),
    (_org_id, auth.uid(), _role, 'work_item.assigned', 'work_item', _work_item_id,
      jsonb_build_object('assigned_resource_id', _selected_resource_id), 'app', _recommendation_id);
END;
$$;
REVOKE ALL ON FUNCTION public.execute_recommendation_approval(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_recommendation_approval(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.execute_recommendation_rejection(
  _recommendation_id uuid,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  _org_id uuid;
  _work_item_id uuid;
  _role text;
BEGIN
  SELECT org_id, work_item_id INTO _org_id, _work_item_id
  FROM public.recommendations
  WHERE id = _recommendation_id AND status IN ('pending','no_match')
  FOR UPDATE;
  IF _org_id IS NULL THEN RAISE EXCEPTION 'Recommendation is already decided'; END IF;

  SELECT role INTO _role FROM public.org_members
    WHERE org_id = _org_id AND user_id = auth.uid() AND status = 'active';
  IF _role IS NULL OR NOT (_role = ANY(ARRAY['owner','admin','operations_manager','scheduler','supervisor'])) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.recommendations SET status = 'rejected' WHERE id = _recommendation_id;
  IF _work_item_id IS NOT NULL THEN
    UPDATE public.work_items SET status = 'unassigned'
      WHERE id = _work_item_id AND org_id = _org_id
        AND status IN ('pending_approval','pending_recommendation');
  END IF;
  INSERT INTO public.approvals (
    org_id, recommendation_id, approver_user_id, approver_role, status, reason, rejected_at
  ) VALUES (
    _org_id, _recommendation_id, auth.uid(), _role, 'rejected', NULLIF(trim(_reason), ''), now()
  );
  INSERT INTO public.audit_events (
    org_id, actor_user_id, actor_role, action, entity_type, entity_id,
    reason, source, recommendation_id
  ) VALUES (
    _org_id, auth.uid(), _role, 'recommendation.rejected', 'recommendation', _recommendation_id,
    NULLIF(trim(_reason), ''), 'app', _recommendation_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.execute_recommendation_rejection(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_recommendation_rejection(uuid, text) TO authenticated, service_role;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY work_item_id ORDER BY recorded_at DESC, id DESC) AS rn
  FROM public.outcomes
  WHERE work_item_id IS NOT NULL
)
DELETE FROM public.outcomes o USING ranked x WHERE o.id = x.id AND x.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_outcome_per_work_item
  ON public.outcomes(work_item_id)
  WHERE work_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_work_item_outcome(
  _work_item_id uuid,
  _final_status text,
  _actual_resource_id uuid DEFAULT NULL,
  _actual_duration_minutes integer DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  _org_id uuid;
  _assigned_resource_id uuid;
  _expected_duration integer;
  _role text;
  _outcome_id uuid;
  _recommendation_id uuid;
  _resolved_resource_id uuid;
  _resolved_duration integer;
  _work_status text;
BEGIN
  IF _final_status NOT IN ('completed','canceled','no_show','failed') THEN
    RAISE EXCEPTION 'Invalid final status';
  END IF;
  IF _actual_duration_minutes IS NOT NULL AND _actual_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'Actual duration must be positive';
  END IF;

  SELECT org_id, assigned_resource_id, duration_minutes
  INTO _org_id, _assigned_resource_id, _expected_duration
  FROM public.work_items
  WHERE id = _work_item_id
  FOR UPDATE;
  IF _org_id IS NULL THEN RAISE EXCEPTION 'Work item not found'; END IF;

  SELECT role INTO _role FROM public.org_members
    WHERE org_id = _org_id AND user_id = auth.uid() AND status = 'active';
  IF _role IS NULL OR NOT (_role = ANY(ARRAY['owner','admin','operations_manager','scheduler','supervisor'])) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _actual_resource_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.resources WHERE id = _actual_resource_id AND org_id = _org_id
  ) THEN
    RAISE EXCEPTION 'Actual resource is not in this organization';
  END IF;
  IF EXISTS (SELECT 1 FROM public.outcomes WHERE work_item_id = _work_item_id) THEN
    RAISE EXCEPTION 'An outcome is already recorded for this work item';
  END IF;

  _resolved_resource_id := COALESCE(_actual_resource_id, _assigned_resource_id);
  _resolved_duration := COALESCE(_actual_duration_minutes, _expected_duration);
  _work_status := CASE WHEN _final_status = 'canceled' THEN 'canceled' ELSE 'completed' END;

  SELECT id INTO _recommendation_id
  FROM public.recommendations
  WHERE org_id = _org_id AND work_item_id = _work_item_id AND status = 'approved'
  ORDER BY updated_at DESC, created_at DESC
  LIMIT 1;

  INSERT INTO public.outcomes (
    org_id, recommendation_id, work_item_id, actual_result, expected_result, variance
  ) VALUES (
    _org_id,
    _recommendation_id,
    _work_item_id,
    jsonb_build_object(
      'resource_id', _resolved_resource_id,
      'duration_minutes', _resolved_duration,
      'final_status', _final_status,
      'notes', NULLIF(trim(_notes), '')
    ),
    jsonb_build_object(
      'assigned_resource_id', _assigned_resource_id,
      'duration_minutes', _expected_duration
    ),
    jsonb_build_object(
      'resource_changed', _resolved_resource_id IS DISTINCT FROM _assigned_resource_id,
      'duration_delta_minutes', COALESCE(_resolved_duration, 0) - COALESCE(_expected_duration, 0)
    )
  ) RETURNING id INTO _outcome_id;

  UPDATE public.work_items
  SET status = _work_status,
      canceled_reason = CASE WHEN _final_status = 'canceled' THEN NULLIF(trim(_notes), '') ELSE canceled_reason END
  WHERE id = _work_item_id AND org_id = _org_id;

  INSERT INTO public.audit_events (
    org_id, actor_user_id, actor_role, action, entity_type, entity_id,
    new_state, source, recommendation_id
  ) VALUES (
    _org_id, auth.uid(), _role, 'outcome.recorded', 'work_item', _work_item_id,
    jsonb_build_object(
      'outcome_id', _outcome_id,
      'final_status', _final_status,
      'actual_resource_id', _resolved_resource_id,
      'actual_duration_minutes', _resolved_duration
    ),
    'app', _recommendation_id
  );

  RETURN _outcome_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_work_item_outcome(uuid, text, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_work_item_outcome(uuid, text, uuid, integer, text) TO authenticated, service_role;