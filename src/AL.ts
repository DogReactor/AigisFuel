import { BufferReader, Origin } from './BufferReader';
import * as fs from 'fs';
import * as pathLib from 'path';

function Align(offset: number, length: number) {
  if (offset % length === 0) {
    return offset;
  }
  return offset + (length - (offset % length));
}

export class AL {
  Buffer: Buffer;
  Head: string;
  [k: string]: any;
  constructor(buffer: Buffer) {
    this.Buffer = buffer;
    this.Head = buffer.toString('utf-8', 0, 4);
  }
  public Package(path: string): Buffer {
    if (!fs.existsSync(path)) {
      return this.Buffer;
    } else {
      console.log('found ' + path);
      return fs.readFileSync(path);
    }
  }

  public Save(path: string) {
    const a = path;
  }
}

export class DefaultAL extends AL {
  constructor(buffer: Buffer) {
    super(buffer);
  }
}
export class Text extends AL {
  Content: string = '';
  constructor(buffer: Buffer) {
    super(buffer);
    this.Content = buffer.toString('utf-8');
  }
  public Save(path: string) {
    fs.writeFileSync(path, this.Buffer);
  }
}

export class ALLZ extends AL {
  Vers: number;
  MinBitsLength: number;
  MinBitsOffset: number;
  MinBitsLiteral: number;
  DstSize: number;
  Dst: Buffer;
  Size: 0;
  constructor(buffer: Buffer) {
    super(buffer);
    const self = this;
    this.Buffer = buffer;
    const br = new BufferReader(buffer);
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
      } else {
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
    function readControl(minBits: number) {
      const u = br.ReadUnary();
      const n = br.ReadBits(u + minBits);
      if (u > 0) {
        return n + (((1 << u) - 1) << minBits);
      } else {
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

    function copyWord(offset: number, length: number) {
      let trueOffset = offset;
      for (let i = 0; i < length; i++) {
        if (offset < 0) {
          trueOffset = dstOffset + offset;
        }
        self.Dst.writeUInt8(self.Dst[trueOffset], dstOffset);
        dstOffset++;
      }
    }
    function copyLiteral(control: number) {
      br.Copy(self.Dst, dstOffset, control);
      dstOffset += control;
    }
  }
  Package() {
    return this.Buffer;
  }
}

export class ALRD extends AL {
  Head: string;
  Vers: number;
  Count: number;
  Size: number;
  Headers: ALRD.Header[];
  Buffer: Buffer;
  constructor(buffer: Buffer) {
    super(buffer);
    this.Buffer = buffer;
    const br = new BufferReader(buffer);
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
      br.Seek(emptyLength, Origin.Current);
      br.Align(4);
      this.Headers.push(header);
    }
  }
}
export namespace ALRD {
  export class Header {
    Offset = 0;
    Type = 0;
    NameEN = '';
    NameJP = '';
  }
}

export class ALTB extends AL {
  Vers: number;
  Form: number;
  Count: number;
  Unknown1: number;
  TableEntry: number;
  NameStartAddressOffset?: number;
  NameStartAddress?: number;
  UnknownNames?: number;
  NameLength?: number;
  Name?: string;
  Size: number;
  StringFieldSizePosition: number = 0;
  StringFieldSize: number = 0;
  StringFieldEntry: number = 0;
  Label?: string;
  StringField: { [k: string]: any } = {};
  StringOffsetList: any[] = [];
  Headers: ALRD.Header[] = [];
  Contents: any[] = [];
  constructor(buffer: Buffer) {
    super(buffer);
    this.Buffer = buffer;
    const br = new BufferReader(buffer);
    this.Head = br.ReadString(4);
    this.Vers = br.ReadByte();
    this.Form = br.ReadByte();
    this.Count = br.ReadWord();
    this.Unknown1 = br.ReadWord();
    this.TableEntry = br.ReadWord();
    this.Size = br.ReadDword();
    if (this.Form === 0x14 || this.Form === 0x1e || this.Form === 0x04) {
      this.StringFieldSizePosition = br.Position;
      this.StringFieldSize = br.ReadDword();
      this.StringFieldEntry = br.ReadDword();
      this.StringField = {};
      this.StringOffsetList = [];

      const nowPosition = br.Position;
      br.Seek(this.StringFieldEntry, Origin.Begin);
      while (br.Position < this.StringFieldEntry + this.StringFieldSize) {
        const offset = br.Position - this.StringFieldEntry;
        const s = br.ReadString();
        this.StringField[offset] = s;
        this.StringOffsetList.push(offset);
      }
      br.Seek(nowPosition, Origin.Begin);
    }
    if (this.Form === 0x1e) {
      this.NameStartAddressOffset = br.Position;
      this.NameStartAddress = br.ReadDword();
    }
    if (this.Form !== 0x04) {
      this.Label = br.ReadString(4);
    }
    const alrdBuffer = br.ReadBytes(this.TableEntry - br.Position);
    br.Seek(this.TableEntry, Origin.Begin);
    const alrd = new ALRD(alrdBuffer);
    this.Headers = alrd.Headers;
    for (let i = 0; i < this.Count; i++) {
      br.Seek(this.TableEntry + this.Size * i, Origin.Begin);
      const row: { [k: string]: any } = {};
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
      br.Seek(this.NameStartAddress, Origin.Begin);
      this.UnknownNames = br.ReadDword();
      this.NameLength = br.ReadByte();
      this.Name = br.ReadString(this.NameLength);
    }
  }
  Save(path: string) {
    if (this.StringField === undefined) {
      return;
    }
    path = path.replace('.atb', '.txt');
    let result = '';
    for (const key in this.StringField) {
      if (this.StringField.hasOwnProperty(key)) {
        const s = this.StringField[key].replace(/\n/g, '\\n');
        result += s + '\r\n';
      }
    }
    fs.writeFileSync(path, result, 'utf8');
  }
  Package(path: string) {
    path = path.replace('.atb', '.txt');
    if (!fs.existsSync(path)) {
      return this.Buffer;
    }
    const replaceObject = this.readReplacementFile(fs.readFileSync(path, { encoding: 'utf-8' }));
    if (replaceObject === null) { return this.Buffer };
    const newStringField = this.ReplaceStringList(replaceObject);
    const newOffsetList = newStringField.offsetList;
    // 制作Offset变化Object
    const offsetChanges: any = {};
    if (this.StringOffsetList.length !== newOffsetList.length) {
      throw 'String数量错误';
    }
    for (let i = 0; i < newOffsetList.length; i++) {
      offsetChanges[this.StringOffsetList[i]] = newOffsetList[i];
    }
    // 取头、StringField、尾，计算长度。
    let size = 0;
    const head = this.Buffer.slice(0, this.StringFieldEntry);
    const stringField = newStringField.buffer;
    const tail = this.Buffer.slice(
      Align(this.StringFieldEntry + this.StringFieldSize, 4),
      this.Buffer.length,
    );
    const alignStringFieldLength = Align(stringField.length, 4);
    size = head.length + alignStringFieldLength;
    size += tail.length;
    // 头的部分要修改StringSize，0x20项的地址，如果有name的话还要修改name的地址。
    head.writeUInt32LE(alignStringFieldLength, this.StringFieldSizePosition);
    for (let i = 0; i < this.Count; i++) {
      const rowEntry = this.TableEntry + this.Size * i;
      for (const header of this.Headers) {
        if (header.Type === 0x20) {
          const offset = rowEntry + header.Offset;
          const stringFieldOffset = head.readUInt32LE(offset);
          const newStringFieldOffset = offsetChanges[stringFieldOffset];
          if (newStringFieldOffset !== undefined) {
            head.writeUInt32LE(newStringFieldOffset, offset);
          } else {
            throw '没有该offset';
          }
        }
      }
    }
    if (
      this.NameStartAddress !== undefined &&
      this.NameStartAddressOffset !== undefined
    ) {
      const newNameStart =
        this.NameStartAddress +
        (alignStringFieldLength -
          (this.NameStartAddress - this.StringFieldEntry));
      head.writeUInt32LE(newNameStart, this.NameStartAddressOffset);
    }

    const newBuffer = Buffer.alloc(size, 0);
    head.copy(newBuffer, 0, 0, head.length);
    stringField.copy(newBuffer, head.length, 0, stringField.length);
    tail.copy(newBuffer, head.length + alignStringFieldLength, 0, tail.length);
    return newBuffer;
  }
  private readReplacementFile(text: string) {
    const obj: any = {};
    const row = text.split('\r\n');
    let count = 0;
    for (const i of row) {
      const col = i.split('\t');
      if (col.length === 2) {
        count++;
        obj[col[0]] = col[1];
      }
    }
    return obj;
  }
  private ReplaceStringList(replaceObject: any) {
    if (this.StringField === undefined) { throw '该文件没有StringField' };
    let count = 0;
    const bufferList = [];
    const offsetList = [];
    let offset = 0;
    for (const key in this.StringField) {
      if (this.StringField.hasOwnProperty(key)) {
        let s = this.StringField[key];
        s = s.replace(/\n/g, '\\n');
        const replaceS = replaceObject[s];
        if (replaceS !== undefined) {
          s = replaceS;
          count++;
        }
        offsetList.push(offset);
        s = s.replace(/\\n/g, '\n') + '\0';
        const stringBuffer = Buffer.from(s, 'utf-8');
        bufferList.push(stringBuffer);
        offset += stringBuffer.length;
      }
    }
    console.log('Replaced ' + count);
    return {
      offsetList,
      buffer: Buffer.concat(bufferList),
    };
  }
}

export class ALAR extends AL {
  Files: ALAR.Entry[] = [];
  TocOffsetList: any[] = [];
  Vers: number;
  Unknown: number;
  Count: number;
  DataOffsetByData: number = 0;
  Unknown1: number = 0;
  Unknown2: number = 0;
  UnknownBytes: Buffer;
  DataOffset: number = 0;
  constructor(buffer: Buffer) {
    super(buffer);
    this.Buffer = buffer;
    const br = new BufferReader(buffer);
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
    } else {
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
      if (pathLib.extname(entry.Name)[1] === 'a') {
        entry.Content = parseObject(
          buffer.slice(entry.Address, entry.Address + entry.Size),
        );
      } else {
        entry.Content = new Text(
          buffer.slice(entry.Address, entry.Address + entry.Size),
        );
      }

      this.Files.push(entry);
    }
    if (this.Vers === 2) {
      this.DataOffsetByData = this.Files[0].Address - 0x22;
    }
    if (this.Vers === 3) {
      this.DataOffsetByData = this.Files[0].Address;
    }
  }
  public Save(path: string) {
    path = path.replace('.aar', '');
    if (!fs.existsSync(path)) { fs.mkdirSync(path) };
    for (const entry of this.Files) {
      entry.Content.Save(pathLib.join(path, entry.Name));
    }
  }
  public Package(path: string) {
    path = path.replace('.aar', '');
    if (!fs.existsSync(path)) {
      return this.Buffer;
    }
    // 依然是头 索引 文件区
    // 头和索引的大小是不会变的，要改的是索引当中的Address和Size
    // 先生成新的文件
    const newFilesBufferArray: Buffer[] = [];
    let offset = this.DataOffsetByData;
    for (let i = 0; i < this.Files.length; i++) {
      const entry = this.Files[i];
      // 替换在这里进行
      const content = entry.Content.Package(pathLib.join(path, entry.Name));
      if (this.Vers === 2) {
        const name = Buffer.alloc(0x22);
        name.write(entry.Name);
        name.writeUInt16LE(entry.Unknown3, 0x20);
        newFilesBufferArray.push(name);
        offset += 0x22;
      }
      entry.Address = offset;
      entry.Size = content.byteLength;
      newFilesBufferArray.push(content);
      offset += content.byteLength;
      if (i === this.Files.length - 1) {
        continue;
      }
      const newOffset = Align(offset, 4);
      newFilesBufferArray.push(Buffer.alloc(newOffset - offset));
      offset = newOffset;
      if (this.Vers === 2) {
        newFilesBufferArray.push(Buffer.alloc(2));
        offset += 2;
      }
    }
    const newFilesBuffer = Buffer.concat(newFilesBufferArray);
    console.log(
      offset,
      newFilesBuffer.byteLength + this.DataOffsetByData,
      this.Buffer.byteLength,
    );
    // 总长度实际上就是offset了
    const newBuffer = Buffer.alloc(offset);
    offset = 0;
    // 头
    newBuffer.write('ALAR', 0);
    offset += 4;
    newBuffer.writeInt8(this.Vers, offset);
    offset++;
    newBuffer.writeInt8(this.Unknown, offset);
    offset++;
    if (this.Vers === 2) {
      newBuffer.writeUInt16LE(this.Count, offset);
      offset += 2;
      this.UnknownBytes.copy(
        newBuffer,
        offset,
        0,
        this.UnknownBytes.byteLength,
      );
      offset += this.UnknownBytes.byteLength;
    }
    if (this.Vers === 3) {
      newBuffer.writeUInt16LE(this.Count, offset);
      offset += 2;
      newBuffer.writeUInt16LE(this.Unknown1, offset);
      offset += 2;
      newBuffer.writeUInt16LE(this.Unknown2, offset);
      offset += 2;
      this.UnknownBytes.copy(
        newBuffer,
        offset,
        0,
        this.UnknownBytes.byteLength,
      );
      offset += this.UnknownBytes.byteLength;
      newBuffer.writeUInt16LE(this.DataOffset, offset);
      offset += 2;
      for (let i = 0; i < this.Count; i++) {
        newBuffer.writeUInt16LE(this.TocOffsetList[i], offset);
        offset += 2;
      }
      offset = Align(offset, 4);
    }
    // 索引
    for (let i = 0; i < this.Count; i++) {
      let entry = new ALAR.Entry();
      entry = this.Files[i];
      if (this.Vers === 2) {
        // 固定长度16字节
        newBuffer.writeUInt16LE(entry.Index, offset);
        offset += 2;
        newBuffer.writeUInt16LE(entry.Unknown1, offset);
        offset += 2;
        newBuffer.writeUInt32LE(entry.Address, offset);
        offset += 4;
        newBuffer.writeUInt32LE(entry.Size, offset);
        offset += 4;
        entry.Unknown2.copy(newBuffer, offset, 0, entry.Unknown2.byteLength);
        offset += entry.Unknown2.byteLength;
      }
      if (this.Vers === 3) {
        newBuffer.writeUInt16LE(entry.Index, offset);
        offset += 2;
        newBuffer.writeUInt16LE(entry.Unknown1, offset);
        offset += 2;
        newBuffer.writeUInt32LE(entry.Address, offset);
        offset += 4;
        newBuffer.writeUInt32LE(entry.Size, offset);
        offset += 4;
        entry.Unknown2.copy(newBuffer, offset, 0, entry.Unknown2.byteLength);
        offset += entry.Unknown2.byteLength;
        const stringBuffer = new Buffer(entry.Name + '\0');
        stringBuffer.copy(newBuffer, offset, 0, stringBuffer.byteLength);
        offset += stringBuffer.byteLength;
        offset = Align(offset, 4);
      }
    }
    if (this.Vers === 2) {
      offset += 2;
    }
    if (offset !== this.DataOffsetByData) {
      console.log('包装的文件头 + 索引长度错误');
      return new Buffer(0);
    }
    // 主体
    newFilesBuffer.copy(newBuffer, offset, 0, newFilesBuffer.byteLength);
    return newBuffer;
  }
  private parseTocEntry(br: BufferReader) {
    const entry = new ALAR.Entry();
    if (this.Vers === 2) {
      entry.Index = br.ReadWord();
      entry.Unknown1 = br.ReadWord();
      entry.Address = br.ReadDword();
      entry.Size = br.ReadDword();
      entry.Unknown2 = br.ReadBytes(4);
      const p = br.Position;
      br.Seek(entry.Address - 0x22, Origin.Begin);
      entry.Name = br.ReadString();
      br.Seek(entry.Address - 0x02, Origin.Begin);
      entry.Unknown3 = br.ReadWord();
      br.Seek(p, Origin.Begin);
    } else {
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
export namespace ALAR {
  export class Entry {
    Index = 0;
    Unknown1 = 0;
    Address = 0;
    Offset = 0;
    Size = 0;
    Unknown2 = Buffer.alloc(0);
    Name = '';
    Unknown3 = 0;
    Content: AL = new DefaultAL(new Buffer(0));
    ParsedContent = new Object();
  }
}

export namespace ALTX {
  export interface Frame {
    X: number;
    Y: number;
    Width: number;
    Height: number;
    OriginX: number;
    OriginY: number;
  }

  export interface FrameTable extends Array<Frame> {
    name?: string;
  }
}

export class ALTX extends AL {
  Vers: number;
  Form: number;
  Count: number;
  Sprites: { [key: number]: ALTX.FrameTable } = {};
  Image = Buffer.alloc(0);
  FakeImage?: string;
  Width = 0;
  Height = 0;
  Unknown1?: number;
  Unknown2?: number;
  constructor(buffer: Buffer) {
    super(buffer);
    const br = new BufferReader(buffer);
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
        const frameTable: ALTX.FrameTable = [];
        frameTable.name = frameName;
        for (let j = 0; j < frames; ++j) {
          const frame: ALTX.Frame = {
            X: br.ReadWord(),
            Y: br.ReadWord(),
            Width: br.ReadWord(),
            Height: br.ReadWord(),
            OriginX: 0,
            OriginY: 0,
          };
          frameTable.push(frame);
        }
        for (let j = 0; j < frames; ++j) {
          frameTable[j].OriginX = br.ReadWord();
          frameTable[j].OriginY = br.ReadWord();
        }
        this.Sprites[index] = frameTable;
      }
    }
    br.Seek(aligOffset, Origin.Begin);
    if (this.Form === 0) {
      const aligBuffer = br.ReadBytes(br.Length - br.Position);
      const alig = new ALIG(aligBuffer);
      this.Image = alig.Image;
      this.Width = alig.Width;
      this.Height = alig.Height;
    } else if (this.Form === 0x0e) {
      this.Width = br.ReadWord();
      this.Height = br.ReadWord();
      this.FakeImage = br.ReadString(0x100);
    }
  }
}

export class ALIG extends AL {
  Vers: number;
  Form: string;
  PaletteForm: string;
  Count = 0;
  Width: number;
  Height: number;
  Size: number;
  Palette: Buffer[] = [];
  PaletteSize = 0;
  Image: Buffer;
  Unknown1: number;
  Unknown2: number;
  Unknown3: number;
  Unknown5: number;
  Unknown6: number;
  Unknown7: number;
  constructor(buffer: Buffer) {
    super(buffer);
    this.Buffer = buffer;
    const br = new BufferReader(buffer);
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
    function convert(x: number) {
      return Math.floor(x / 8) * 64 + (x % 8) * 9;
    }
    const rawImage: number[] = [];
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
          const extractor = new ALIG.ChannelExtractor(pix);
          let a = extractor.extract(2);
          let b = extractor.extract(32);
          let g = extractor.extract(32);
          let r = extractor.extract(32);
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
          const extractor = new ALIG.ChannelExtractor(pix);
          let b = extractor.extract(32);
          let g = extractor.extract(32);
          let r = extractor.extract(32);
          let a = extractor.extract(2);
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
          const extractor = new ALIG.ChannelExtractor(pix);
          let a = extractor.extract(16);
          let b = extractor.extract(16);
          let g = extractor.extract(16);
          let r = extractor.extract(16);
          r = Math.floor(r * (255 / 15) + 0.5);
          g = Math.floor(g * (255 / 15) + 0.5);
          b = Math.floor(b * (255 / 15) + 0.5);
          a = Math.floor(a * (255 / 15) + 0.5);
          rawImage.push(r, g, b, a);
        }
        break;
      case 'BGR4':
        for (let i = 0; i < this.Size; ++i) {
          const pix = br.ReadWord();
          const extractor = new ALIG.ChannelExtractor(pix);
          let b = extractor.extract(16);
          let g = extractor.extract(16);
          let r = extractor.extract(16);
          let a = extractor.extract(16);
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

export namespace ALIG {
  export class ChannelExtractor {
    private pix: number;
    constructor(pix: number) {
      this.pix = pix;
    }
    extract(length: number) {
      const channel = this.pix % length;
      this.pix = (this.pix - channel) / length;
      return channel;
    }
  }
}

export class ALOD extends AL {
  Vers: number;
  Form: number;
  Fields: string[];
  Entries: any[];
  EntryCount: number;
  FieldCount: number;
  Unknown: number;
  ALMTOffset: number;
  ALMT?: ALMT;
  constructor(buffer: Buffer) {
    super(buffer);
    const br = new BufferReader(buffer);
    this.Head = br.ReadString(4);
    this.Vers = br.ReadByte();
    this.Form = br.ReadByte();
    this.EntryCount = br.ReadByte();
    this.FieldCount = br.ReadByte();
    this.Unknown = br.ReadDword();
    this.ALMTOffset = br.ReadDword();

    const entryOffsets: number[] = [];
    for (let i = 0; i < this.EntryCount; i++) {
      entryOffsets.push(br.ReadWord());
    }

    const fieldOffsets: number[] = [];
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
      br.Seek(entryOffsets[i], Origin.Begin);
      const entry: { Name: string; Fields: any } = {
        Name: br.ReadString(8),
        Fields: {},
      };

      const EntryFieldCount = br.ReadDword();

      const entryFieldOffsets: number[] = [];
      for (let j = 0; j < EntryFieldCount; j++) {
        entryFieldOffsets.push(entryOffsets[i] + br.ReadWord());
      }

      const entryFieldIndexes: number[] = [];
      for (let j = 0; j < EntryFieldCount; j++) {
        entryFieldIndexes.push(br.ReadByte());
      }

      br.Align(2);

      entry.Fields = {};

      for (let j = 0; j < EntryFieldCount; j++) {
        const field = this.Fields[entryFieldIndexes[j]];
        br.Seek(entryFieldOffsets[j], Origin.Begin);
        let value: any;
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

export namespace ALMT {
  export interface Entry {
    Name: string;
    [k: string]: any;
  }
  export interface Field {
    Offset: number;
    Id1: number;
    Id2: number;
    Name: string;
  }
}

export class ALMT extends AL {
  Vers: number;
  Unknown1: number;
  EntryCount: number;
  FieldCount: number;
  Unknown2: number;
  Unknown3: number;
  DataOffset: number;
  Entries: ALMT.Entry[] = [];
  Fields: ALMT.Field[];
  Pattern: number;
  Length: number;
  Rate: number;
  Flag1: number;
  Unknown4: number;
  EntryOffset?: number;
  constructor(buffer: Buffer) {
    super(buffer);
    this.Buffer = buffer;
    const br = new BufferReader(buffer);
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
      const field: ALMT.Field = {
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
      const fieldDescs: number[] = [];
      for (let idx = 0; idx < fieldCount + fieldCountNonstream; idx++) {
        fieldDescs.push(br.ReadByte());
      }

      br.Align(2);

      const fieldOffsets: number[] = [];
      for (let idx = 0; idx < fieldCount + fieldCountNonstream; idx++) {
        fieldOffsets.push(fieldOffsetBase + br.ReadWord());
      }

      fieldDescs.forEach((fieldDesc, idx) => {
        const fieldIdx = fieldDesc & 0x0f;
        const field = this.Fields[fieldIdx];

        const stream: any[] = [];

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
        } else {
          stream.push({
            Data: this.parseField(field.Name, br),
          });
        }
        entry[field.Name] = stream;
      });
    }
  }
  private parseField(name: string, br: BufferReader): any {
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
          X: br.ReadFloat(),
          Y: br.ReadFloat(),
          Z: br.ReadFloat(),
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
        return [br.ReadFloat(), br.ReadFloat(), br.ReadFloat()];
      default:
        console.log(`Field not parsed: ${name}`);
        return;
    }
  }
}

function parseObject(buffer: Buffer) {
  const type = buffer.toString('utf-8', 0, 4);
  let r: AL;
  switch (type) {
    case 'ALLZ':
      const lz = new ALLZ(buffer);
      try {
        r = parseObject(lz.Dst);
      } catch {
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
    case 'ALRD':
      r = new ALRD(buffer);
      break;
    default:
      console.log(`Not Support type ${type}`);
      r = new DefaultAL(buffer);
      break;
  }
  return r;
}

export function parseAL(buffer: Buffer) {
  return parseObject(buffer);
}
