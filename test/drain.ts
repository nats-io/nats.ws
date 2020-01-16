/*
 * Copyright 2020 The NATS Authors
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
 *
 */

import test from 'ava';
import {SC, startServer, stopServer} from './helpers/nats_server_control';
import {connect, Msg} from '../src/nats';
import {Lock} from './helpers/latch';
import {Nuid} from 'js-nuid'
import {Sub} from '../src/protocol';
import {ErrorCode} from "../src/error";

const nuid = new Nuid();

test.before(async (t) => {
    let server = await startServer();
    t.context = {server: server};
});

test.after.always((t) => {
    // @ts-ignore
    stopServer(t.context.server);
});

test('connection drains when no subs', async (t) => {
    t.plan(2);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let dp = await nc.drain();
    t.true(Array.isArray(dp));
    t.is(dp.length, 0);
    nc.close();
});

test('connection drain', async (t) => {
    t.plan(5);
    let lock = new Lock();
    let sc = t.context as SC;
    let subj = nuid.next();

    let nc1 = await connect({url: sc.server.ws});
    let c1 = 0;
    let s1 = await nc1.subscribe(subj, () => {
        c1++;
        if (c1 === 1) {
            let dp = nc1.drain();
            dp.then((subs: Sub[]) => {
                t.is(subs.length, 1);
                if (subs[0].sid) {
                    t.is(subs[0].sid, s1.sid);
                } else {
                    t.fail('unexpected resolve');
                }
                lock.unlock();
            }).catch((ex) => {
                t.fail(ex);
            });
        }
    }, {queue: 'q1'});

    let nc2 = await connect({url: sc.server.ws});
    let c2 = 0;
    await nc2.subscribe(subj, () => {
        c2++;
    }, {queue: 'q1'});

    await nc1.flush();
    await nc2.flush();

    for (let i = 0; i < 10000; i++) {
        nc2.publish(subj);
    }
    await nc2.flush();
    // @ts-ignore

    await lock.latch;

    t.is(c1 + c2, 10000);
    t.true(c1 >= 1, 's1 got more than one message');
    t.true(c2 >= 1, 's2 got more than one message');
    nc2.close();
});

test('subscription drain', async (t) => {
    t.plan(5);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});


    let subj = nuid.next();
    let c1 = 0;
    let s1 = await nc.subscribe(subj, () => {
        c1++;
        if (!s1.isDraining()) {
            // resolve when done
            s1.drain()
                .then((se: Sub) => {
                    t.is(se.sid, s1.sid);
                    lock.unlock();
                });
        }
    }, {queue: 'q1'});

    let c2 = 0;
    await nc.subscribe(subj, () => {
        c2++;
    }, {queue: 'q1'});


    for (let i = 0; i < 10000; i++) {
        nc.publish(subj);
    }
    await nc.flush();
    await lock.latch;

    t.is(c1 + c2, 10000);
    t.true(c1 >= 1, 's1 got more than one message');
    t.true(c2 >= 1, 's2 got more than one message');
    t.true(s1.isCancelled());
    nc.close();
});

test('publisher drain', async (t) => {
    t.plan(5);
    let lock = new Lock();
    let sc = t.context as SC;
    let subj = nuid.next();

    let nc1 = await connect({url: sc.server.ws});
    let c1 = 0;
    let s1 = await nc1.subscribe(subj, () => {
        c1++;
        if (c1 === 1) {
            let dp = nc1.drain();
            for (let i = 0; i < 100; i++) {
                nc1.publish(subj);
            }
            dp.then((subs: Sub[]) => {
                t.is(subs.length, 1);
                if (subs[0].sid) {
                    t.is(subs[0].sid, s1.sid);
                } else {
                    t.fail('unexpected resolve');
                }
                lock.unlock();
            })
                .catch((ex) => {
                    t.fail(ex);
                });
        }
    }, {queue: 'q1'});


    let nc2 = await connect({url: sc.server.ws});
    let c2 = 0;
    await nc2.subscribe(subj, () => {
        c2++;
    }, {queue: 'q1'});

    await nc1.flush();

    for (let i = 0; i < 10000; i++) {
        nc2.publish(subj);
    }
    await nc2.flush();

    await lock.latch;

    t.is(c1 + c2, 10000 + 100);
    t.true(c1 >= 1, 's1 got more than one message');
    t.true(c2 >= 1, 's2 got more than one message');
    nc2.close();
});

