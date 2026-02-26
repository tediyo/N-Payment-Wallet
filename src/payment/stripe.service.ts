import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      try {
        this.stripe = new Stripe(secretKey, {
          apiVersion: '2026-01-28.clover',
        });
        this.logger.log('Stripe initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize Stripe:', error);
      }
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not found in environment variables');
    }
  }

  async createCheckoutSession(
    amount: number,
    currency: string,
    userId: string,
    tx_ref: string,
    userEmail?: string,
    successUrl?: string,
    cancelUrl?: string,
  ) {
    if (!this.stripe) {
      throw new BadRequestException(
        'Stripe not initialized. Check STRIPE_SECRET_KEY in .env',
      );
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: 'Wallet Recharge',
              description: `Recharge wallet with ${amount} ${currency.toUpperCase()}`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl || `${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}/payment/cancel`,
      metadata: {
        userId,
        tx_ref,
      },
      ...(userEmail ? { customer_email: userEmail } : {}),
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async verifyPayment(sessionId: string) {
    if (!this.stripe) {
      throw new BadRequestException(
        'Stripe not initialized. Check STRIPE_SECRET_KEY in .env',
      );
    }

    const session = await this.stripe.checkout.sessions.retrieve(sessionId);

    return {
      success: session.payment_status === 'paid',
      sessionId: session.id,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency,
      customerEmail: session.customer_email,
      metadata: session.metadata,
    };
  }

  async handleWebhook(payload: any, signature: string) {
    if (!this.stripe) {
      throw new BadRequestException(
        'Stripe not initialized. Check STRIPE_SECRET_KEY in .env',
      );
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    // Webhook secret is optional - if not set, skip verification (not recommended for production)
    if (!webhookSecret) {
      this.logger.warn(
        'STRIPE_WEBHOOK_SECRET not set - skipping signature verification',
      );
      // Parse event without verification (development only)
      const event = JSON.parse(payload.toString());
      return this.processWebhookEvent(event);
    }

    let event;
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
      return this.processWebhookEvent(event);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Webhook signature verification failed');
    }
  }

  // Helper method to process webhook events
  private processWebhookEvent(event: any) {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        return {
          type: 'checkout.session.completed',
          sessionId: session.id,
          paymentStatus: session.payment_status,
          metadata: session.metadata,
        };
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        return {
          type: 'payment_intent.succeeded',
          paymentIntentId: paymentIntent.id,
        };
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
        return { type: event.type, handled: false };
    }
  }
}
