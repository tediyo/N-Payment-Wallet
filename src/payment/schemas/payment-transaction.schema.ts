import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentTransactionStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'cancelled';

export type PaymentProvider = 'chapa' | 'stripe';

export type PaymentTransactionDocument = HydratedDocument<PaymentTransaction>;

@Schema({ timestamps: true })
export class PaymentTransaction {
  @Prop({ required: true, unique: true })
  tx_ref: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 1000000 })
  amount: number;

  @Prop({ required: true, default: 'ETB' })
  currency: string;

  @Prop({
    required: true,
    enum: ['pending', 'success', 'failed', 'cancelled'],
    default: 'pending',
  })
  status: PaymentTransactionStatus;

  @Prop({
    required: true,
    enum: ['chapa', 'stripe'],
    default: 'chapa',
  })
  provider: PaymentProvider;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  walletTransactionId?: Types.ObjectId;

  @Prop({ type: Object })
  chapaResponse?: any;

  @Prop({ type: Object })
  stripeResponse?: any;

  @Prop()
  stripeSessionId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PaymentTransactionSchema =
  SchemaFactory.createForClass(PaymentTransaction);
