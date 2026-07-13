import { z } from 'zod';

export const receiptAnalysisSchema = z.object({
  recipientNameDetected: z
    .string()
    .nullable()
    .describe('Payee or recipient name visible on the receipt, if any'),
  recipientMatch: z
    .boolean()
    .describe(
      'True when the recipient matches one of the expected teacher account names',
    ),
  senderNameDetected: z
    .string()
    .nullable()
    .describe('Sender or payer name visible on the receipt, if any'),
  senderMatch: z
    .boolean()
    .describe(
      'True when the detected sender name matches the student-entered sender name',
    ),
  transactionReference: z
    .string()
    .nullable()
    .describe(
      'Stable transaction identifier visible on the receipt, such as transaction ID or reference number',
    ),
  appearsDuplicate: z
    .boolean()
    .describe(
      'True when the receipt appears to be a resubmission of an already-used payment',
    ),
  duplicateReason: z.string().nullable(),
  notes: z.string().nullable(),
});

export type ReceiptAnalysis = z.infer<typeof receiptAnalysisSchema>;
