-- Migration 010: Add text_edits_in_cycle to memorials table
ALTER TABLE memoriais ADD COLUMN IF NOT EXISTS text_edits_in_cycle integer DEFAULT 0 NOT NULL;
