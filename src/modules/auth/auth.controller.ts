import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
} from "../../common/dto/auth.dto";
import {
  AuthResponseDto,
  RegisterResponseDto,
} from "../../common/dto/auth-response.dto";
import { Request } from "express";

@ApiTags("Authentication")
@Controller("api/v1/auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Register a new user",
    description: "Create a new user account with email and password",
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: "User successfully registered",
    type: RegisterResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Validation error or email already exists",
  })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ipAddress = req.ip || (req.headers["x-forwarded-for"] as string);
    const userAgent = req.headers["user-agent"];

    return this.authService.register(
      dto.email,
      dto.password,
      dto.deviceFingerprint,
    );
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Login user",
    description: "Authenticate user and receive JWT tokens",
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: "Login successful, returns access and refresh tokens",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip || (req.headers["x-forwarded-for"] as string);
    const userAgent = req.headers["user-agent"];

    return this.authService.login(
      dto.email,
      dto.password,
      dto.deviceFingerprint,
      ipAddress,
      userAgent,
    );
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Refresh access token",
    description: "Get a new access token using refresh token",
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: "New access token generated",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid or expired refresh token" })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }
}
