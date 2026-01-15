import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: 'FirebaseService',
          useValue: {},
        },
      ],
    })
      .overrideProvider(AppService)
      .useValue({
        healthCheck: jest.fn().mockResolvedValue({
          status: 'ok',
          info: {},
          error: {},
          details: {},
        }),
      })
      .compile();

    appController = app.get<AppController>(AppController);
  });

  describe('healthCheck', () => {
    it('should be defined', () => {
      expect(appController.healthCheck).toBeDefined();
    });
    it('should return health check result', async () => {
      const result = await appController.healthCheck();
      expect(result).toBeDefined();

      expect(result.status).toBe('ok');
    });
  });
});
