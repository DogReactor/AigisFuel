"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BufferReader_1 = require("./BufferReader");
class DefaultAL {
    constructor(buffer) {
        this.Buffer = buffer;
        this.Head = buffer.toString('utf-8', 0, 4);
    }
}
exports.DefaultAL = DefaultAL;
class ALLZ {
    constructor(buffer) {
        const self = this;
        this.Buffer = buffer;
        const br = new BufferReader_1.BufferReader(buffer);
        this.Head = br.ReadString(4);
        this.Vers = br.ReadByte();
        this.MinBitsLength = br.ReadByte();
        this.MinBitsOffset = br.ReadByte();
        this.MinBitsLiteral = br.ReadByte();
        this.DstSize = br.ReadDword();
        this.Dst = Buffer.alloc(this.DstSize);
        this.Dst.fill(0);
        this.Size = 0;
        let dstOffset = 0;
        copyLiteral(readControlLiteral());
        let wordOffset = readControlOffset();
        let wordLength = readControlLength();
        let literalLength = 0;
        let finishFlag = 'overflow';
        while (!br.Overflow()) {
            if (dstOffset + wordLength >= this.DstSize) {
                finishFlag = 'word';
                break;
            }
            if (br.ReadBit() === 0) {
                literalLength = readControlLiteral();
                if (dstOffset + wordLength + literalLength >= this.DstSize) {
                    finishFlag = 'literal';
                    break;
                }
                copyWord(wordOffset, wordLength);
                copyLiteral(literalLength);
                wordOffset = readControlOffset();
                wordLength = readControlLength();
            }
            else {
                copyWord(wordOffset, wordLength);
                wordOffset = readControlOffset();
                wordLength = readControlLength();
            }
        }
        switch (finishFlag) {
            case 'word':
                copyWord(wordOffset, wordLength);
                break;
            case 'literal':
                copyWord(wordOffset, wordLength);
                copyLiteral(literalLength);
                break;
            case 'overflow':
                throw Error('Overflow in ALLZ');
        }
        function readControl(minBits) {
            const u = br.ReadUnary();
            const n = br.ReadBits(u + minBits);
            if (u > 0) {
                return n + (((1 << u) - 1) << minBits);
            }
            else {
                return n;
            }
        }
        function readControlLength() {
            return 3 + readControl(self.MinBitsLength);
        }
        function readControlOffset() {
            return -1 - readControl(self.MinBitsOffset);
        }
        function readControlLiteral() {
            return 1 + readControl(self.MinBitsLiteral);
        }
        function copyWord(offset, length) {
            let trueOffset = offset;
            for (let i = 0; i < length; i++) {
                if (offset < 0) {
                    trueOffset = dstOffset + offset;
                }
                self.Dst.writeUInt8(self.Dst[trueOffset], dstOffset);
                dstOffset++;
            }
        }
        function copyLiteral(control) {
            br.Copy(self.Dst, dstOffset, control);
            dstOffset += control;
        }
    }
    Package() {
        return this.Buffer;
    }
}
exports.ALLZ = ALLZ;
class ALRD {
    constructor(buffer) {
        this.Buffer = buffer;
        const br = new BufferReader_1.BufferReader(buffer);
        this.Head = br.ReadString(4);
        if (this.Head !== 'ALRD') {
            throw Error('Not a ALRD');
        }
        this.Vers = br.ReadWord();
        this.Count = br.ReadWord();
        this.Size = br.ReadWord();
        this.Headers = [];
        for (let i = 0; i < this.Count; i++) {
            const header = new ALRD.Header();
            header.Offset = br.ReadWord();
            header.Type = br.ReadByte();
            const emptyLength = br.ReadByte();
            const lengthEN = br.ReadByte();
            const lengthJP = br.ReadByte();
            header.NameEN = br.ReadString();
            header.NameJP = br.ReadString();
            br.Align(4);
            br.Seek(emptyLength, BufferReader_1.Origin.Current);
            br.Align(4);
            this.Headers.push(header);
        }
    }
}
exports.ALRD = ALRD;
(function (ALRD) {
    class Header {
        constructor() {
            this.Offset = 0;
            this.Type = 0;
            this.NameEN = '';
            this.NameJP = '';
        }
    }
    ALRD.Header = Header;
})(ALRD = exports.ALRD || (exports.ALRD = {}));
class ALTB {
    constructor(buffer) {
        this.StringField = {};
        this.StringOffsetList = [];
        this.Headers = [];
        this.Contents = [];
        this.Buffer = buffer;
        const br = new BufferReader_1.BufferReader(buffer);
        this.Head = br.ReadString(4);
        this.Vers = br.ReadByte();
        this.Form = br.ReadByte();
        this.Count = br.ReadWord();
        this.Unknown1 = br.ReadWord();
        this.TableEntry = br.ReadWord();
        this.Size = br.ReadDword();
        if (this.Form === 0x14 || this.Form === 0x1e) {
            this.StringFieldSizePosition = br.Position;
            this.StringFieldSize = br.ReadDword();
            this.StringFieldEntry = br.ReadDword();
            this.StringField = {};
            this.StringOffsetList = [];
            const nowPosition = br.Position;
            br.Seek(this.StringFieldEntry, BufferReader_1.Origin.Begin);
            while (br.Position < this.StringFieldEntry + this.StringFieldSize) {
                const offset = br.Position - this.StringFieldEntry;
                const s = br.ReadString();
                this.StringField[offset] = s;
                this.StringOffsetList.push(offset);
            }
            br.Seek(nowPosition, BufferReader_1.Origin.Begin);
        }
        if (this.Form === 0x1e) {
            this.NameStartAddressOffset = br.Position;
            this.NameStartAddress = br.ReadDword();
        }
        this.Label = br.ReadString(4);
        const alrdBuffer = br.ReadBytes(this.TableEntry - br.Position);
        br.Seek(this.TableEntry, BufferReader_1.Origin.Begin);
        const alrd = new ALRD(alrdBuffer);
        this.Headers = alrd.Headers;
        for (let i = 0; i < this.Count; i++) {
            br.Seek(this.TableEntry + this.Size * i, BufferReader_1.Origin.Begin);
            const row = {};
            for (let j = 0; j < alrd.Headers.length; j++) {
                const header = this.Headers[j];
                const offset = br.Position;
                let v = null;
                switch (header.Type) {
                    case 1:
                        v = buffer.readInt32LE(offset + header.Offset);
                        break;
                    case 4:
                        v = buffer.readFloatLE(offset + header.Offset);
                        break;
                    case 5:
                        v = buffer.readUInt8(offset + header.Offset);
                        break;
                    case 0x20:
                        const stringOffset = buffer.readUInt32LE(offset + header.Offset);
                        v = this.StringField[stringOffset];
                        break;
                }
                row[header.NameEN] = v;
            }
            this.Contents.push(row);
        }
        if (this.NameStartAddress !== undefined) {
            br.Seek(this.NameStartAddress, BufferReader_1.Origin.Begin);
            this.UnknownNames = br.ReadDword();
            this.NameLength = br.ReadByte();
            this.Name = br.ReadString(this.NameLength);
        }
    }
}
exports.ALTB = ALTB;
class ALAR {
    constructor(buffer) {
        this.Files = [];
        this.TocOffsetList = [];
        this.Buffer = buffer;
        const br = new BufferReader_1.BufferReader(buffer);
        this.Head = br.ReadString(4);
        this.Files = [];
        this.TocOffsetList = [];
        this.Vers = br.ReadByte();
        this.Unknown = br.ReadByte();
        if (this.Vers !== 2 && this.Vers !== 3) {
            throw Error('ALAR VERSION ERROR');
        }
        if (this.Vers === 2) {
            this.Count = br.ReadWord();
            this.UnknownBytes = br.ReadBytes(8);
        }
        else {
            this.Count = br.ReadWord();
            this.Unknown1 = br.ReadWord();
            this.Unknown2 = br.ReadWord();
            this.UnknownBytes = br.ReadBytes(4);
            this.DataOffset = br.ReadWord();
            for (let i = 0; i < this.Count; i++) {
                this.TocOffsetList.push(br.ReadWord());
            }
        }
        br.Align(4);
        for (let i = 0; i < this.Count; i++) {
            const entry = this.parseTocEntry(br);
            entry.Content = parseObject(buffer.slice(entry.Address, entry.Address + entry.Size));
            this.Files.push(entry);
        }
        if (this.Vers === 2) {
            this.DataOffsetByData = this.Files[0].Address - 0x22;
        }
        if (this.Vers === 3) {
            this.DataOffsetByData = this.Files[0].Address;
        }
    }
    parseTocEntry(br) {
        const entry = new ALAR.Entry();
        if (this.Vers === 2) {
            entry.Index = br.ReadWord();
            entry.Unknown1 = br.ReadWord();
            entry.Address = br.ReadDword();
            entry.Size = br.ReadDword();
            entry.Unknown2 = br.ReadBytes(4);
            const p = br.Position;
            br.Seek(entry.Address - 0x22, BufferReader_1.Origin.Begin);
            entry.Name = br.ReadString();
            br.Seek(entry.Address - 0x02, BufferReader_1.Origin.Begin);
            entry.Unknown3 = br.ReadWord();
            br.Seek(p, BufferReader_1.Origin.Begin);
        }
        else {
            entry.Index = br.ReadWord();
            entry.Unknown1 = br.ReadWord();
            entry.Address = br.ReadDword();
            entry.Size = br.ReadDword();
            entry.Unknown2 = br.ReadBytes(6);
            entry.Name = br.ReadString();
            br.Align(4);
        }
        return entry;
    }
}
exports.ALAR = ALAR;
(function (ALAR) {
    class Entry {
        constructor() {
            this.Index = 0;
            this.Unknown1 = 0;
            this.Address = 0;
            this.Offset = 0;
            this.Size = 0;
            this.Unknown2 = Buffer.alloc(0);
            this.Name = '';
            this.Unknown3 = 0;
            this.ParsedContent = new Object();
        }
    }
    ALAR.Entry = Entry;
})(ALAR = exports.ALAR || (exports.ALAR = {}));
class ALTX {
    constructor(buffer) {
        this.Sprites = {};
        this.Image = {};
        this.Width = 0;
        this.Height = 0;
        this.Buffer = buffer;
        const br = new BufferReader_1.BufferReader(buffer);
        const startOffset = br.Position;
        this.Head = br.ReadString(4);
        this.Vers = br.ReadByte();
        this.Form = br.ReadByte();
        this.Count = br.ReadWord();
        const aligOffset = startOffset + br.ReadDword();
        if (this.Form === 0) {
            const blockStart = [];
            for (let i = 0; i < this.Count; ++i) {
                blockStart.push(startOffset + br.ReadWord());
            }
            br.Align(4);
            for (let i = 0; i < this.Count; ++i) {
                let frameName = '';
                if (br.Position === blockStart[i] - 0x20) {
                    frameName = br.ReadString(0x20);
                }
                const index = br.ReadWord();
                this.Unknown1 = br.ReadWord();
                const frames = br.ReadWord();
                this.Unknown2 = br.ReadWord();
                const frameTable = [];
                frameTable.name = frameName;
                for (let j = 0; j < frames; ++j) {
                    const frame = {
                        x: br.ReadWord(),
                        y: br.ReadWord(),
                        width: br.ReadWord(),
                        height: br.ReadWord(),
                        originX: 0,
                        originY: 0,
                    };
                    frameTable.push(frame);
                }
                for (let j = 0; j < frames; ++j) {
                    frameTable[j].originX = br.ReadWord();
                    frameTable[j].originY = br.ReadWord();
                }
                this.Sprites[index] = frameTable;
            }
        }
        br.Seek(aligOffset, BufferReader_1.Origin.Begin);
        if (this.Form === 0) {
            const aligBuffer = br.ReadBytes(br.Length - br.Position);
            const alig = new ALIG(aligBuffer);
            this.Image = alig.Image;
            this.Width = alig.Width;
            this.Height = alig.Height;
        }
        else if (this.Form === 0x0e) {
            this.Width = br.ReadWord();
            this.Height = br.ReadWord();
            this.FakeImage = br.ReadString(0x100);
        }
    }
}
exports.ALTX = ALTX;
class ALIG {
    constructor(buffer) {
        this.Palette = [];
        this.PaletteSize = 0;
        this.Buffer = buffer;
        const br = new BufferReader_1.BufferReader(buffer);
        this.Head = br.ReadString(4);
        this.Vers = br.ReadByte();
        this.Unknown1 = br.ReadByte();
        this.Unknown2 = br.ReadByte();
        this.Unknown3 = br.ReadByte();
        this.Form = br.ReadString(4);
        this.PaletteForm = br.ReadString(4);
        this.Width = br.ReadDword();
        this.Height = br.ReadDword();
        this.Size = this.Width * this.Height;
        this.Unknown5 = br.ReadWord();
        this.Unknown6 = br.ReadWord();
        this.Unknown7 = br.ReadDword();
        function extractChannel(pix, flag) {
            const channel = pix % flag;
            pix = (pix - channel) / flag;
            return channel;
        }
        function convert(x) {
            return Math.floor(x / 8) * 64 + (x % 8) * 9;
        }
        const rawImage = [];
        switch (this.Form) {
            case 'PAL4':
                this.PaletteSize = 16;
                for (let i = 0; i < this.PaletteSize; ++i) {
                    this.Palette[i] = br.ReadBytes(4);
                }
                for (let i = 0; i < Math.floor(this.Size / 2); ++i) {
                    const x = br.ReadByte();
                    const low = x >> 4;
                    const high = x & 0xf;
                    rawImage.push(...this.Palette[low], ...this.Palette[high]);
                }
                break;
            case 'ABG5':
                for (let i = 0; i < this.Size; ++i) {
                    const pix = br.ReadWord();
                    let a = extractChannel(pix, 2);
                    let b = extractChannel(pix, 32);
                    let g = extractChannel(pix, 32);
                    let r = extractChannel(pix, 32);
                    r = convert(r);
                    g = convert(g);
                    b = convert(b);
                    a = Math.floor(a * (255 / 1) + 0.5);
                    rawImage.push(r, g, b, a);
                }
                break;
            case 'BGR5':
                for (let i = 0; i < this.Size; ++i) {
                    const pix = br.ReadWord();
                    let b = extractChannel(pix, 32);
                    let g = extractChannel(pix, 32);
                    let r = extractChannel(pix, 32);
                    let a = extractChannel(pix, 2);
                    r = convert(r);
                    g = convert(g);
                    b = convert(b);
                    a = Math.floor(a * (255 / 1) + 0.5);
                    rawImage.push(r, g, b, a);
                }
                break;
            case 'ABG4':
                for (let i = 0; i < this.Size; ++i) {
                    const pix = br.ReadWord();
                    let a = extractChannel(pix, 16);
                    let b = extractChannel(pix, 16);
                    let g = extractChannel(pix, 16);
                    let r = extractChannel(pix, 16);
                    r = Math.floor(r * (255 / 1) + 0.5);
                    g = Math.floor(g * (255 / 1) + 0.5);
                    b = Math.floor(b * (255 / 1) + 0.5);
                    a = Math.floor(a * (255 / 1) + 0.5);
                    rawImage.push(r, g, b, a);
                }
                break;
            case 'BGR4':
                for (let i = 0; i < this.Size; ++i) {
                    const pix = br.ReadWord();
                    let b = extractChannel(pix, 16);
                    let g = extractChannel(pix, 16);
                    let r = extractChannel(pix, 16);
                    let a = extractChannel(pix, 16);
                    r = Math.floor(r * (255 / 1) + 0.5);
                    g = Math.floor(g * (255 / 1) + 0.5);
                    b = Math.floor(b * (255 / 1) + 0.5);
                    a = Math.floor(a * (255 / 1) + 0.5);
                    rawImage.push(r, g, b, a);
                }
                break;
            case 'RGBA':
                this.Image = br.ReadBytes(4 * this.Size);
                return;
            case 'BGRA':
                const p = br.ReadBytes(4 * this.Size);
                for (let i = 0; i < p.length; i += 4) {
                    const [b, g, r, a] = p.slice(i, 4).reverse();
                    rawImage.push(r, g, b, a);
                }
                break;
            default:
                console.log('Unknwon image format: ', this.Form);
                break;
        }
        this.Image = Buffer.from(rawImage);
    }
}
exports.ALIG = ALIG;
class ALOD {
    constructor(buffer) {
        this.Buffer = buffer;
        const br = new BufferReader_1.BufferReader(buffer);
        this.Head = br.ReadString(4);
        this.Vers = br.ReadByte();
        this.Form = br.ReadByte();
        this.EntryCount = br.ReadByte();
        this.FieldCount = br.ReadByte();
        this.Unknown = br.ReadDword();
        this.ALMTOffset = br.ReadDword();
        const entryOffsets = [];
        for (let i = 0; i < this.EntryCount; i++) {
            entryOffsets.push(br.ReadWord());
        }
        const fieldOffsets = [];
        for (let i = 0; i < this.FieldCount; i++) {
            fieldOffsets.push(br.ReadWord());
        }
        this.Fields = [];
        for (let i = 0; i < this.FieldCount; i++) {
            this.Fields.push(br.ReadString());
        }
        br.Align(4);
        this.Entries = [];
        for (let i = 0; i < this.EntryCount; i++) {
            br.Align(4);
            br.Seek(entryOffsets[i], BufferReader_1.Origin.Begin);
            const entry = {
                Name: br.ReadString(8),
                Fields: {},
            };
            const EntryFieldCount = br.ReadDword();
            const entryFieldOffsets = [];
            for (let j = 0; j < EntryFieldCount; j++) {
                entryFieldOffsets.push(entryOffsets[i] + br.ReadWord());
            }
            const entryFieldIndexes = [];
            for (let j = 0; j < EntryFieldCount; j++) {
                entryFieldIndexes.push(br.ReadByte());
            }
            br.Align(2);
            entry.Fields = {};
            for (let j = 0; j < EntryFieldCount; j++) {
                const field = this.Fields[entryFieldIndexes[j]];
                br.Seek(entryFieldOffsets[j], BufferReader_1.Origin.Begin);
                let value;
                switch (field) {
                    case 'Texture0ID':
                        value = {
                            Id1: br.ReadWord(),
                            Id2: br.ReadWord(),
                        };
                        break;
                    case 'Color':
                        value = {
                            R: br.ReadFloat(),
                            G: br.ReadFloat(),
                            B: br.ReadFloat(),
                            A: br.ReadFloat(),
                        };
                        break;
                    case 'Alpha':
                        value = br.ReadFloat();
                        break;
                    case 'ParentNodeID':
                        value = br.ReadString(4);
                        break;
                    default:
                        console.log(`Field not recognized: ${field}`);
                }
                entry.Fields[field] = value;
            }
            this.Entries.push(entry);
            if (this.Form === 2) {
                this.ALMT = new ALMT(this.Buffer.slice(this.ALMTOffset));
            }
        }
    }
}
exports.ALOD = ALOD;
class ALMT {
    constructor(buffer) {
        this.Entries = [];
        this.Buffer = buffer;
        const br = new BufferReader_1.BufferReader(buffer);
        this.Head = br.ReadString(4);
        this.Vers = br.ReadByte();
        this.Unknown1 = br.ReadByte();
        this.EntryCount = br.ReadWord();
        this.FieldCount = br.ReadByte();
        this.Unknown2 = br.ReadByte();
        this.Unknown3 = br.ReadWord();
        for (let i = 0; i < this.EntryCount; i++) {
            this.Entries.push({
                Name: br.ReadString(4),
            });
        }
        this.DataOffset = br.ReadDword();
        this.Fields = [];
        for (let i = 0; i < this.FieldCount; i++) {
            const field = {
                Offset: br.ReadWord(),
                Id1: 0,
                Id2: 0,
                Name: '',
            };
            this.Fields.push(field);
        }
        for (let i = 0; i < this.FieldCount; i++) {
            const field = this.Fields[i];
            field.Id1 = br.ReadByte();
            field.Id2 = br.ReadByte();
            field.Name = br.ReadString();
        }
        br.Align(4);
        this.Pattern = br.ReadDword();
        this.Length = br.ReadWord();
        this.Rate = br.ReadByte();
        this.Flag1 = br.ReadByte();
        this.Unknown4 = br.ReadWord();
        for (let i = 0; i < (this.Unknown4 - 0x002a) / 2; i++) {
            this.EntryOffset = br.ReadWord();
        }
        for (const entry of this.Entries) {
            const fieldOffsetBase = br.Position;
            const fieldCountNonstream = br.ReadByte();
            const fieldCount = br.ReadByte();
            const fieldDescs = [];
            for (let idx = 0; idx < fieldCount + fieldCountNonstream; idx++) {
                fieldDescs.push(br.ReadByte());
            }
            br.Align(2);
            const fieldOffsets = [];
            for (let idx = 0; idx < fieldCount + fieldCountNonstream; idx++) {
                fieldOffsets.push(fieldOffsetBase + br.ReadWord());
            }
            fieldDescs.forEach((fieldDesc, idx) => {
                const fieldIdx = fieldDesc & 0x0f;
                const field = this.Fields[fieldIdx];
                const stream = [];
                if (idx >= fieldCountNonstream) {
                    while (true) {
                        const time = br.ReadWord();
                        if (time === 0xffff) {
                            break;
                        }
                        if (time !== 0x494c) {
                            stream.push({
                                Time: time,
                                Data: this.parseField(field.Name, br),
                            });
                        }
                    }
                }
                else {
                    stream.push({
                        Data: this.parseField(field.Name, br),
                    });
                }
                entry[field.Name] = stream;
            });
        }
    }
    parseField(name, br) {
        switch (name) {
            case 'PatternNo':
            case 'BlendMode':
            case 'Disp':
                return br.ReadWord();
            case 'Texture0ID':
                return {
                    Id1: br.ReadWord(),
                    Id2: br.ReadWord(),
                };
            case 'Alpha':
                return br.ReadFloat();
            case 'Pos':
                return {
                    X: br.ReadDword(),
                    Y: br.ReadDword(),
                };
            case 'Rot':
                return br.ReadDword();
            case 'Scale':
            case 'Center':
                return {
                    X: br.ReadFloat(),
                    Y: br.ReadFloat(),
                    Z: br.ReadFloat(),
                };
            case 'Color3':
                return [br.ReadFloat(), br.ReadFloat()];
            default:
                console.log(`Field not parsed: ${name}`);
                return;
        }
    }
}
exports.ALMT = ALMT;
function parseObject(buffer) {
    const type = buffer.toString('utf-8', 0, 4);
    let r;
    switch (type) {
        case 'ALLZ':
            const lz = new ALLZ(buffer);
            try {
                r = parseObject(lz.Dst);
            }
            catch (_a) {
                r = lz;
            }
            break;
        case 'ALTB':
            r = new ALTB(buffer);
            break;
        case 'ALAR':
            r = new ALAR(buffer);
            break;
        case 'ALTX':
            r = new ALTX(buffer);
            break;
        case 'ALOD':
            r = new ALOD(buffer);
            break;
        default:
            console.log(`Not Support type ${type}`);
            r = new DefaultAL(buffer);
            break;
    }
    return r;
}
function parseAL(buffer) {
    return parseObject(buffer);
}
exports.parseAL = parseAL;
