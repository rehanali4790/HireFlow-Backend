import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class JobsService {
  constructor(private db: DatabaseService) {}

  async getJobs(employerId?: string) {
    if (employerId) {
      const result = await this.db.query(
        `SELECT j.*, json_build_object('company_name', e.company_name, 'company_logo_url', e.company_logo_url) as employer
         FROM jobs j JOIN employers e ON j.employer_id = e.id
         WHERE j.employer_id = $1 ORDER BY j.created_at DESC`,
        [employerId],
      );
      return result.rows;
    } else {
      const result = await this.db.query(
        `SELECT j.*, json_build_object('company_name', e.company_name, 'company_logo_url', e.company_logo_url) as employer
         FROM jobs j JOIN employers e ON j.employer_id = e.id
         WHERE j.status = 'active' ORDER BY j.created_at DESC`,
      );
      return result.rows;
    }
  }

  async getJob(id: string) {
    const result = await this.db.query(
      `SELECT j.*, json_build_object('company_name', e.company_name, 'company_logo_url', e.company_logo_url, 'company_description', e.company_description) as employer
       FROM jobs j JOIN employers e ON j.employer_id = e.id WHERE j.id = $1`,
      [id],
    );
    return result.rows[0];
  }

  async createJob(employerId: string, data: any) {
    const result = await this.db.query(
      `INSERT INTO jobs (employer_id, title, description, requirements, responsibilities, skills_required, location, work_type, remote_policy, salary_min, salary_max, salary_currency, experience_level, education_required, status, positions_available, application_deadline, settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [
        employerId,
        data.title,
        data.description,
        data.requirements,
        data.responsibilities,
        data.skills_required || [],
        data.location,
        data.work_type || 'full-time',
        data.remote_policy || 'on-site',
        data.salary_min,
        data.salary_max,
        data.salary_currency || 'USD',
        data.experience_level,
        data.education_required,
        data.status || 'draft',
        data.positions_available || 1,
        data.application_deadline,
        data.settings ? JSON.stringify(data.settings) : '{}',
      ],
    );
    return result.rows[0];
  }

  async updateJob(id: string, employerId: string, data: any) {
    const fields = [];
    const values = [];
    let idx = 1;

    const allowedFields = [
      'title',
      'description',
      'requirements',
      'responsibilities',
      'skills_required',
      'location',
      'work_type',
      'remote_policy',
      'salary_min',
      'salary_max',
      'salary_currency',
      'experience_level',
      'education_required',
      'status',
      'positions_available',
      'positions_filled',
      'application_deadline',
      'settings',
    ];

    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        if (key === 'settings') {
          fields.push(`${key} = $${idx++}`);
          values.push(JSON.stringify(data[key]));
        } else {
          fields.push(`${key} = $${idx++}`);
          values.push(data[key]);
        }
      }
    }

    fields.push('updated_at = NOW()');
    values.push(id, employerId);

    const result = await this.db.query(
      `UPDATE jobs SET ${fields.join(', ')} WHERE id = $${idx} AND employer_id = $${idx + 1} RETURNING *`,
      values,
    );

    return result.rows[0];
  }

  async deleteJob(id: string, employerId: string) {
    const result = await this.db.query(
      'DELETE FROM jobs WHERE id = $1 AND employer_id = $2 RETURNING id',
      [id, employerId],
    );
    return result.rows.length > 0;
  }
}
