/*
 * Copyright 2018-2020 The NATS Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {DataBuffer} from "./databuffer"

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
        // @ts-ignore
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

export function settle(a: any[]): Promise<any[]> {
    if (Array.isArray(a)) {
        return Promise.resolve(a).then(_settle);
    } else {
        return Promise.reject(new TypeError('argument requires an array of promises'));
    }
}

function _settle(a: any[]): Promise<any> {
    return Promise.all(a.map((p) => {
        return Promise.resolve(p).then(_resolve, _resolve);
    }));
}

function _resolve(r: any): any {
    return r;
}
