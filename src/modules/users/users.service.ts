import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  /**
   * Get user by ID
   */
  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['recycleActions', 'rewards'],
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  /**
   * Get user profile (without sensitive data)
   */
  async getProfile(userId: string): Promise<Partial<User>> {
    const user = await this.findOne(userId);
    const { passwordHash, ...profile } = user;
    return profile;
  }
}
