import {extend} from "./util";
import {ClientEventMap} from "./nats";
import {
    ClientHandlers,
    defaultReq,
    defaultSub,
    Msg,
    MsgCallback,
    ProtocolHandler,
    RequestOptions,
    Subscription
} from "./protocol";
import {NatsError} from "./error";
import {Nuid} from "js-nuid/src/nuid"

const nuid = new Nuid();


export const BAD_SUBJECT_MSG = 'Subject must be supplied';
export const BAD_AUTHENTICATION = 'BAD_AUTHENTICATION';

export const BAD_SUBJECT = 'BAD_SUBJECT';

const BAD_AUTHENTICATION_MSG = 'User and Token can not both be provided';


export interface NatsConnectionOptions {
    url: string;
    name?: string;
    json?: boolean;
    user?: string;
    pass?: string;
    token?: string;
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

export function connect(opts: NatsConnectionOptions): Promise<NatsConnection> {
    return NatsConnection.connect(opts);
}


export class NatsConnection implements ClientHandlers {
    options: NatsConnectionOptions;
    protocol!: ProtocolHandler;
    closeListeners: Callback[] = [];
    errorListeners: ErrorCallback[] = [];


    private constructor(opts: NatsConnectionOptions) {
        this.options = {url: "ws://localhost:4222"} as NatsConnectionOptions;
        if (opts.json === undefined) {
            opts.json = false;
        }

        if (opts.user && opts.token) {
            throw (new NatsError(BAD_AUTHENTICATION_MSG, BAD_AUTHENTICATION));
        }
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

    publish(subject: string, data: any = undefined, reply: string = ""): NatsConnection {
        subject = subject || "";
        if (subject.length === 0) {
            this.errorHandler(new Error("subject required"));
            return this;
        }

        if (!this.options.json) {
            data = data || "";
        } else {
            data = data === undefined ? null : data;
        }

        if (this.options.json) {
            data = JSON.stringify(data);
        }
        //@ts-ignore
        let len = data.length;

        reply = reply || "";

        if (reply) {
            this.protocol.sendCommand(`PUB ${subject} ${reply} ${len}\r\n${data}\r\n`);
        } else {
            this.protocol.sendCommand(`PUB ${subject} ${len}\r\n${data}\r\n`);
        }

        return this;
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

    request(subject: string, timeout: number = 1000, data?: string | null): Promise<Msg> {
        return new Promise<Msg>((resolve, reject) => {
            if (this.isClosed()) {
                //FIXME: proper error
                reject(new NatsError("closed", "closed"));
            }
            let r = defaultReq();
            let opts = {max: 1} as RequestOptions;
            extend(r, opts);
            r.token = nuid.next();
            //@ts-ignore
            r.timeout = setTimeout(() => {
                reject('timeout');
            }, timeout);
            r.callback = (msg: Msg) => {
                resolve(msg);
            };
            this.protocol.request(r);
            this.publish(subject, data, `${this.protocol.muxSubscriptions.baseInbox}${r.token}`);
        });
    }


    /**
     * Flushes to the server. If a callback is provided, the callback is c
     * @param {Function} cb - optional
     * @returns {Promise<void> | void}
     */
    flush(cb?: Function): Promise<void> | void {
        if (cb === undefined) {
            return new Promise((resolve) => {
                this.protocol.flush(() => {
                    resolve();
                });
            });
        } else {
            this.protocol.flush(cb);
        }
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






