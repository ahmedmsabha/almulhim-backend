export const SUPPORT_FOLLOW_UP_SEP =
  '\n\n<!-- mulhim-support-follow-up -->\n';

export type SupportFollowUp = {
  createdAt: string;
  message: string;
};

export function parseSupportMessage(stored: string): {
  message: string;
  followUps: SupportFollowUp[];
} {
  if (!stored.includes(SUPPORT_FOLLOW_UP_SEP)) {
    return { message: stored, followUps: [] };
  }

  const [first, ...rest] = stored.split(SUPPORT_FOLLOW_UP_SEP);
  const followUps: SupportFollowUp[] = [];

  for (const block of rest) {
    const newline = block.indexOf('\n');
    if (newline === -1) continue;

    const meta = block.slice(0, newline).trim();
    const text = block.slice(newline + 1).trim();
    if (!text) continue;

    const createdAt =
      meta.startsWith('[') && meta.endsWith(']')
        ? meta.slice(1, -1)
        : new Date().toISOString();

    followUps.push({ createdAt, message: text });
  }

  return { message: first ?? '', followUps };
}

export function appendSupportFollowUp(
  stored: string,
  newMessage: string,
): string {
  const stamp = `[${new Date().toISOString()}]`;
  return `${stored.trimEnd()}${SUPPORT_FOLLOW_UP_SEP}${stamp}\n${newMessage.trim()}`;
}
