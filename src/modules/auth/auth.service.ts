import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private db: DatabaseService,
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
    const existing = await this.db.query(
      'SELECT id FROM employers WHERE contact_email = $1',
      [email],
    );

    if (existing.rows.length > 0) {
      throw new Error('An account with this email already exists');
    }

    const passwordHash = this.hashPassword(password);
    const token = this.generateToken();

    const result = await this.db.query(
      `INSERT INTO employers (company_name, contact_email, password_hash, auth_token, user_id)
       VALUES ($1, $2, $3, $4, gen_random_uuid()) RETURNING id, company_name, contact_email`,
      [companyName, email, passwordHash, token],
    );

    return { employer: result.rows[0], token };
  }

  async login(email: string, password: string) {
    const passwordHash = this.hashPassword(password);
    const result = await this.db.query(
      'SELECT id, company_name, contact_email FROM employers WHERE contact_email = $1 AND password_hash = $2',
      [email, passwordHash],
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const token = this.generateToken();
    await this.db.query('UPDATE employers SET auth_token = $1 WHERE id = $2', [
      token,
      result.rows[0].id,
    ]);

    return { employer: result.rows[0], token };
  }

  async logout(employerId: string) {
    await this.db.query('UPDATE employers SET auth_token = NULL WHERE id = $1', [
      employerId,
    ]);
    return { success: true };
  }

  async getEmployerByToken(token: string) {
    const result = await this.db.query(
      'SELECT * FROM employers WHERE auth_token = $1',
      [token],
    );
    return result.rows[0] || null;
  }

  async getSession(token: string) {
    const employer = await this.getEmployerByToken(token);
    if (!employer) {
      throw new Error('Not authenticated');
    }
    const { password_hash, auth_token, ...safe } = employer;
    return { employer: safe };
  }
}
