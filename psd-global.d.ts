declare global {
  var agPsd: {
    readPsd(buffer: ArrayBuffer, options?: Record<string, unknown>): any;
    writePsdUint8Array(psd: any, options?: Record<string, unknown>): Uint8Array;
  } | undefined;
}

export {};
