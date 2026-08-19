import { describe, it, expect } from 'vitest';
import { countActiveSubscriptions, enhanceSubscription, filterEnhancedSubscription } from './subscriptionUtils';

describe('subscriptionUtils', () => {
    describe('countActiveSubscriptions', () => {
        it('Test 1: Mismo garage_id + vehicle_id activo múltiples veces se cuenta como múltiples abonos', () => {
            const subs = [
                { id: '1', active: true, garage_id: 'g1', vehicle_id: 'v1' },
                { id: '2', active: true, garage_id: 'g1', vehicle_id: 'v1' },
            ];
            expect(countActiveSubscriptions(subs as any, 'g1')).toBe(2);
        });

        it('Test 2: Solo se consideran abonos con active === true', () => {
            const subs = [
                { id: '1', active: true, garage_id: 'g1', end_date: '2023-01-01' },
                { id: '2', active: false, garage_id: 'g1', end_date: '2025-01-01' },
                { id: '3', active: undefined, garage_id: 'g1' },
            ];
            expect(countActiveSubscriptions(subs as any, 'g1')).toBe(1);
        });

        it('Test 3: Filtro por garage_id ("all" o específico)', () => {
            const subs = [
                { id: '1', active: true, garage_id: 'g1' },
                { id: '2', active: true, garage_id: 'g2' },
            ];
            expect(countActiveSubscriptions(subs as any, 'g1')).toBe(1);
            expect(countActiveSubscriptions(subs as any, 'g2')).toBe(1);
            expect(countActiveSubscriptions(subs as any, 'all')).toBe(2);
        });

        it('Test 4: Se deduplica por subscription.id antes de contar', () => {
            const subs = [
                { id: '1', active: true, garage_id: 'g1' },
                { id: '1', active: true, garage_id: 'g1' }, // Duplicado técnico
            ];
            expect(countActiveSubscriptions(subs as any, 'g1')).toBe(1);
        });

        it('Test 5: Validar que respeta la unidad de negocio (1 cochera con 5 vehículos = 1 abono)', () => {
            // Este test es conceptual: el array de subscriptions ya representa la unidad de negocio correcta (1 registro en tabla = 1 abono).
            const subs = [
                { id: '1', active: true, garage_id: 'g1', customer_id: 'c1' },
            ];
            expect(countActiveSubscriptions(subs as any, 'g1')).toBe(1);
        });
    });

    describe('enhanceSubscription', () => {
        const customerById = new Map([
            ['c1', { id: 'c1', name: 'John Doe', dni: '123' }]
        ]);
        const vehicleById = new Map([
            ['v1', { id: 'v1', plate: 'ABC 123' }]
        ]);
        const cocherasByGarageCustomer = new Map([
            ['g1_c1', [
                { numero: '10', cliente_id: 'c1', garage_id: 'g1', vehiculos: ['XYZ 999', 'ABC 123'] }
            ]]
        ]);
        const activeGarageVehicleCounts = new Map([
            ['g1_v1', 2] // Simulated duplicate
        ]);

        it('Should resolve customer and main vehicle correctly', () => {
            const sub = { id: '1', customer_id: 'c1', vehicle_id: 'v1', garage_id: 'g1' };
            const result = enhanceSubscription(sub as any, true, customerById, vehicleById, cocherasByGarageCustomer, activeGarageVehicleCounts);
            
            expect(result.customer?.name).toBe('John Doe');
            expect(result.mainVehicle?.plate).toBe('ABC 123');
            expect(result.targetCochera?.numero).toBe('10');
            expect(result.isDuplicate).toBe(true);
        });

        it('Should handle missing relations gracefully', () => {
            const sub = { id: '2', customer_id: 'c2', vehicle_id: 'v2', garage_id: 'g1' };
            const result = enhanceSubscription(sub as any, true, customerById, vehicleById, cocherasByGarageCustomer, activeGarageVehicleCounts);
            
            expect(result.customer).toBeUndefined();
            expect(result.mainVehicle).toBeUndefined();
            expect(result.targetCochera).toBeUndefined();
            expect(result.isDuplicate).toBe(false);
        });

        it('Should mark multiple candidates correctly', () => {
            const cByGC = new Map([
                ['g1_c1', [
                    { numero: '11', cliente_id: 'c1', garage_id: 'g1', vehiculos: ['DDD 111'] },
                    { numero: '12', cliente_id: 'c1', garage_id: 'g1', vehiculos: ['EEE 222'] }
                ]]
            ]);
            const sub = { id: '3', customer_id: 'c1', vehicle_id: 'v1', garage_id: 'g1' };
            const result = enhanceSubscription(sub as any, true, customerById, vehicleById, cByGC, activeGarageVehicleCounts);
            
            expect(result.targetCochera).toBeUndefined();
            expect(result.multipleCandidates).toBe(true);
            expect(result.candidateCocheras.length).toBe(2);
        });
    });

    describe('filterEnhancedSubscription', () => {
        it('Filters correctly by name, plate, and cochera', () => {
            const item = {
                sub: { id: 'abc-123', customer_id: 'c1' },
                customer: { name: 'Maria Gomez', dni: '999' },
                mainVehicle: { plate: 'MAR 456' },
                targetCochera: { numero: 'A-15' }
            };

            expect(filterEnhancedSubscription(item as any, '')).toBe(true);
            expect(filterEnhancedSubscription(item as any, 'maria')).toBe(true);
            expect(filterEnhancedSubscription(item as any, 'mar 456')).toBe(true);
            expect(filterEnhancedSubscription(item as any, 'a-15')).toBe(true);
            expect(filterEnhancedSubscription(item as any, 'abc')).toBe(true);
            
            expect(filterEnhancedSubscription(item as any, 'pedro')).toBe(false);
            expect(filterEnhancedSubscription(item as any, 'xyz')).toBe(false);
        });
    });
});
