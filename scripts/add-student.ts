import 'dotenv/config';
import { createClerkClient } from '@clerk/backend';
import { Pool } from 'pg';

type StudentRegion = 'gaza' | 'west_bank';

type CliArgs = {
  clerkId: string;
  region: StudentRegion;
  email?: string;
  fullName?: string;
  phoneNumber?: string;
  telegramUsername?: string;
};

function printUsage(): never {
  console.error(`Usage:
  npm run seed:student -- --clerkId <id> --region <gaza|west_bank> [options]

Required:
  --clerkId <Clerk user id>
  --region <gaza|west_bank>

Optional (override Clerk / defaults):
  --email <email>
  --fullName <name>
  --phoneNumber <phone>
  --telegramUsername <handle>

Example:
  npm run seed:student -- --clerkId user_xxx --region gaza
`);
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      console.error(`Missing value for --${key}`);
      printUsage();
    }

    args[key] = next;
    i += 1;
  }

  const clerkId = args.clerkId?.trim();
  const region = args.region?.trim() as StudentRegion | undefined;

  if (!clerkId || !region) {
    printUsage();
  }

  if (region !== 'gaza' && region !== 'west_bank') {
    console.error(`Invalid region "${region}". Use gaza or west_bank.`);
    process.exit(1);
  }

  return {
    clerkId,
    region,
    email: args.email?.trim(),
    fullName: args.fullName?.trim(),
    phoneNumber: args.phoneNumber?.trim(),
    telegramUsername: args.telegramUsername?.trim(),
  };
}

function defaultFullName(
  email: string,
  firstName?: string | null,
  lastName?: string | null,
): string {
  const fromClerk = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fromClerk) {
    return fromClerk;
  }

  const local = email.split('@')[0]?.trim();
  return local && local.length > 0 ? local : 'Student';
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (!clerkSecretKey) {
    throw new Error('CLERK_SECRET_KEY is required');
  }

  const clerk = createClerkClient({ secretKey: clerkSecretKey });
  const clerkUser = await clerk.users.getUser(cli.clerkId);
  const clerkEmail =
    clerkUser.emailAddresses.find(
      (entry) => entry.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  const email = cli.email ?? clerkEmail;
  if (!email) {
    throw new Error(
      `No email found for ${cli.clerkId}. Pass --email explicitly.`,
    );
  }

  const phoneFromClerk =
    clerkUser.phoneNumbers.find(
      (entry) => entry.id === clerkUser.primaryPhoneNumberId,
    )?.phoneNumber ?? clerkUser.phoneNumbers[0]?.phoneNumber;

  const fullName =
    cli.fullName ??
    defaultFullName(email, clerkUser.firstName, clerkUser.lastName);
  const phoneNumber = cli.phoneNumber ?? phoneFromClerk ?? '0000000000';
  const telegramUsername =
    cli.telegramUsername ?? clerkUser.username ?? 'pending';

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query<{
      id: string;
      clerk_id: string;
      email: string;
      full_name: string;
      region: string;
      role: string;
    }>(
      `INSERT INTO users (
         id,
         clerk_id,
         email,
         full_name,
         phone_number,
         telegram_username,
         region,
         role,
         created_at,
         updated_at
       )
       VALUES (
         gen_random_uuid(),
         $1,
         $2,
         $3,
         $4,
         $5,
         $6::"StudentRegion",
         'student'::"UserRole",
         NOW(),
         NOW()
       )
       ON CONFLICT (clerk_id) DO UPDATE
       SET
         email = EXCLUDED.email,
         full_name = EXCLUDED.full_name,
         phone_number = EXCLUDED.phone_number,
         telegram_username = EXCLUDED.telegram_username,
         region = EXCLUDED.region,
         role = 'student'::"UserRole",
         updated_at = NOW()
       RETURNING id, clerk_id, email, full_name, region, role`,
      [
        cli.clerkId,
        email,
        fullName,
        phoneNumber,
        telegramUsername,
        cli.region,
      ],
    );

    const user = result.rows[0];
    console.log(
      JSON.stringify(
        {
          status: 'ok',
          id: user.id,
          clerkId: user.clerk_id,
          email: user.email,
          fullName: user.full_name,
          region: user.region,
          role: user.role,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to add student: ${message}`);
  process.exit(1);
});
