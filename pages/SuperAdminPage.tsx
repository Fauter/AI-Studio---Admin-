import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Shield, Building2, MapPin, LogOut, Search, ChevronDown, ChevronUp, 
  ExternalLink, Loader2, Users, Image as ImageIcon, Maximize2, Calendar, Car, X, LayoutDashboard,
  Trash2, AlertTriangle
} from 'lucide-react';
import { Profile, Garage } from '../types';
import { useAuth } from '../hooks/useAuth';
import AuthenticatedUserIdentity from '../components/AuthenticatedUserIdentity';
import { formatDateTime24h } from '../lib/dateFormatters';

type OwnerWithGarages = Profile & {
  garages: Garage[];
  createdAt: string;
};

interface StayPhoto {
  id: string;
  plate: string;
  entry_time: string;
  entry_photo_path: string;
  garage_id: string;
}

export default function SuperAdminPage() {
  const { signOut } = useAuth();
  
  // --- STATES: SUMMARY TAB ---
  const [owners, setOwners] = useState<OwnerWithGarages[]>([]);
  const [allGarages, setAllGarages] = useState<Garage[]>([]);
  const [totalGarages, setTotalGarages] = useState(0);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOwnerId, setExpandedOwnerId] = useState<string | null>(null);

  // --- STATES: PHOTOS TAB ---
  const [activeTab, setActiveTab] = useState<'summary' | 'photos'>('summary');
  const [photos, setPhotos] = useState<StayPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<StayPhoto | null>(null);
  const [selectedGarageFilter, setSelectedGarageFilter] = useState<string>('');
  const [photoToDelete, setPhotoToDelete] = useState<StayPhoto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // FETCH: Summary Data
  useEffect(() => {
    const fetchSuperAdminData = async () => {
      try {
        setLoadingSummary(true);
        // 1. Fetch owners
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'owner');
        
        if (profilesError) throw profilesError;

        // 2. Fetch garages
        const { data: garagesData, error: garagesError } = await supabase
          .from('garages')
          .select('*');

        if (garagesError) throw garagesError;

        setTotalGarages(garagesData?.length || 0);
        setAllGarages(garagesData || []);

        const mappedOwners = (profilesData || []).map(owner => {
          const ownerGarages = garagesData?.filter(g => g.owner_id === owner.id) || [];
          return {
            ...owner,
            garages: ownerGarages,
            createdAt: owner.created_at ? new Date(owner.created_at).toLocaleDateString() : 'N/A'
          };
        });

        setOwners(mappedOwners);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSuperAdminData();
  }, []);

  // FETCH: Photos Data (Lazy loaded when tab is clicked)
  useEffect(() => {
    if (activeTab === 'photos' && photos.length === 0) {
      const fetchPhotos = async () => {
        try {
          setLoadingPhotos(true);
          const { data, error: fetchError } = await supabase
            .from('stays')
            .select('id, plate, entry_time, entry_photo_path, garage_id')
            .not('entry_photo_path', 'is', null)
            .order('entry_time', { ascending: false })
            .limit(100);

          if (fetchError) throw fetchError;
          setPhotos(data || []);
        } catch (err: any) {
          console.error("Error fetching photos:", err);
        } finally {
          setLoadingPhotos(false);
        }
      };
      fetchPhotos();
    }
  }, [activeTab, photos.length]);

  const filteredOwners = owners.filter(owner => {
    const search = searchTerm.toLowerCase();
    const nameMatch = owner.full_name?.toLowerCase().includes(search);
    const emailMatch = owner.email?.toLowerCase().includes(search);
    return nameMatch || emailMatch;
  });

  const toggleExpand = (id: string) => {
    setExpandedOwnerId(prev => prev === id ? null : id);
  };

  const handleAudit = (ownerId: string) => {
    console.log('Auditar Panel para owner:', ownerId);
    alert(`Simulando ingreso auditado al panel del owner ID: ${ownerId}`);
  };

  const getGarageName = (garageId: string) => {
    const garage = allGarages.find(g => g.id === garageId);
    return garage ? garage.name : 'Desconocido';
  };

  const handleDeletePhoto = async () => {
    if (!photoToDelete) return;
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('stays')
        .update({ entry_photo_path: null })
        .eq('id', photoToDelete.id);

      if (error) throw error;

      // Update local state by removing the photo
      setPhotos(prev => prev.filter(p => p.id !== photoToDelete.id));
      setPhotoToDelete(null);
    } catch (err: any) {
      alert(`Error al borrar la foto: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredPhotos = photos.filter(photo => {
    if (!selectedGarageFilter) return true;
    return photo.garage_id === selectedGarageFilter;
  });

  if (loadingSummary && activeTab === 'summary') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER FIJO */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight hidden md:block">
              GarageIA Hub - SuperAdmin
            </span>
          </div>

          {/* TABS NAVEGACIÓN */}
          <nav className="flex space-x-2">
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'summary' 
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm' 
                  : 'bg-white text-slate-500 border border-transparent hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:block">Resumen</span>
            </button>
            <button
              onClick={() => setActiveTab('photos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'photos' 
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm' 
                  : 'bg-white text-slate-500 border border-transparent hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:block">Galería de Fotos</span>
            </button>
          </nav>

          <div className="flex items-center justify-end gap-2 shrink-0">
            <AuthenticatedUserIdentity />
            <button 
              onClick={signOut}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:block">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* --- VIEW: SUMMARY --- */}
        {activeTab === 'summary' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
            
            {/* TOP METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                  <Users className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Dueños Registrados</p>
                  <p className="text-2xl font-bold text-slate-900">{owners.length}</p>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Garajes Totales</p>
                  <p className="text-2xl font-bold text-slate-900">{totalGarages}</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium">
                Error al cargar datos: {error}
              </div>
            )}

            {/* CONTROLS */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-bold text-slate-800">Directorio de Cuentas</h2>
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o email..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all"
                />
              </div>
            </div>

            {/* OWNERS LIST (ACCORDION) */}
            <div className="space-y-4">
              {filteredOwners.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-300 rounded-2xl py-12 flex flex-col items-center justify-center text-slate-500">
                  <Search className="h-10 w-10 mb-3 text-slate-300" />
                  <p className="font-medium text-slate-600">No se encontraron resultados</p>
                  <p className="text-sm">Intenta con otro término de búsqueda.</p>
                </div>
              ) : (
                filteredOwners.map(owner => {
                  const isExpanded = expandedOwnerId === owner.id;
                  
                  return (
                    <div key={owner.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all">
                      {/* CARD HEADER */}
                      <div 
                        className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => toggleExpand(owner.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 font-bold text-slate-600">
                            {owner.full_name ? owner.full_name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">{owner.full_name || 'Usuario sin nombre'}</h3>
                            <p className="text-sm text-slate-500">{owner.email || 'Sin correo electrónico'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6 justify-between md:justify-end">
                          <div className="flex gap-4">
                            <div className="flex flex-col items-center md:items-end">
                              <span className="text-xs font-semibold text-slate-500 uppercase">Registro</span>
                              <span className="text-sm font-medium text-slate-700">{owner.createdAt}</span>
                            </div>
                            <div className="flex flex-col items-center md:items-end">
                              <span className="text-xs font-semibold text-slate-500 uppercase">Garajes</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 mt-0.5">
                                {owner.garages.length}
                              </span>
                            </div>
                          </div>
                          <button className="text-slate-400 hover:text-slate-600 p-1">
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

                      {/* ACCORDION CONTENT: GARAGES */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/50 p-5 animate-in slide-in-from-top-2">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                            <h4 className="font-semibold text-slate-700">Establecimientos ({owner.garages.length})</h4>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleAudit(owner.id); }}
                              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 text-slate-700 rounded-lg text-sm font-bold transition-all shadow-sm"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Auditar Panel
                            </button>
                          </div>

                          {owner.garages.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">Este dueño aún no ha registrado garajes.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {owner.garages.map(garage => (
                                <div key={garage.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col gap-2 hover:border-indigo-200 transition-colors">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-indigo-500 shrink-0" />
                                    <span className="font-bold text-slate-800 text-sm truncate" title={garage.name || ''}>
                                      {garage.name || 'Sin nombre'}
                                    </span>
                                  </div>
                                  <div className="flex items-start gap-2 text-slate-500 text-xs">
                                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
                                    <span className="line-clamp-2" title={garage.address || ''}>
                                      {garage.address || 'Sin dirección configurada'}
                                    </span>
                                  </div>
                                  {garage.cuit && (
                                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-mono text-slate-400">
                                      CUIT: {garage.cuit}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* --- VIEW: PHOTOS GALLERY --- */}
        {activeTab === 'photos' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ImageIcon className="h-6 w-6 text-indigo-500" />
                Registros Fotográficos (LPR)
              </h2>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Building2 className="h-4 w-4 text-slate-400" />
                <select 
                  value={selectedGarageFilter}
                  onChange={(e) => setSelectedGarageFilter(e.target.value)}
                  className="w-full md:w-64 pl-3 pr-8 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm bg-white"
                >
                  <option value="">Todos los estacionamientos</option>
                  {allGarages.map(g => (
                    <option key={g.id} value={g.id}>{g.name || 'Sin nombre'}</option>
                  ))}
                </select>
              </div>
            </div>

            {loadingPhotos ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : filteredPhotos.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl py-16 flex flex-col items-center justify-center text-slate-500">
                <ImageIcon className="h-12 w-12 mb-4 text-slate-300" />
                <p className="font-medium text-lg text-slate-600">No se encontraron registros fotográficos</p>
                <p className="text-sm mt-1">Aún no hay ingresos vehiculares con captura de patente en la base de datos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredPhotos.map(photo => (
                  <div key={photo.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col group relative">
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoToDelete(photo);
                        }}
                        className="p-1.5 bg-white/90 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors shadow-sm border border-slate-200/50 backdrop-blur-sm"
                        title="Borrar foto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div 
                      className="relative h-48 bg-slate-100 overflow-hidden cursor-pointer"
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      <img 
                        src={photo.entry_photo_path} 
                        alt={`Patente ${photo.plate}`} 
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md h-8 w-8" />
                      </div>
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-slate-400" />
                        <span className="font-bold text-slate-800 text-lg tracking-wider bg-slate-100 px-2 rounded uppercase border border-slate-200">
                          {photo.plate || 'DESCONOCIDA'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>{formatDateTime24h(photo.entry_time)}</span>
                      </div>
                      <div className="text-xs text-slate-500 truncate border-t border-slate-100 pt-2 mt-1 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-medium">{getGarageName(photo.garage_id)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* --- MODAL CONFIRM DELETE PHOTO --- */}
      {photoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4 mx-auto">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
                ¿Eliminar esta fotografía?
              </h3>
              <p className="text-sm text-slate-500 text-center mb-6">
                Estás a punto de borrar la foto del registro <span className="font-bold text-slate-700">{photoToDelete.plate}</span>. Esta acción no eliminará el ingreso, pero la foto se perderá de la base remota. Esta acción no es reversible.
              </p>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPhotoToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeletePhoto}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Borrando...
                    </>
                  ) : (
                    'Eliminar Fotografía'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL LIGHTBOX --- */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in bg-slate-900/80 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-md"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="bg-slate-100 flex items-center justify-center min-h-[300px] max-h-[70vh] overflow-hidden">
              <img 
                src={selectedPhoto.entry_photo_path} 
                alt={`Captura de patente ${selectedPhoto.plate}`}
                className="w-full h-full object-contain"
              />
            </div>
            
            <div className="p-6 bg-white border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Patente Capturada</h3>
                  <div className="text-3xl font-black text-slate-800 uppercase tracking-widest">
                    {selectedPhoto.plate || 'DESCONOCIDA'}
                  </div>
                </div>
                <div className="flex flex-col sm:items-end gap-1 text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">{formatDateTime24h(selectedPhoto.entry_time)}</span>
                  </div>
                  <div className="text-sm text-slate-400">
                    ID Estancia: {selectedPhoto.id.split('-')[0]}...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
