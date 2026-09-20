import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body()
    body: {
      orgName: string;
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    },
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body.token, body.password);
  }
}
