import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { PayBillDto } from './dto/pay-bill.dto';
import { RechargeDto } from './dto/recharge.dto';
import { TransferDto } from './dto/transfer.dto';
import {
  WalletTransaction,
  WalletTransactionDocument,
} from './wallet.schema';

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(WalletTransaction.name)
    private readonly transactionModel: Model<WalletTransactionDocument>,
  ) {}

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
    const session = await this.userModel.db.startSession();
    let updatedUser: UserDocument | null = null;

    try {
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
    } finally {
      await session.endSession();
    }

    return { balance: updatedUser!.balance };
  }

  async transfer(userId: string, dto: TransferDto) {
    if (dto.toUserId === userId) {
      throw new BadRequestException('Cannot transfer to yourself');
    }
    const session = await this.userModel.db.startSession();
    let sender: UserDocument | null = null;

    try {
      await session.withTransaction(async () => {
        sender = await this.userModel.findById(userId).session(session).exec();
        if (!sender) {
          throw new NotFoundException('Sender not found');
        }
        if (sender.balance < dto.amount) {
          throw new BadRequestException('Insufficient balance');
        }

        const receiver = await this.userModel
          .findById(dto.toUserId)
          .session(session)
          .exec();
        if (!receiver) {
          throw new NotFoundException('Receiver not found');
        }

        sender.balance -= dto.amount;
        receiver.balance += dto.amount;
        await sender.save({ session });
        await receiver.save({ session });

        await this.transactionModel.create(
          [
            {
              type: 'transfer',
              amount: dto.amount,
              fromUser: sender._id,
              toUser: receiver._id,
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    return { balance: sender!.balance };
  }

  async payBill(userId: string, dto: PayBillDto) {
    const session = await this.userModel.db.startSession();
    let user: UserDocument | null = null;

    try {
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
    } finally {
      await session.endSession();
    }

    return { balance: user!.balance };
  }

  async listTransactions(userId: string) {
    return this.transactionModel
      .find({
        $or: [{ fromUser: userId }, { toUser: userId }],
      })
      .sort({ createdAt: -1 })
      .exec();
  }
}
