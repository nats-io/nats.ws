
export class DataBuffer {
    buffers: ArrayBuffer[] = [];
    byteLength: number = 0;

    pack() : void {
        if(this.buffers.length > 1) {
            let v = this.buffers.splice(0, this.buffers.length);
            this.buffers.push(DataBuffer.concat(...v));
        }
    }

    drain(n?: number): ArrayBuffer {
        if(this.buffers.length) {
            this.pack();
            let v = this.buffers.pop();
            if(v) {
                let max = this.byteLength;
                if (n === undefined || n > max) {
                    n = max;
                }
                let d = v.slice(0, n);
                if (max > n) {
                    this.buffers.push(v.slice(n));
                }
                this.byteLength = max - n;
                return d;
            }
        }
        return new Uint8Array(0).buffer;
    }

    fill(data: ArrayBuffer): void {
        if(data) {
            this.buffers.push(data);
            this.byteLength += data.byteLength;
        }
    }

    peek(): ArrayBuffer {
        if(this.buffers.length) {
            this.pack();
            return this.buffers[0];
        }
        return new Uint8Array(0).buffer;
    }

    size(): number {
        return this.byteLength;
    }

    length() : number {
        return this.buffers.length;
    }

    static concat(...bufs: ArrayBuffer[]): ArrayBuffer {
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

    static fromAscii(m: string) : ArrayBuffer {
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

    static toAscii(a: ArrayBuffer) : string {
        return String.fromCharCode.apply(null, new Uint8Array(a));
    }

}