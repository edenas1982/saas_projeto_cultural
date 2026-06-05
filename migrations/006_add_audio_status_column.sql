-- Migration: Add audio_status column to narrativas
ALTER TABLE public.narrativas ADD COLUMN IF NOT EXISTS audio_status text DEFAULT 'pending' CHECK (audio_status IN ('pending', 'generating', 'success', 'failed'));
