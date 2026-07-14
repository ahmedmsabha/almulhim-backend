/**
 * Probe R2 signed GET + HTTP Range (iOS AVPlayer needs 206).
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/probe-r2-signed-get.ts [storageKey]
 *
 * If storageKey is omitted, uses PROBE_R2_KEY from env or the first video-like
 * object is not auto-discovered — pass a key explicitly.
 */
import 'dotenv/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

async function main(): Promise<void> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const key =
    process.argv[2] ??
    process.env.PROBE_R2_KEY ??
    '';

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      'Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME',
    );
  }

  if (!key) {
    throw new Error(
      'Pass a storage key: npx ts-node --transpile-only scripts/probe-r2-signed-get.ts videos/.../file.mp4',
    );
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  console.log(`Bucket: ${bucket}`);
  console.log(`Key: ${key}`);

  const head = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  );
  console.log(
    `HeadObject OK — ContentType=${head.ContentType ?? '(none)'} ContentLength=${head.ContentLength ?? '(none)'}`,
  );

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 900 },
  );

  const host = new URL(url).host;
  console.log(`Signed host: ${host}`);
  console.log(
    `Expected virtual-hosted prefix: ${bucket}.${accountId}.r2.cloudflarestorage.com`,
  );

  const headRes = await fetch(url, { method: 'HEAD' });
  console.log(
    `HEAD signed URL → ${headRes.status} Content-Type=${headRes.headers.get('content-type')} Accept-Ranges=${headRes.headers.get('accept-ranges')}`,
  );
  if (headRes.status === 403) {
    console.log(
      'Note: HEAD 403 on a GetObject-signed URL is expected (signature is GET-only). AVPlayer uses Range GET.',
    );
  }

  if ((head.ContentLength ?? 0) < 1024) {
    console.warn(
      `Warning: object is only ${head.ContentLength ?? 0} bytes — not a real media file; players will fail.`,
    );
  }

  const rangeRes = await fetch(url, {
    headers: { Range: 'bytes=0-1' },
  });
  const contentRange = rangeRes.headers.get('content-range');
  console.log(
    `GET Range bytes=0-1 → ${rangeRes.status} Content-Range=${contentRange} Content-Type=${rangeRes.headers.get('content-type')}`,
  );

  if (rangeRes.status !== 206 && rangeRes.status !== 200) {
    const body = await rangeRes.text();
    console.error('Body preview:', body.slice(0, 400));
    process.exitCode = 1;
    throw new Error(
      `Range probe failed with HTTP ${rangeRes.status} (want 206 for iOS AVPlayer)`,
    );
  }

  if (rangeRes.status === 206 && !contentRange) {
    process.exitCode = 1;
    throw new Error('Got 206 but missing Content-Range header');
  }

  console.log('Probe OK — signed GET supports streaming/Range.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
