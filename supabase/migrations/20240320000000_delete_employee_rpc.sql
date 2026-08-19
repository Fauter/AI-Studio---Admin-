-- RPC for secure employee deletion
CREATE OR REPLACE FUNCTION public.delete_employee_account(
  p_target_id uuid,
  p_actor_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target record;
  v_actor_employee record;
  v_actor_owner record;
  v_is_owner boolean := false;
  v_is_manager boolean := false;
  v_effective_owner_id uuid;
BEGIN
  -- 1. Identificar al actor (puede ser el Owner real o un Manager)
  SELECT id INTO v_actor_owner FROM public.profiles WHERE id = p_actor_id;
  
  IF v_actor_owner.id IS NOT NULL THEN
    v_is_owner := true;
    v_effective_owner_id := p_actor_id;
  ELSE
    SELECT id, role, owner_id INTO v_actor_employee FROM public.employee_accounts WHERE id = p_actor_id;
    IF v_actor_employee.id IS NOT NULL AND v_actor_employee.role = 'manager' THEN
      v_is_manager := true;
      v_effective_owner_id := v_actor_employee.owner_id;
    ELSE
      RAISE EXCEPTION 'Actor inválido o sin permisos.';
    END IF;
  END IF;

  -- 2. Obtener el empleado objetivo
  SELECT * INTO v_target FROM public.employee_accounts WHERE id = p_target_id;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Empleado no encontrado.';
  END IF;

  -- 3. Validar que el empleado pertenece a la misma organización
  IF v_target.owner_id != v_effective_owner_id THEN
    RAISE EXCEPTION 'El empleado no pertenece a su organización.';
  END IF;

  -- 4. Validar reglas de jerarquía
  IF v_is_manager THEN
    -- Un Manager no puede borrar a otro Manager
    IF v_target.role = 'manager' THEN
      RAISE EXCEPTION 'Privilegios insuficientes para eliminar a un Gerente.';
    END IF;
  END IF;

  -- 5. Proceder con el borrado físico
  DELETE FROM public.employee_accounts WHERE id = p_target_id;
  
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_employee_account TO anon;
GRANT EXECUTE ON FUNCTION public.delete_employee_account TO authenticated;

NOTIFY pgrst, 'reload config';
