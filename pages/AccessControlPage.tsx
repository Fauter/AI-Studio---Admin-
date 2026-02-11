
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function AccessControlPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the Global Hub Access Section
    navigate('/setup/onboarding', { replace: true });
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500 font-medium">Redirigiendo a Gestión Global...</p>
      </div>
    </div>
  );
}
