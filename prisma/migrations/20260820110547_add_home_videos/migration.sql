-- CreateTable
CREATE TABLE "home_videos" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "storage_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_videos_is_published_sort_order_idx" ON "home_videos"("is_published", "sort_order");

-- Seed default About video slots (unpublished, no media yet)
INSERT INTO "home_videos" ("id", "title", "storage_key", "sort_order", "is_published", "published_at", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'التدريس أونلاين', NULL, 0, false, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'دليلك للتعامل مع التطبيق', NULL, 1, false, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'لوحة شرف طلاب غزة', NULL, 2, false, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'لوحة شرف طلاب الضفة', NULL, 3, false, NULL, NOW(), NOW());
