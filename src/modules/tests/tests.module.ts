import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';
import { AuthModule } from '../auth/auth.module';
import { Test } from './entities/test.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Test]), AuthModule],
  controllers: [TestsController],
  providers: [TestsService],
})
export class TestsModule { }
