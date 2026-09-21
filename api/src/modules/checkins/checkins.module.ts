import { Module } from '@nestjs/common';
import { CheckInsController } from './checkins.controller';
import { CheckInsService } from './checkins.service';

@Module({
  controllers: [CheckInsController],
  providers: [CheckInsService],
})
export class CheckInsModule {}
