import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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
  constructor(private readonly paymentService: PaymentService) { }

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

  @Get('success')
  paymentSuccess(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Payment Successful</title>
          <style>
            body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f0fdf4; }
            .card { text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 400px; }
            .icon { font-size: 64px; margin-bottom: 16px; }
            h1 { color: #16a34a; margin-bottom: 8px; }
            p { color: #666; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✅</div>
            <h1>Payment Successful!</h1>
            <p>Your wallet will be credited shortly.<br>You can close this window and return to the app.</p>
          </div>
        </body>
      </html>
    `);
  }

  @Get('cancel')
  paymentCancel(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Payment Cancelled</title>
          <style>
            body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fef2f2; }
            .card { text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 400px; }
            .icon { font-size: 64px; margin-bottom: 16px; }
            h1 { color: #dc2626; margin-bottom: 8px; }
            p { color: #666; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">❌</div>
            <h1>Payment Cancelled</h1>
            <p>No charges have been made.<br>You can close this window and return to the app.</p>
          </div>
        </body>
      </html>
    `);
  }
}
