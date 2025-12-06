import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskDto {
  @ApiProperty({ example: 'Add user authentication', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: 'Implement JWT-based authentication', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'high', enum: ['low', 'medium', 'high', 'critical'], required: false })
  @IsEnum(['low', 'medium', 'high', 'critical'])
  @IsOptional()
  priority?: string;

  @ApiProperty({
    example: 'NOT_STARTED',
    enum: ['NOT_STARTED', 'SPECIFICATION', 'IN_PROGRESS', 'REVIEW', 'TESTING', 'DONE'],
    required: false
  })
  @IsEnum(['NOT_STARTED', 'SPECIFICATION', 'IN_PROGRESS', 'REVIEW', 'TESTING', 'DONE'])
  @IsOptional()
  status?: string;

  @ApiProperty({ example: 'ABC-123', required: false, description: 'Linear issue ID' })
  @IsString()
  @IsOptional()
  linearId?: string;
}
