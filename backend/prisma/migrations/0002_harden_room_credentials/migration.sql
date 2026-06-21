-- Room credentials are encrypted at the application boundary.
-- Encrypted payloads can exceed the previous VarChar limits.
ALTER TABLE "room_credentials"
  ALTER COLUMN "room_id" TYPE TEXT,
  ALTER COLUMN "room_pass" TYPE TEXT,
  ALTER COLUMN "custom_code" TYPE TEXT;
