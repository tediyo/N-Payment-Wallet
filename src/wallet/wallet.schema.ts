import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WalletTransactionDocument = HydratedDocument<WalletTransaction>;

export type WalletTransactionType = 'recharge' | 'transfer' | 'bill';

@Schema({ timestamps: true })
export class WalletTransaction {
  @Prop({ required: true, enum: ['recharge', 'transfer', 'bill'] })
  type: WalletTransactionType;

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
}

export const WalletTransactionSchema =
  SchemaFactory.createForClass(WalletTransaction);
