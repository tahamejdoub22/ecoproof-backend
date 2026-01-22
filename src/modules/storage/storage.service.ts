import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as crypto from "crypto";
import axios from "axios";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get("SUPABASE_S3_ENDPOINT");
    const region = this.configService.get("SUPABASE_S3_REGION") || "eu-north-1";
    const accessKeyId = this.configService.get("SUPABASE_S3_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get(
      "SUPABASE_S3_SECRET_ACCESS_KEY",
    );
    this.bucketName = this.configService.get("SUPABASE_S3_BUCKET");

    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucketName) {
      throw new Error("Supabase S3 configuration is missing");
    }

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });

    this.logger.log("Storage service initialized (Supabase S3)");
  }

  /**
   * Upload image to Supabase Storage
   */
  async uploadImage(
    file: any,
    userId: string,
    actionId: string,
  ): Promise<{ url: string; hash: string }> {
    try {
      // Validate file
      this.validateImage(file);

      // Calculate hash
      const hash = this.calculateHash(file.buffer);

      // Generate file path
      const fileName = `${userId}/${actionId}-${Date.now()}.${this.getFileExtension(file.originalname)}`;
      const key = `recycle-actions/${fileName}`;

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "private",
      });

      await this.s3Client.send(command);

      // Generate public URL (or signed URL for private)
      const url = `${this.configService.get("SUPABASE_S3_ENDPOINT")}/${this.bucketName}/${key}`;

      this.logger.log(`Image uploaded: ${key}`);

      return { url, hash };
    } catch (error) {
      this.logger.error(
        `Failed to upload image: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to upload image: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verify image hash matches claimed hash
   */
  async verifyImageHash(
    imageUrl: string,
    claimedHash: string,
  ): Promise<boolean> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 10000,
      });

      const actualHash = this.calculateHash(Buffer.from(response.data));
      return actualHash === claimedHash;
    } catch (error) {
      this.logger.error(`Failed to verify image hash: ${error.message}`);
      return false;
    }
  }

  /**
   * Download image for AI verification
   */
  async downloadImage(imageUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 10000,
      });
      return Buffer.from(response.data);
    } catch (error) {
      throw new HttpException(
        `Failed to download image: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Calculate SHA-256 hash
   */
  private calculateHash(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Validate image file
   */
  private validateImage(file: any): void {
    // Check MIME type
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new HttpException(
        `Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(", ")}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new HttpException(
        `File too large: ${file.size} bytes. Max: ${maxSize} bytes`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get file extension
   */
  private getFileExtension(filename: string): string {
    return filename.split(".").pop()?.toLowerCase() || "jpg";
  }
}
