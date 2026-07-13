import { SetMetadata } from '@nestjs/common';
import type { ArcjetProfile } from '../../lib/arcjet/arcjet.profiles';
import { ARCJET_PROTECT_KEY } from '../constants/arcjet-metadata';

export const ArcjetProtect = (profile: ArcjetProfile) =>
  SetMetadata(ARCJET_PROTECT_KEY, profile);
