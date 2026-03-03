import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { PayBillDto } from './dto/pay-bill.dto';
import { RechargeDto } from './dto/recharge.dto';
import { TransferDto } from './dto/transfer.dto';
import {
  WalletTransaction,
  WalletTransactionDocument,
} from './wallet.schema';
import { SecurityService } from '../security/security.service';
import { NotificationService } from '../notifications/notification.service';
import * as crypto from 'crypto';

@Injectable()
export class WalletService {
  private readonly QR_SECRET = process.env.QR_SECRET || 'super-secret-qr-key';
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(WalletTransaction.name)
    private readonly transactionModel: Model<WalletTransactionDocument>,
    private readonly securityService: SecurityService,
    private readonly notificationService: NotificationService,
  ) { }

  async getWallet(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      balance: user.balance,
    };
  }

  async recharge(userId: string, dto: RechargeDto) {
    console.log(`[Wallet] Attempting recharge for user ${userId}, amount: ${dto.amount}`);
    let updatedUser: UserDocument | null = null;
    let session: any = null;

    try {
      session = await this.userModel.db.startSession();
      await session.withTransaction(async () => {
        updatedUser = await this.userModel
          .findByIdAndUpdate(
            userId,
            { $inc: { balance: dto.amount } },
            { new: true, session },
          )
          .exec();

        if (!updatedUser) {
          throw new NotFoundException('User not found');
        }

        await this.transactionModel.create(
          [
            {
              type: 'recharge',
              amount: dto.amount,
              toUser: updatedUser._id,
            },
          ],
          { session },
        );
      });
    } catch (error: any) {
      // Fallback if transactions not supported (no replica set)
      if (
        error?.code === 20 ||
        error?.codeName === 'IllegalOperation' ||
        error?.message?.includes('replica set') ||
        error?.errmsg?.includes('replica set') ||
        error?.errorResponse?.errmsg?.includes('replica set')
      ) {
        updatedUser = await this.userModel
          .findByIdAndUpdate(
            userId,
            { $inc: { balance: dto.amount } },
            { new: true },
          )
          .exec();

        if (!updatedUser) {
          throw new NotFoundException('User not found');
        }

        await this.transactionModel.create({
          type: 'recharge',
          amount: dto.amount,
          toUser: updatedUser._id,
        });
      } else {
        throw error;
      }
    } finally {
      if (session) {
        await session.endSession();
      }
    }

    // Trigger Notification
    await this.notificationService.create(
      userId,
      'Wallet Recharge',
      `Your wallet has been recharged with ${dto.amount} ETB.`,
    );

    return { balance: updatedUser!.balance };
  }

  async transfer(userId: string, dto: TransferDto) {
    // 1. Verify PIN
    await this.securityService.verifyWalletPin(userId, dto.pin);

    // 2. Resolve Receiver
    let receiverId = dto.toUserId;
    if (!receiverId && dto.phoneNumber) {
      const receiverUser = await this.userModel
        .findOne({ phoneNumber: dto.phoneNumber })
        .exec();
      if (!receiverUser) {
        throw new NotFoundException('Receiver with this phone number not found');
      }
      receiverId = receiverUser.id;
    }

    if (!receiverId) {
      throw new BadRequestException('Receiver ID or Phone Number is required');
    }

    const senderId = String(userId);
    const targetId = String(receiverId);

    if (senderId === targetId) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    // 3. Idempotency Check
    if (dto.idempotencyKey) {
      const existingTx = await this.transactionModel
        .findOne({ idempotencyKey: dto.idempotencyKey })
        .exec();
      if (existingTx) {
        return { balance: (await this.userModel.findById(userId).exec())?.balance, message: 'Duplicate transaction' };
      }
    }

    let sender: UserDocument | null = null;
    let session: any = null;

    try {
      session = await this.userModel.db.startSession();
      await session.withTransaction(async () => {
        sender = await this.userModel.findById(userId).session(session).exec();
        if (!sender) {
          throw new NotFoundException('Sender not found');
        }
        if (sender.isFrozen) {
          throw new BadRequestException('Wallet is frozen');
        }
        if (sender.balance < dto.amount) {
          throw new BadRequestException('Insufficient balance');
        }

        // Check daily limit
        if (sender.spentToday + dto.amount > sender.dailyLimit) {
          throw new BadRequestException('Daily limit exceeded');
        }

        const receiver = await this.userModel
          .findById(targetId)
          .session(session)
          .exec();
        if (!receiver) {
          throw new NotFoundException('Receiver not found');
        }

        sender.balance -= dto.amount;
        sender.spentToday += dto.amount;
        receiver.balance += dto.amount;

        await sender.save({ session });
        await receiver.save({ session });

        await this.transactionModel.create(
          [
            {
              type: 'transfer',
              status: 'SUCCESS',
              amount: dto.amount,
              fromUser: sender._id,
              toUser: receiver._id,
              note: dto.note,
              idempotencyKey: dto.idempotencyKey,
            },
          ],
          { session },
        );
      });
    } catch (error: any) {
      // Fallback for simple MongoDB (no replica set)
      if (error?.message?.includes('replica set')) {
        sender = await this.userModel.findById(userId).exec();
        const receiver = await this.userModel.findById(targetId).exec();

        if (!sender || !receiver) throw new NotFoundException('User not found');
        if (sender.balance < dto.amount) throw new BadRequestException('Insufficient balance');

        sender.balance -= dto.amount;
        receiver.balance += dto.amount;
        await sender.save();
        await receiver.save();

        await this.transactionModel.create({
          type: 'transfer',
          status: 'SUCCESS',
          amount: dto.amount,
          fromUser: sender._id,
          toUser: receiver._id,
          note: dto.note,
          idempotencyKey: dto.idempotencyKey,
        });
      } else {
        throw error;
      }
    } finally {
      if (session) {
        await session.endSession();
      }
    }

    // Trigger Notifications
    await this.notificationService.create(
      userId,
      'Transfer Sent',
      `You sent ${dto.amount} ETB to ${targetId}.`,
    );
    await this.notificationService.create(
      targetId,
      'Transfer Received',
      `You received ${dto.amount} ETB from ${userId}.`,
    );

    return { balance: sender!.balance };
  }

  async payBill(userId: string, dto: PayBillDto) {
    let user: UserDocument | null = null;
    let session: any = null;

    try {
      session = await this.userModel.db.startSession();
      await session.withTransaction(async () => {
        user = await this.userModel.findById(userId).session(session).exec();
        if (!user) {
          throw new NotFoundException('User not found');
        }
        if (user.balance < dto.amount) {
          throw new BadRequestException('Insufficient balance');
        }

        user.balance -= dto.amount;
        await user.save({ session });

        await this.transactionModel.create(
          [
            {
              type: 'bill',
              amount: dto.amount,
              fromUser: user._id,
              biller: dto.biller,
              reference: dto.reference,
            },
          ],
          { session },
        );
      });
    } catch (error: any) {
      // Fallback if transactions not supported (no replica set)
      if (
        error?.code === 20 ||
        error?.codeName === 'IllegalOperation' ||
        error?.message?.includes('replica set') ||
        error?.errmsg?.includes('replica set') ||
        error?.errorResponse?.errmsg?.includes('replica set')
      ) {
        user = await this.userModel.findById(userId).exec();
        if (!user) {
          throw new NotFoundException('User not found');
        }
        if (user.balance < dto.amount) {
          throw new BadRequestException('Insufficient balance');
        }

        user.balance -= dto.amount;
        await user.save();

        await this.transactionModel.create({
          type: 'bill',
          amount: dto.amount,
          fromUser: user._id,
          biller: dto.biller,
          reference: dto.reference,
        });
      } else {
        throw error;
      }
    } finally {
      if (session) {
        await session.endSession();
      }
    }

    return { balance: user!.balance };
  }

  async listTransactions(userId: string) {
    const transactions = await this.transactionModel
      .find({
        $or: [
          { fromUser: new Types.ObjectId(userId) },
          { toUser: new Types.ObjectId(userId) },
        ],
      })
      .populate('fromUser', 'name email')
      .populate('toUser', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    return transactions.map((tx) => {
      const transaction = tx.toObject();
      let direction: 'IN' | 'OUT' = 'OUT';
      let description = transaction.type.toUpperCase();

      if (transaction.type === 'recharge') {
        direction = 'IN';
        description = 'Wallet Recharge';
      } else if (transaction.type === 'bill') {
        direction = 'OUT';
        description = `Bill Payment: ${transaction.biller || 'Unknown'}`;
      } else if (transaction.type === 'transfer') {
        const isReceiver = String(transaction.toUser?._id) === String(userId);
        direction = isReceiver ? 'IN' : 'OUT';

        if (isReceiver) {
          const senderName = (transaction.fromUser as any)?.name || 'Someone';
          description = `Received from ${senderName}`;
        } else {
          const receiverName = (transaction.toUser as any)?.name || 'Someone';
          description = `Sent to ${receiverName}`;
        }
      }

      return {
        ...transaction,
        direction,
        description: transaction.note || description,
      };
    });
  }

  // QR Implementation
  async generateDynamicQr(userId: string, amount: number, note?: string) {
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    const payload = JSON.stringify({ userId, amount, note, expiresAt });
    const signature = crypto
      .createHmac('sha256', this.QR_SECRET)
      .update(payload)
      .digest('hex');

    return {
      type: 'DYNAMIC',
      payload: Buffer.from(payload).toString('base64'),
      signature,
    };
  }

  async validateQr(payloadBase64: string, signature: string) {
    const payload = Buffer.from(payloadBase64, 'base64').toString();
    const expectedSignature = crypto
      .createHmac('sha256', this.QR_SECRET)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new BadRequestException('Invalid QR signature');
    }

    const data = JSON.parse(payload);
    if (data.expiresAt && Date.now() > data.expiresAt) {
      throw new BadRequestException('QR code expired');
    }

    return data;
  }
}
