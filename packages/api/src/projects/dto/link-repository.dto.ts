import { IsString, IsNotEmpty, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkRepositoryDto {
  @ApiProperty({
    example: 'https://github.com/facebook/react',
    description: 'Repository URL (GitHub)'
  })
  @IsUrl()
  @IsNotEmpty()
  repositoryUrl: string;
}
