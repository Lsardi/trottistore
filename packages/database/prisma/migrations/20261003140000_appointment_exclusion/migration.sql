CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE sav.repair_appointments
  ADD COLUMN technician_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE sav.repair_appointments
  ADD CONSTRAINT repair_appointments_no_overlap
  EXCLUDE USING gist (technician_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status NOT IN ('CANCELLED'));
