import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './notification.schema';

@Injectable()
export class NotificationService {
    constructor(
        @InjectModel(Notification.name)
        private readonly notificationModel: Model<NotificationDocument>,
    ) { }

    async create(userId: string, title: string, message: string, data?: any) {
        return this.notificationModel.create({
            userId: new Types.ObjectId(userId),
            title,
            message,
            data,
        });
    }

    async list(userId: string) {
        return this.notificationModel
            .find({ userId: new Types.ObjectId(userId) })
            .sort({ createdAt: -1 })
            .limit(50)
            .exec();
    }

    async markAsRead(notificationId: string) {
        return this.notificationModel.findByIdAndUpdate(notificationId, { isRead: true }).exec();
    }
}
