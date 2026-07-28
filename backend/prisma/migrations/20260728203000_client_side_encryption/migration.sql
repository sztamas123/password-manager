-- Phase 3 data cannot be encrypted by the server because the server must never
-- receive a master password or vault key. Abort instead of silently discarding
-- plaintext if this migration is applied to a populated installation.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "vaults")
    OR EXISTS (SELECT 1 FROM "folders")
    OR EXISTS (SELECT 1 FROM "entries") THEN
    RAISE EXCEPTION
      'Phase 4 migration requires empty vault tables; remove development-only Phase 3 data first';
  END IF;
END $$;

-- CreateTable
CREATE TABLE "encryption_profiles" (
    "user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "kdf_algorithm" VARCHAR(20) NOT NULL,
    "kdf_salt" VARCHAR(22) NOT NULL,
    "kdf_memory_kib" INTEGER NOT NULL,
    "kdf_iterations" INTEGER NOT NULL,
    "kdf_parallelism" INTEGER NOT NULL,
    "wrapped_vault_key" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encryption_profiles_pkey" PRIMARY KEY ("user_id")
);

-- Replace all plaintext vault fields with opaque authenticated ciphertext.
ALTER TABLE "vaults"
  ADD COLUMN "encrypted_data" TEXT NOT NULL,
  DROP COLUMN "name";

ALTER TABLE "folders"
  ADD COLUMN "encrypted_data" TEXT NOT NULL,
  DROP COLUMN "name";

ALTER TABLE "entries"
  ADD COLUMN "encrypted_data" TEXT NOT NULL,
  DROP COLUMN "name",
  DROP COLUMN "username",
  DROP COLUMN "password",
  DROP COLUMN "url",
  DROP COLUMN "notes";

-- AddForeignKey
ALTER TABLE "encryption_profiles"
  ADD CONSTRAINT "encryption_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
