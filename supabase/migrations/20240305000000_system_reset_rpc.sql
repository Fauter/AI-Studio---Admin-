
-- LIMPIEZA TOTAL: Eliminar versiones antiguas para evitar conflictos
DROP FUNCTION IF EXISTS public.fn_reset_system_data();
DROP FUNCTION IF EXISTS public.fn_system_factory_reset();

-- Función RPC para Reinicio de Fábrica (Factory Reset)
-- Elimina toda la data operativa y de usuarios, EXCEPTO el SuperAdmin Maestro.
-- Versión Atomicidad Estricta con Transaction Block y Cache Reload

CREATE OR REPLACE FUNCTION public.fn_system_factory_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Bypass RLS
SET search_path = public
AS $$
DECLARE
    v_caller_id uuid;
    v_master_id uuid := 'b7a216ee-f2a6-4739-aa07-1f12a2deb5e5'; -- UUID Maestro
BEGIN
    v_caller_id := auth.uid();

    -- 1. Verificar Permisos (Fallo Rápido)
    IF v_caller_id IS DISTINCT FROM v_master_id THEN
        -- Fallback: Permitir también a usuarios con rol 'superadmin' verificado en DB
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller_id AND role = 'superadmin') THEN
            RAISE EXCEPTION 'Acceso Denegado: ID % no autorizado para reset global.', v_caller_id;
        END IF;
    END IF;

    -- 2. BLOQUE ATÓMICO DE BORRADO (Todo o Nada)
    -- Cualquier error dentro de este bloque hará rollback de toda la operación.
    BEGIN
        
        -- A. Datos de Precios (Nivel más bajo, dependiente de Tariffs/Vehicles)
        DELETE FROM public.prices;

        -- B. Configuraciones de Garaje
        DELETE FROM public.financial_configs;
        DELETE FROM public.building_levels;
        DELETE FROM public.building_configs;

        -- C. Definiciones Base de Garaje
        DELETE FROM public.tariffs;
        DELETE FROM public.vehicle_types;

        -- D. Relaciones de Personal (Pivot)
        DELETE FROM public.garage_managers;

        -- E. Cuentas de Empleados (Shadow Users)
        DELETE FROM public.employee_accounts;

        -- F. Garajes (Entidad Principal)
        DELETE FROM public.garages;

        -- G. Usuarios (Profiles) - PROTECCIÓN CRÍTICA
        -- Borramos todo perfil que NO sea el maestro NI superadmin.
        DELETE FROM public.profiles
        WHERE id != v_master_id 
        AND role != 'superadmin';

    EXCEPTION WHEN OTHERS THEN
        -- Capturar y relanzar error con contexto para el frontend
        RAISE EXCEPTION 'Fallo Crítico en Reset de Sistema (Rollback ejecutado): % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    END;

END;
$$;

-- 3. PERMISOS EXPLÍCITOS (Critical para PGRST202)
GRANT EXECUTE ON FUNCTION public.fn_system_factory_reset() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_system_factory_reset() TO service_role;

-- 4. Notificar recarga de caché de esquema
NOTIFY pgrst, 'reload config';
