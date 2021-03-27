"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Origin;
(function (Origin) {
    Origin[Origin["Begin"] = 0] = "Begin";
    Origin[Origin["End"] = 1] = "End";
    Origin[Origin["Current"] = 2] = "Current";
})(Origin = exports.Origin || (exports.Origin = {}));
class BufferReader {
    constructor(buffer) {
        this.position = 0;
        this.length = 0;
        this.bits = 0;
        this.bitsCount = 0;
        this.buffer = buffer;
        this.length = buffer.byteLength;
    }
    get Position() {
        return this.position;
    }
    get Length() {
        return this.length;
    }
    Align(length) {
        if (this.position % length !== 0) {
            this.position = this.position + (length - (this.position % length));
        }
    }
    ReadString(length) {
        if (length) {
            const v = this.buffer.toString('utf-8', this.position, this.position + length);
            this.position += length;
            return v;
        }
        else {
            const start = this.position;
            for (let i = 0; i < 0xffff; i++) {
                const b = this.buffer.readUInt8(this.position);
                this.position++;
                if (b === 0) {
                    break;
                }
            }
            return this.buffer.toString('utf-8', start, this.position - 1);
        }
    }
    ReadDword() {
        const value = this.buffer.readUInt32LE(this.position);
        this.position += 4;
        return value;
    }
    ReadInt() {
        const value = this.buffer.readInt32LE(this.position);
        this.position += 4;
        return value;
    }
    ReadByte() {
        const value = this.buffer.readUInt8(this.position);
        this.position++;
        return value;
    }
    ReadWord() {
        const value = this.buffer.readUInt16LE(this.position);
        this.position += 2;
        return value;
    }
    ReadShort() {
        const value = this.buffer.readInt16LE(this.position);
        this.position += 2;
        return value;
    }
    ReadBytes(length) {
        const result = this.buffer.slice(this.position, this.position + length);
        this.position += length;
        return result;
    }
    ReadFloat() {
        const value = this.buffer.readFloatLE(this.position);
        this.position += 4;
        return value;
    }
    ReadBit() {
        this.ensure(1);
        const result = this.bits & 1;
        this.bits = this.bits >> 1;
        this.bitsCount -= 1;
        return result;
    }
    ReadBits(count) {
        this.ensure(count);
        const result = this.bits & ((1 << count) - 1);
        this.bits = this.bits >> count;
        this.bitsCount -= count;
        return result;
    }
    ReadUnary() {
        let n = 0;
        while (this.ReadBit() === 1) {
            n++;
        }
        return n;
    }
    Seek(length, seekOrigin) {
        let origin;
        switch (seekOrigin) {
            case Origin.Begin:
                origin = 0;
                break;
            case Origin.Current:
                origin = this.position;
                break;
            case Origin.End:
                origin = this.length - 1;
                length = 0 - length;
                break;
            default:
                throw Error('Unknow');
        }
        this.position = origin + length;
    }
    Copy(target, targetStart, length) {
        this.buffer.copy(target, targetStart, this.position, this.position + length);
        this.position += length;
    }
    Overflow() {
        return this.position > this.length;
    }
    ensure(count) {
        while (this.bitsCount < count) {
            this.bits = this.bits | (this.ReadByte() << this.bitsCount);
            this.bitsCount += 8;
        }
    }
}
exports.BufferReader = BufferReader;
