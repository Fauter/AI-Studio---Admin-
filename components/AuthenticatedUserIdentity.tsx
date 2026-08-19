import React from 'react';
import { useAuth } from '../hooks/useAuth';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Gerente',
  operador: 'Operador',
  owner: 'Owner',
  administrative: 'Administrativo',
  superadmin: 'Super Administrador'
};

export default function AuthenticatedUserIdentity() {
  const { profile, shadowUser, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-end justify-center animate-pulse min-w-[100px]">
        <div className="h-4 w-24 bg-slate-200 rounded mb-1"></div>
        <div className="h-3 w-16 bg-slate-200 rounded"></div>
      </div>
    );
  }

  let displayName = '';
  let rawRole = '';

  if (shadowUser) {
    const first = (shadowUser as any).first_name?.trim() || '';
    const last = (shadowUser as any).last_name?.trim() || '';
    
    if (first || last) {
      displayName = `${first} ${last}`.trim().replace(/\s+/g, ' ');
    } else if (shadowUser.username) {
      displayName = shadowUser.username.trim();
    } else if (shadowUser.full_name) {
      displayName = shadowUser.full_name.trim();
    }
    rawRole = shadowUser.role || '';
  } else if (profile) {
    if (profile.full_name?.trim()) {
      displayName = profile.full_name.trim().replace(/\s+/g, ' ');
    } else if (user?.user_metadata?.full_name?.trim()) {
      displayName = user.user_metadata.full_name.trim().replace(/\s+/g, ' ');
    } else if (user?.email) {
      displayName = user.email.split('@')[0];
    } else if (profile.email) {
      displayName = profile.email.split('@')[0];
    }
    rawRole = profile.role || '';
  } else {
    return null;
  }

  if (!displayName) return null;

  const roleLabel = ROLE_LABELS[rawRole] || (rawRole.charAt(0).toUpperCase() + rawRole.slice(1));

  return (
    <div className="flex flex-col items-end justify-center min-w-0 shrink-0 max-w-[150px] md:max-w-[200px]">
      <span 
        className="text-sm font-bold text-slate-800 truncate w-full text-right"
        title={displayName}
      >
        {displayName}
      </span>
      <span className="text-xs text-slate-500 truncate w-full text-right" title={roleLabel}>
        {roleLabel}
      </span>
    </div>
  );
}
