import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.schema';
import { MailService } from '../../lib/mail/mail.service';
import {
  createContactMessageSchema,
  type CreateContactMessageInput,
} from './schemas/contact.schema';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async submit(input: unknown): Promise<{ ok: true }> {
    const validated = this.parseInput(input);
    const mailEnabled = this.configService.get('MAIL_ENABLED', { infer: true });
    const to =
      this.configService.get('TEACHER_SUPPORT_EMAIL', { infer: true }) ??
      this.configService.get('MAIL_FROM', { infer: true });

    if (mailEnabled && !to) {
      this.logger.warn(
        'Contact form submitted but TEACHER_SUPPORT_EMAIL/MAIL_FROM is unset',
      );
      throw new ServiceUnavailableException(
        'Contact email is not configured',
      );
    }

    const phoneLine = validated.phone
      ? `Phone: ${validated.phone}`
      : 'Phone: (not provided)';

    try {
      if (!mailEnabled || !to) {
        this.logger.log(
          `Landing contact from ${validated.email} accepted (mail disabled)`,
        );
        return { ok: true };
      }

      await this.mailService.sendMail({
        to,
        subject: `Landing contact from ${validated.name}`,
        text: [
          'New contact message from the marketing landing page.',
          '',
          `Name: ${validated.name}`,
          `Email: ${validated.email}`,
          phoneLine,
          '',
          'Message:',
          validated.message,
        ].join('\n'),
      });

      return { ok: true };
    } catch (error) {
      this.logger.error('Failed to send landing contact email', error);
      throw error;
    }
  }

  private parseInput(input: unknown): CreateContactMessageInput {
    return createContactMessageSchema.parse(input);
  }
}
