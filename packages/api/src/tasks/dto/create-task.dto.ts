import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({ example: 'Add user authentication' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Implement JWT-based authentication' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'project-id-123' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ example: 'high', enum: ['low', 'medium', 'high', 'critical'] })
  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority: string;

  @ApiProperty({ example: 'ABC-123', required: false, description: 'Linear issue ID' })
  @IsString()
  @IsOptional()
  linearId?: string;
}

