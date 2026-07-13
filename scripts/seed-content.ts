/**
 * Dev seed: Unit → Chapter → Lesson (+ sample video/pdf rows) for Admin Content Tree verify.
 *
 * Usage (from almulhim-backend):
 *   npx ts-node --transpile-only scripts/seed-content.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query('BEGIN');

    // Idempotent: remove prior verify seed by title prefix
    await pool.query(
      `DELETE FROM units WHERE title LIKE 'Verify Seed:%' OR title LIKE '[Verify] %'`,
    );

    const unit1 = await pool.query<{ id: string }>(
      `INSERT INTO units (
         id, title, description, region, sort_order,
         is_published, published_at, created_at, updated_at
       ) VALUES (
         gen_random_uuid(),
         '[Verify] Foundations of Modern Algebra',
         'Seed unit for Admin Content Tree verify',
         'both'::"ContentRegion",
         0,
         false,
         NULL,
         NOW(),
         NOW()
       ) RETURNING id`,
    );
    const unit1Id = unit1.rows[0].id;

    const unit2 = await pool.query<{ id: string }>(
      `INSERT INTO units (
         id, title, description, region, sort_order,
         is_published, published_at, created_at, updated_at
       ) VALUES (
         gen_random_uuid(),
         '[Verify] Geometric Principles',
         'Second seed unit (West Bank)',
         'west_bank'::"ContentRegion",
         1,
         true,
         NOW(),
         NOW(),
         NOW()
       ) RETURNING id`,
    );
    const unit2Id = unit2.rows[0].id;

    const chapter1 = await pool.query<{ id: string }>(
      `INSERT INTO chapters (
         id, unit_id, title, sort_order, is_published, published_at, created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, 'Chapter 1.1: Linear Equations', 0, false, NULL, NOW(), NOW()
       ) RETURNING id`,
      [unit1Id],
    );
    const chapter1Id = chapter1.rows[0].id;

    const chapter2 = await pool.query<{ id: string }>(
      `INSERT INTO chapters (
         id, unit_id, title, sort_order, is_published, published_at, created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, 'Chapter 2.1: Circles', 0, true, NOW(), NOW(), NOW()
       ) RETURNING id`,
      [unit2Id],
    );
    const chapter2Id = chapter2.rows[0].id;

    const lessonPreview = await pool.query<{ id: string }>(
      `INSERT INTO lessons (
         id, chapter_id, title, sort_order, access_level,
         is_published, published_at, created_at, updated_at
       ) VALUES (
         gen_random_uuid(),
         $1,
         'مقدمة في المعادلات الخطية ذات المتغير الواحد',
         0,
         'preview'::"LessonAccessLevel",
         false,
         NULL,
         NOW(),
         NOW()
       ) RETURNING id`,
      [chapter1Id],
    );
    const lessonPreviewId = lessonPreview.rows[0].id;

    const lessonMomentum = await pool.query<{ id: string }>(
      `INSERT INTO lessons (
         id, chapter_id, title, sort_order, access_level,
         is_published, published_at, created_at, updated_at
       ) VALUES (
         gen_random_uuid(),
         $1,
         'الزخم الخطي في الميكانيكا',
         1,
         'subscriber_only'::"LessonAccessLevel",
         true,
         NOW(),
         NOW(),
         NOW()
       ) RETURNING id`,
      [chapter1Id],
    );
    const lessonMomentumId = lessonMomentum.rows[0].id;

    const lessonGeo = await pool.query<{ id: string }>(
      `INSERT INTO lessons (
         id, chapter_id, title, sort_order, access_level,
         is_published, published_at, created_at, updated_at
       ) VALUES (
         gen_random_uuid(),
         $1,
         'خصائص الدائرة',
         0,
         'subscriber_only'::"LessonAccessLevel",
         true,
         NOW(),
         NOW(),
         NOW()
       ) RETURNING id`,
      [chapter2Id],
    );
    const lessonGeoId = lessonGeo.rows[0].id;

    await pool.query(
      `INSERT INTO lesson_videos (
         id, lesson_id, storage_key, title, duration_seconds, sort_order, created_at, updated_at
       ) VALUES (
         gen_random_uuid(),
         $1,
         'content/verify/intro-linear.mp4',
         'Intro video',
         765,
         0,
         NOW(),
         NOW()
       )`,
      [lessonPreviewId],
    );

    await pool.query(
      `INSERT INTO lesson_pdfs (
         id, lesson_id, storage_key, title, sort_order, created_at, updated_at
       ) VALUES (
         gen_random_uuid(),
         $1,
         'content/verify/momentum-worksheet.pdf',
         'Momentum worksheet',
         0,
         NOW(),
         NOW()
       )`,
      [lessonMomentumId],
    );

    await pool.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          ok: true,
          units: [unit1Id, unit2Id],
          chapters: [chapter1Id, chapter2Id],
          lessons: {
            previewArabic: lessonPreviewId,
            momentumSearchTarget: lessonMomentumId,
            geometry: lessonGeoId,
          },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
