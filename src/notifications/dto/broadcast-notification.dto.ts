import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class BroadcastNotificationDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(150)
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Message is required' })
  @MaxLength(1000)
  message: string;

  @IsString()
  @IsOptional()
  actionUrl?: string;
}
