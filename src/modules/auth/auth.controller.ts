import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentEmployer } from './current-employer.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(
    @Body() body: { email: string; password: string; companyName: string },
  ) {
    try {
      if (!body.email || !body.password || !body.companyName) {
        throw new HttpException(
          'Email, password, and company name are required',
          HttpStatus.BAD_REQUEST,
        );
      }
      return await this.authService.signup(
        body.email,
        body.password,
        body.companyName,
      );
    } catch (error) {
      if (error.message.includes('already exists')) {
        throw new HttpException(error.message, HttpStatus.CONFLICT);
      }
      throw new HttpException(
        'Failed to create account',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    try {
      return await this.authService.login(body.email, body.password);
    } catch (error) {
      throw new HttpException(
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@CurrentEmployer() employer: any) {
    return await this.authService.logout(employer.id);
  }

  @Get('session')
  async getSession(@Headers('authorization') auth: string) {
    try {
      const token = auth?.replace('Bearer ', '');
      if (!token) {
        throw new HttpException('Not authenticated', HttpStatus.UNAUTHORIZED);
      }
      return await this.authService.getSession(token);
    } catch (error) {
      throw new HttpException('Not authenticated', HttpStatus.UNAUTHORIZED);
    }
  }
}
