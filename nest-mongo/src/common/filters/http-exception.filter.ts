import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

type ErrorResponse = {
  statusCode: number;
  message: string;
  errors?: string[];
  details?: unknown;
  path: string;
  timestamp: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | undefined;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const responsePayload = payload as Record<string, unknown>;
        const payloadMessage = responsePayload.message;
        if (typeof payloadMessage === 'string') {
          message = payloadMessage;
        } else if (Array.isArray(payloadMessage)) {
          message = 'Validation failed';
          errors = payloadMessage.map(String);
        }
        if (Array.isArray(responsePayload.errors)) {
          errors = responsePayload.errors.map(String);
        }
        if (responsePayload.details !== undefined) {
          details = responsePayload.details;
        }
      }
    } else {
      // eslint-disable-next-line no-console
      console.error(exception);
    }

    const body: ErrorResponse = {
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(errors ? { errors } : {}),
      ...(details !== undefined ? { details } : {}),
    };

    response.status(status).json(body);
  }
}
