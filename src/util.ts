let CRLF : ArrayBuffer = asciiToByteArray("\r\n");
let CR = new Uint8Array(CRLF)[0]; // 13
let LF = new Uint8Array(CRLF)[1]; // 10

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
    let buf = new Uint8Array(a)
    for(let i=0; i < buf.byteLength; i++) {
        let n = i+1;
        if(buf.byteLength > n && buf[i] === CR && buf[n] === LF) {
            return n+1;
        }
    }
    return -1;
}

export function debugMsg(a: ArrayBuffer) : string {
    let uia = new Uint8Array(a);
    let buf = [];
    for(let i=0; i < a.byteLength; i++) {
        buf.push(String.fromCharCode(uia[i]));
    }
    return buf.join('');
}

export function extractProtocolMessage(a: ArrayBuffer | string) : string {
    if(typeof a === 'string') {
        return a;
    }
    let n = protoLen(a);
    let uia = new Uint8Array(a);
    if(n) {
        let buf = new Array(n);
        for(let i=0; i < n; i++) {
            buf.push(String.fromCharCode(uia[i]));
        }
        return buf.join('');
    }

    return '';
}

export function asciiToByteArray(m: string) : ArrayBuffer {
    let len = m ? m.length : 0;
    let buf = new Uint8Array(len);
    if(m) {
        for(let i=0; i < m.length; i++) {
            buf[i] = m.charCodeAt(i);
        }
    }

    return buf.buffer;
}



export function buildWSMessage(protocol: string, a?: ArrayBuffer) : ArrayBuffer {
    let msg = asciiToByteArray(protocol);
    if(a) {
        msg = concat(msg, a, CRLF)
    }

    return msg;
}

export function concat(...chunks: ArrayBuffer[]) : ArrayBuffer {
    let max = 0;
    for(let i=0; i < chunks.length; i++) {
        max += chunks[i].byteLength;
    }
    let buf = new Uint8Array(max);
    let index = 0;
    for(let i=0; i < chunks.length; i++) {
        buf.set(new Uint8Array(chunks[i]), index);
        index += chunks[i].byteLength;
    }
    return buf.buffer;
}