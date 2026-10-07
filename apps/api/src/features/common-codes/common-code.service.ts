import { Inject, Injectable } from '@nestjs/common';
import { CommonCodeRepository } from './common-code.repository.js';
import { fail } from '../../shared/errors.js';
@Injectable()
export class CommonCodeService {
  constructor(@Inject(CommonCodeRepository) private readonly repository: CommonCodeRepository) {}
  groups() { return this.repository.groups(); }
  async createGroup(key: string, name: string, actor: string) {
    const result=await this.repository.createGroup(key,name,actor);
    if(!result) fail(409,'COMMON_CODE_GROUP_EXISTS');
    return result;
  }
  async updateGroup(key: string, name: string, version: number, actor: string) {
    const result=await this.repository.updateGroup(key,name,version,actor);
    if(!result) {
      await this.requireGroup(key);
      fail(409,'COMMON_CODE_VERSION_CONFLICT');
    }
    return result;
  }
  private async requireGroup(key: string) {
    if(!await this.repository.group(key)) fail(404,'COMMON_CODE_GROUP_NOT_FOUND');
  }
  async list(key: string) { await this.requireGroup(key); return this.repository.list(key); }
  async create(key: string, code: string, name: string, reference: string | null, actor: string) {
    await this.requireGroup(key);
    if(key==='source' ? !/^[a-z][a-z0-9]{3}$/.test(code) || !reference : reference!==null) fail(400,'VALIDATION_FAILED');
    const result=await this.repository.create(key,code,name,reference,actor);
    if(!result) fail(409,'COMMON_CODE_EXISTS');
    return result;
  }
  async update(key: string, code: string, name: string, version: number, actor: string) {
    await this.requireGroup(key);
    const result=await this.repository.update(key,code,name,version,actor);
    if(!result) {
      if(!await this.repository.find(key,code)) fail(404,'COMMON_CODE_NOT_FOUND');
      fail(409,'COMMON_CODE_VERSION_CONFLICT');
    }
    return result;
  }
}
