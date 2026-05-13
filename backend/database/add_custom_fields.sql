-- Add custom_fields JSONB column to equipment table
-- Stores model-specific attributes, e.g. AMS2140 channel count
-- Run this in the Supabase SQL editor.

alter table equipment
  add column if not exists custom_fields jsonb not null default '{}';
