-- Migration: 20260804000000_subscription_full_price_config

-- 1. Ensure the columns exist
ALTER TABLE public.financial_configs
ADD COLUMN IF NOT EXISTS subscription_full_price_enabled boolean;

ALTER TABLE public.financial_configs
ADD COLUMN IF NOT EXISTS subscription_full_price_until_day integer;

-- Change column to NOT NULL DEFAULT false if it was added as nullable
ALTER TABLE public.financial_configs 
ALTER COLUMN subscription_full_price_enabled SET DEFAULT false;

-- 2. Data normalization before applying the constraint
-- If enabled is null, set to false
UPDATE public.financial_configs
SET subscription_full_price_enabled = false
WHERE subscription_full_price_enabled IS NULL;

ALTER TABLE public.financial_configs 
ALTER COLUMN subscription_full_price_enabled SET NOT NULL;

-- If enabled = false, until_day must be NULL
UPDATE public.financial_configs
SET subscription_full_price_until_day = NULL
WHERE subscription_full_price_enabled = false;

-- If enabled = true but until_day is invalid (null, < 1 or > 28), we will disable it to be safe 
-- (rather than guessing 10) to avoid charging full price by mistake.
UPDATE public.financial_configs
SET subscription_full_price_enabled = false,
    subscription_full_price_until_day = NULL
WHERE subscription_full_price_enabled = true 
  AND (subscription_full_price_until_day IS NULL OR subscription_full_price_until_day < 1 OR subscription_full_price_until_day > 28);

-- 3. Add constraint
-- Make it idempotent by dropping first if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'financial_configs_subscription_full_price_check' 
      AND conrelid = 'public.financial_configs'::regclass
  ) THEN
    ALTER TABLE public.financial_configs DROP CONSTRAINT financial_configs_subscription_full_price_check;
  END IF;
END $$;

ALTER TABLE public.financial_configs
ADD CONSTRAINT financial_configs_subscription_full_price_check
CHECK (
  (subscription_full_price_enabled = false AND subscription_full_price_until_day IS NULL) OR
  (subscription_full_price_enabled = true AND subscription_full_price_until_day BETWEEN 1 AND 28)
);
