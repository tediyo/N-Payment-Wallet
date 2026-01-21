import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PayBillDto } from './dto/pay-bill.dto';
import { RechargeDto } from './dto/recharge.dto';
import { TransferDto } from './dto/transfer.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.walletService.getWallet(user.userId);
  }

  @Post('recharge')
  recharge(@CurrentUser() user: AuthUser, @Body() dto: RechargeDto) {
    return this.walletService.recharge(user.userId, dto);
  }

  @Post('transfer')
  transfer(@CurrentUser() user: AuthUser, @Body() dto: TransferDto) {
    return this.walletService.transfer(user.userId, dto);
  }

  @Post('pay-bill')
  payBill(@CurrentUser() user: AuthUser, @Body() dto: PayBillDto) {
    return this.walletService.payBill(user.userId, dto);
  }

  @Get('transactions')
  transactions(@CurrentUser() user: AuthUser) {
    return this.walletService.listTransactions(user.userId);
  }
}
