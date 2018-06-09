import {Buffer} from 'buffer';

let CRLF : ArrayBuffer = asciiToByteArray("\r\n");
let CR = new Uint8Array(CRLF)[0]; // 13
let LF = new Uint8Array(CRLF)[1]; // 10

export function isArrayBuffer(a: any): boolean {
    return a instanceof ArrayBuffer;
}

export function extend(a: any, ...b: any[]): any {
    for (let i = 0; i < b.length; i++) {
        let o = b[i];
        Object.keys(o).forEach(function (k) {
            a[k] = o[k];
        });
    }
    return a;
}

function protoLen(a: Buffer): number {
    for (let i = 0; i < a.byteLength; i++) {
        let n = i+1;
        if (a.byteLength > n && a[i] === CR && a[n] === LF) {
            return n+1;
        }
    }
    return -1;
}

export function extractProtocolMessage(a: ArrayBuffer): string {
    // protocol messages are ascii, so Uint8Array
    return String.fromCharCode.apply(null, new Uint8Array(a));
}

export function asciiToByteArray(m: string) : ArrayBuffer {
    if (!m) {
        m = "";
    }
    let buf = new ArrayBuffer(m.length);
    let v = new Uint8Array(buf);
    for (let i = 0; i < m.length; i++) {
        v[i] = m.charCodeAt(i);
    }
    return buf;
}


export function buildWSMessage(protocol: string, a?: ArrayBuffer) : ArrayBuffer {
    let msg = asciiToByteArray(protocol);
    if(a) {
        msg = concat(msg, a, CRLF)
    }
    return msg;
}

export function concat(...bufs: ArrayBuffer[]): ArrayBuffer {
    let max = 0;
    for (let i = 0; i < bufs.length; i++) {
        max += bufs[i].byteLength;
    }
    let buf = new Uint8Array(max);
    let index = 0;
    for (let i = 0; i < bufs.length; i++) {
        buf.set(new Uint8Array(bufs[i]), index);
        index += bufs[i].byteLength;
    }
    return buf.buffer;
}