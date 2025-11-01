import { IsString, IsNotEmpty, IsUrl, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'my-awesome-app' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'My awesome application' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'https://github.com/org/repo' })
  @IsUrl()
  @IsNotEmpty()
  repository: string;

  @ApiProperty({ example: { version: '1.0', project: {}, vcs: {}, commands: {}, ci: {}, code_agent: {}, quality_gates: {}, notifications: {}, files: {} } })
  @IsObject()
  @IsNotEmpty()
  config: Record<string, any>;

  @ApiProperty({ example: '/path/to/workspace', required: false })
  @IsString()
  @IsOptional()
  workspacePath?: string;
}

