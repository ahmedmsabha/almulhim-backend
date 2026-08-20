-- CreateTable
CREATE TABLE "home_gallery_slides" (
    "id" UUID NOT NULL,
    "caption" TEXT NOT NULL,
    "image_storage_key" TEXT,
    "external_image_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_gallery_slides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_gallery_slides_is_published_sort_order_idx" ON "home_gallery_slides"("is_published", "sort_order");

-- Seed published Unsplash slides (physics lab URL is the working replacement)
INSERT INTO "home_gallery_slides" (
  "id",
  "caption",
  "image_storage_key",
  "external_image_url",
  "sort_order",
  "is_published",
  "published_at",
  "created_at",
  "updated_at"
)
VALUES
  (
    gen_random_uuid(),
    'مختبر فيزياء',
    NULL,
    'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?auto=format&fit=crop&w=1200&q=80',
    0,
    true,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'رياضيات على السبورة',
    NULL,
    'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1200&q=80',
    1,
    true,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'مذاكرة توجيهي',
    NULL,
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
    2,
    true,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'قاعة صف',
    NULL,
    'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1200&q=80',
    3,
    true,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'كتب علمية',
    NULL,
    'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=80',
    4,
    true,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'معادلات فيزيائية',
    NULL,
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
    5,
    true,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'تعلم أونلاين',
    NULL,
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    6,
    true,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'لقطة تطبيق — دراسة',
    NULL,
    'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1200&q=80',
    7,
    true,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'لقطة تطبيق — هاتف',
    NULL,
    'https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=1200&q=80',
    8,
    true,
    NOW(),
    NOW(),
    NOW()
  );
