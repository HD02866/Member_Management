import { IsNotEmpty, IsUUID } from 'class-validator';

export class ApplyMembershipDto {
  @IsUUID('4', { message: 'Must provide a valid UUID membership plan ID' })
  @IsNotEmpty({ message: 'Membership plan ID is required' })
  planId: string;
}
