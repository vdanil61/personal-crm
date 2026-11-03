-- Hands everything that exists before the login feature to the owner.
-- The owner's email comes from the connection setting app.owner_email (see src/db/apply-migrations.ts),
-- never from this file: the repository is public.
DO $$
DECLARE
  owner_email text;
  owner_id uuid;
BEGIN
  -- Nothing to hand over: a database without data needs no owner
  IF NOT (EXISTS (SELECT 1 FROM contacts) OR EXISTS (SELECT 1 FROM notes) OR EXISTS (SELECT 1 FROM groups)) THEN
    RETURN;
  END IF;

  owner_email := lower(btrim(coalesce(current_setting('app.owner_email', true), '')));
  IF owner_email = '' THEN
    -- The email itself is not written anywhere: deploy logs are public
    RAISE EXCEPTION 'OWNER_EMAIL is not set: existing contacts and groups need an owner';
  END IF;

  INSERT INTO users (name, email, email_verified) VALUES ('', owner_email, true)
  ON CONFLICT (email) DO NOTHING;
  SELECT id INTO owner_id FROM users WHERE email = owner_email;

  -- Notes, group links, frequencies and "Связался" marks belong to their contacts and stay as they are
  UPDATE contacts SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE groups SET user_id = owner_id WHERE user_id IS NULL;
END $$;
