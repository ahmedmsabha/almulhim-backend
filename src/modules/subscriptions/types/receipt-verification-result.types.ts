/**
 * Per-check outcome written by `ReceiptVerificationService`.
 *
 * - `detected` — value Gemini extracted (recipient/sender name, or raw txn id)
 * - `expected` — only on `senderMatch`: the student-entered `receiptSenderName`
 * - `reason` — human-readable failure note, or null when `passed`
 */
export type ReceiptVerificationCheckResult = {
  passed: boolean;
  detected: string | null;
  expected?: string | null;
  reason: string | null;
};

/**
 * Canonical JSON stored in `subscriptions.verification_result`.
 *
 * Written by the receipt AI pipeline (`ReceiptVerificationService`), not invented
 * for the admin UI. Admin Web should parse this shape for the AI check panel.
 *
 * Outcomes:
 * - `passed: true` + all checks passed → subscription promoted to `pending_approval`
 * - `passed: false` → stays `pending_review` (admin may still approve/reject)
 * - `aiEnabled: false` → AI skipped (`RECEIPT_AI_ENABLED=false`); auto-promotes with notes
 * - `error` set → pipeline/Gemini failure; checks usually failed with the same message
 *
 * Transaction reference for duplicate detection lives at
 * `checks.notDuplicate.transactionReference` (also mirrored in `detected`).
 */
export type ReceiptVerificationResult = {
  version: 1;
  passed: boolean;
  /** ISO-8601 timestamp when verification ran */
  verifiedAt: string;
  aiEnabled: boolean;
  /** e.g. `gemini-3.1-flash-lite` when AI ran; null when skipped */
  model: string | null;
  /** Pipeline/Gemini error message when verification could not complete */
  error: string | null;
  checks: {
    recipientMatch: ReceiptVerificationCheckResult;
    senderMatch: ReceiptVerificationCheckResult;
    notDuplicate: ReceiptVerificationCheckResult & {
      /** Stable txn id extracted from the receipt (null if none / failure) */
      transactionReference: string | null;
    };
  };
  /** Free-text notes from Gemini, or skip-mode explanation */
  notes: string | null;
};

export const RECEIPT_VERIFICATION_RESULT_VERSION = 1 as const;

export const isReceiptVerificationResult = (
  value: unknown,
): value is ReceiptVerificationResult => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReceiptVerificationResult>;
  return candidate.version === RECEIPT_VERIFICATION_RESULT_VERSION;
};

export const extractTransactionReference = (
  verificationResult: unknown,
): string | null => {
  if (!isReceiptVerificationResult(verificationResult)) {
    return null;
  }

  return verificationResult.checks.notDuplicate.transactionReference;
};
