-- AlterTable
ALTER TABLE "subscription_plans"
  ADD COLUMN "price_gaza" INTEGER,
  ADD COLUMN "price_west_bank" INTEGER,
  ADD COLUMN "access_ends_at" TIMESTAMP(3),
  ADD COLUMN "starts_at" TIMESTAMP(3);

-- Backfill existing plans from the retired single price / duration columns.
-- Academic-year end is 30 June 2027 so current subscribers keep access.
UPDATE "subscription_plans"
SET
  "price_gaza" = "price_amount",
  "price_west_bank" = "price_amount",
  "access_ends_at" = TIMESTAMP '2027-06-30 21:00:00';

ALTER TABLE "subscription_plans"
  ALTER COLUMN "price_gaza" SET NOT NULL,
  ALTER COLUMN "price_west_bank" SET NOT NULL,
  ALTER COLUMN "access_ends_at" SET NOT NULL;

ALTER TABLE "subscription_plans"
  DROP COLUMN "price_amount",
  DROP COLUMN "duration_days";

-- CreateTable
CREATE TABLE "plan_units" (
    "plan_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_units_pkey" PRIMARY KEY ("plan_id","unit_id")
);

-- CreateIndex
CREATE INDEX "plan_units_unit_id_idx" ON "plan_units"("unit_id");

-- AddForeignKey
ALTER TABLE "plan_units" ADD CONSTRAINT "plan_units_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_units" ADD CONSTRAINT "plan_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link every existing plan to all current units so no active subscriber loses access.
INSERT INTO "plan_units" ("plan_id", "unit_id", "created_at")
SELECT p.id, u.id, CURRENT_TIMESTAMP
FROM "subscription_plans" p
CROSS JOIN "units" u;

-- Swap the one-open-per-user concurrency constraint for one-open-per-plan.
DROP INDEX "subscriptions_one_open_per_user_idx";

CREATE UNIQUE INDEX "subscriptions_one_open_per_plan_idx"
  ON "subscriptions"("user_id", "plan_id")
  WHERE "status" IN ('pending_review','pending_approval','active','suspended');
