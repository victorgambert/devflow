import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateIntegrationDto {
  @ApiPropertyOptional({
    description: 'Figma file key (from URL: figma.com/file/{fileKey}/...)',
    example: 'ABC123xyz',
  })
  @IsOptional()
  @IsString()
  figmaFileKey?: string;

  @ApiPropertyOptional({
    description: 'Figma node ID (specific frame/component)',
    example: '1234:5678',
  })
  @IsOptional()
  @IsString()
  figmaNodeId?: string;

  @ApiPropertyOptional({
    description: 'Sentry project slug',
    example: 'my-project',
  })
  @IsOptional()
  @IsString()
  sentryProjectSlug?: string;

  @ApiPropertyOptional({
    description: 'Sentry organization slug',
    example: 'my-org',
  })
  @IsOptional()
  @IsString()
  sentryOrgSlug?: string;

  @ApiPropertyOptional({
    description: 'GitHub repository for issues (format: owner/repo)',
    example: 'acme/my-project',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[^/]+\/[^/]+$/, {
    message: 'githubIssuesRepo must be in format: owner/repo',
  })
  githubIssuesRepo?: string;
}
