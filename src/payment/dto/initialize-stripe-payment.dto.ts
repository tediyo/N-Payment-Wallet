import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class InitializeStripePaymentDto {
  @IsNumber()
  @Min(1)
  @Max(999999)
  amount: number;

  @IsString()
  currency: string; // e.g., 'usd', 'etb', 'eur'

  @IsString()
  @IsOptional()
  return_url?: string;
}
