import { IsMongoId, IsNumber, Min } from 'class-validator';

export class TransferDto {
  @IsMongoId()
  toUserId: string;

  @IsNumber()
  @Min(1)
  amount: number;
}
