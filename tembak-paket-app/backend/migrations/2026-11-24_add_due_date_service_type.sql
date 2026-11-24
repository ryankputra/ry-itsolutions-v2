-- Migration: Add due_date and service_type columns to transactions table
-- Date: 2026-11-24
-- Purpose: Support autoCompleteSlowOrders filter by due date and explicit service type
-- Run with: sqlite3 database.sqlite < this_file.sql
-- Or via backend/db.js migration logic

-- Backup first (run manually before applying):
-- cp database.sqlite database.sqlite.backup_$(date +%F_%H-%M-%S)

-- 1. Add due_date column (nullable DATETIME, stores ISO8601 UTC)
ALTER TABLE transactions ADD COLUMN due_date TEXT;

-- 2. Add service_type column with explicit enum-like values
-- Valid values: 'fast', 'slow', '3bulan_fast', '3bulan_slow', 'reguler', 'imei', 'ceir', 'ceir_register'
-- Default to 'reguler' for backward compatibility
ALTER TABLE transactions ADD COLUMN service_type TEXT DEFAULT 'reguler';

-- 3. Create composite index for autoCompleteSlowOrders query performance
CREATE INDEX IF NOT EXISTS idx_transactions_status_service_due
ON transactions(status, service_type, due_date);

-- 4. Create index for service_type lookups
CREATE INDEX IF NOT EXISTS idx_transactions_service_type
ON transactions(service_type);

-- 5. Create index for due_date queries
CREATE INDEX IF NOT EXISTS idx_transactions_due_date
ON transactions(due_date);

-- 6. Update existing rows: infer service_type from speed_option and packageName
-- Slow orders
UPDATE transactions
SET service_type = 'slow'
WHERE service_type = 'reguler'
  AND (speed_option = 'slow' OR packageName LIKE '%Slow%' OR packageName LIKE '%3 Bulan Slow%');

-- Fast orders
UPDATE transactions
SET service_type = 'fast'
WHERE service_type = 'reguler'
  AND (speed_option = 'fast' OR packageName LIKE '%Fast%');

-- 3 Bulan Fast orders
UPDATE transactions
SET service_type = '3bulan_fast'
WHERE service_type = 'reguler'
  AND packageName LIKE '%3 Bulan Fast%';

-- 3 Bulan Slow orders
UPDATE transactions
SET service_type = '3bulan_slow'
WHERE service_type = 'reguler'
  AND packageName LIKE '%3 Bulan Slow%';

-- IMEI orders (based on packageId or imei presence)
UPDATE transactions
SET service_type = 'imei'
WHERE service_type = 'reguler'
  AND (imei IS NOT NULL OR packageId LIKE 'imei%' OR packageName LIKE '%IMEI%');

-- CEIR orders
UPDATE transactions
SET service_type = 'ceir'
WHERE service_type = 'reguler'
  AND (packageName LIKE '%CEIR%' OR packageId LIKE 'ceir%');

-- CEIR Register orders
UPDATE transactions
SET service_type = 'ceir_register'
WHERE service_type = 'reguler'
  AND (packageName LIKE '%Register%' OR packageId LIKE 'ceir_register%');

-- 7. Verify migration
-- SELECT service_type, COUNT(*) FROM transactions GROUP BY service_type;
-- SELECT COUNT(*) FROM transactions WHERE due_date IS NOT NULL;
-- SELECT * FROM transactions WHERE status IN ('processing','in_queue') AND service_type IN ('slow','3bulan_slow') AND (due_date IS NULL OR due_date <= datetime('now'));