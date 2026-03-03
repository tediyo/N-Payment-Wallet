import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    ],
    providers: [SecurityService],
    controllers: [SecurityController],
    exports: [SecurityService],
})
export class SecurityModule { }
