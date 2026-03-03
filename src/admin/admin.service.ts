import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class AdminService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        private readonly walletService: WalletService,
    ) { }

    async listUsers() {
        return this.userModel.find().select('-passwordHash').exec();
    }

    async freezeUser(userId: string) {
        const user = await this.userModel.findByIdAndUpdate(userId, { isFrozen: true }, { new: true });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async unfreezeUser(userId: string) {
        const user = await this.userModel.findByIdAndUpdate(userId, { isFrozen: false }, { new: true });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async adjustBalance(userId: string, amount: number, reason: string) {
        // Reusing recharge logic for credit adjustment
        return this.walletService.recharge(userId, { amount, currency: 'ETB' } as any);
    }
}
