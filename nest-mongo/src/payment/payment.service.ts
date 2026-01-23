import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ChapaService } from 'chapa-nestjs';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { WalletService } from '../wallet/wallet.service';
import { EmailService } from './email.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { InitializeStripePaymentDto } from './dto/initialize-stripe-payment.dto';
import { StripeService } from './stripe.service';
import {
  PaymentTransaction,
  PaymentTransactionDocument,
} from './schemas/payment-transaction.schema';

@Injectable()
export class PaymentService {
  constructor(
    private readonly chapaService: ChapaService,
    private readonly stripeService: StripeService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(PaymentTransaction.name)
    private readonly paymentTransactionModel: Model<PaymentTransactionDocument>,
    private readonly walletService: WalletService,
    private readonly emailService: EmailService,
  ) {}

  async initializeMobilePayment(userId: string, dto: InitializePaymentDto) {
    // Get user details
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!user.email || !emailRegex.test(user.email)) {
      throw new BadRequestException(
        `Invalid email format for user: ${user.email}. Please update your email address.`,
      );
    }

    const nameParts = user.name.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? user.name;
    const lastName = nameParts.slice(1).join(' ') || firstName;

    // Generate transaction reference
    const tx_ref = await this.chapaService.generateTransactionReference({
      prefix: 'WLT',
      size: 20,
    });

    // Create payment transaction record
    const paymentTransaction = await this.paymentTransactionModel.create({
      tx_ref,
      userId: new Types.ObjectId(userId),
      amount: dto.amount,
      currency: dto.currency,
      status: 'pending',
    });

