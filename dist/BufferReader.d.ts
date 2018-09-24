/// <reference types="node" />
export declare enum Origin {
    Begin = 0,
    End = 1,
    Current = 2
}
export declare class BufferReader {
    readonly Position: number;
    readonly Length: number;
    private buffer;
    private position;
    private length;
    private bits;
    private bitsCount;
    constructor(buffer: Buffer);
    Align(length: number): void;
    ReadString(length?: number): string;
    ReadDword(): number;
    ReadInt(): number;
    ReadByte(): number;
    ReadWord(): number;
    ReadBytes(length: number): Buffer;
    ReadFloat(): number;
    ReadBit(): number;
    ReadBits(count: number): number;
    ReadUnary(): number;
    Seek(length: number, seekOrigin: Origin): void;
    Copy(target: Buffer, targetStart: number, length: number): void;
    Overflow(): boolean;
    private ensure;
}
