import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserDocument } from '../auth/schemas/user.schema';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendPaymentSuccessEmail(
    user: UserDocument,
    amount: number,
    currency: string,
    tx_ref: string,
  ) {
    const emailConfig = {
      from: this.configService.get('EMAIL_FROM') || 'noreply@walletapp.com',
      to: user.email,
      subject: 'Payment Successful - Wallet Recharge',
      html: this.getPaymentSuccessEmailTemplate(
        user.name,
        amount,
        currency,
        tx_ref,
      ),
    };

    // TODO: Replace with actual email sending (nodemailer, SendGrid, etc.)
    // For now, log the email
    this.logger.log(`[Email] Payment Success Email would be sent:`, {
      to: emailConfig.to,
      subject: emailConfig.subject,
      tx_ref,
    });

    // Uncomment when nodemailer is installed:
    /*
    try {
      const transporter = nodemailer.createTransport({
        host: this.configService.get('SMTP_HOST'),
        port: this.configService.get('SMTP_PORT'),
        secure: false,
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
      });

      await transporter.sendMail(emailConfig);
      this.logger.log(`Payment success email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
    }
    */

    return emailConfig;
  }

  private getPaymentSuccessEmailTemplate(
    userName: string,
    amount: number,
    currency: string,
    tx_ref: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .amount { font-size: 24px; font-weight: bold; color: #4CAF50; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Successful!</h1>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Your wallet has been successfully recharged.</p>
            <p><strong>Amount:</strong> <span class="amount">${amount} ${currency}</span></p>
            <p><strong>Transaction Reference:</strong> ${tx_ref}</p>
            <p>Thank you for using our service!</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
