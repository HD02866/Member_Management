import { IsString, IsOptional, IsArray, IsEnum, IsNotEmpty, MaxLength, IsNumber } from 'class-validator';

export class StartConversationDto {
  @IsString()
  @IsNotEmpty()
  recipientUserId: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  initialMessage?: string;
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  @IsArray()
  attachments?: {
    url: string;
    mimeType: string;
    sizeBytes: number;
    filename: string;
  }[];
}

export class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;
}
