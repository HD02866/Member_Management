import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, UserDto } from './dto/auth-response.dto';
import { UserStatus, MemberStatus, OrganizationStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(UsersService)
    private readonly usersService: UsersService,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * Registers a new User account.
   * Note: Creates the global USER identity foundation.
   * Membership in an organization is managed separately.
   */
  async register(
    dto: RegisterDto,
    meta?: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<AuthResponseDto> {
    const email = dto.email ? dto.email.toLowerCase().trim() : null;
    const phoneNumber = dto.phoneNumber
      ? this.usersService.normalizePhone(dto.phoneNumber.trim())
      : null;

    if (!email && !phoneNumber) {
      throw new BadRequestException('At least one communication identifier (email or phone) is required');
    }

    // Check for duplicate account using canonical representations
    if (email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      if (existingEmail) {
        throw new ConflictException('An account with this email address already exists');
      }
    }

    if (phoneNumber) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phoneNumber },
      });
      if (existingPhone) {
        throw new ConflictException('An account with this phone number already exists');
      }
    }

    // Hash password with Argon2id
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = await this.prisma.user.create({
      data: {
        email,
        phoneNumber,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        status: UserStatus.ACTIVE,
      },
    });

    const targetSlug = (dto.organizationSlug || '4b').toLowerCase().trim();
    const org = await this.prisma.organization.findFirst({
      where: { slug: targetSlug, status: OrganizationStatus.ACTIVE, deletedAt: null },
    });

      if (org) {
        const count = await this.prisma.memberProfile.count({
          where: { organizationId: org.id },
        });
        const prefix = org.slug.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'MEM';
        const memberNumber = `${prefix}-${String(count + 1).padStart(5, '0')}`;

        await this.prisma.withTenantContext(org.id, async (tx) => {
          await tx.memberProfile.create({
            data: {
              organizationId: org.id,
              userId: user.id,
              memberNumber,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phoneNumber: user.phoneNumber,
              status: MemberStatus.ACTIVE,
            },
          });
        });
      }

      return this.createAuthResponse(user, meta);
  }

  /**
   * Authenticates a user with email or phone + password.
   */
  async login(
    dto: LoginDto,
    meta?: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<AuthResponseDto> {
    const user = await this.usersService.findByIdentifier(dto.identifier);

    if (!user) {
      // Generic message to mitigate account enumeration
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) {
      throw new UnauthorizedException('Account has been deactivated. Please contact support.');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createAuthResponse(user, meta);
  }

  /**
   * Logs out user by revoking the active session token.
   */
  async logout(sessionId?: string): Promise<void> {
    if (sessionId) {
      try {
        await this.prisma.session.delete({
          where: { id: sessionId },
        });
      } catch {
        // Ignore if session already purged
      }
    }
  }

  /**
   * Creates Session, signs JWT access token, and returns sanitized DTO.
   */
  private async createAuthResponse(
    user: {
      id: string;
      email: string | null;
      phoneNumber: string | null;
      firstName: string;
      lastName: string;
      isPlatformAdmin: boolean;
      status: string;
      createdAt: Date;
    },
    meta?: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<AuthResponseDto> {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const refreshExpiresDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshExpiresDays);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        expiresAt,
      },
    });

    const jwtExpiresIn =
      this.configService?.get<string>('jwt.expiresIn') || process.env.JWT_EXPIRES_IN || '15m';
    const jwtSecret =
      this.configService?.get<string>('jwt.secret') ||
      process.env.JWT_SECRET ||
      'dev_insecure_jwt_secret_change_me_immediately_32chars';

    const payload = {
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      isPlatformAdmin: user.isPlatformAdmin,
      status: user.status,
      sessionId: session.id,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: jwtSecret,
      expiresIn: jwtExpiresIn as any,
    });

    const userDto: UserDto = {
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      isPlatformAdmin: user.isPlatformAdmin,
      status: user.status,
      createdAt: user.createdAt,
    };

    return {
      user: userDto,
      tokens: {
        accessToken,
        refreshToken: sessionToken,
        expiresIn: jwtExpiresIn,
      },
    };
  }
}
