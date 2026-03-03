import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SecurityService } from './security.service';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
    constructor(private readonly securityService: SecurityService) { }

    @Post('pin/set')
    async setPin(@Request() req, @Body('pin') pin: string) {
        return this.securityService.setWalletPin(req.user.userId, pin);
    }

    @Post('pin/change')
    async changePin(
        @Request() req,
        @Body('oldPin') oldPin: string,
        @Body('newPin') newPin: string,
    ) {
        return this.securityService.changeWalletPin(req.user.userId, oldPin, newPin);
    }

    @Post('otp/generate')
    async generateOtp(@Request() req, @Body('reason') reason: string) {
        return this.securityService.generateOtp(req.user.userId, reason);
    }
}
