import { IsNotEmpty, IsString } from 'class-validator';

export class ScanQrDto {
    @IsNotEmpty()
    @IsString()
    payload: string;

    @IsNotEmpty()
    @IsString()
    signature: string;

    @IsNotEmpty()
    @IsString()
    pin: string;
}
