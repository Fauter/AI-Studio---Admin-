-- ============================================================================
-- RPC: sync_prices_on_update
-- Purpose: Propagate price changes from the prices matrix to:
--   1. cocheras.precio_base (for matching garage/tariff-type/vehicle-type)
--   2. debts.amount & debts.remaining_amount (PENDING debts with amount_paid = 0)
--
-- Parameters:
--   p_garage_id       UUID   - The garage context
--   p_tariff_id       UUID   - The tariff that was updated
--   p_vehicle_type_id UUID   - The vehicle type that was updated
--   p_new_amount      NUMERIC - The new price amount
--
-- Safety:
--   - All matching is case-insensitive (LOWER)
--   - NEVER touches debts with amount_paid > 0
--   - Runs inside a single transaction (implicit in plpgsql)
--   - Logs row counts for debugging
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_prices_on_update(
    p_garage_id       UUID,
    p_tariff_id       UUID,
    p_vehicle_type_id UUID,
    p_new_amount      NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tariff_name    TEXT;
    v_vehicle_type_name TEXT;
    v_cocheras_updated INT := 0;
    v_debts_updated    INT := 0;
BEGIN
    -- ═══════════════════════════════════════════════════════════════
    -- §1. Resolve names from IDs
    -- ═══════════════════════════════════════════════════════════════
    SELECT name INTO v_tariff_name
    FROM tariffs
    WHERE id = p_tariff_id AND garage_id = p_garage_id;

    IF v_tariff_name IS NULL THEN
        RAISE WARNING '[sync_prices] Tariff ID % not found for garage %', p_tariff_id, p_garage_id;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Tariff not found',
            'cocheras_updated', 0,
            'debts_updated', 0
        );
    END IF;

    SELECT name INTO v_vehicle_type_name
    FROM vehicle_types
    WHERE id = p_vehicle_type_id AND garage_id = p_garage_id;

    IF v_vehicle_type_name IS NULL THEN
        RAISE WARNING '[sync_prices] Vehicle type ID % not found for garage %', p_vehicle_type_id, p_garage_id;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Vehicle type not found',
            'cocheras_updated', 0,
            'debts_updated', 0
        );
    END IF;

    RAISE NOTICE '[sync_prices] Resolved: tariff="%", vehicle_type="%", new_amount=%',
        v_tariff_name, v_vehicle_type_name, p_new_amount;

    -- ═══════════════════════════════════════════════════════════════
    -- §2. Update cocheras.precio_base
    -- ═══════════════════════════════════════════════════════════════
    -- Logic:
    --   cochera.tipo matches tariff name (case-insensitive)
    --   AND the cochera's client has at least one vehicle whose type
    --   matches the vehicle_type name AND whose plate is in cocheras.vehiculos
    UPDATE cocheras c
    SET precio_base = p_new_amount
    WHERE c.garage_id = p_garage_id
      AND LOWER(c.tipo) = LOWER(v_tariff_name)
      AND c.cliente_id IS NOT NULL
      AND EXISTS (
          SELECT 1
          FROM vehicles v
          WHERE v.customer_id = c.cliente_id
            AND v.garage_id = p_garage_id
            AND LOWER(v.type) = LOWER(v_vehicle_type_name)
            AND v.plate = ANY(c.vehiculos)
      );

    GET DIAGNOSTICS v_cocheras_updated = ROW_COUNT;
    RAISE NOTICE '[sync_prices] Cocheras updated: %', v_cocheras_updated;

    -- ═══════════════════════════════════════════════════════════════
    -- §3. Update debts (PENDING, amount_paid = 0 only)
    -- ═══════════════════════════════════════════════════════════════
    -- Logic:
    --   debt.status = 'PENDING'
    --   AND COALESCE(debt.amount_paid, 0) = 0  (NEVER touch partial payments)
    --   AND debt.subscription -> vehicle -> type matches vehicle_type name
    --   AND subscription.type matches tariff name
    UPDATE debts d
    SET amount = p_new_amount,
        remaining_amount = p_new_amount
    WHERE d.garage_id = p_garage_id
      AND d.status = 'PENDING'
      AND COALESCE(d.amount_paid, 0) = 0
      AND EXISTS (
          SELECT 1
          FROM subscriptions s
          JOIN vehicles v ON v.id = s.vehicle_id
          WHERE s.id = d.subscription_id
            AND s.garage_id = p_garage_id
            AND LOWER(s.type) = LOWER(v_tariff_name)
            AND LOWER(v.type) = LOWER(v_vehicle_type_name)
      );

    GET DIAGNOSTICS v_debts_updated = ROW_COUNT;
    RAISE NOTICE '[sync_prices] Debts updated: %', v_debts_updated;

    -- ═══════════════════════════════════════════════════════════════
    -- §4. Return summary
    -- ═══════════════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', true,
        'tariff_name', v_tariff_name,
        'vehicle_type_name', v_vehicle_type_name,
        'new_amount', p_new_amount,
        'cocheras_updated', v_cocheras_updated,
        'debts_updated', v_debts_updated
    );

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[sync_prices] Error: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'cocheras_updated', 0,
        'debts_updated', 0
    );
END;
$$;

-- Grant execute to authenticated users (Supabase convention)
GRANT EXECUTE ON FUNCTION sync_prices_on_update(UUID, UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_prices_on_update(UUID, UUID, UUID, NUMERIC) TO service_role;
