import { Subscription } from './CashFlowShared';

export function countActiveSubscriptions(subscriptions: Subscription[], selectedGarageId: string): number {
    // 1. Deduplicate technically by subscription.id in case of pagination overlaps
    const uniqueSubsMap = new Map<string, Subscription>();
    for (const sub of subscriptions) {
        if (sub.id) {
            uniqueSubsMap.set(sub.id, sub);
        }
    }
    const uniqueSubs = Array.from(uniqueSubsMap.values());

    // 2. Filter by selected garage
    const garageFiltered = selectedGarageId === 'all'
        ? uniqueSubs
        : uniqueSubs.filter(sub => sub.garage_id === selectedGarageId);

    // 3. Filter by canonical state active === true
    const activeSubs = garageFiltered.filter(sub => sub.active === true);

    return activeSubs.length;
}

export function enhanceSubscription(
    sub: Subscription,
    isActive: boolean,
    customerById: Map<string, any>,
    vehicleById: Map<string, any>,
    cocherasByGarageCustomer: Map<string, any[]>,
    activeGarageVehicleCounts: Map<string, number>
) {
    const customer = sub.customer_id ? customerById.get(sub.customer_id) : undefined;
    const mainVehicle = sub.vehicle_id ? vehicleById.get(sub.vehicle_id) : undefined;
    
    let targetCochera: any | undefined = undefined;
    let multipleCandidates = false;
    let candidateCocheras: any[] = [];

    if (sub.customer_id && sub.garage_id) {
        const key = sub.garage_id + '_' + sub.customer_id;
        const customerCocheras = cocherasByGarageCustomer.get(key) || [];
        
        if (customerCocheras.length === 1) {
            targetCochera = customerCocheras[0];
        } else if (customerCocheras.length > 1) {
            if (mainVehicle && mainVehicle.plate) {
                const plate = mainVehicle.plate.trim().toUpperCase();
                const matching = customerCocheras.filter(c => 
                    c.vehiculos?.some(v => v.trim().toUpperCase() === plate)
                );
                if (matching.length === 1) {
                    targetCochera = matching[0];
                } else {
                    multipleCandidates = true;
                    candidateCocheras = customerCocheras;
                }
            } else {
                multipleCandidates = true;
                candidateCocheras = customerCocheras;
            }
        }
    }

    const isDuplicate = isActive && sub.vehicle_id && sub.garage_id && (activeGarageVehicleCounts.get(sub.garage_id + '_' + sub.vehicle_id) || 0) > 1;

    return { sub, customer, mainVehicle, targetCochera, multipleCandidates, candidateCocheras, isDuplicate };
}

export function filterEnhancedSubscription(item: ReturnType<typeof enhanceSubscription>, searchTerm: string) {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    const { sub, customer, mainVehicle, targetCochera } = item;
    
    if (customer?.name?.toLowerCase().includes(q)) return true;
    if (customer?.dni?.toLowerCase().includes(q)) return true;
    if (mainVehicle?.plate?.toLowerCase().includes(q)) return true;
    if (mainVehicle?.type?.toLowerCase().includes(q)) return true;
    if (targetCochera?.numero?.toLowerCase().includes(q)) return true;
    if (targetCochera?.vehiculos?.some(v => v.toLowerCase().includes(q))) return true;
    if (sub.id?.toLowerCase().includes(q)) return true;
    if (sub.customer_id?.toLowerCase().includes(q)) return true;
    
    return false;
}
