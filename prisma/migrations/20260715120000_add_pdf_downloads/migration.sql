-- CreateTable
CREATE TABLE "pdf_downloads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lesson_pdf_id" UUID NOT NULL,
    "device_hash" TEXT NOT NULL,
    "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdf_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pdf_downloads_user_id_lesson_pdf_id_idx" ON "pdf_downloads"("user_id", "lesson_pdf_id");

-- CreateIndex
CREATE INDEX "pdf_downloads_lesson_pdf_id_revoked_at_idx" ON "pdf_downloads"("lesson_pdf_id", "revoked_at");

-- AddForeignKey
ALTER TABLE "pdf_downloads" ADD CONSTRAINT "pdf_downloads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_downloads" ADD CONSTRAINT "pdf_downloads_lesson_pdf_id_fkey" FOREIGN KEY ("lesson_pdf_id") REFERENCES "lesson_pdfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
