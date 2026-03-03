import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TransferDto {
  @IsOptional()
  @IsString()
  toUserId?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @IsNotEmpty()
  @IsString()
  pin: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
