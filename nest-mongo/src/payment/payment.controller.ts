import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  initialize(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitializePaymentDto,
  ) {
    return this.paymentService.initializePayment(user.userId, dto);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  verify(@Body() body: { tx_ref: string }) {
    return this.paymentService.verifyPayment(body.tx_ref);
  }

  @Post('webhook')
  webhook(@Body() body: { tx_ref: string }) {
    // Public endpoint for Chapa webhook callbacks
    return this.paymentService.verifyPayment(body.tx_ref);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  getHistory(@CurrentUser() user: AuthUser) {
    return this.paymentService.getPaymentHistory(user.userId);
  }
}
