import { applyDecorators, SetMetadata } from '@nestjs/common';
import {
  REQUIRES_REGISTRATION_KEY,
  STUDENT_ONLY_KEY,
} from '../constants/auth-metadata';

export type RequiresRegistrationOptions = {
  studentOnly?: boolean;
};

export const RequiresRegistration = (
  options: RequiresRegistrationOptions = {},
) =>
  applyDecorators(
    SetMetadata(REQUIRES_REGISTRATION_KEY, true),
    SetMetadata(STUDENT_ONLY_KEY, options.studentOnly ?? false),
  );
