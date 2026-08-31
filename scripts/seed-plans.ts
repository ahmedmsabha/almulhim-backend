/**
 * Dev seed: three content-based subscription plans with Gaza / West Bank prices
 * and unit links.
 *
 * Usage (from almulhim-backend):
 *   npx ts-node --transpile-only scripts/seed-plans.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';

const ACCESS_ENDS_AT = '2027-06-30T21:00:00.000Z';
const SEMESTER_2_STARTS_AT = '2027-01-01T00:00:00.000Z';

const UNITS = [
  { title: 'الوحدة الأولى', sortOrder: 0 },
  { title: 'الوحدة الثانية', sortOrder: 1 },
  { title: 'الوحدة الثالثة', sortOrder: 2 },
  { title: 'مراجعة', sortOrder: 3 },
  { title: 'تجريبي', sortOrder: 4 },
] as const;

type PlanSeed = {
  name: string;
  description: string;
  priceGaza: number;
  priceWestBank: number;
  sortOrder: number;
  startsAt: string | null;
  unitTitles: readonly string[];
};

const PLANS: PlanSeed[] = [
  {
    name: 'الفصل الأول',
    description: 'الوحدة الأولى والوحدة الثانية',
    priceGaza: 12000,
    priceWestBank: 25000,
    sortOrder: 0,
    startsAt: null,
    unitTitles: ['الوحدة الأولى', 'الوحدة الثانية'],
  },
  {
    name: 'الفصل الثاني',
    description: 'الوحدة الثالثة والمراجعة والتجريبي',
    priceGaza: 12000,
    priceWestBank: 25000,
    sortOrder: 1,
    startsAt: SEMESTER_2_STARTS_AT,
    unitTitles: ['الوحدة الثالثة', 'مراجعة', 'تجريبي'],
  },
  {
    name: 'الاشتراك السنوي',
    description: 'كل الوحدات',
    priceGaza: 24000,
    priceWestBank: 50000,
    sortOrder: 2,
    startsAt: null,
    unitTitles: UNITS.map((unit) => unit.title),
  },
];

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query('BEGIN');

    const unitIdsByTitle = new Map<string, string>();

    for (const unit of UNITS) {
      const existing = await pool.query<{ id: string }>(
        `SELECT id FROM units WHERE title = $1 LIMIT 1`,
        [unit.title],
      );

      if (existing.rows[0]) {
        unitIdsByTitle.set(unit.title, existing.rows[0].id);
        continue;
      }

      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO units (
           id, title, description, region, sort_order,
           is_published, published_at, created_at, updated_at
         ) VALUES (
           gen_random_uuid(), $1, NULL, 'both'::"ContentRegion", $2,
           false, NULL, NOW(), NOW()
         ) RETURNING id`,
        [unit.title, unit.sortOrder],
      );
      unitIdsByTitle.set(unit.title, inserted.rows[0].id);
    }

    for (const plan of PLANS) {
      const existing = await pool.query<{ id: string }>(
        `SELECT id FROM subscription_plans WHERE name = $1 LIMIT 1`,
        [plan.name],
      );

      const planId = existing.rows[0]
        ? existing.rows[0].id
        : (
            await pool.query<{ id: string }>(
              `INSERT INTO subscription_plans (
                 id, name, description, price_gaza, price_west_bank, currency,
                 access_ends_at, starts_at, is_active, sort_order,
                 created_at, updated_at
               ) VALUES (
                 gen_random_uuid(), $1, $2, $3, $4, 'ILS',
                 $5::timestamptz, $6::timestamptz, true, $7,
                 NOW(), NOW()
               ) RETURNING id`,
              [
                plan.name,
                plan.description,
                plan.priceGaza,
                plan.priceWestBank,
                ACCESS_ENDS_AT,
                plan.startsAt,
                plan.sortOrder,
              ],
            )
          ).rows[0].id;

      if (existing.rows[0]) {
        await pool.query(
          `UPDATE subscription_plans
           SET description = $2,
               price_gaza = $3,
               price_west_bank = $4,
               access_ends_at = $5::timestamptz,
               starts_at = $6::timestamptz,
               sort_order = $7,
               is_active = true,
               updated_at = NOW()
           WHERE id = $1`,
          [
            planId,
            plan.description,
            plan.priceGaza,
            plan.priceWestBank,
            ACCESS_ENDS_AT,
            plan.startsAt,
            plan.sortOrder,
          ],
        );
      }

      await pool.query(`DELETE FROM plan_units WHERE plan_id = $1`, [planId]);

      for (const title of plan.unitTitles) {
        const unitId = unitIdsByTitle.get(title);
        if (!unitId) {
          throw new Error(`Missing unit for title: ${title}`);
        }
        await pool.query(
          `INSERT INTO plan_units (plan_id, unit_id, created_at)
           VALUES ($1, $2, NOW())`,
          [planId, unitId],
        );
      }
    }

    await pool.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          plans: PLANS.map((plan) => plan.name),
          units: UNITS.map((unit) => unit.title),
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
