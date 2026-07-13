import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { AppEnv } from '../../config/env.schema';

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string | null;

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    const enabled = this.configService.get('MAIL_ENABLED', { infer: true });

    if (!enabled) {
      this.transporter = null;
      this.fromAddress = null;
      this.logger.log('Mail disabled');
      return;
    }

    this.fromAddress =
      this.configService.get('MAIL_FROM', { infer: true }) ?? null;

    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', { infer: true }),
      port: this.configService.get('SMTP_PORT', { infer: true }),
      secure: this.configService.get('SMTP_SECURE', { infer: true }),
      auth: {
        user: this.configService.get('SMTP_USER', { infer: true }),
        pass: this.configService.get('SMTP_PASS', { infer: true }),
      },
    });

    this.logger.log('Mail transporter initialized');
  }

  isEnabled(): boolean {
    return this.transporter !== null;
  }

  async sendMail(input: SendMailInput): Promise<void> {
    if (!this.transporter || !this.fromAddress) {
      this.logger.debug(
        `Skipping email to ${input.to} because mail is disabled`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${input.to}`, error);
      throw error;
    }
  }
}
