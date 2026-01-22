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
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import {
  PaymentTransaction,
  PaymentTransactionDocument,
} from './schemas/payment-transaction.schema';

@Injectable()
export class PaymentService {
  constructor(
    private readonly chapaService: ChapaService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(PaymentTransaction.name)
    private readonly paymentTransactionModel: Model<PaymentTransactionDocument>,
    private readonly walletService: WalletService,
  ) {}

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

      // If payment successful, recharge wallet
      if (paymentTransaction.status === 'success') {
        await this.walletService.recharge(
          paymentTransaction.userId.toString(),
          { amount: paymentTransaction.amount },
        );
        // Note: Wallet transaction is created automatically by wallet service
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
      paymentTransaction.status = 'failed';
      paymentTransaction.chapaResponse = { error: error.message };
      await paymentTransaction.save();

      throw new BadRequestException(
        `Payment verification failed: ${error.message}`,
      );
    }
  }

  async getPaymentHistory(userId: string) {
    return this.paymentTransactionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }
}
