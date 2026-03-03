import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ unique: true, sparse: true, trim: true })
  phoneNumber?: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop()
  walletPinHash?: string;

  @Prop({ default: 0, min: 0 })
  balance: number;

  @Prop({ default: false })
  isFrozen: boolean;

  @Prop({ default: 50000 })
  dailyLimit: number;

  @Prop({ default: 0 })
  spentToday: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
