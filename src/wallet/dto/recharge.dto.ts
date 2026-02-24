import { IsNumber, Min } from 'class-validator';

export class RechargeDto {
  @IsNumber()
  @Min(1)
  amount: number;
}
