
-- 1. Modificar tabla employee_accounts
-- Eliminamos la columna garage_id para que los empleados pertenezcan al Owner, no al Garaje.
ALTER TABLE public.employee_accounts 
DROP COLUMN IF EXISTS garage_id;

-- 2. Actualizar RPC login_employee
-- Ahora retorna owner_id en lugar de garage_id (ya que garage_id ya no existe en la tabla).
CREATE OR REPLACE FUNCTION public.login_employee(p_username text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user record;
BEGIN
  -- Buscar usuario por username (Global Search en la tabla de empleados)
  SELECT * INTO v_user
  FROM public.employee_accounts
  WHERE username = p_username;

  -- Verificar existencia y contraseña
  IF v_user.id IS NOT NULL AND v_user.password_hash = crypt(p_password, v_user.password_hash) THEN
    -- Retornar objeto de sesión actualizado
    RETURN json_build_object(
      'id', v_user.id,
      'email', null, 
      'full_name', v_user.first_name || ' ' || v_user.last_name,
      'role', v_user.role,
      'owner_id', v_user.owner_id, -- Clave para que el frontend sepa quién es el jefe
      'username', v_user.username
    );
  END IF;

  RETURN null;
END;
$$;

-- 3. Asegurar Políticas RLS
-- La política existente "Owners can manage their employees" se mantiene válida
-- porque se basa en `auth.uid() = owner_id`, lo cual no ha cambiado.

-- Notificar recarga de caché de esquema
NOTIFY pgrst, 'reload config';