    try {
      // Initialize Chapa mobile payment
      const response = await this.chapaService.mobileInitialize({
        first_name: firstName,
        last_name: lastName,
        email: user.email.trim().toLowerCase(),
        currency: dto.currency,
        amount: dto.amount.toString(),
        tx_ref: tx_ref,
        callback_url: dto.callback_url,
        return_url: dto.return_url,
        customization: {
          title: 'Wallet Recharge',
          description: `Recharge wallet with ${dto.amount} ${dto.currency}`,
        },
      });

      // Update payment transaction with Chapa response
      paymentTransaction.chapaResponse = response;
      await paymentTransaction.save();

      return {
        ...response,
        paymentTransactionId: paymentTransaction._id,
      };
    } catch (error: any) {
      // Update status to failed
      paymentTransaction.status = 'failed';
      paymentTransaction.chapaResponse = {
        message: error?.message,
        name: error?.name,
        response: error?.response?.data ?? error?.response,
        errorResponse: error?.errorResponse,
      };
      await paymentTransaction.save();

      // Log full error for debugging
      console.error('Chapa Mobile Payment Error:', {
        message: error?.message,
        response: error?.response,
        data: error?.response?.data,
        fullError: error,
      });

      const details =
        error?.response?.data ??
        error?.response ??
        error?.message ??
        'Unknown error';

      // Use second parameter for response body to preserve structure
      throw new BadRequestException(
        {
          message: 'Mobile payment initialization failed',
          details: details,
        },
        'Mobile payment initialization failed',
      );
    }
  }

  async initializePayment(userId: string, dto: InitializePaymentDto) {
    // Get user details
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!user.email || !emailRegex.test(user.email)) {
      throw new BadRequestException(
        `Invalid email format for user: ${user.email}. Please update your email address.`,
      );
    }

    const nameParts = user.name.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? user.name;
    // Chapa requires last_name, so always provide a non-empty fallback
    const lastName = nameParts.slice(1).join(' ') || firstName;

    // Generate transaction reference
    const tx_ref = await this.chapaService.generateTransactionReference({
      prefix: 'WLT',
      size: 20,
    });

    // Create payment transaction record
    const paymentTransaction = await this.paymentTransactionModel.create({
      tx_ref,
      userId: new Types.ObjectId(userId),
      amount: dto.amount,
      currency: dto.currency,
      status: 'pending',
    });

    try {
      // Initialize Chapa payment
      const response = await this.chapaService.initialize({
        first_name: firstName,
        last_name: lastName,
        email: user.email.trim().toLowerCase(),
        currency: dto.currency,
        amount: dto.amount.toString(),
        tx_ref: tx_ref,
        callback_url: dto.callback_url,
        return_url: dto.return_url,
        customization: {
          title: 'Wallet Recharge',
          description: `Recharge wallet with ${dto.amount} ${dto.currency}`,
        },
      });

      // Update payment transaction with Chapa response
      paymentTransaction.chapaResponse = response;
      await paymentTransaction.save();

      return {
        ...response,
        paymentTransactionId: paymentTransaction._id,
      };
    } catch (error: any) {
      // Update status to failed
      paymentTransaction.status = 'failed';
      paymentTransaction.chapaResponse = {
        message: error?.message,
        name: error?.name,
        // common shapes: axios-like, nest HttpException-like, or custom
        response: error?.response?.data ?? error?.response,
        errorResponse: error?.errorResponse,
      };
      await paymentTransaction.save();

      const details =
        error?.response?.data ??
        error?.response ??
        error?.message ??
        'Unknown error';

      // Log full error for debugging
      console.error('Chapa Payment Error:', {
        message: error?.message,
        response: error?.response,
        data: error?.response?.data,
        fullError: error,
      });

      // Use second parameter for response body to preserve structure
      throw new BadRequestException(
        {
          message: 'Payment initialization failed',
          details: details,
        },
        'Payment initialization failed',
      );
    }
  }

  async verifyPayment(tx_ref: string) {
    // Find payment transaction
    const paymentTransaction =
      await this.paymentTransactionModel.findOne({ tx_ref }).exec();

    if (!paymentTransaction) {
      throw new NotFoundException('Payment transaction not found');
    }

    // If already verified and successful, return existing data
    if (paymentTransaction.status === 'success') {
      return {
        message: 'Payment already verified',
        status: 'success',
        data: paymentTransaction,
      };
    }

    try {
      // Verify with Chapa
      const response = await this.chapaService.verify({ tx_ref });

      // Update payment transaction
      paymentTransaction.status =
        response.data.status === 'successful' ? 'success' : 'failed';
      paymentTransaction.chapaResponse = response;
      await paymentTransaction.save();

      // If payment successful, recharge wallet and send email
      if (paymentTransaction.status === 'success') {
        await this.walletService.recharge(
          paymentTransaction.userId.toString(),
          { amount: paymentTransaction.amount },
        );
        // Note: Wallet transaction is created automatically by wallet service
        await paymentTransaction.save();

        // Send success email notification
        try {
          const user = await this.userModel
            .findById(paymentTransaction.userId)
            .exec();
          if (user) {
            await this.emailService.sendPaymentSuccessEmail(
              user,
              paymentTransaction.amount,
              paymentTransaction.currency,
              paymentTransaction.tx_ref,
            );
          }
        } catch (emailError: any) {
          // Log but don't fail the payment verification
          console.error('Failed to send payment success email:', emailError);
        }
      }

      return {
        message: 'Payment verified successfully',
        status: paymentTransaction.status,
        data: {
          paymentTransaction,
          chapaResponse: response,
        },
      };
    } catch (error: any) {
      paymentTransaction.status = 'failed';
      paymentTransaction.chapaResponse = { error: error.message };
      await paymentTransaction.save();

      throw new BadRequestException(
        `Payment verification failed: ${error.message}`,
      );
    }
  }

  async getPaymentStatus(tx_ref: string) {
    const paymentTransaction =
      await this.paymentTransactionModel.findOne({ tx_ref }).exec();

    if (!paymentTransaction) {
      throw new NotFoundException('Payment transaction not found');
    }

    return {
      tx_ref: paymentTransaction.tx_ref,
      status: paymentTransaction.status,
      amount: paymentTransaction.amount,
      currency: paymentTransaction.currency,
      createdAt: paymentTransaction.createdAt,
      updatedAt: paymentTransaction.updatedAt,
      paymentTransactionId: paymentTransaction._id,
    };
  }

  async getTransactionDetails(tx_ref: string) {
    const paymentTransaction =
      await this.paymentTransactionModel.findOne({ tx_ref }).exec();

    if (!paymentTransaction) {
      throw new NotFoundException('Payment transaction not found');
    }

    // Get user details
    const user = await this.userModel
      .findById(paymentTransaction.userId)
      .exec();

    return {
      tx_ref: paymentTransaction.tx_ref,
      status: paymentTransaction.status,
      amount: paymentTransaction.amount,
      currency: paymentTransaction.currency,
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
          }
        : null,
      chapaResponse: paymentTransaction.chapaResponse,
      createdAt: paymentTransaction.createdAt,
      updatedAt: paymentTransaction.updatedAt,
      paymentTransactionId: paymentTransaction._id,
      walletTransactionId: paymentTransaction.walletTransactionId,
    };
  }

  async handleWebhook(tx_ref: string) {
    // Log webhook received
    console.log(`[Webhook] Received payment verification request for: ${tx_ref}`);

    // Find payment transaction
    const paymentTransaction =
      await this.paymentTransactionModel.findOne({ tx_ref }).exec();

    if (!paymentTransaction) {
      console.error(`[Webhook] Payment transaction not found: ${tx_ref}`);
      throw new NotFoundException('Payment transaction not found');
    }

    // If already verified and successful, skip processing
    if (paymentTransaction.status === 'success') {
      console.log(`[Webhook] Payment already verified: ${tx_ref}`);
      return {
        message: 'Payment already verified',
        status: 'success',
        data: paymentTransaction,
      };
    }

    try {
      // Verify with Chapa
      console.log(`[Webhook] Verifying payment with Chapa: ${tx_ref}`);
      const response = await this.chapaService.verify({ tx_ref });

      // Update payment transaction
      const previousStatus = paymentTransaction.status;
      paymentTransaction.status =
        response.data.status === 'successful' ? 'success' : 'failed';
      paymentTransaction.chapaResponse = response;
      await paymentTransaction.save();

      console.log(
        `[Webhook] Payment status updated: ${previousStatus} -> ${paymentTransaction.status}`,
      );

      // If payment successful, recharge wallet and send email
      if (paymentTransaction.status === 'success') {
        console.log(
          `[Webhook] Recharging wallet for user: ${paymentTransaction.userId}, amount: ${paymentTransaction.amount}`,
        );
        try {
          await this.walletService.recharge(
            paymentTransaction.userId.toString(),
            { amount: paymentTransaction.amount },
          );
          console.log(`[Webhook] Wallet recharged successfully`);

          // Send success email notification
          try {
            const user = await this.userModel
              .findById(paymentTransaction.userId)
              .exec();
            if (user) {
              await this.emailService.sendPaymentSuccessEmail(
                user,
                paymentTransaction.amount,
                paymentTransaction.currency,
                paymentTransaction.tx_ref,
              );
              console.log(`[Webhook] Payment success email sent`);
            }
          } catch (emailError: any) {
            console.error(
              `[Webhook] Failed to send payment success email: ${emailError.message}`,
            );
            // Don't throw - email is not critical
          }
        } catch (walletError: any) {
          console.error(
            `[Webhook] Failed to recharge wallet: ${walletError.message}`,
          );
          // Don't throw - payment is verified, wallet recharge can be retried
        }
        await paymentTransaction.save();
      }

      return {
        message: 'Payment verified successfully',
        status: paymentTransaction.status,
        data: {
          paymentTransaction,
          chapaResponse: response,
        },
      };
    } catch (error: any) {
      console.error(`[Webhook] Verification failed: ${error.message}`, error);
      paymentTransaction.status = 'failed';
      paymentTransaction.chapaResponse = {
        error: error.message,
        webhookError: true,
      };
      await paymentTransaction.save();

      // Return error but don't throw (webhook should return 200 to Chapa)
      return {
        message: 'Payment verification failed',
        status: 'failed',
        error: error.message,
        data: paymentTransaction,
      };
    }
  }

  async getBanks() {
    try {
      const response = await this.chapaService.getBanks();
      return response;
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to fetch banks: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async getPaymentHistory(
    userId: string,
    filters?: {
      status?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const query: any = { userId: new Types.ObjectId(userId) };

    // Filter by status
    if (filters?.status) {
      query.status = filters.status;
    }

    // Filter by date range
    if (filters?.startDate || filters?.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    // Pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.paymentTransactionModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.paymentTransactionModel.countDocuments(query).exec(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentAnalytics(
    userId: string,
    filters?: { startDate?: string; endDate?: string },
  ) {
    const query: any = { userId: new Types.ObjectId(userId) };

    // Filter by date range
    if (filters?.startDate || filters?.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    // Get all transactions for analytics
    const transactions = await this.paymentTransactionModel
      .find(query)
      .exec();

    // Calculate statistics
    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter(
      (t) => t.status === 'success',
    );
    const failedTransactions = transactions.filter((t) => t.status === 'failed');
    const pendingTransactions = transactions.filter(
      (t) => t.status === 'pending',
    );

    // Calculate amounts
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const successfulAmount = successfulTransactions.reduce(
      (sum, t) => sum + t.amount,
      0,
    );
    const failedAmount = failedTransactions.reduce(
      (sum, t) => sum + t.amount,
      0,
    );
    const pendingAmount = pendingTransactions.reduce(
      (sum, t) => sum + t.amount,
      0,
    );

    // Calculate success rate
    const successRate =
      totalTransactions > 0
        ? (successfulTransactions.length / totalTransactions) * 100
        : 0;

    // Group by status
    const statusBreakdown = {
      success: successfulTransactions.length,
      failed: failedTransactions.length,
      pending: pendingTransactions.length,
      cancelled: transactions.filter((t) => t.status === 'cancelled').length,
    };

    // Group by currency
    const currencyBreakdown = transactions.reduce((acc, t) => {
      acc[t.currency] = (acc[t.currency] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Recent transactions (last 10)
    const recentTransactions = transactions
      .sort((a, b) => {
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 10)
      .map((t) => ({
        tx_ref: t.tx_ref,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        createdAt: t.createdAt,
      }));

    return {
      summary: {
        totalTransactions,
        totalAmount,
        successfulAmount,
        failedAmount,
        pendingAmount,
        successRate: Number(successRate.toFixed(2)),
      },
      statusBreakdown,
      currencyBreakdown,
      recentTransactions,
      dateRange: {
        startDate: filters?.startDate || null,
        endDate: filters?.endDate || null,
      },
    };
  }

  async getDashboardStats(userId: string) {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const thisWeek = new Date(now.setDate(now.getDate() - 7));
    const thisMonth = new Date(now.setMonth(now.getMonth() - 1));

    const [todayStats, weekStats, monthStats, allTimeStats] =
      await Promise.all([
        this.getPaymentAnalytics(userId, {
          startDate: today.toISOString(),
        }),
        this.getPaymentAnalytics(userId, {
          startDate: thisWeek.toISOString(),
        }),
        this.getPaymentAnalytics(userId, {
          startDate: thisMonth.toISOString(),
        }),
        this.getPaymentAnalytics(userId),
      ]);

    return {
      today: todayStats.summary,
      thisWeek: weekStats.summary,
      thisMonth: monthStats.summary,
      allTime: allTimeStats.summary,
      recentTransactions: allTimeStats.recentTransactions,
    };
  }

  async initializeStripePayment(userId: string, dto: InitializeStripePaymentDto) {
    // Get user details
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!user.email || !emailRegex.test(user.email)) {
      throw new BadRequestException(
        `Invalid email format for user: ${user.email}. Please update your email address.`,
      );
    }

    // Generate transaction reference
    const tx_ref = `STRIPE-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create payment transaction record
    const paymentTransaction = await this.paymentTransactionModel.create({
      tx_ref,
      userId: new Types.ObjectId(userId),
      amount: dto.amount,
      currency: dto.currency.toUpperCase(),
      status: 'pending',
      provider: 'stripe',
    });

    try {
      // Create Stripe checkout session
      const stripeSession = await this.stripeService.createCheckoutSession(
        dto.amount,
        dto.currency,
        userId,
        tx_ref,
        user.email,
      );

      // Update payment transaction with Stripe response
      paymentTransaction.stripeResponse = stripeSession;
      paymentTransaction.stripeSessionId = stripeSession.sessionId;
      await paymentTransaction.save();

      return {
        ...stripeSession,
        paymentTransactionId: paymentTransaction._id,
        tx_ref: paymentTransaction.tx_ref,
      };
    } catch (error: any) {
      // Update status to failed
      paymentTransaction.status = 'failed';
      paymentTransaction.stripeResponse = {
        error: error?.message || 'Unknown error',
      };
      await paymentTransaction.save();

      console.error('Stripe Payment Error:', {
        message: error?.message,
        fullError: error,
      });

      throw new BadRequestException(
        `Stripe payment initialization failed: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async verifyStripePayment(sessionId: string) {
    // Find payment transaction by Stripe session ID
    const paymentTransaction =
      await this.paymentTransactionModel
        .findOne({ stripeSessionId: sessionId })
        .exec();

    if (!paymentTransaction) {
      throw new NotFoundException('Payment transaction not found');
    }

    // If already verified and successful, return existing data
    if (paymentTransaction.status === 'success') {
      return {
        message: 'Payment already verified',
        status: 'success',
        data: paymentTransaction,
      };
    }

    try {
      // Verify with Stripe
      const stripeResponse = await this.stripeService.verifyPayment(sessionId);

      // Update payment transaction
      paymentTransaction.status = stripeResponse.success ? 'success' : 'failed';
      paymentTransaction.stripeResponse = stripeResponse;
      await paymentTransaction.save();

      // If payment successful, recharge wallet
      if (paymentTransaction.status === 'success') {
        await this.walletService.recharge(
          paymentTransaction.userId.toString(),
          { amount: paymentTransaction.amount },
        );
        await paymentTransaction.save();

        // Send success email notification
        try {
          const user = await this.userModel
            .findById(paymentTransaction.userId)
            .exec();
          if (user) {
            await this.emailService.sendPaymentSuccessEmail(
              user,
              paymentTransaction.amount,
              paymentTransaction.currency,
              paymentTransaction.tx_ref,
            );
          }
        } catch (emailError: any) {
          console.error('Failed to send payment success email:', emailError);
        }
      }

      return {
        message: 'Payment verified successfully',
        status: paymentTransaction.status,
        data: {
          paymentTransaction,
          stripeResponse,
        },
      };
    } catch (error: any) {
      paymentTransaction.status = 'failed';
      paymentTransaction.stripeResponse = { error: error.message };
      await paymentTransaction.save();

      throw new BadRequestException(
        `Stripe payment verification failed: ${error.message}`,
      );
    }
  }

  async handleStripeWebhook(payload: any, signature: string) {
    try {
      const webhookData = await this.stripeService.handleWebhook(
        payload,
        signature,
      );

      // Check if webhook data has the expected structure
      if (
        webhookData &&
        typeof webhookData === 'object' &&
        'type' in webhookData &&
        webhookData.type === 'checkout.session.completed'
      ) {
        const sessionId = (webhookData as any).sessionId;
        const paymentStatus = (webhookData as any).paymentStatus;

        if (!sessionId) {
          return { received: false, error: 'Missing sessionId in webhook data' };
        }

        // Find payment transaction by session ID
        const paymentTransaction =
          await this.paymentTransactionModel
            .findOne({ stripeSessionId: sessionId })
            .exec();

        if (paymentTransaction && paymentTransaction.status === 'pending') {
          // Update status
          paymentTransaction.status =
            paymentStatus === 'paid' ? 'success' : 'failed';
          paymentTransaction.stripeResponse = webhookData;
          await paymentTransaction.save();

          // If successful, recharge wallet
          if (paymentTransaction.status === 'success') {
            try {
              await this.walletService.recharge(
                paymentTransaction.userId.toString(),
                { amount: paymentTransaction.amount },
              );

              // Send email notification
              const user = await this.userModel
                .findById(paymentTransaction.userId)
                .exec();
              if (user) {
                await this.emailService.sendPaymentSuccessEmail(
                  user,
                  paymentTransaction.amount,
                  paymentTransaction.currency,
                  paymentTransaction.tx_ref,
                );
              }
            } catch (error: any) {
              console.error('Failed to process successful payment:', error);
            }
          }
        }
      }

      return { received: true, data: webhookData };
    } catch (error: any) {
      console.error('Stripe webhook error:', error);
      return { received: false, error: error.message };
    }
  }
}
