-- Habilitar pgcrypto para hashing seguro
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de Cuentas de Empleados (Shadow Auth)
CREATE TABLE IF NOT EXISTS public.employee_accounts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    garage_id uuid REFERENCES public.garages(id) NOT NULL,
    owner_id uuid REFERENCES public.profiles(id) NOT NULL, -- El dueño que crea la cuenta
    username text NOT NULL,
    password_hash text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    role user_role NOT NULL CHECK (role IN ('manager', 'auditor', 'operador')),
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_username_global UNIQUE (username)
);

-- Trigger: Encriptar contraseña automáticamente al insertar o actualizar
CREATE OR REPLACE FUNCTION public.encrypt_employee_password()
RETURNS trigger AS $$
BEGIN
  -- Si el password no parece un hash bcrypt válido (empieza con $2...), lo hasheamos
  IF NEW.password_hash IS NOT NULL AND NEW.password_hash !~ '^\$2[axy]\$.{56}$' THEN
    NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf', 10));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_encrypt_employee_password ON public.employee_accounts;
CREATE TRIGGER trigger_encrypt_employee_password
BEFORE INSERT OR UPDATE ON public.employee_accounts
FOR EACH ROW EXECUTE FUNCTION public.encrypt_employee_password();

-- RLS: Seguridad a nivel de fila
ALTER TABLE public.employee_accounts ENABLE ROW LEVEL SECURITY;

-- Política: Los dueños pueden ver y gestionar SOLO los empleados que ellos crearon (owner_id)
DROP POLICY IF EXISTS "Owners can manage their employees" ON public.employee_accounts;
CREATE POLICY "Owners can manage their employees"
ON public.employee_accounts
FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- IMPORTANTE: Permitir acceso a usuarios autenticados (para que Supabase Client pueda leer/escribir si cumple la politica)
GRANT ALL ON TABLE public.employee_accounts TO authenticated;
GRANT ALL ON TABLE public.employee_accounts TO service_role;

-- RPC: Función de Login para Shadow Users
-- Retorna el perfil del usuario si las credenciales son válidas
CREATE OR REPLACE FUNCTION public.login_employee(p_username text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con permisos de sistema para leer hashes
AS $$
DECLARE
  v_user record;
  v_garage_name text;
BEGIN
  -- Buscar usuario por username
  SELECT ea.*, g.name as garage_name 
  INTO v_user
  FROM public.employee_accounts ea
  JOIN public.garages g ON ea.garage_id = g.id
  WHERE ea.username = p_username;

  -- Verificar existencia y contraseña
  IF v_user.id IS NOT NULL AND v_user.password_hash = crypt(p_password, v_user.password_hash) THEN
    -- Retornar objeto compatible con la estructura de sesión del frontend
    RETURN json_build_object(
      'id', v_user.id,
      'email', null, -- Shadow users no tienen email
      'full_name', v_user.first_name || ' ' || v_user.last_name,
      'role', v_user.role,
      'garage_id', v_user.garage_id,
      'username', v_user.username
    );
  END IF;

  RETURN null;
END;
$$;