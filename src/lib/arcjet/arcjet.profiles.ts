import { detectBot, shield, slidingWindow } from '@arcjet/node';

export type ArcjetProfile =
  | 'receipt-submit'
  | 'receipt-upload-url'
  | 'support-create'
  | 'download-authorize'
  | 'user-register'
  | 'device-bind'
  | 'upload-url'
  | 'admin-mutation'
  | 'content-search';

const ARCJET_RULE_MODE = 'DRY_RUN' as const;
const USER_CHARACTERISTICS = ['userId'] as const;

const scraperBotRule = detectBot({
  mode: ARCJET_RULE_MODE,
  deny: ['CATEGORY:AI', 'CURL'],
});

const userRateLimit = (max: number, interval: string | number) =>
  slidingWindow({
    mode: ARCJET_RULE_MODE,
    characteristics: USER_CHARACTERISTICS,
    max,
    interval,
  });

export type ArcjetProfileRuleSet = {
  rateLimit: ReturnType<typeof userRateLimit>;
  botDetection?: ReturnType<typeof detectBot>;
};

export const ARCJET_PROFILE_RULES: Record<ArcjetProfile, ArcjetProfileRuleSet> =
  {
    'receipt-submit': {
      rateLimit: userRateLimit(3, '1h'),
      botDetection: scraperBotRule,
    },
    'receipt-upload-url': {
      rateLimit: userRateLimit(10, '1h'),
      botDetection: scraperBotRule,
    },
    'support-create': {
      rateLimit: userRateLimit(5, '24h'),
      botDetection: scraperBotRule,
    },
    'download-authorize': {
      rateLimit: userRateLimit(30, '1h'),
      botDetection: scraperBotRule,
    },
    'user-register': {
      rateLimit: userRateLimit(5, '1h'),
      botDetection: scraperBotRule,
    },
    'device-bind': {
      rateLimit: userRateLimit(10, '1h'),
      botDetection: scraperBotRule,
    },
    'upload-url': {
      rateLimit: userRateLimit(20, '1h'),
    },
    'admin-mutation': {
      rateLimit: userRateLimit(60, '1m'),
    },
    // Frequent student/admin search (debounced clients); AI-cost aware — 30/min per user.
    'content-search': {
      rateLimit: userRateLimit(30, '1m'),
    },
  };

export const ARCJET_BASE_RULES = [shield({ mode: ARCJET_RULE_MODE })] as const;

export const ARCJET_PROFILES = Object.keys(
  ARCJET_PROFILE_RULES,
) as ArcjetProfile[];
