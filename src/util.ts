import {Buffer} from 'buffer';
import {DataBuffer} from "./databuffer";

let CRLF: ArrayBuffer = DataBuffer.fromAscii("\r\n");
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

function protoLen(a: ArrayBuffer): number {
    let ba = new Uint8Array(a);
    for (let i = 0; i < ba.byteLength; i++) {
        let n = i + 1;
        if (ba.byteLength > n && ba[i] === CR && ba[n] === LF) {
            return n + 1;
        }
    }
    return -1;
}

export function extractProtocolMessage(a: ArrayBuffer): string {
    // protocol messages are ascii, so Uint8Array
    let len = protoLen(a);
    if (len) {
        let ba = new Uint8Array(a);
        let small = ba.slice(0, len);
        return String.fromCharCode.apply(null, small);
    }
    return "";
}


export function buildWSMessage(protocol: string, a?: ArrayBuffer): ArrayBuffer {
    let msg = DataBuffer.fromAscii(protocol);
    if (a) {
        msg = DataBuffer.concat(msg, a, CRLF)
    }
    return msg;
}