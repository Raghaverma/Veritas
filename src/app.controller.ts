import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { HealthCheckResult } from '@nestjs/terminus';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/health')
  healthCheck(): Promise<HealthCheckResult> {
    return this.appService.healthCheck();
  }
}
