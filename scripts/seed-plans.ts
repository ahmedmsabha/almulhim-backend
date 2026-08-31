/**
 * Upsert the three content-based plans, rename legacy titles, and delete any
 * leftover time-based plans (and their subscriptions).
 *
 * Usage (from almulhim-backend):
 *   npm run seed:plans
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
    name: 'باقة الفصل الأول',
    description: 'الوحدة الأولى والوحدة الثانية',
    priceGaza: 12000,
    priceWestBank: 25000,
    sortOrder: 0,
    startsAt: null,
    unitTitles: ['الوحدة الأولى', 'الوحدة الثانية'],
  },
  {
    name: 'باقة الفصل الثاني',
    description: 'الوحدة الثالثة والمراجعة والتجريبي',
    priceGaza: 12000,
    priceWestBank: 25000,
    sortOrder: 1,
    startsAt: SEMESTER_2_STARTS_AT,
    unitTitles: ['الوحدة الثالثة', 'مراجعة', 'تجريبي'],
  },
  {
    name: 'الباقة السنوية',
    description: 'كل الوحدات',
    priceGaza: 24000,
    priceWestBank: 50000,
    sortOrder: 2,
    startsAt: null,
    unitTitles: UNITS.map((unit) => unit.title),
  },
];

/** Previous titles so re-running the seed renames instead of duplicating. */
const PLAN_NAME_ALIASES: Record<string, readonly string[]> = {
  'باقة الفصل الأول': ['باقة الفصل الأول', 'الفصل الأول'],
  'باقة الفصل الثاني': ['باقة الفصل الثاني', 'الفصل الثاني'],
  'الباقة السنوية': ['الباقة السنوية', 'الاشتراك السنوي'],
};

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

    const keptPlanIds: string[] = [];

    for (const plan of PLANS) {
      const aliases = PLAN_NAME_ALIASES[plan.name] ?? [plan.name];
      const existing = await pool.query<{ id: string; name: string }>(
        `SELECT id, name FROM subscription_plans
         WHERE name = ANY($1::text[])
         ORDER BY CASE WHEN name = $2 THEN 0 ELSE 1 END
         LIMIT 1`,
        [aliases, plan.name],
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

      keptPlanIds.push(planId);

      await pool.query(
        `UPDATE subscription_plans
         SET name = $2,
             description = $3,
             price_gaza = $4,
             price_west_bank = $5,
             access_ends_at = $6::timestamptz,
             starts_at = $7::timestamptz,
             sort_order = $8,
             is_active = true,
             updated_at = NOW()
         WHERE id = $1`,
        [
          planId,
          plan.name,
          plan.description,
          plan.priceGaza,
          plan.priceWestBank,
          ACCESS_ENDS_AT,
          plan.startsAt,
          plan.sortOrder,
        ],
      );

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

    const deletedSubscriptions = await pool.query(
      `DELETE FROM subscriptions
       WHERE plan_id <> ALL($1::uuid[])`,
      [keptPlanIds],
    );
    const deletedPlans = await pool.query<{ id: string; name: string }>(
      `DELETE FROM subscription_plans
       WHERE id <> ALL($1::uuid[])
       RETURNING id, name`,
      [keptPlanIds],
    );

    await pool.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          plans: PLANS.map((plan) => plan.name),
          removedPlans: deletedPlans.rows.map((row) => row.name),
          removedSubscriptions: deletedSubscriptions.rowCount ?? 0,
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
