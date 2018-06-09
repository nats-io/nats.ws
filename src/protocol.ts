import {BINARY_PAYLOAD, JSON_PAYLOAD, NatsConnectionOptions, STRING_PAYLOAD} from "./nats";
import {Transport, TransportHandlers, WSTransport} from "./transport";
import {NatsError} from "./error";
import {buildWSMessage, concat, extend, extractProtocolMessage} from "./util";
import {Nuid} from 'js-nuid/src/nuid'

const nuid = new Nuid();

const FLUSH_THRESHOLD = 65536;


export enum ParserState {
    CLOSED = -1,
    AWAITING_CONTROL = 0,
    AWAITING_MSG_PAYLOAD = 1
}

const MSG = /^MSG\s+([^\s\r\n]+)\s+([^\s\r\n]+)\s+(([^\s\r\n]+)[^\S\r\n]+)?(\d+)\r\n/i;
const OK = /^\+OK\s*\r\n/i;
const ERR = /^-ERR\s+('.+')?\r\n/i;
const PING = /^PING\r\n/i;
const PONG = /^PONG\r\n/i;
const INFO = /^INFO\s+([^\r\n]+)\r\n/i;
const SUBRE = /^SUB\s+([^\r\n]+)\r\n/i;

const CR_LF = '\r\n';
const CR_LF_LEN = CR_LF.length;
const PING_REQUEST = 'PING' + CR_LF;
const PONG_RESPONSE = 'PONG' + CR_LF;
const CONNECT = 'CONNECT';
const SUB = 'SUB';
const UNSUB = 'UNSUB';

export function createInbox(): string {
    return `_INBOX.${nuid.next()}`;
}

export class Connect {
    lang: string = "javascript";
    version: string = "1.0.0";
    verbose: boolean = false;
    pedantic: boolean = false;
    protocol: number = 1;
    user?: string;
    pass?: string;
    auth_token?: string;
    name?: string;

    constructor(opts?: NatsConnectionOptions) {
        opts = opts || {} as NatsConnectionOptions;
        if (opts.token) {
            this.auth_token = opts.token;
        }
        extend(this, opts);
    }
}

export interface Callback {
    (): void;
}

export interface ErrorCallback {
    (error: Error): void;
}

export interface ClientHandlers {
    closeHandler: Callback;
    errorHandler: ErrorCallback;
}


export interface MsgCallback {
    (msg: Msg): void;
}

export interface RequestOptions {
    timeout?: number;
}

export interface Base {
    subject: string;
    callback: MsgCallback;
    received: number;
    timeout?: number | null;
    max?: number | undefined;
}

export interface Req extends Base {
    token: string;
}

export interface Sub extends Base {
    sid: number;
    queueGroup?: string | null;
}

export function defaultSub(): Sub {
    return {sid: 0, subject: "", received: 0} as Sub;
}

export function defaultReq(): Req {
    return {token: "", subject: "", received: 0, max: 1} as Req;

}


export class Request {
    token: string;
    private protocol: ProtocolHandler;

    constructor(req: Req, protocol: ProtocolHandler) {
        this.token = req.token;
        this.protocol = protocol;
    }

    cancel(): void {
        this.protocol.cancelRequest(this.token, 0);
    }
}

export class Subscription {
    sid: number;
    private protocol: ProtocolHandler;

    constructor(sub: Sub, protocol: ProtocolHandler) {
        this.sid = sub.sid;
        this.protocol = protocol;
    }

    unsubscribe(max?: number): void {
        this.protocol.unsubscribe(this.sid, max);
    }
}

export class MuxSubscription {
    baseInbox!: string;
    reqs: { [key: string]: Req } = {};
    length: number = 0;

    init(): string {
        this.baseInbox = `${createInbox()}.`;
        return this.baseInbox;
    }

    add(r: Req) {
        if (!isNaN(r.received)) {
            r.received = 0;
        }
        this.length++;
        this.reqs[r.token] = r;
    }

    get(token: string): Req | null {
        if (token in this.reqs) {
            return this.reqs[token];
        }
        return null;
    }

    cancel(r: Req): void {
        if (r && r.timeout) {
            clearTimeout(r.timeout);
            r.timeout = null;
        }
        if (r.token in this.reqs) {
            delete this.reqs[r.token];
            this.length--;
        }
    }

