-- Activation des extensions PostgreSQL
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- Recherche textuelle fuzzy

-- Index GIN pour la recherche full-text en français
-- (sera utilisé pour chercher dans les descriptions d'annonces)
CREATE TEXT SEARCH CONFIGURATION french_immo (COPY = french);
