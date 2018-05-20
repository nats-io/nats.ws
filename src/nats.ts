import {extend} from "./util";
import {ClientEventMap} from "./nats";
import {
    ClientHandlers,
    defaultReq,
    defaultSub,
    MsgCallback,
    ProtocolHandler,
    Request,
    RequestOptions,
    Subscription
} from "./protocol";
import {NatsError} from "./error";

const nuid = require('nuid');

export const BAD_SUBJECT_MSG = 'Subject must be supplied';


export interface NatsConnectionOptions {
    url: string;
    name?: string;
}

export interface Callback {
    (): void;
}

export interface ErrorCallback {
    (error: Error): void;
}

export interface ClientEventMap {
    close: Callback;
    error: ErrorCallback;
}

export interface SubscribeOptions {
    queueGroup?: string;
    max?: number;
}


export class NatsConnection implements ClientHandlers {
    options: NatsConnectionOptions;
    protocol!: ProtocolHandler;
    closeListeners: Callback[] = [];
    errorListeners: ErrorCallback[] = [];

    private constructor(opts: NatsConnectionOptions) {
        this.options = {url: "ws://localhost:4222"} as NatsConnectionOptions;
        extend(this.options, opts);
    }

    public static connect(opts: NatsConnectionOptions): Promise<NatsConnection> {
        return new Promise<NatsConnection>((resolve, reject) => {
            let nc = new NatsConnection(opts);
            ProtocolHandler.connect(opts, nc)
                .then((ph) => {
                    nc.protocol = ph;
                    resolve(nc);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    close(): void {
        this.protocol.close();
    }

    publish(subject: string, data: string | null = "", reply: string="", cb?: Callback) {
        subject = subject || "";
        if (subject.length === 0) {
            this.errorHandler(new Error("subject required"));
            return;
        }
        data = data || "";
        reply = reply || "";

        if (reply) {
            this.protocol.sendCommand(`PUB ${subject} ${reply} ${data.length}\r\n${data}\r\n`);
        } else {
            this.protocol.sendCommand(`PUB ${subject} ${data.length}\r\n${data}\r\n`);
        }

        if(cb) {
            this.flush(cb);
        }
    }

    subscribe(subject: string, cb: MsgCallback, opts: SubscribeOptions = {}): Promise<Subscription> {
        return new Promise<Subscription>((resolve, reject) => {
            if (this.isClosed()) {
                //FIXME: proper error
                reject(new NatsError("closed", "closed"));
            }

            let s = defaultSub();
            extend(s, opts);
            s.subject = subject;
            s.callback = cb;
            resolve(this.protocol.subscribe(s));
        });
    }

    request(subject: string, cb: MsgCallback, data?: string | null, opts?: RequestOptions): Promise<Request> {
        return new Promise<Request>((resolve, reject) => {
            if (this.isClosed()) {
                //FIXME: proper error
                reject(new NatsError("closed", "closed"));
            }
            let r = defaultReq();
            opts = opts || {} as RequestOptions;
            extend(r, opts);
            r.token = nuid.next();
            r.callback = cb;
            resolve(this.protocol.request(r));
            this.publish(subject, data, `${this.protocol.muxSubscriptions.baseInbox}${r.token}`);
        });
    }


    flush(f?: Function): void {
        this.protocol.flush(f);
    }


    errorHandler(error: Error): void {
        this.errorListeners.forEach((cb) => {
            try {
                cb(error);
            } catch (ex) {
            }
        });
    }

    closeHandler(): void {
        this.closeListeners.forEach((cb) => {
            try {
                cb();
            } catch (ex) {
            }
        });
    }

    addEventListener<K extends keyof ClientEventMap>(type: K, listener: (this: NatsConnection, ev: ClientEventMap[K][]) => void): void {
        if (type === "close") {
            //@ts-ignore
            this.closeListeners.push(listener);
        } else if (type === "error") {
            //@ts-ignore
            this.errorListeners.push(listener);
        }
    }

    isClosed(): boolean {
        return this.protocol.isClosed();
    }
}






