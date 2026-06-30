import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppEnv } from '../../config/env.schema';

export type PutObjectInput = {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
};

export type SignedUrlInput = {
  key: string;
  expiresInSeconds: number;
};

export type SignedPutUrlInput = {
  key: string;
  contentType: string;
  expiresInSeconds: number;
};

export type ObjectMetadata = {
  contentType: string | undefined;
  contentLength: number | undefined;
};

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
  ) {
    const accountId = this.configService.get('R2_ACCOUNT_ID', { infer: true });

    this.bucketName = this.configService.get('R2_BUCKET_NAME', {
      infer: true,
    });

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.get('R2_ACCESS_KEY_ID', {
          infer: true,
        }),
        secretAccessKey: this.configService.get('R2_SECRET_ACCESS_KEY', {
          infer: true,
        }),
      },
    });
  }

  getBucketName(): string {
    return this.bucketName;
  }

  getPublicBaseUrl(): string {
    return this.configService.get('R2_PUBLIC_BASE_URL', { infer: true });
  }

  async putObject(input: PutObjectInput): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to upload object: ${input.key}`, error);
      throw error;
    }
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof NotFound) {
        return false;
      }

      this.logger.error(`Object head check failed for key: ${key}`, error);
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to delete object: ${key}`, error);
      throw error;
    }
  }

  async createSignedGetUrl(input: SignedUrlInput): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: input.key,
        }),
        { expiresIn: input.expiresInSeconds },
      );
    } catch (error) {
      this.logger.error(`Failed to create signed URL for key: ${input.key}`, error);
      throw error;
    }
  }

  async createSignedPutUrl(input: SignedPutUrlInput): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: input.key,
          ContentType: input.contentType,
        }),
        { expiresIn: input.expiresInSeconds },
      );
    } catch (error) {
      this.logger.error(
        `Failed to create signed PUT URL for key: ${input.key}`,
        error,
      );
      throw error;
    }
  }

  async headObject(key: string): Promise<ObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      return {
        contentType: result.ContentType,
        contentLength: result.ContentLength,
      };
    } catch (error) {
      if (error instanceof NotFound) {
        return null;
      }

      this.logger.error(`Object head lookup failed for key: ${key}`, error);
      throw error;
    }
  }
}
