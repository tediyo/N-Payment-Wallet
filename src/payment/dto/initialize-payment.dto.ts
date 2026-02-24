import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class InitializePaymentDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  callback_url: string;

  @IsString()
  @IsNotEmpty()
  return_url: string;
}
