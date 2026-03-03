import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WalletTransactionDocument = HydratedDocument<WalletTransaction>;

export type WalletTransactionType =
  | 'recharge'
  | 'transfer'
  | 'bill'
  | 'adjustment'
  | 'refund';

export type WalletTransactionStatus =
  | 'INITIATED'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'REVERSED';

@Schema({ timestamps: true })
export class WalletTransaction {
  @Prop({
    required: true,
    enum: ['recharge', 'transfer', 'bill', 'adjustment', 'refund'],
  })
  type: WalletTransactionType;

  @Prop({
    required: true,
    enum: ['INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED'],
    default: 'SUCCESS',
  })
  status: WalletTransactionStatus;

  @Prop({ required: true, min: 1 })
  amount: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  fromUser?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  toUser?: Types.ObjectId;

  @Prop({ trim: true })
  biller?: string;

  @Prop({ trim: true })
  reference?: string;

  @Prop({ trim: true })
  note?: string;

  @Prop({ default: 0 })
  fee: number;

  @Prop({ unique: true, sparse: true })
  idempotencyKey?: string;
}

export const WalletTransactionSchema =
  SchemaFactory.createForClass(WalletTransaction);
