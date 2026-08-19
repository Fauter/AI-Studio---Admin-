// Adapted Pricing Engine for Dashboard Simulator
// Ported from Desktop version, modified to accept in-memory data arrays

interface Chunk { minutes: number; price: number; name: string }

export class PricingEngine {
    // --- Helper: Canonical Identity Comparator (Robust String Matching) ---
    private static toCanonical(text: string): string {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    }

    // --- Dynamic Parking Logic (DP Optimization) ---
    static calculateSimulated(
        stay: { entryTime: Date | string; exitTime?: Date | string | null; plate: string; vehicleType?: string },
        exitTime: Date | string,
        paymentMethod: string = 'Efectivo',
        tariffs: any[],
        pricesMatrix: any,
        financialConfig: any
    ): number {
        // 1. Validation & Setup
        const rawType = stay.vehicleType || 'Auto';
        
        const start = new Date(stay.entryTime);
        const end = new Date(exitTime);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
        if (end <= start) return 0;

        const durationMs = end.getTime() - start.getTime();
        const minutesTotal = Math.ceil(durationMs / 60000);

        let params = financialConfig || { initial_tolerance: 15, fractionate_after: 0 };
        let matrix = pricesMatrix || {};

        // 3. Tolerance Logic:
        const tolerance = params?.initial_tolerance ?? params?.toleranciaInicial ?? 0;
        if (tolerance > 0 && minutesTotal <= tolerance) {
            return 0;
        }

        const fractionateFloor = params?.fractionate_after ?? params?.fraccionarDesde ?? 0;

        // 4. Resolve Prices for Vehicle
        let vehiclePrices: any = null;

        // 1. Try Exact Match
        if (matrix[rawType]) {
            vehiclePrices = matrix[rawType];
        } else {
            // 2. Try Canonical Match
            const canonicalType = this.toCanonical(rawType);
            const foundKey = Object.keys(matrix).find(k => this.toCanonical(k) === canonicalType);
            if (foundKey) {
                vehiclePrices = matrix[foundKey];
            } else {
                // 3. Try "Auto" Fallback if original type not found
                if (matrix['Auto']) {
                    vehiclePrices = matrix['Auto'];
                }
            }
        }

        if (!vehiclePrices) {
            return 0;
        }

        // 5. Build Combinations (Chunks)
        const chunks: Chunk[] = [];

        for (const t of tariffs) {
            if (t.type !== 'hora') continue;

            const d = Number(t.days || 0);
            const h = Number(t.hours || 0);
            const m = Number(t.minutes || 0);
            const blockMinutes = (d * 1440) + (h * 60) + m;

            if (isNaN(blockMinutes) || blockMinutes <= 0) {
                continue;
            }

            // --- FRACTIONATION FLOOR LOGIC ---
            if (fractionateFloor > 0 && minutesTotal < fractionateFloor) {
                if (blockMinutes < fractionateFloor) {
                    continue;
                }
            }

            let price = vehiclePrices[t.name];
            const canonicalName = this.toCanonical(t.name);

            if (price === undefined) {
                const matchedKey = Object.keys(vehiclePrices).find(k => this.toCanonical(k) === canonicalName);
                if (matchedKey) {
                    price = vehiclePrices[matchedKey];
                }
            }

            if (price !== undefined && price !== null) {
                const numPrice = Number(price);
                if (!isNaN(numPrice)) {
                    chunks.push({ minutes: blockMinutes, price: numPrice, name: t.name });
                }
            }
        }

        if (chunks.length === 0) return 0;

        // 6. Run Optimization (DP)
        return this.optimizeCost(minutesTotal, chunks);
    }

    /**
     * Finds the minimum cost to cover at least targetMinutes using available chunks.
     */
    private static optimizeCost(targetMinutes: number, chunks: Chunk[]): number {
        const maxChunkSize = Math.max(...chunks.map(c => c.minutes));
        const limit = targetMinutes + maxChunkSize;

        if (isNaN(limit) || limit <= 0 || !Number.isFinite(limit)) {
            return 0;
        }

        const dp = new Array(limit + 1).fill(Infinity);
        dp[0] = 0;

        for (let i = 0; i <= limit; i++) {
            if (dp[i] === Infinity) continue;

            for (const chunk of chunks) {
                const next = i + chunk.minutes;
                if (next <= limit) {
                    if (dp[i] + chunk.price < dp[next]) {
                        dp[next] = dp[i] + chunk.price;
                    }
                }
            }
        }

        let minCost = Infinity;
        for (let i = targetMinutes; i <= limit; i++) {
            if (dp[i] < minCost) {
                minCost = dp[i];
            }
        }

        return minCost === Infinity ? 0 : minCost;
    }
}
