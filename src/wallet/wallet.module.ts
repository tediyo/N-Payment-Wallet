import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WalletTransaction, WalletTransactionSchema } from './wallet.schema';

import { SecurityModule } from '../security/security.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [
    AuthModule,
    SecurityModule,
    NotificationModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule { }
