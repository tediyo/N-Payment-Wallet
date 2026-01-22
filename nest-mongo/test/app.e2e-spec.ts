import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { Connection } from 'mongoose';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Wallet (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;

  beforeAll(async () => {
    process.env.MONGO_URI = 'mongodb://localhost:27017/nest-mongo-test';
    process.env.JWT_SECRET = 'test-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: (errors) =>
          new BadRequestException({
            message: 'Validation failed',
            errors: errors.flatMap((error) =>
              Object.values(error.constraints ?? {}),
            ),
          }),
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    connection = moduleFixture.get<Connection>(getConnectionToken());
  });

  beforeEach(async () => {
    await connection.dropDatabase();
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await app.close();
  });

  it('registers, authenticates, and performs wallet actions', async () => {
    const registerA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Ali', email: 'ali@test.com', password: '123456' })
      .expect(201);

    const tokenA = registerA.body.token as string;
    const userAId = registerA.body.user.id as string;

    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Bora', email: 'bora@test.com', password: '123456' })
      .expect(201);

    const userBId = registerB.body.user.id as string;

    await request(app.getHttpServer())
      .post('/wallet/recharge')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ amount: 200 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/wallet/transfer')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toUserId: userBId, amount: 50 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/wallet/pay-bill')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ biller: 'Electricity', amount: 30, reference: 'Jan-2026' })
      .expect(201);

    const me = await request(app.getHttpServer())
      .get('/wallet/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(me.body).toMatchObject({ id: userAId, balance: 120 });

    const tx = await request(app.getHttpServer())
      .get('/wallet/transactions')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(tx.body).toHaveLength(3);
  });

  it('returns validation errors for invalid recharge', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Sam', email: 'sam@test.com', password: '123456' })
      .expect(201);

    const token = register.body.token as string;

    const response = await request(app.getHttpServer())
      .post('/wallet/recharge')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 0 })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      message: 'Validation failed',
    });
    expect(Array.isArray(response.body.errors)).toBe(true);
  });
});
