/// <reference types="node" />
export interface AL {
    Buffer: Buffer;
    Head: string;
    [k: string]: any;
}
export declare class DefaultAL implements AL {
    Buffer: Buffer;
    Head: string;
    constructor(buffer: Buffer);
}
export declare class ALLZ implements AL {
    Buffer: Buffer;
    Head: string;
    Vers: number;
    MinBitsLength: number;
    MinBitsOffset: number;
    MinBitsLiteral: number;
    DstSize: number;
    Dst: Buffer;
    Size: 0;
    constructor(buffer: Buffer);
    Package(): Buffer;
}
export declare class ALRD {
    Head: string;
    Vers: number;
    Count: number;
    Size: number;
    Headers: ALRD.Header[];
    Buffer: Buffer;
    constructor(buffer: Buffer);
}
export declare namespace ALRD {
    class Header {
        Offset: number;
        Type: number;
        NameEN: string;
        NameJP: string;
    }
}
export declare class ALTB implements AL {
    Buffer: Buffer;
    Head: string;
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
    StringFieldSizePosition?: number;
    StringFieldSize?: number;
    StringFieldEntry?: number;
    Label: string;
    StringField: {
        [k: string]: any;
    };
    StringOffsetList: any[];
    Headers: ALRD.Header[];
    Contents: any[];
    constructor(buffer: Buffer);
}
export declare class ALAR implements AL {
    Buffer: Buffer;
    Head: string;
    Files: ALAR.Entry[];
    TocOffsetList: any[];
    Vers: number;
    Unknown: number;
    Count: number;
    Unknown1?: number;
    Unknown2?: number;
    UnknownBytes: Buffer;
    DataOffset?: number;
    DataOffsetByData?: number;
    constructor(buffer: Buffer);
    private parseTocEntry;
}
export declare namespace ALAR {
    class Entry {
        Index: number;
        Unknown1: number;
        Address: number;
        Offset: number;
        Size: number;
        Unknown2: Buffer;
        Name: string;
        Unknown3: number;
        Content: AL | undefined;
        ParsedContent: Object;
    }
}
export declare namespace ALTX {
    interface Frame {
        x: number;
        y: number;
        width: number;
        height: number;
        originX: number;
        originY: number;
    }
    interface FrameTable extends Array<Frame> {
        name?: string;
    }
}
export declare class ALTX implements AL {
    Buffer: Buffer;
    Head: string;
    Vers: number;
    Form: number;
    Count: number;
    Sprites: {
        [key: number]: ALTX.FrameTable;
    };
    Image: Buffer;
    FakeImage?: string;
    Width: number;
    Height: number;
    Unknown1?: number;
    Unknown2?: number;
    constructor(buffer: Buffer);
}
export declare class ALIG implements AL {
    Buffer: Buffer;
    Head: string;
    Vers: number;
    Form: string;
    PaletteForm: string;
    Count: number;
    Width: number;
    Height: number;
    Size: number;
    Palette: Buffer[];
    PaletteSize: number;
    Image: Buffer;
    Unknown1: number;
    Unknown2: number;
    Unknown3: number;
    Unknown5: number;
    Unknown6: number;
    Unknown7: number;
    constructor(buffer: Buffer);
}
export declare class ALOD implements AL {
    Buffer: Buffer;
    Head: string;
    Vers: number;
    Form: number;
    Fields: string[];
    Entries: any[];
    EntryCount: number;
    FieldCount: number;
    Unknown: number;
    ALMTOffset: number;
    ALMT?: ALMT;
    constructor(buffer: Buffer);
}
export declare namespace ALMT {
    interface Entry {
        Name: string;
        [k: string]: any;
    }
    interface Field {
        Offset: number;
        Id1: number;
        Id2: number;
        Name: string;
    }
}
export declare class ALMT implements AL {
    Buffer: Buffer;
    Head: string;
    Vers: number;
    Unknown1: number;
    EntryCount: number;
    FieldCount: number;
    Unknown2: number;
    Unknown3: number;
    DataOffset: number;
    Entries: ALMT.Entry[];
    Fields: ALMT.Field[];
    Pattern: number;
    Length: number;
    Rate: number;
    Flag1: number;
    Unknown4: number;
    EntryOffset?: number;
    constructor(buffer: Buffer);
    private parseField;
}
export declare function parseAL(buffer: Buffer): AL;
