import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { Note, NoteDocument } from './schemas/note.schema';

@Injectable()
export class NotesService {
  constructor(
    @InjectModel(Note.name) private readonly noteModel: Model<NoteDocument>,
  ) {}

  async create(dto: CreateNoteDto): Promise<Note> {
    const note = new this.noteModel(dto);
    return note.save();
  }

  async findAll(): Promise<Note[]> {
    return this.noteModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Note> {
    const note = await this.noteModel.findById(id).exec();
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }

  async update(id: string, dto: UpdateNoteDto): Promise<Note> {
    const note = await this.noteModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.noteModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Note not found');
    }
    return { deleted: true };
  }
}
