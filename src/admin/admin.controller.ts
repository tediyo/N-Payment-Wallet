import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard) // In production, add AdminGuard
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('users')
    async getUsers() {
        return this.adminService.listUsers();
    }

    @Post('users/:id/freeze')
    async freeze(@Param('id') id: string) {
        return this.adminService.freezeUser(id);
    }

    @Post('users/:id/unfreeze')
    async unfreeze(@Param('id') id: string) {
        return this.adminService.unfreezeUser(id);
    }

    @Post('users/:id/adjust')
    async adjust(
        @Param('id') id: string,
        @Body('amount') amount: number,
        @Body('reason') reason: string,
    ) {
        return this.adminService.adjustBalance(id, amount, reason);
    }
}
