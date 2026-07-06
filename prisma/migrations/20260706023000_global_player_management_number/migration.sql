CREATE SEQUENCE IF NOT EXISTS "PlayerManagementNumberSeq"
  START WITH 10000
  INCREMENT BY 1;

SELECT setval(
  '"PlayerManagementNumberSeq"',
  GREATEST(
    9999,
    COALESCE(
      (
        SELECT MAX("managementNumber"::integer)
        FROM "Player"
        WHERE "managementNumber" ~ '^[0-9]+$'
      ),
      9999
    )
  ),
  true
);

DROP INDEX IF EXISTS "Player_storeId_managementNumber_key";

CREATE UNIQUE INDEX "Player_managementNumber_key" ON "Player"("managementNumber");
