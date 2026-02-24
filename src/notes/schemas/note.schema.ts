import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NoteDocument = HydratedDocument<Note>;

@Schema({ timestamps: true })
export class Note {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '', trim: true })
  content: string;
}

export const NoteSchema = SchemaFactory.createForClass(Note);
