
-- Enable pgcrypto
create extension if not exists "pgcrypto";

-- 1. ASEGURAR ENUMS (Critical)
-- Postgres permite agregar valores a enums. 'if not exists' es PG12+.
-- Si falla en versiones viejas, envolver en bloque DO.
DO $$
BEGIN
    ALTER TYPE public.user_role ADD VALUE 'operator';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    ALTER TYPE public.user_role ADD VALUE 'operador';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. LIMPIEZA
-- Ya no usamos el RPC para crear usuarios, la lógica está en Edge Function.
drop function if exists public.create_garage_user_rpc(jsonb);
drop function if exists public.create_garage_user_rpc(uuid, text, text, text, uuid);

-- 3. PERMISOS
-- Asegurar que el Service Role (usado por Edge Function) tenga acceso total
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.garage_managers TO service_role;
GRANT ALL ON TABLE public.garages TO service_role;

-- 4. Notificar recarga de schema
NOTIFY pgrst, 'reload config';
