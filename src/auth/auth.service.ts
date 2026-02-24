import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { User, UserDocument } from './schemas/user.schema';

type SafeUser = {
  id: string;
  name: string;
  email: string;
  balance: number;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.userModel.findOne({ email }).exec();
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({
      name: dto.name.trim(),
      email,
      passwordHash,
      balance: 0,
    });

    return this.createAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createAuthResponse(user);
  }

  async validateUserById(userId: string) {
    return this.userModel.findById(userId).exec();
  }

  private createAuthResponse(user: UserDocument) {
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      token,
      user: this.toSafeUser(user),
    };
  }

  private toSafeUser(user: UserDocument): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      balance: user.balance,
    };
  }
}
