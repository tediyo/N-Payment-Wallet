import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SecurityService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    ) { }

    async setWalletPin(userId: string, pin: string) {
        if (!/^\d{4,6}$/.test(pin)) {
            throw new BadRequestException('PIN must be 4-6 digits');
        }
        const pinHash = await bcrypt.hash(pin, 10);
        await this.userModel.findByIdAndUpdate(userId, { walletPinHash: pinHash });
        return { message: 'Wallet PIN set successfully' };
    }

    async verifyWalletPin(userId: string, pin: string): Promise<boolean> {
        const user = await this.userModel.findById(userId).select('+walletPinHash').exec();
        if (!user || !user.walletPinHash) {
            throw new BadRequestException('Wallet PIN not set');
        }
        const isValid = await bcrypt.compare(pin, user.walletPinHash);
        if (!isValid) {
            throw new BadRequestException('Invalid Wallet PIN');
        }
        return true;
    }

    // OTP logic placeholder (could integrate with SMS service)
    async generateOtp(userId: string, reason: string) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`[OTP] Generated OTP for user ${userId} (${reason}): ${otp}`);
        // In production, send via SMS/Email
        return { message: 'OTP sent successfully', otp }; // Returning OTP for development convenience
    }

    async changeWalletPin(userId: string, oldPin: string, newPin: string) {
        await this.verifyWalletPin(userId, oldPin);
        return this.setWalletPin(userId, newPin);
    }
}