test('publish after drain fails', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let subj = nuid.next();
    let nc = await connect({url: sc.server.ws});
    await nc.subscribe(subj, () => {});
    await nc.drain();
    try {
        nc.publish(subj);
    } catch (err) {
        t.is(err.code, ErrorCode.CONNECTION_CLOSED);
    }
    nc.close();
});

test('reject reqrep during connection drain', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    let subj = 'xxxx';

    // start a service for replies
    let nc1 = await connect({url: sc.server.ws});
    await nc1.subscribe(subj + 'a', (msg: Msg) => {
        if (msg.reply) {
            nc1.publish(msg.reply, 'ok');
        }
    });
    nc1.flush();

    // start a client, and initialize requests
    let nc2 = await connect({url: sc.server.ws});
    // start a mux subscription
    await nc2.request(subj + 'a', 1000, 'initialize the request');

    let first = true;
    await nc2.subscribe(subj, async () => {
        if (first) {
            first = false;
            nc2.drain();
            try {
                // should fail
                await nc2.request(subj + 'a', 1000);
                t.fail('shouldn\'t have been able to request');
                lock.unlock();
            } catch (err) {
                t.is(err.code, ErrorCode.CONNECTION_DRAINING);
                lock.unlock();
            }
        }
    });
    // publish a trigger for the drain and requests
    for (let i = 0; i < 2; i++) {
        nc2.publish(subj, 'here');
    }
    nc2.flush();
    await lock.latch;
});

test('reject drain on closed', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc1 = await connect({url: sc.server.ws});
    nc1.close();
    await t.throwsAsync(() => {
        return nc1.drain();
    }, {code: ErrorCode.CONNECTION_CLOSED});
});

test('reject drain on draining', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc1 = await connect({url: sc.server.ws});
    nc1.drain();
    await t.throwsAsync(() => {
        return nc1.drain();
    }, {code: ErrorCode.CONNECTION_DRAINING});
});

test('reject subscribe on draining', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc1 = await connect({url: sc.server.ws});
    nc1.drain();
    await t.throwsAsync(() => {
        return nc1.subscribe('foo', () => {});
    }, {code: ErrorCode.CONNECTION_DRAINING});
});

test('reject subscription drain on closed sub', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc1 = await connect({url: sc.server.ws});
    let sub = await nc1.subscribe('foo', () => {});
    await sub.drain();
    await t.throwsAsync(() => {
        return sub.drain();
    }, {code: ErrorCode.SUB_CLOSED});
});

test('connection is closed after drain', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc1 = await connect({url: sc.server.ws});
    await nc1.subscribe('foo', () => {});
    await nc1.drain();
    t.true(nc1.isClosed());
});

test('reject subscription drain on closed', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc1 = await connect({url: sc.server.ws});
    let sub = await nc1.subscribe('foo', () => {});
    nc1.close();
    await t.throwsAsync(() => {
        return sub.drain();
    }, {code: ErrorCode.CONNECTION_CLOSED});
});

test('reject subscription drain on draining sub', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc1 = await connect({url: sc.server.ws});
    let subj = nuid.next();
    let sub = await nc1.subscribe(subj, async () => {
        sub.drain();
        await t.throwsAsync(() => {
            return sub.drain();
        }, {code: ErrorCode.SUB_DRAINING});
    });
    nc1.publish(subj);
    await nc1.flush();
});
