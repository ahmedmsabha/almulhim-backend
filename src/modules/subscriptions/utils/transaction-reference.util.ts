export const normalizeTransactionReference = (
  transactionReference: string | null | undefined,
): string | null => {
  if (!transactionReference) {
    return null;
  }

  const normalized = transactionReference.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};
