-- 店舗ごとのユーザログインを分離するための店舗IDです。
ALTER TABLE "Store" ADD COLUMN "storeCode" TEXT;

UPDATE "Store"
SET "storeCode" = CASE
  WHEN "id" = 'store-demo' THEN 'DEMO'
  WHEN "id" = 'store-demo-2' THEN 'EKIMAE'
  ELSE UPPER(SUBSTRING(REGEXP_REPLACE("id", '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 12))
END;

ALTER TABLE "Store" ALTER COLUMN "storeCode" SET NOT NULL;

CREATE UNIQUE INDEX "Store_storeCode_key" ON "Store"("storeCode");
