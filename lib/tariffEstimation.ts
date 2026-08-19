import { PricingEngine } from './PricingEngine';
import { VehicleType, Tariff, Price, FinancialConfig } from '../types';

export function buildPriceMatrix(
    vehicles: any[], // using any[] to support both Simulator and Dashboard usage if types differ slightly
    tariffs: any[],
    prices: any[],
    paymentMethod: string
): Record<string, Record<string, number>> {
    const matrix: Record<string, Record<string, number>> = {};
    const methodFilter = paymentMethod === 'Efectivo' ? 'standard' : 'electronic';

    // Optimize lookups
    const pricesByVehicleAndTariff = new Map<string, any>();
    for (const p of prices) {
        if (p.price_list === methodFilter) {
            pricesByVehicleAndTariff.set(`${p.vehicle_type_id}-${p.tariff_id}`, p);
        }
    }

    vehicles.forEach(v => {
        matrix[v.name] = {};
        tariffs.forEach(t => {
            const p = pricesByVehicleAndTariff.get(`${v.id}-${t.id}`);
            if (p) {
                matrix[v.name][t.name] = p.amount;
            }
        });
    });

    return matrix;
}

export type EstimateResult = {
    amount: number;
    isValid: true;
} | {
    amount: null;
    isValid: false;
    reason: 'missing_data' | 'error';
};

// Normalize vehicle type name (same logic as PricingEngine)
export function toCanonical(text: string): string {
    if (!text) return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function estimateStayCost(
    entryTime: Date,
    exitTime: Date,
    vehicleTypeName: string,
    plate: string,
    paymentMethod: string,
    tariffs: any[],
    pricesMatrix: any,
    financialConfig: any
): EstimateResult {
    try {
        if (!vehicleTypeName || !tariffs || tariffs.length === 0 || !pricesMatrix || Object.keys(pricesMatrix).length === 0) {
            return { amount: null, isValid: false, reason: 'missing_data' };
        }

        const calculatedTotal = PricingEngine.calculateSimulated(
            { entryTime, vehicleType: vehicleTypeName, plate },
            exitTime,
            paymentMethod,
            tariffs,
            pricesMatrix,
            financialConfig
        );

        return { amount: calculatedTotal, isValid: true };
    } catch (e) {
        console.error(`Error estimating stay cost for plate ${plate}, type ${vehicleTypeName}:`, e);
        return { amount: null, isValid: false, reason: 'error' };
    }
}
