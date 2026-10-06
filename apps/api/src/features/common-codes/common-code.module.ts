import { Module, type DynamicModule } from '@nestjs/common';
import { CommonCodeController } from './common-code.controller.js';
import { CommonCodeService } from './common-code.service.js';
import { CommonCodeRepository } from './common-code.repository.js';
import { TypeOrmCommonCodeRepository } from '../../persistence/common-code.repository.js';
import { AdminGuard, HTTP_OPTIONS, type HttpOptions } from '../../http/auth.guard.js';
@Module({})
export class CommonCodeModule {
  static register(persistence: DynamicModule, options: HttpOptions): DynamicModule {
    return { module: CommonCodeModule, imports: [persistence], controllers: [CommonCodeController],
      providers: [CommonCodeService,AdminGuard,
        { provide: CommonCodeRepository, useClass: TypeOrmCommonCodeRepository },
        { provide: HTTP_OPTIONS, useValue: options }], exports: [CommonCodeRepository] };
  }
}
