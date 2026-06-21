-- Room credentials are encrypted at the application boundary.
-- Encrypted payloads can exceed the previous VarChar limits.
DO $$
BEGIN
  IF to_regclass('public.room_credentials') IS NOT NULL THEN
    ALTER TABLE "room_credentials"
      ALTER COLUMN "room_id" TYPE TEXT,
      ALTER COLUMN "room_pass" TYPE TEXT,
      ALTER COLUMN "custom_code" TYPE TEXT;
  END IF;
END $$;
