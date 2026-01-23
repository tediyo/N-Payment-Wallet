import { IsNumber, IsString, Min } from 'class-validator';

export class InitializeStripePaymentDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  currency: string; // e.g., 'usd', 'etb', 'eur'
}
