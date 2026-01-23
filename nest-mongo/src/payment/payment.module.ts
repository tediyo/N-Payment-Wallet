import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { WalletModule } from '../wallet/wallet.module';
import { EmailService } from './email.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from './schemas/payment-transaction.schema';
import { StripeService } from './stripe.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
    ]),
    AuthModule,
    WalletModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, EmailService, StripeService],
  exports: [PaymentService],
})
export class PaymentModule {}
