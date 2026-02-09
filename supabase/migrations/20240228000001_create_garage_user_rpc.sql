
-- Habilitar extensión si no existe
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Eliminar funciones obsoletas si existen para evitar conflictos
DROP FUNCTION IF EXISTS public.create_garage_user(text, text, text, text, text, uuid);

-- Función Transaccional de Vinculación y Validación
CREATE OR REPLACE FUNCTION public.link_user_to_garage(
    p_user_id uuid,
    p_email text,
    p_full_name text,
    p_role_name text,
    p_garage_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con privilegios de sistema para bypass RLS en inserts
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id uuid;
    v_caller_role user_role;
    v_is_garage_owner boolean;
    v_is_garage_manager boolean;
    v_target_role user_role;
BEGIN
    -- 1. Identificar al Caller
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: Usuario no autenticado';
    END IF;

    -- 2. Obtener rol global del Caller (si existe en perfil)
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

    -- 3. Determinar autoridad sobre el garaje específico
    SELECT EXISTS (SELECT 1 FROM public.garages WHERE id = p_garage_id AND owner_id = v_caller_id)
    INTO v_is_garage_owner;

    SELECT EXISTS (SELECT 1 FROM public.garage_managers WHERE garage_id = p_garage_id AND user_id = v_caller_id)
    INTO v_is_garage_manager;

    -- 4. Convertir input de texto a ENUM (Validación de tipo)
    BEGIN
        v_target_role := p_role_name::user_role;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Rol inválido: %', p_role_name;
    END;

    -- 5. MATRIZ DE PERMISOS (Jerarquía Estricta)
    
    -- CASO A: Superadmin (Poder absoluto)
    IF v_caller_role = 'superadmin' THEN
        -- Permitido todo
        NULL; 

    -- CASO B: Owner del Garaje
    ELSIF v_is_garage_owner THEN
        -- Permitido crear Managers, Auditores y Operadores
        IF v_target_role NOT IN ('manager', 'auditor', 'operador') THEN
             RAISE EXCEPTION 'Un Owner solo puede crear Managers, Auditores u Operadores.';
        END IF;

    -- CASO C: Manager del Garaje
    ELSIF v_is_garage_manager THEN
        -- Permitido crear Auditores y Operadores. PROHIBIDO crear Managers.
        IF v_target_role = 'manager' THEN
            RAISE EXCEPTION 'Privilegios insuficientes: Un Gerente no puede crear otros Gerentes.';
        END IF;
        IF v_target_role NOT IN ('auditor', 'operador') THEN
             RAISE EXCEPTION 'Rol no permitido para creación por Gerente.';
        END IF;

    -- CASO D: Sin permisos
    ELSE
        RAISE EXCEPTION 'Acceso denegado: No tienes autoridad sobre este garaje.';
    END IF;

    -- 6. EJECUCIÓN TRANSACCIONAL (Idempotente)

    -- A. Actualizar/Crear Perfil
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (p_user_id, p_email, p_full_name, v_target_role)
    ON CONFLICT (id) DO UPDATE
    SET 
        role = excluded.role,
        full_name = excluded.full_name;

    -- B. Vincular al Garaje
    INSERT INTO public.garage_managers (garage_id, user_id)
    VALUES (p_garage_id, p_user_id)
    ON CONFLICT (garage_id, user_id) DO NOTHING;

    RETURN TRUE;
END;
$$;

-- Otorgar permisos de ejecución al rol autenticado (Frontend)
GRANT EXECUTE ON FUNCTION public.link_user_to_garage TO authenticated;
