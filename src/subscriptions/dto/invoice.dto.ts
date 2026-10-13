import {
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSaasInvoiceDto {
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @IsNotEmpty()
  amount: string | number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsNotEmpty()
  dueDate: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SettleSaasInvoiceDto {
  @IsString()
  @IsNotEmpty()
  paymentReference: string;

  @IsString()
  @IsOptional()
  paidDate?: string;
}
