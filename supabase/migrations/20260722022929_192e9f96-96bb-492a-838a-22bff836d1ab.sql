
-- Resources: contact phone
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS phone text;

-- Accounts: service address & requirements
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS service_address text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS zip text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS required_qualifications text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS preferred_resource_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- Qualifications: extra metadata
ALTER TABLE public.resource_qualifications ADD COLUMN IF NOT EXISTS qualification_name text;
ALTER TABLE public.resource_qualifications ADD COLUMN IF NOT EXISTS qualification_type text;
ALTER TABLE public.resource_qualifications ADD COLUMN IF NOT EXISTS credential_number text;
ALTER TABLE public.resource_qualifications ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.resource_qualifications ADD COLUMN IF NOT EXISTS notes text;

-- Work items: canceled_reason
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS canceled_reason text;
