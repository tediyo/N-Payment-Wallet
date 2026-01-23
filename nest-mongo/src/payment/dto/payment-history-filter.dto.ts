import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum PaymentStatusFilter {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export class PaymentHistoryFilterDto {
  @IsOptional()
  @IsEnum(PaymentStatusFilter)
  status?: PaymentStatusFilter;

  @IsOptional()
  @IsString()
  startDate?: string; // ISO date string

  @IsOptional()
  @IsString()
  endDate?: string; // ISO date string

  @IsOptional()
  @IsString()
  page?: string; // Page number as string (will be converted)

  @IsOptional()
  @IsString()
  limit?: string; // Limit as string (will be converted)
}
