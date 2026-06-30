-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('student', 'admin');

-- CreateEnum
CREATE TYPE "StudentRegion" AS ENUM ('gaza', 'west_bank');

-- CreateEnum
CREATE TYPE "ContentRegion" AS ENUM ('gaza', 'west_bank', 'both');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('pending_review', 'pending_approval', 'active', 'expired', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "LessonAccessLevel" AS ENUM ('preview', 'subscriber_only');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('open', 'reviewed', 'closed');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('web', 'mobile');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "telegram_username" TEXT NOT NULL,
    "region" "StudentRegion" NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'student',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "duration_days" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "receipt_storage_key" TEXT,
    "receipt_sender_name" TEXT,
    "verification_result" JSONB,
    "verified_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "suspended_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "region" "ContentRegion" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "access_level" "LessonAccessLevel" NOT NULL DEFAULT 'subscriber_only',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_videos" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "title" TEXT,
    "duration_seconds" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_pdfs" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "title" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_pdfs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_storage_key" TEXT,
    "region" "ContentRegion" NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'open',
    "admin_reply" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_bindings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_type" "DeviceType" NOT NULL,
    "device_hash" TEXT NOT NULL,
    "bound_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_downloads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lesson_video_id" UUID NOT NULL,
    "device_hash" TEXT NOT NULL,
    "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "units_region_is_published_sort_order_idx" ON "units"("region", "is_published", "sort_order");

-- CreateIndex
CREATE INDEX "chapters_unit_id_sort_order_idx" ON "chapters"("unit_id", "sort_order");

-- CreateIndex
CREATE INDEX "lessons_chapter_id_sort_order_idx" ON "lessons"("chapter_id", "sort_order");

-- CreateIndex
CREATE INDEX "lesson_videos_lesson_id_sort_order_idx" ON "lesson_videos"("lesson_id", "sort_order");

-- CreateIndex
CREATE INDEX "lesson_pdfs_lesson_id_sort_order_idx" ON "lesson_pdfs"("lesson_id", "sort_order");

-- CreateIndex
CREATE INDEX "announcements_region_is_published_published_at_idx" ON "announcements"("region", "is_published", "published_at");

-- CreateIndex
CREATE INDEX "support_requests_user_id_status_idx" ON "support_requests"("user_id", "status");

-- CreateIndex
CREATE INDEX "support_requests_status_created_at_idx" ON "support_requests"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "device_bindings_user_id_device_type_key" ON "device_bindings"("user_id", "device_type");

-- CreateIndex
CREATE INDEX "video_downloads_user_id_lesson_video_id_idx" ON "video_downloads"("user_id", "lesson_video_id");

-- CreateIndex
CREATE INDEX "video_downloads_lesson_video_id_revoked_at_idx" ON "video_downloads"("lesson_video_id", "revoked_at");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_videos" ADD CONSTRAINT "lesson_videos_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_pdfs" ADD CONSTRAINT "lesson_pdfs_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_bindings" ADD CONSTRAINT "device_bindings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_downloads" ADD CONSTRAINT "video_downloads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_downloads" ADD CONSTRAINT "video_downloads_lesson_video_id_fkey" FOREIGN KEY ("lesson_video_id") REFERENCES "lesson_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PartialUniqueIndex
CREATE UNIQUE INDEX "subscriptions_one_open_per_user_idx" ON "subscriptions"("user_id") WHERE "status" IN ('pending_review', 'pending_approval', 'active', 'suspended');

-- PartialUniqueIndex
CREATE UNIQUE INDEX "subscriptions_receipt_storage_key_unique_idx" ON "subscriptions"("receipt_storage_key") WHERE "receipt_storage_key" IS NOT NULL;

