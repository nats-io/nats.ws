/*
 * Copyright 2018 The NATS Authors
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

import {connect, Msg, Payload, SubscribeOptions} from "../src/nats";
import test from "ava";
import {WSTransport} from "../src/transport";
import {Lock} from "./helpers/latch";

import {Nuid} from "js-nuid/lib/src/nuid"
import {SC, startServer, stopServer} from "./helpers/nats_server_control";
import {DataBuffer} from "../src/databuffer";
import {ErrorCode, NatsError} from "../src/error";

const nuid = new Nuid();

test.before(async (t) => {
    let server = await startServer();
    t.context = {server: server};
});

test.after.always((t) => {
    //@ts-ignore
    stopServer(t.context.server);
});

test('connect', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    nc.close();
    t.pass();
});

test('fail connect', async (t) => {
    t.plan(1);
    try {
        let nc = await connect({url: `ws://localhost:32001`});
        nc.close();
        t.fail();
    } catch (ex) {
        let err = ex as NatsError;
        t.is(err.code, ErrorCode.CONNECTION_REFUSED)
    }
});

test('publish', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    nc.publish('foo', '');
    await nc.flush();
    nc.close();
    t.pass();
});

test('no publish without subject', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    nc.addEventListener('error', (ex) => {
        //@ts-ignore
        let nex = ex as NatsError;
        t.is(nex.code, ErrorCode.BAD_SUBJECT);
        lock.unlock();
    });
    nc.publish("");
    return lock.latch;
});

test('subscribe and unsubscribe', async (t) => {
    t.plan(10);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let subject = nuid.next();
    let sub = await nc.subscribe(subject, () => {
    }, {max: 1000, queueGroup: 'aaa'});
    t.is(sub.sid, 1);
    t.is(nc.protocol.subscriptions.length, 1);
    let s = nc.protocol.subscriptions.get(1);
    if (s) {
        t.is(s.received, 0);
        t.is(s.subject, subject);
        t.truthy(s.callback);
        t.is(s.max, 1000);
        t.is(s.queueGroup, 'aaa');
    }
    // change the expected max
    sub.unsubscribe(10);
    t.is(nc.protocol.subscriptions.length, 1);
    s = nc.protocol.subscriptions.get(1);
    if (s) {
        t.is(s.max, 10);
    }
    // unsub
    sub.unsubscribe(0);
    t.is(nc.protocol.subscriptions.length, 0);
    nc.close();
});

test('subscriptions fire callbacks', async t => {
    t.plan(2);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let s = nuid.next();
    let sub = await nc.subscribe(s, (msg: Msg) => {
        t.pass();
        lock.unlock();
    });
    await nc.flush();
    nc.publish(s);
    await lock.latch;
    let sd = nc.protocol.subscriptions.get(1);
    if (sd) {
        t.is(sd.received, 1);
    }
    sub.unsubscribe();
    nc.close();
});


test('subscriptions pass exact subjects to cb', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let s = nuid.next();
    let subj = `${s}.foo.bar.baz`;
    let sub = await nc.subscribe(`${s}.*.*.*`, (msg: Msg) => {
        t.is(msg.subject, subj);
        lock.unlock();
    });

    nc.publish(subj);
    await lock.latch;
    sub.unsubscribe();
    nc.close();
});

test('subscriptions returns Subscription', async (t) => {
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let subj = nuid.next();
    let sub = await nc.subscribe(subj, () => {
    });
    t.is(sub.sid, 1);
    sub.unsubscribe();
    nc.close();
});


test('wildcard subscriptions', async (t) => {
    t.plan(3);
    let single = 3;
    let partial = 2;
    let full = 5;

    let singleCounter = 0;
    let partialCounter = 0;
    let fullCounter = 0;

    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});

    let s = nuid.next();
    let singleSub = await nc.subscribe(`${s}.*`, () => {
        singleCounter++;
    });
    let partialSub = await nc.subscribe(`${s}.foo.bar.*`, () => {
        partialCounter++;
    });
    let fullSub = await nc.subscribe(`${s}.foo.>`, () => {
        fullCounter++;
    });

    nc.publish(`${s}.bar`);
    nc.publish(`${s}.baz`);
    nc.publish(`${s}.foo.bar.1`);
    nc.publish(`${s}.foo.bar.2`);
    nc.publish(`${s}.foo.baz.3`);
    nc.publish(`${s}.foo.baz.foo`);
    nc.publish(`${s}.foo.baz`);
    nc.publish(`${s}.foo`);

    await nc.flush();
    t.is(singleCounter, single);
    t.is(partialCounter, partial);
    t.is(fullCounter, full);

    singleSub.unsubscribe();
    partialSub.unsubscribe();
    fullSub.unsubscribe();
    nc.close();

});


test('correct data in message', async (t) => {
    t.plan(3);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let subj = nuid.next();

    let lock = new Lock();
    let sub = await nc.subscribe(subj, (m) => {
        t.is(m.subject, subj);
        //@ts-ignore
        t.is(m.data, '0xFEEDFACE');
        t.is(m.reply, undefined);
        lock.unlock();
    }, {max: 1});

    nc.publish(subj, '0xFEEDFACE');
    await lock.latch;
    sub.unsubscribe();
    nc.close();
});

test('correct reply in message', async (t) => {
    t.plan(2);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let s = nuid.next();
    let r = nuid.next();

    let lock = new Lock();
    let sub = await nc.subscribe(s, (m) => {
        t.is(m.subject, s);
        t.is(m.reply, r);
        lock.unlock();
    }, {max: 1});

    nc.publish(s, '', r);
    await lock.latch;
    sub.unsubscribe();
    nc.close();
});

test('closed cannot subscribe', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    nc.close();
    try {
        await nc.subscribe('foo', () => {
        })
    } catch (err) {
        t.pass();
    }
});

test('close cannot request', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    nc.close();
    try {
        await nc.request('foo');
    } catch (err) {
        t.pass();
    }
});

test('flush calls callback', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let lock = new Lock();
    let p = nc.flush(() => {
        t.pass();
        lock.unlock();
    });

    if (p) {
        t.fail('should have not returned a promise');
    }

    await lock.latch;
    nc.close();
});

test('flush without callback returns promise', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let p = nc.flush();
    if (!p) {
        t.fail('should have returned a promise');
    }
    await p;
    t.pass();
    nc.close();
});


test('unsubscribe after close', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let sub = await nc.subscribe(nuid.next(), () => {
    });
    nc.close();
    sub.unsubscribe();
    t.pass();
});

test('unsubscribe stops messages', async (t) => {
    t.plan(1);
    let received = 0;
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let subj = nuid.next();
    let sub = await nc.subscribe(subj, () => {
        received++;
        sub.unsubscribe();
    });
    nc.publish(subj);
    nc.publish(subj);
    nc.publish(subj);
    nc.publish(subj);

    await nc.flush();
    t.is(received, 1);
    sub.unsubscribe();
    nc.close();
});


test('request', async t => {
    t.plan(1);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let s = nuid.next();
    let sub = await nc.subscribe(s, (msg: Msg) => {
        if (msg.reply) {
            nc.publish(msg.reply, "foo");
        }
    });
    let msg = await nc.request(s, 1000, "test");
    //@ts-ignore
    t.is(msg.data, "foo");
    sub.unsubscribe();
    nc.close();
});

test('request timeout', async t => {
    t.plan(1);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let s = nuid.next();
    try {
        await nc.request(s, 100, "test");
    } catch (err) {
        t.pass();
        nc.close();
    }
});


test('close listener is called', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    nc.addEventListener('close', () => {
        t.pass();
        lock.unlock();
    });

    let stream = (nc.protocol.transport as WSTransport).stream;
    if (stream) {
        stream.close();
    }
    await lock.latch;
});

test('error listener is called', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    nc.addEventListener('error', () => {
        t.pass();
        lock.unlock();
    });

    // make the server angry
    (nc.protocol.transport as WSTransport).write(DataBuffer.fromAscii('HelloWorld'));
    await lock.latch;
});

test('chaining', async (t) => {
    t.plan(3);
    let lock = new Lock(2);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let subjects = [];
    subjects.push(nuid.next());
    subjects.push(nuid.next());
    nc.subscribe(subjects[0], () => {
        t.pass();
        lock.unlock();
    });
    nc.subscribe(subjects[1], () => {
        t.pass();
        lock.unlock();
    });
    nc.publish(subjects[0]).publish(subjects[1]).flush();
    t.pass();
    return lock.latch;
});

test('subscription with timeout', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let to = setTimeout(() => {
        t.pass();
        lock.unlock();
    });
    nc.subscribe(nuid.next(), () => {
        //@ts-ignore
    }, {max: 1, timeout: to});
    nc.flush();
    return lock.latch;
});

test('subscription expecting 2 fires timeout', async (t) => {
    t.plan(2);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let subj = nuid.next();
    let sub = await nc.subscribe(subj, () => {
        t.pass();
    }, {max: 2});
    sub.setTimeout(250, () => {
        t.pass();
        lock.unlock();
    });
    nc.publish(subj);
    nc.flush();
    return lock.latch;
});

test('subscription timeout with count is autocancel', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});

    let subj = nuid.next();
    let sub = await nc.subscribe(subj, () => {
    }, {max: 2} as SubscribeOptions);
    sub.setTimeout(500, () => {
        t.fail("didn't get expected message count");
    });
    nc.publish(subj);
    nc.publish(subj);
    nc.flush();
    setTimeout(() => {
        lock.unlock();
        t.pass();
    }, 600);
    return lock.latch;
});

test('subscription cancel timeout', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});

    let subj = nuid.next();
    let sub = await nc.subscribe(subj, () => {
        if (sub.hasTimeout()) {
            sub.cancelTimeout();
        }
    }, {max: 2} as SubscribeOptions);
    sub.setTimeout(500, () => {
        t.fail('timeout fired');
    });

    nc.publish(subj);
    nc.flush();
    setTimeout(() => {
        lock.unlock();
        t.pass();
    }, 600);
    return lock.latch;
});

test('subscription timeout is cancelled', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});

    let subj = nuid.next();
    let sub = await nc.subscribe(subj, () => {
        t.pass();
    });
    sub.setTimeout(200, () => {
        t.fail();
    });
    nc.publish(subj);
    nc.flush();
    setTimeout(() => {
        lock.unlock();
    }, 300);
    return lock.latch;
});

test('subscription received', async (t) => {
    t.plan(4);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let subj = nuid.next();
    let sub = await nc.subscribe(subj, () => {
        t.pass();
        if (sub.getReceived() === 3) {
            lock.unlock();
        }
    });
    sub.setTimeout(300, () => {
        t.fail();
    });
    // do it again
    sub.setTimeout(300, () => {
        t.fail();
    });
    nc.publish(subj);
    nc.publish(subj);
    nc.publish(subj);

    await lock.latch;
    sub.unsubscribe();
    t.is(0, sub.getReceived());
});

async function payloads(t: any, payload: string, ok: boolean) {
    t.plan(1);
    let sc = t.context as SC;
    try {
        //@ts-ignore
        let nc = await connect({url: sc.server.ws, payload: payload});
        if (ok) {
            t.pass();
        } else {
            t.fail();
        }
        nc.close();
    } catch (ex) {
        if (!ok) {
            t.pass();
        } else {
            t.fail(ex);
        }
    }
}

test('payload - json', payloads, Payload.JSON, true);
test('payload - binary', payloads, Payload.BINARY, true);
test('payload - string', payloads, Payload.STRING, true);
test('payload - test', payloads, 'test', false);

