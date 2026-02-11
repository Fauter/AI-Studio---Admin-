-- 1. ASEGURAR QUE EXISTE LA FUNCIÓN DE APOYO (SECURITY DEFINER)
-- Esta función es la "llave maestra" que permite saber el rol sin disparar el RLS
CREATE OR REPLACE FUNCTION public.check_is_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT (role = 'superadmin')
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. CONFIGURACIÓN DE TABLA PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RLS_Profiles_Select" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Superadmin views all" ON public.profiles;

CREATE POLICY "RLS_Profiles_Select_Final" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id -- El dueño ve su propio perfil
  OR 
  public.check_is_superadmin() -- El admin ve todos sin recursión
);

-- 3. CONFIGURACIÓN DE TABLA GARAGES
ALTER TABLE public.garages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RLS_Garages_Select" ON public.garages;

CREATE POLICY "RLS_Garages_Select_Final" ON public.garages
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid() -- El Owner ve su garage
  OR 
  public.check_is_superadmin() -- El Superadmin ve todos los garages
  OR
  -- Permitir acceso a empleados (Managers/Auditores)
  EXISTS (
    SELECT 1 FROM public.garage_managers 
    WHERE garage_id = public.garages.id 
    AND user_id = auth.uid()
  )
);