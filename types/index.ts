/**
 * Enums matching Database Types
 */
export enum UserRole {
  SUPERADMIN = 'superadmin',
  OWNER = 'owner',
  MANAGER = 'manager',
  AUDITOR = 'auditor'
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

export interface VehicleType {
  id: string;
  name: string;
  icon_key?: string; // e.g. 'car', 'bike', 'truck'
  sort_order: number;
}

export type TariffType = 'hour' | 'stay' | 'subscription' | 'service';

export interface Tariff {
  id: string;
  name: string; // e.g., 'Hora', 'Estadía 12hs', 'Abono Mensual'
  type: TariffType;
  sort_order: number;
}

export interface Price {
  id?: string; // Optional because upsert might create it
  garage_id: string;
  vehicle_type_id: string;
  tariff_id: string;
  amount: number;
  price_list_id?: string; // 'standard' by default
  updated_at?: string;
}

/**
 * Functional DTOs & Configuration Interfaces
 */

export interface BuildingLevelDTO {
  id: string;
  display_name: string;
  type: LevelType;
  capacity: number; // Maps to total_spots
  sort_order: number;
}

export interface MonthlyPunitorioStep {
  day_trigger: number;
  surcharge_percentage: number;
}

export interface MonthlyPunitorio {
  month_index: number; // 0-11
  active: boolean;
  start_day: number;
  steps: MonthlyPunitorioStep[];
}

export interface FinancialConfig {
  garage_id: string;
  punitorio_rules: MonthlyPunitorio[] | null; // Stored as jsonb
  payment_methods: any | null; // jsonb
  invoice_types: any | null; // jsonb
}

/**
 * View Models
 */

export interface GarageAdminView {
  id: string;
  name: string;
  address: string;
  role: UserRole; // The role of the current user for this specific garage context
  is_active: boolean;
}

export interface UserSession {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}