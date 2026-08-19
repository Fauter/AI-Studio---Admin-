-- INSTRUCCIONES IMPORTANTES:
-- Ejecutar este script COMPLETO en el SQL Editor de Supabase.

-- ==========================================
-- FUNCIONES RPC (Reporting)
-- ==========================================

-- A. Resumen Mensual (Monthly)
CREATE OR REPLACE FUNCTION public.get_cashflow_monthly_summary(
    p_garage_ids uuid[],
    p_from_date date DEFAULT '2020-01-01',
    p_to_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    year_month text,
    garage_id uuid,
    gross_income numeric,
    expenses numeric,
    net_income numeric
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH movements_agg AS (
        SELECT 
            to_char(timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') as year_month,
            garage_id,
            COALESCE(SUM(amount), 0) as gross_income
        FROM public.movements
        WHERE garage_id = ANY(p_garage_ids)
          AND timestamp >= p_from_date::timestamp
          AND timestamp < (p_to_date + interval '1 day')::timestamp
        GROUP BY year_month, garage_id
    ),
    partial_agg AS (
        SELECT
            to_char(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') as year_month,
            garage_id,
            COALESCE(SUM(amount), 0) as expenses
        FROM public.partial_closes
        WHERE garage_id = ANY(p_garage_ids)
          AND movement_type = 'expense'
          AND created_at >= p_from_date::timestamp
          AND created_at < (p_to_date + interval '1 day')::timestamp
        GROUP BY year_month, garage_id
    )
    SELECT 
        COALESCE(m.year_month, p.year_month) as year_month,
        COALESCE(m.garage_id, p.garage_id) as garage_id,
        COALESCE(m.gross_income, 0) as gross_income,
        COALESCE(p.expenses, 0) as expenses,
        COALESCE(m.gross_income, 0) - COALESCE(p.expenses, 0) as net_income
    FROM movements_agg m
    FULL OUTER JOIN partial_agg p ON m.year_month = p.year_month AND m.garage_id = p.garage_id
    ORDER BY year_month DESC;
$$;

-- B. Resumen Diario (Daily)
CREATE OR REPLACE FUNCTION public.get_cashflow_daily_summary(
    p_garage_ids uuid[],
    p_year_month text -- Formato 'YYYY-MM'
)
RETURNS TABLE (
    day text,
    garage_id uuid,
    gross_income numeric,
    expenses numeric,
    net_income numeric
)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_start_timestamp timestamptz;
    v_end_timestamp timestamptz;
BEGIN
    -- Determinar el inicio y fin del mes local en base a America/Argentina/Buenos_Aires
    v_start_timestamp := (p_year_month || '-01 00:00:00-03')::timestamptz;
    v_end_timestamp := v_start_timestamp + interval '1 month';

    RETURN QUERY
    WITH movements_agg AS (
        SELECT 
            to_char(timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') as day,
            garage_id,
            COALESCE(SUM(amount), 0) as gross_income
        FROM public.movements
        WHERE garage_id = ANY(p_garage_ids)
          AND timestamp >= v_start_timestamp
          AND timestamp < v_end_timestamp
        GROUP BY day, garage_id
    ),
    partial_agg AS (
        SELECT
            to_char(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') as day,
            garage_id,
            COALESCE(SUM(amount), 0) as expenses
        FROM public.partial_closes
        WHERE garage_id = ANY(p_garage_ids)
          AND movement_type = 'expense'
          AND created_at >= v_start_timestamp
          AND created_at < v_end_timestamp
        GROUP BY day, garage_id
    )
    SELECT 
        COALESCE(m.day, p.day) as day,
        COALESCE(m.garage_id, p.garage_id) as garage_id,
        COALESCE(m.gross_income, 0) as gross_income,
        COALESCE(p.expenses, 0) as expenses,
        COALESCE(m.gross_income, 0) - COALESCE(p.expenses, 0) as net_income
    FROM movements_agg m
    FULL OUTER JOIN partial_agg p ON m.day = p.day AND m.garage_id = p.garage_id
    ORDER BY day DESC;
END;
$$;
