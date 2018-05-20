import {NatsConnectionOptions} from "./nats";
import {Transport, TransportHandlers, WSTransport} from "./transport";
import {NatsError} from "./error";
import {extend} from "./util";

const nuid = require('nuid');

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
    max?: number;
    timeout?: number;
}

export interface Base {
    subject: string;
    callback: MsgCallback;
    received: number;
    timeout?: number | null;
    max?: number | null;
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

    unsubscribe(max?: number): void {
        this.protocol.cancelRequest(this.token, max);
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
                    if (r.max === null) {
                        mux.cancel(r);
                    }
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
    data?: string;
}

export class MsgBuffer {
    msg: Msg;
    psize: number;
    chunks: string[] | null = null;

    constructor(chunks: RegExpExecArray) {
        this.msg = {} as Msg;
        this.msg.subject = chunks[1];
        this.msg.sid = parseInt(chunks[2], 10);
        this.msg.reply = chunks[4];
        this.msg.size = parseInt(chunks[5], 10);
        this.psize = this.msg.size + CR_LF_LEN;
    }

    push(s: string) {
        if (!this.chunks) {
            this.chunks = [];
        }
        this.chunks.push(s);
        this.psize -= s.length;

        if (this.psize === 0) {
            this.msg.data = this.chunks.join('').slice(0, this.msg.size);
        }
    }

    hasChunks(): boolean {
        return this.chunks != null && this.chunks.length > 0;
    }
}

export class DataBuffer {
    chunks: string[] = [];
    length: number = 0;

    size(): number {
        return this.chunks.length;
    }

    push(data: string) {
        if (data) {
            this.chunks.push(data);
            this.length += data.length;
        }
    }

    peek(): string {
        return this.chunks.join('');
    }

    drain(): string {
        let v = this.chunks.join('');
        this.chunks = [];
        this.length = 0;
        return v;
    }

    read(n: number): string {
        let v = this.chunks.join('');
        return v.slice(0, n);
    }

    slice(start: number) {
        let v = this.drain();
        v = v.slice(start);
        this.push(v);
    }
}

export class ProtocolHandler implements TransportHandlers {
    infoReceived: boolean = false;
    subscriptions: Subscriptions;
    muxSubscriptions: MuxSubscription;
    inbound: DataBuffer = new DataBuffer();
    outbound: DataBuffer = new DataBuffer();
    state: ParserState = ParserState.AWAITING_CONTROL;
    pongs: Array<Function | undefined> = [];
    pout: number = 0;
    payload: MsgBuffer | null = null;
    clientHandlers: ClientHandlers;
    options: NatsConnectionOptions;
    transport!: Transport;


    constructor(options: NatsConnectionOptions, handlers: ClientHandlers) {
        this.options = options;
        this.clientHandlers = handlers;
        this.subscriptions = new Subscriptions();
        this.muxSubscriptions = new MuxSubscription();
    }

    public static connect(options: NatsConnectionOptions, handlers: ClientHandlers): Promise<ProtocolHandler> {
        return new Promise<ProtocolHandler>((resolve, reject) => {
            let ph = new ProtocolHandler(options, handlers);
            let pongPromise = new Promise<boolean>((ok, fail) => {
                let timer = setTimeout(() => {
                    fail(new Error("timeout"));
                }, 10000);
                ph.pongs.push(() => {
                    clearTimeout(timer);
                    ok(true);
                });
            });

            WSTransport.connect(new URL(options.url), ph)
                .then((transport) => {
                    ph.transport = transport;
                })
                .catch((err) => {
                    reject(err);
                });

            pongPromise.then((ok) => {
                resolve(ph);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    processInbound(): void {
        let m: RegExpExecArray | null = null;
        while (this.inbound.length) {
            switch (this.state) {
                case ParserState.CLOSED:
                    return;
                case ParserState.AWAITING_CONTROL:
                    let buf = this.inbound.peek();
                    if ((m = MSG.exec(buf))) {
                        this.payload = new MsgBuffer(m);
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
                        this.transport.write(PONG_RESPONSE);
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
                            this.transport.write(`${CONNECT} ${cs}${CR_LF}`);
                            this.sendSubscriptions();
                            this.transport.write(PING_REQUEST);
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
                    if (this.inbound.length < this.payload.msg.size) {
                        let d = this.inbound.peek();
                        this.payload.push(d);
                        return;
                    }
                    let dd = this.inbound.read(this.payload.psize);
                    this.inbound.slice(this.payload.psize);
                    this.payload.push(dd);
                    this.processMsg();
                    this.state = ParserState.AWAITING_CONTROL;
                    this.payload = null;
                    break;
            }

            if (m) {
                let psize = m[0].length;
                if (psize >= this.inbound.length) {
                    this.inbound.drain();
                } else {
                    this.inbound.slice(psize);
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
    }

    sendCommand(cmd: string) {
        if (cmd && cmd.length) {
            this.outbound.push(cmd);
        }
        if (this.outbound.size() === 1) {
            setTimeout(() => {
                this.flushPending();
            });
        } else if (this.outbound.length > FLUSH_THRESHOLD) {
            this.flushPending();
        }
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
        console.error('error from server', s);
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
        this.transport.write(cmds.join(''));
    }

    openHandler(evt: Event): void {
    }

    closeHandler(evt: CloseEvent): void {
        this.close();
        this.clientHandlers.closeHandler();
    }

    errorHandler(evt: Event): void {
        let err;
        if (evt) {
            err = (evt as ErrorEvent).error;
        }
        this.handleError(err);
    }

    messageHandler(evt: MessageEvent): void {
        this.inbound.push(evt.data);
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
            return;
        }
        let d = this.outbound.drain();
        if (d) {
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
        this.close();
        this.clientHandlers.errorHandler(err);
    }
}