import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class InitializePaymentDto {
  @IsNumber()
  @Min(1)
  @Max(999999)
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
