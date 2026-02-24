import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class PayBillDto {
  @IsNotEmpty()
  biller: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  reference?: string;
}