    getToken(m: Msg): string | null {
        let s = m.subject || "";
        if (s.indexOf(this.baseInbox) === 0) {
            return s.substring(this.baseInbox.length);
        }
        return null;
    }

    dispatcher() {
        let mux = this;
        return function (m: Msg) {
            let token = mux.getToken(m);
            if (token) {
                let r = mux.get(token);
                if (r) {
                    r.received++;
                    if (r.max && r.max >= r.received) {
                        mux.cancel(r);
                    }
                    r.callback(m);
                }
            }
        }
    };
}


export class Subscriptions {
    mux!: Sub;
    subs: { [key: number]: Sub } = {};
    sidCounter: number = 0;
    length: number = 0;

    add(s: Sub): Sub {
        this.sidCounter++;
        this.length++;
        s.sid = this.sidCounter;
        this.subs[s.sid] = s;
        return s;
    }

    setMux(s: Sub): Sub {
        this.mux = s;
        return s;
    }

    getMux(): Sub | null {
        return this.mux;
    }

    get(sid: number): (Sub | null) {
        if (sid in this.subs) {
            return this.subs[sid];
        }
        return null;
    }

    all(): (Sub)[] {
        let buf = [];
        for (let sid in this.subs) {
            let sub = this.subs[sid];
            buf.push(sub);
        }
        return buf;
    }

    cancel(s: Sub): void {
        if (s && s.timeout) {
            clearTimeout(s.timeout);
            s.timeout = null;
        }
        if (s.sid in this.subs) {
            delete this.subs[s.sid];
            this.length--;
        }
    }
}

export interface Msg {
    subject: string;
    sid: number;
    reply?: string;
    size: number;
    data?: any;
}

export class MsgBuffer {
    msg: Msg;
    length: number;
    buf?: ArrayBuffer | null;
    payload: string;

    constructor(chunks: RegExpExecArray, payload: "string" | "json" | "binary" = "string") {
        this.msg = {} as Msg;
        this.msg.subject = chunks[1];
        this.msg.sid = parseInt(chunks[2], 10);
        this.msg.reply = chunks[4];
        this.msg.size = parseInt(chunks[5], 10);
        this.length = this.msg.size + CR_LF_LEN;
        this.payload = payload;
    }

    fill(data: ArrayBuffer) {
        if (!this.buf) {
            this.buf = data;
        } else {
            this.buf = concat(this.buf, data);
        }
        this.length -= data.byteLength;

        if (this.length === 0) {
            this.msg.data = this.buf.slice(0, this.buf.byteLength - 2);
            switch (this.payload) {
                case JSON_PAYLOAD:
                    this.msg.data = new TextDecoder("utf-8").decode(this.msg.data);
                    this.msg.data = JSON.parse(this.msg.data);
                    break;
                case STRING_PAYLOAD:
                    this.msg.data = new TextDecoder("utf-8").decode(this.msg.data);
                    break;
                case BINARY_PAYLOAD:
                    break;
            }
            this.buf = null;
        }
    }
}

export class DataBuffer {
    buffers: ArrayBuffer[] = [];
    byteLength: number = 0;

