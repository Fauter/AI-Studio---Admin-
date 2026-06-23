-- ============================================================================
-- Migración: Creación de Garajes por MANAGER
-- Fecha: 2024-03-15
-- Descripción:
--   1. RPC SECURITY DEFINER para que un MANAGER (shadow user) pueda crear
--      garajes de forma atómica bajo el owner_id de su organización.
--   2. Políticas RLS INSERT para garages, building_configs y financial_configs
--      exclusivas para OWNER autenticados (auth.uid()).
-- ============================================================================

-- ============================================================================
-- PARTE 1: RPC create_garage_for_manager
-- ============================================================================
-- Permite a un MANAGER crear un garaje en una transacción atómica:
--   1. Valida que el empleado es un MANAGER válido bajo el owner dado.
--   2. Inserta el garaje con owner_id = p_owner_id (siempre el dueño real).
--   3. Crea configs por defecto (building_configs, financial_configs).
--   4. Auto-asigna el nuevo garaje al array allowed_garages del MANAGER.
-- Si cualquier paso falla, plpgsql hace rollback automáticamente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_garage_for_manager(
  p_employee_id uuid,
  p_owner_id uuid,
  p_name text,
  p_address text,
  p_cuit text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee record;
  v_garage record;
BEGIN
  -- ╔═══════════════════════════════════════════════════════════════╗
  -- ║ PASO 1: Validar que el empleado es un MANAGER legítimo      ║
  -- ╚═══════════════════════════════════════════════════════════════╝
  SELECT id, role, owner_id, permissions
  INTO v_employee
  FROM public.employee_accounts
  WHERE id = p_employee_id
    AND owner_id = p_owner_id
    AND role = 'manager';

  IF v_employee.id IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: El empleado no es un gerente autorizado para esta organización.';
  END IF;

  -- Validar inputs básicos
  IF TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'El nombre del garaje es obligatorio.';
  END IF;

  -- ╔═══════════════════════════════════════════════════════════════╗
  -- ║ PASO 2: Crear garaje bajo el owner_id del dueño real        ║
  -- ╚═══════════════════════════════════════════════════════════════╝
  INSERT INTO public.garages (owner_id, name, address, cuit)
  VALUES (p_owner_id, TRIM(p_name), TRIM(p_address), TRIM(p_cuit))
  RETURNING * INTO v_garage;

  -- ╔═══════════════════════════════════════════════════════════════╗
  -- ║ PASO 3: Crear configuraciones por defecto                   ║
  -- ╚═══════════════════════════════════════════════════════════════╝
  INSERT INTO public.building_configs (garage_id) VALUES (v_garage.id);
  INSERT INTO public.financial_configs (garage_id) VALUES (v_garage.id);

  -- ╔═══════════════════════════════════════════════════════════════╗
  -- ║ PASO 4: Auto-asignar garaje al MANAGER creador              ║
  -- ║ Agrega el nuevo garage ID al array permissions.allowed_garages║
  -- ╚═══════════════════════════════════════════════════════════════╝
  UPDATE public.employee_accounts
  SET permissions = jsonb_set(
    COALESCE(permissions, '{"sections":[],"allowed_garages":[]}')::jsonb,
    '{allowed_garages}',
    (
      COALESCE(permissions -> 'allowed_garages', '[]'::jsonb)
      || to_jsonb(v_garage.id::text)
    )
  )
  WHERE id = p_employee_id;

  -- ╔═══════════════════════════════════════════════════════════════╗
  -- ║ RETORNO: Objeto JSON del garaje creado                      ║
  -- ╚═══════════════════════════════════════════════════════════════╝
  RETURN row_to_json(v_garage);
END;
$$;

-- Permisos de ejecución: anon (shadow users) y authenticated (owners)
GRANT EXECUTE ON FUNCTION public.create_garage_for_manager TO anon;
GRANT EXECUTE ON FUNCTION public.create_garage_for_manager TO authenticated;


-- ============================================================================
-- PARTE 2: Políticas RLS INSERT para OWNER autenticado (auth.uid())
-- ============================================================================
-- Estas políticas permiten que el OWNER haga INSERT directo desde el cliente.
-- Los MANAGER no pasan por aquí (usan el RPC SECURITY DEFINER de arriba).
-- ============================================================================

-- --- GARAGES ---
ALTER TABLE public.garages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RLS_Garages_Insert_Owner" ON public.garages;
CREATE POLICY "RLS_Garages_Insert_Owner" ON public.garages
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

-- --- BUILDING_CONFIGS ---
ALTER TABLE public.building_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RLS_BuildingConfigs_Insert_Owner" ON public.building_configs;
CREATE POLICY "RLS_BuildingConfigs_Insert_Owner" ON public.building_configs
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.garages
    WHERE id = garage_id
    AND owner_id = auth.uid()
  )
);

-- --- FINANCIAL_CONFIGS ---
ALTER TABLE public.financial_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RLS_FinancialConfigs_Insert_Owner" ON public.financial_configs;
CREATE POLICY "RLS_FinancialConfigs_Insert_Owner" ON public.financial_configs
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.garages
    WHERE id = garage_id
    AND owner_id = auth.uid()
  )
);


-- ============================================================================
-- Notificar recarga de caché de esquema PostgREST
-- ============================================================================
NOTIFY pgrst, 'reload config';
