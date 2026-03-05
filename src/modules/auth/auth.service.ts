import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employer } from './entities/employer.entity';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Employer)
    private employerRepository: Repository<Employer>,
    private config: ConfigService,
  ) {}

  private hashPassword(password: string): string {
    const secret = this.config.get('TOKEN_SECRET', 'hireflow');
    return crypto
      .createHash('sha256')
      .update(password + secret)
      .digest('hex');
  }

  private generateToken(): string {
    return crypto.randomBytes(48).toString('hex');
  }

  async signup(email: string, password: string, companyName: string) {
    const existing = await this.employerRepository.findOne({
      where: { contactEmail: email },
    });

    if (existing) {
      throw new Error('An account with this email already exists');
    }

    const passwordHash = this.hashPassword(password);
    const token = this.generateToken();

    const employer = this.employerRepository.create({
      companyName,
      contactEmail: email,
      passwordHash,
      authToken: token,
    });

    const saved = await this.employerRepository.save(employer);
    const { passwordHash: _, authToken: __, ...safe } = saved;

    return { employer: safe, token };
  }

  async login(email: string, password: string) {
    const passwordHash = this.hashPassword(password);
    const employer = await this.employerRepository.findOne({
      where: { contactEmail: email, passwordHash },
    });

    if (!employer) {
      throw new Error('Invalid email or password');
    }

    const token = this.generateToken();
    employer.authToken = token;
    await this.employerRepository.save(employer);

    const { passwordHash: _, authToken: __, ...safe } = employer;
    return { employer: safe, token };
  }

  async logout(employerId: string) {
    await this.employerRepository.update(employerId, { authToken: null });
    return { success: true };
  }

  async getEmployerByToken(token: string) {
    return await this.employerRepository.findOne({
      where: { authToken: token },
    });
  }

  async getSession(token: string) {
    const employer = await this.getEmployerByToken(token);
    if (!employer) {
      throw new Error('Not authenticated');
    }
    const { passwordHash, authToken, ...safe } = employer;
    return { employer: safe };
  }
}
