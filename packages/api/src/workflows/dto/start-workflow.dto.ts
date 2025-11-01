import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartWorkflowDto {
  @ApiProperty({ example: 'task-id-123' })
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @ApiProperty({ example: 'project-id-123' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ example: 'user-id-123', required: false })
  @IsString()
  @IsOptional()
  userId?: string;
}

