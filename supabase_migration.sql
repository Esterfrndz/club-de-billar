-- Migration: Add solo/accompanied reservation fields
-- Execute this in Supabase SQL Editor

-- Add new columns to reservations table
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS is_solo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS companion_name TEXT,
ADD COLUMN IF NOT EXISTS companion_member_id TEXT;

-- Add index for better query performance on solo reservations
CREATE INDEX IF NOT EXISTS idx_reservations_is_solo 
ON reservations(is_solo) 
WHERE is_solo = true;

-- Add comment to document the schema
COMMENT ON COLUMN reservations.is_solo IS 'Indicates if the reservation is for solo play (true) or accompanied (false)';
COMMENT ON COLUMN reservations.companion_name IS 'Name of the companion (if accompanied from start or if someone joins)';
COMMENT ON COLUMN reservations.companion_member_id IS 'Member code of the companion (if a registered member joins)';