    pack() : void {
        if(this.buffers.length > 1) {
            let v = this.buffers.splice(0, this.buffers.length);
            this.buffers.push(concat(...v));
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

}

export class ProtocolHandler implements TransportHandlers {
    infoReceived: boolean = false;
    subscriptions: Subscriptions;
    muxSubscriptions: MuxSubscription;
    inbound: DataBuffer;
    outbound: DataBuffer;
    state: ParserState = ParserState.AWAITING_CONTROL;
    pongs: Array<Function | undefined> = [];
    pout: number = 0;
    payload: MsgBuffer | null = null;
    clientHandlers: ClientHandlers;
    options: NatsConnectionOptions;
    transport!: Transport;
    connectError!: ErrorCallback | null;


    constructor(options: NatsConnectionOptions, handlers: ClientHandlers) {
        this.options = options;
        this.clientHandlers = handlers;
        this.subscriptions = new Subscriptions();
        this.muxSubscriptions = new MuxSubscription();
        this.inbound = new DataBuffer();
        this.outbound = new DataBuffer();
    }

    public static connect(options: NatsConnectionOptions, handlers: ClientHandlers): Promise<ProtocolHandler> {
        return new Promise<ProtocolHandler>((resolve, reject) => {
            let ph = new ProtocolHandler(options, handlers);
            ph.connectError = reject;
            let pongPromise = new Promise<boolean>((ok, fail) => {
                let timer = setTimeout(() => {
                    fail(new Error("timeout"));
                }, 10000);
                ph.pongs.push(() => {
                    clearTimeout(timer);
                    ok(true);
                });
            });

            WSTransport.connect(options, ph)
                .then((transport) => {
                    ph.transport = transport;
                })
                .catch((err) => {
                    ph.connectError = null;
                    reject(err);
                });

            pongPromise.then((ok) => {
                ph.connectError = null;
                resolve(ph);
            }).catch((err) => {
                ph.connectError = null;
                reject(err);
            });
        });
    }

    processInbound(): void {
        let m: RegExpExecArray | null = null;
        while (this.inbound.size()) {
            switch (this.state) {
                case ParserState.CLOSED:
                    return;
                case ParserState.AWAITING_CONTROL:
                    let raw = this.inbound.peek();
                    let buf = extractProtocolMessage(raw);

                    if ((m = MSG.exec(buf))) {
                        this.payload = new MsgBuffer(m, this.options.payload);
                        this.state = ParserState.AWAITING_MSG_PAYLOAD;
                    } else if ((m = OK.exec(buf))) {
                        // ignored
                    } else if ((m = ERR.exec(buf))) {
                        this.processError(m[1]);
                        return;
                    } else if ((m = PONG.exec(buf))) {
                        this.pout = 0;
                        let cb = this.pongs.shift();
                        if (cb) {
                            cb();
                        }
                    } else if ((m = PING.exec(buf))) {
                        this.transport.write(buildWSMessage(PONG_RESPONSE));
                    } else if ((m = INFO.exec(buf))) {
                        if (!this.infoReceived) {
                            // send connect
                            let info = JSON.parse(m[1]);
                            if (info.tls_required && !this.transport.isSecure()) {
                                // fixme: normalize error format
                                this.handleError(new NatsError('wss required', 'wss required'));
                                return;
                            }
                            let cs = JSON.stringify(new Connect(this.options));
                            this.transport.write(buildWSMessage(`${CONNECT} ${cs}${CR_LF}`));
                            this.sendSubscriptions();
                            this.transport.write(buildWSMessage(PING_REQUEST));
                            this.infoReceived = true;
                            this.flushPending();
                        }
                    } else {
                        return;
                    }
                    break;
                case ParserState.AWAITING_MSG_PAYLOAD:
                    if (!this.payload) {
                        break;
                    }
                    if (this.inbound.size() < this.payload.msg.size) {
                        let d = this.inbound.drain();
                        this.payload.fill(d);
                        return;
                    }
                    let dd = this.inbound.drain(this.payload.length);
                    this.payload.fill(dd);
                    this.processMsg();
                    this.state = ParserState.AWAITING_CONTROL;
                    this.payload = null;
                    break;
            }

            if (m) {
                let psize = m[0].length;
                if (psize >= this.inbound.size()) {
                    this.inbound.drain();
                } else {
                    this.inbound.drain(psize);
                }
                m = null;
            }
        }
    }

    processMsg() {
        if (!this.payload || !this.subscriptions.sidCounter) {
            return;
        }

        let m = this.payload;

        let sub = this.subscriptions.get(m.msg.sid);
        if (!sub) {
            return;
        }
        sub.received += 1;
        if (sub.callback) {
            sub.callback(m.msg);
        }
        if (sub.max !== undefined && sub.received >= sub.max) {
            this.unsubscribe(sub.sid);
        }
    }

    sendCommand(cmd: string | ArrayBuffer) {
        let buf: ArrayBuffer;
        if (typeof cmd === 'string') {
            buf = new TextEncoder().encode(cmd).buffer;
        } else {
            buf = cmd as ArrayBuffer;
        }
        if (cmd) {
            this.outbound.fill(buf);
        }

        let chunks = this.outbound.length();
        if (chunks === 1) {
            setTimeout(() => {
                this.flushPending();
            });
        } else if (chunks > FLUSH_THRESHOLD) {
            this.flushPending();
        }
    }

    publish(subject: string, data: ArrayBuffer, reply: string) {
        let len = Buffer.byteLength(data);
        reply = reply || "";

        let proto: string;
        if (reply) {
            proto = `PUB ${subject} ${reply} ${len}\r\n`;
        } else {
            proto = `PUB ${subject} ${len}\r\n`;
        }

        this.sendCommand(buildWSMessage(proto, data));
    }

    request(r: Req): Request {
        this.initMux();
        this.muxSubscriptions.add(r);
        return new Request(r, this);
    }

    subscribe(s: Sub): Subscription {
        let sub = this.subscriptions.add(s) as Sub;
        if (sub.queueGroup) {
            this.sendCommand(`SUB ${sub.subject} ${sub.queueGroup} ${sub.sid}\r\n`);
        } else {
            this.sendCommand(`SUB ${sub.subject} ${sub.sid}\r\n`);
        }
        return new Subscription(sub, this);
    }

    unsubscribe(sid: number, max?: number) {
        if (!sid || this.isClosed()) {
            return;
        }

        let s = this.subscriptions.get(sid);
        if (s) {
            if (max) {
                this.sendCommand(`UNSUB ${sid} ${max}\r\n`);
            } else {
                this.sendCommand(`UNSUB ${sid}\r\n`);
            }
            s.max = max;
            if (s.max === undefined || s.received >= s.max) {
                this.subscriptions.cancel(s);
            }
        }
    }

    cancelRequest(token: string, max?: number): void {
        if (!token || this.isClosed()) {
            return;
        }
        let r = this.muxSubscriptions.get(token);
        if (r) {
            r.max = max;
            if (r.max === undefined || r.received >= r.max) {
                this.muxSubscriptions.cancel(r);
            }
        }
    }

    flush(f?: Function): void {
        this.pongs.push(f);
        this.sendCommand(PING_REQUEST);
    }

    processError(s: string) {
        let err = new Error(s);
        let evt = {error: err} as ErrorEvent;
        this.errorHandler(evt);
    }

    sendSubscriptions() {
        let cmds: string[] = [];
        this.subscriptions.all().forEach((s) => {
            if (s.queueGroup) {
                cmds.push(`${SUB} ${s.subject} ${s.queueGroup} ${s.sid} ${CR_LF}`);
            } else {
                cmds.push(`${SUB} ${s.subject} ${s.sid} ${CR_LF}`);
            }
        });
        if(cmds.length) {
            this.transport.write(buildWSMessage(cmds.join('')));
        }
    }

    openHandler(evt: Event): void {
    }

    closeHandler(evt: CloseEvent): void {
        this.close();
        this.clientHandlers.closeHandler();
    }

    errorHandler(evt: Event | Error): void {
        let err;
        if (evt) {
            err = (evt as ErrorEvent).error;
        }
        this.handleError(err);
    }

    messageHandler(evt: MessageEvent): void {
        this.inbound.fill(evt.data);
        this.processInbound();
    }

    close(): void {
        this.transport.close();
        this.state = ParserState.CLOSED;
    }

    isClosed(): boolean {
        return this.transport.isClosed();
    }

    private flushPending() {
        if (!this.infoReceived) {
            console.log('flush - no info, waiting');
            return;
        }

        if (this.outbound.size()) {
            let d = this.outbound.drain();
            this.transport.write(d);
        }
    }

    private initMux(): void {
        let mux = this.subscriptions.getMux();
        if (!mux) {
            let inbox = this.muxSubscriptions.init();
            let sub = defaultSub();
            // dot is already part of mux
            sub.subject = `${inbox}*`;
            sub.callback = this.muxSubscriptions.dispatcher();
            this.subscriptions.setMux(sub);
            this.subscribe(sub);
        }
    }

    private handleError(err: Error) {
        if (this.connectError) {
            this.connectError(err);
            this.connectError = null;
        }
        this.close();
        this.clientHandlers.errorHandler(err);
    }
}