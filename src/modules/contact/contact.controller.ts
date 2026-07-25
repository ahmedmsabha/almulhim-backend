import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { ArcjetProtect } from '../../common/decorators/arcjet-protect.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ContactService } from './contact.service';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @ArcjetProtect('contact-public')
  @Post()
  async submit(@Body() body: unknown): Promise<{ ok: true }> {
    try {
      return await this.contactService.submit(body);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.flatten(),
        });
      }

      throw error;
    }
  }
}
