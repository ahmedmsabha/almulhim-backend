-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "receipt_transaction_reference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_receipt_transaction_reference_key" ON "subscriptions"("receipt_transaction_reference");
