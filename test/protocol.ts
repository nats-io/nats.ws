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

import test from "ava"
import {ClientHandlers, defaultReq, MuxSubscription, ProtocolHandler, Sub, Subscriptions} from "../src/protocol"
import {ConnectionOptions, Msg} from "../src/nats"
import {Lock} from "./helpers/latch"
import {TransportHandlers, WSTransport} from "../src/transport"
import {DataBuffer} from "../src/databuffer"

test('partial messages correctly', async (t) => {
    t.plan(3)
    let lock = new Lock(3)

    let protocol = new ProtocolHandler({} as ConnectionOptions, {} as ClientHandlers)
    protocol.infoReceived = true

    // feed the inbound with arrays of 1 byte at a time
    let data = 'MSG test.foo 1 11\r\nHello World\r\nMSG test.bar 1 11\r\nHello World\r\nMSG test.baz 1 11\r\nHello World\r\nPONG\r\n'
    let chunks: ArrayBuffer[] = [];
    let te = new TextEncoder();
    for (let i = 0; i < data.length; i++) {
        chunks.push(te.encode(data.charAt(i)).buffer);
    }

    let s = {} as Sub;
    s.sid = 1;
    s.subject = "test.*";
    s.callback = (msg => {
        t.is(msg.data, "Hello World");
        lock.unlock();
    });

    protocol.subscriptions.add(s);

    function f(i: number) {
        setTimeout(() => {
            protocol.inbound.fill(chunks[i]);
            protocol.processInbound();
        });
    }

    for (let i = 0; i < chunks.length; i++) {
        f(i);
    }

    return lock.latch;
});

// this test is about coverage - we don't implement
// reconnect, so subscriptions cannot be added until
// a connection is resolved.
test('send subs', async (t) => {
    t.plan(1);
    let protocol = new ProtocolHandler({} as ConnectionOptions, {} as ClientHandlers)
    // not connected!
    protocol.transport = new WSTransport({} as TransportHandlers);
    //@ts-ignore
    protocol.flushPending();
    protocol.processMsg();

    protocol.subscribe({sid: 1, subject: "test"} as Sub);
    protocol.subscribe({sid: 2, subject: "test", queue: "a"} as Sub);

    let info = 'INFO {"server_id":"9yK5cBjrCQXW5ds4BAYmOs","version":"1.2.0-beta3","git_commit":"","go":"go1.10.1","host":"127.0.0.1","port":61258,"auth_required":false,"tls_required":false,"tls_verify":false,"max_payload":1048576}\r\n';
    protocol.inbound.fill(DataBuffer.fromAscii(info));
    protocol.processInbound();

    t.pass();
});


test('mux subscription unknown return null', (t) => {
    t.plan(4);
    let mux = new MuxSubscription();
    mux.init();

    let r = defaultReq();
    r.token = "alberto";
    //@ts-ignore
    r.received = "foo";
    mux.add(r);
    t.is(mux.length, 1);
    t.deepEqual(mux.get("alberto"), r);
    t.is(mux.getToken({subject: ""} as Msg), null);
    mux.cancel(r);
    t.is(mux.length, 0);

    let x = defaultReq();
    x.token = "bbbb";
    mux.cancel(x);
});

test('bad dispatch is noop', (t) => {
    let mux = new MuxSubscription();
    mux.init();
    mux.dispatcher()({subject: "foo"} as Msg);
    t.pass();
});

test('dispatch without max', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let mux = new MuxSubscription();
    mux.init();
    let r = defaultReq();
    r.token = "foo";
    // max in requests is supposed to be 1 - this just for coverage
    r.max = 2;
    r.callback = () => {
        t.is(mux.length, 1);
        lock.unlock();
    };
    mux.add(r);

    let m = {} as Msg;
    m.subject = mux.baseInbox + "foo";
    let f = mux.dispatcher();
    f(m);
    return lock.latch;
});


test("subs all", (t) => {
    t.plan(6);
    let subs = new Subscriptions();
    let s = {} as Sub;
    s.subject = "hello";
    s.timeout = 1;
    s.received = 0;
    subs.add(s);
    t.is(subs.length, 1);
    t.is(s.sid, 1);
    t.is(subs.sidCounter, 1);
    t.deepEqual(subs.get(1), s);
    let a = subs.all();
    t.is(a.length, 1);
    subs.cancel(a[0]);
    t.is(subs.length, 0);
});

test('cancel unknown sub', (t) => {
    t.plan(2);
    let subs = new Subscriptions();
    let s = {} as Sub;
    s.subject = "hello";
    t.is(subs.length, 0);
    subs.cancel(s);
    t.is(subs.length, 0);
});
