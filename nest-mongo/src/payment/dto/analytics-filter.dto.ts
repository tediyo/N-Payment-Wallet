import { IsOptional, IsString } from 'class-validator';

export class AnalyticsFilterDto {
  @IsOptional()
  @IsString()
  startDate?: string; // ISO date string

  @IsOptional()
  @IsString()
  endDate?: string; // ISO date string
}
