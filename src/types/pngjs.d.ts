declare module "pngjs" {
  export interface PNGOptions {
    width?: number;
    height?: number;
    filterType?: number;
  }
  export class PNG {
    width: number;
    height: number;
    data: Buffer;
    constructor(options?: PNGOptions);
    static sync: {
      read(buffer: Buffer): { width: number; height: number; data: Buffer };
      write(png: PNG): Buffer;
    };
  }
}
