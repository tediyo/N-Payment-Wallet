import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { InitializeStripePaymentDto } from './dto/initialize-stripe-payment.dto';
import { PaymentHistoryFilterDto } from './dto/payment-history-filter.dto';
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

  @Post('initialize-mobile')
  @UseGuards(JwtAuthGuard)
  initializeMobile(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitializePaymentDto,
  ) {
    return this.paymentService.initializeMobilePayment(user.userId, dto);
  }

  @Get('status/:tx_ref')
  @UseGuards(JwtAuthGuard)
  getStatus(@Param('tx_ref') tx_ref: string) {
    return this.paymentService.getPaymentStatus(tx_ref);
  }

  @Get('transaction/:tx_ref')
  @UseGuards(JwtAuthGuard)
  getTransactionDetails(@Param('tx_ref') tx_ref: string) {
    return this.paymentService.getTransactionDetails(tx_ref);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  verify(@Body() body: { tx_ref: string }) {
    return this.paymentService.verifyPayment(body.tx_ref);
  }

  @Post('webhook')
  webhook(@Body() body: { tx_ref: string }) {
    // Public endpoint for Chapa webhook callbacks
    // Always return 200 to Chapa, even if verification fails
    return this.paymentService.handleWebhook(body.tx_ref).catch((error) => {
      // Log error but return success to Chapa
      console.error('[Webhook] Error processing webhook:', error);
      return {
        message: 'Webhook received but processing failed',
        status: 'error',
        error: error.message,
      };
    });
  }

  @Get('banks')
  @UseGuards(JwtAuthGuard)
  getBanks() {
    return this.paymentService.getBanks();
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  getHistory(
    @CurrentUser() user: AuthUser,
    @Query() filters: PaymentHistoryFilterDto,
  ) {
    return this.paymentService.getPaymentHistory(user.userId, {
      status: filters.status,
      startDate: filters.startDate,
      endDate: filters.endDate,
      page: filters.page ? parseInt(filters.page, 10) : undefined,
      limit: filters.limit ? parseInt(filters.limit, 10) : undefined,
    });
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  getAnalytics(
    @CurrentUser() user: AuthUser,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.paymentService.getPaymentAnalytics(user.userId, {
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.paymentService.getDashboardStats(user.userId);
  }

  @Post('stripe/initialize')
  @UseGuards(JwtAuthGuard)
  initializeStripe(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitializeStripePaymentDto,
  ) {
    return this.paymentService.initializeStripePayment(user.userId, dto);
  }

  @Post('stripe/verify')
  @UseGuards(JwtAuthGuard)
  verifyStripe(@Body() body: { sessionId: string }) {
    return this.paymentService.verifyStripePayment(body.sessionId);
  }

  @Post('stripe/webhook')
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    // Public endpoint for Stripe webhook callbacks
    const payload = req.rawBody || req.body;
    return this.paymentService.handleStripeWebhook(payload, signature);
  }
}
