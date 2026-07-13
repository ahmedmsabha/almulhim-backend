-- AlterTable
ALTER TABLE "users" ADD COLUMN "deactivated_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_deactivated_at_idx" ON "users"("deactivated_at");
