ALTER TABLE public.activation_participants
  ADD COLUMN IF NOT EXISTS country_of_origin_code text,
  ADD COLUMN IF NOT EXISTS country_of_origin_name text,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.activation_participants
  ADD CONSTRAINT activation_participants_origin_code_chk CHECK (country_of_origin_code IS NULL OR country_of_origin_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT activation_participants_origin_name_chk CHECK (country_of_origin_name IS NULL OR char_length(country_of_origin_name) BETWEEN 2 AND 100),
  ADD CONSTRAINT activation_participants_age_chk CHECK (age IS NULL OR age BETWEEN 1 AND 120),
  ADD CONSTRAINT activation_participants_email_chk CHECK (email IS NULL OR (email = lower(email) AND char_length(email) <= 254 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));