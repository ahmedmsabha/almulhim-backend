import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import type { AppEnv } from '../../config/env.schema';
import {
  contentSearchResultSchema,
  type ContentSearchResult,
} from './schemas/content-search.schema';
import {
  receiptAnalysisSchema,
  type ReceiptAnalysis,
} from './schemas/receipt-analysis.schema';

export const RECEIPT_VERIFICATION_MODEL = 'gemini-3.5-flash';
export const CONTENT_SEARCH_MODEL = 'gemini-3.5-flash';

export type AnalyzeReceiptInput = {
  imageBuffer: Buffer;
  mediaType: string;
  expectedRecipientNames: string[];
  expectedSenderName: string;
  knownTransactionReferences: string[];
};

export type SearchContentItemsInput = {
  query: string;
  items: Array<{
    id: string;
    title: string;
    type: 'unit' | 'chapter' | 'lesson';
    orderIndex: number;
  }>;
};

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(private readonly configService: ConfigService<AppEnv, true>) {}

  isReceiptAiEnabled(): boolean {
    return this.configService.get('RECEIPT_AI_ENABLED', { infer: true });
  }

  isContentSearchAiEnabled(): boolean {
    return this.configService.get('CONTENT_SEARCH_AI_ENABLED', { infer: true });
  }

  getExpectedRecipientNames(): string[] {
    return this.configService.get('EXPECTED_RECIPIENT_NAMES', { infer: true });
  }

  async analyzeReceipt(input: AnalyzeReceiptInput): Promise<ReceiptAnalysis> {
    if (!this.isReceiptAiEnabled()) {
      throw new Error('Receipt AI is disabled');
    }

    const expectedRecipients = input.expectedRecipientNames.join(', ');
    const knownReferences =
      input.knownTransactionReferences.length > 0
        ? input.knownTransactionReferences.join(', ')
        : 'none';

    try {
      const result = await generateObject({
        model: google(RECEIPT_VERIFICATION_MODEL),
        schema: receiptAnalysisSchema,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  'Analyze this payment receipt image for a student subscription request.',
                  `Expected recipient names (payee): ${expectedRecipients}`,
                  `Expected sender name entered by the student: ${input.expectedSenderName}`,
                  `Known transaction references already used: ${knownReferences}`,
                  'Set recipientMatch when the payee matches any expected recipient name, allowing minor spelling or formatting differences.',
                  'Set senderMatch when the payer name matches the expected sender name, allowing minor spelling or formatting differences.',
                  'Extract transactionReference when a stable transaction ID or reference number is visible.',
                  'Set appearsDuplicate to true only when this receipt clearly reuses a payment already represented by a known transaction reference.',
                ].join('\n'),
              },
              {
                type: 'file',
                mediaType: input.mediaType,
                data: input.imageBuffer,
              },
            ],
          },
        ],
      });

      return result.object;
    } catch (error) {
      this.logger.error('Receipt AI analysis failed', error);
      throw error;
    }
  }

  async searchContentItems(
    input: SearchContentItemsInput,
  ): Promise<ContentSearchResult> {
    if (!this.isContentSearchAiEnabled()) {
      throw new Error('Content search AI is disabled');
    }

    const catalog = input.items
      .map(
        (item) =>
          `- id=${item.id}; type=${item.type}; orderIndex=${item.orderIndex}; title=${JSON.stringify(item.title)}`,
      )
      .join('\n');

    try {
      const result = await generateObject({
        model: google(CONTENT_SEARCH_MODEL),
        schema: contentSearchResultSchema,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  'You match a search query against a fixed catalog of learning content items.',
                  'Return ONLY item ids from the catalog that match the query INTENT.',
                  'Match using title text and orderIndex context (display/sort order).',
                  'Support Arabic and English, including:',
                  '- Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) and Western digits',
                  '- spelled-out Arabic numbers and ordinals (e.g. الأول, الثاني, درس ٢)',
                  '- partial title matches and minor spelling variation',
                  'Never invent ids. Never return an id that is not in the catalog.',
                  'If nothing matches, return an empty matchingIds array.',
                  `Search query: ${JSON.stringify(input.query)}`,
                  'Catalog:',
                  catalog.length > 0 ? catalog : '(empty)',
                ].join('\n'),
              },
            ],
          },
        ],
      });

      return result.object;
    } catch (error) {
      this.logger.error('Content search AI failed', error);
      throw error;
    }
  }
}
