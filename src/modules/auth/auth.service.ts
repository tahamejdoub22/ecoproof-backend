import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditActionType } from '../../entities/audit-log.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private auditService: AuditService,
  ) {}

  /**
   * Register new user
   */
  async register(
    email: string,
    password: string,
    deviceFingerprint?: string,
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    // Check if user exists
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = this.userRepo.create({
      email,
      passwordHash,
      deviceFingerprint: deviceFingerprint || null,
      trustScore: 0.7, // Initial trust score
      streakDays: 0,
      role: UserRole.USER,
    });

    await this.userRepo.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Audit log
    await this.auditService.log(AuditActionType.USER_REGISTERED, {
      userId: user.id,
      metadata: { email },
    });

    this.logger.log(`User registered: ${email}`);

    return {
      user,
      ...tokens,
    };
  }

  /**
   * Login user
   */
  async login(
    email: string,
    password: string,
    deviceFingerprint?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update device fingerprint if provided
    if (deviceFingerprint && user.deviceFingerprint !== deviceFingerprint) {
      user.deviceFingerprint = deviceFingerprint;
      await this.userRepo.save(user);
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Audit log
    await this.auditService.log(AuditActionType.USER_LOGIN, {
      userId: user.id,
      ipAddress,
      userAgent,
    });

    this.logger.log(`User logged in: ${email}`);

    return {
      user,
      ...tokens,
    };
  }

  /**
   * Validate user from JWT
   */
  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.validateUser(payload.sub);

      const newPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = this.jwtService.sign(newPayload, { expiresIn: '15m' });

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
