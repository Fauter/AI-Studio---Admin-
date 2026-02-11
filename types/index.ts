
/**
 * Enums matching Database Types
 */
export enum UserRole {
  SUPERADMIN = 'superadmin',
  OWNER = 'owner',
  MANAGER = 'manager',
  ADMINISTRATIVE = 'administrative', // Nuevo
  OPERATOR = 'operador', // Mantenemos el valor exacto de tu DB
  AUDITOR = 'auditor' // Matches PostgreSQL ENUM value exactly (lowercase)
}

export enum LevelType {
  SUBSUELO = 'subsuelo',
  PLANTA_BAJA = 'planta_baja',
  PISO = 'piso'
}

/**
 * Database Row Interfaces
 */
export interface Profile {
  id: string; // uuid
  email: string | null;
  role: UserRole | null;
  full_name: string | null;
}

export interface EmployeeAccount {
  id: string;
  owner_id: string;
  garage_id?: string | null; // Optional: Null means Global Employee (Owner level)
  username: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  created_at?: string;
  // Join fields (Optional)
  garages?: {
    name: string;
  };
}

export interface Garage {
  id: string; // uuid
  owner_id: string | null;
  name: string | null;
  cuit: string | null;
  address: string | null;
  logo_url: string | null;
}

export interface GarageManager {
  garage_id: string;
  user_id: string;
}

export interface BuildingConfig {
  garage_id: string;
  count_subsuelos: number | null;
  has_planta_baja: boolean | null;
  count_pisos: number | null;
}

export interface BuildingLevel {
  id: string;
  garage_id: string | null;
  type: LevelType | null;
  level_number: number | null;
  display_name: string | null;
  total_spots: number | null;
  sort_order: number | null;
}

/**
 * Price Matrix & Tariffs
 */

export type VehicleIconKey = 'car' | 'bike' | 'truck' | 'bus';

export interface VehicleType {
  id: string;
  garage_id: string;
  name: string;
  icon_key: VehicleIconKey | string; 
  sort_order: number;
}

export type TariffType = 'hora' | 'turno' | 'abono'; 

export interface Tariff {
  id: string;
  garage_id: string;
  name: string;
  type: TariffType;
  days: number;
  hours: number;
  minutes: number;
  tolerance: number; 
  sort_order: number;
  is_protected: boolean; 
}

export interface Price {
  id?: string; 
  garage_id: string;
  vehicle_type_id: string;
  tariff_id: string;
  amount: number;
  price_list: string;
  updated_at?: string;
}

/**
 * Functional DTOs & Configuration Interfaces
 */

export interface BuildingLevelDTO {
  id?: string;
  display_name: string;
  type: LevelType;
  capacity: number;
  sort_order: number;
}

export interface MonthlyPunitorioStep {
  day_trigger: number;
  surcharge_percentage: number;
}

export interface MonthlyPunitorio {
  month_index: number;
  active: boolean;
  start_day: number;
  steps: MonthlyPunitorioStep[];
}

export interface FinancialConfig {
  garage_id: string;
  punitorio_rules: MonthlyPunitorio[] | null; 
  payment_methods: any | null; 
  invoice_types: any | null; 
}

/**
 * View Models
 */

export interface GarageAdminView {
  id: string;
  name: string;
  address: string;
  role: UserRole;
  is_active: boolean;
}

// CRITICAL: Aligned with RPC login_employee response
export interface UserSession {
  id: string;
  email: string | null;
  full_name: string;
  role: UserRole;
  isShadow?: boolean; 
  owner_id?: string; // Reference to the Organization Owner (Boss)
  garage_id?: string; // Optional: legacy or specific assignment
  username?: string;
}
