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

import {SC, startServer, stopServer} from "./helpers/nats_server_control";
import test from "ava";
import {connect} from "../src/nats";
import {Lock} from "./helpers/latch";

test.before(async (t) => {
    let server = await startServer();
    t.context = {server: server};
});

test.after.always((t) => {
    //@ts-ignore
    stopServer(t.context.server);
});

let max = 10000;
test(`pubsub`, async (t) => {
    t.plan(1);
    let lock = new Lock(max);
    let count = 0;
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    let sub = await nc.subscribe("foo", (msg) => {
        lock.unlock();
        count++;
        if (count >= max) {
            t.pass();
        }
    }, {max: max});

    nc.flush();
    for (let i = 0; i < max; i++) {
        nc.publish('foo');
    }
    return lock.latch;
});


test(`pub`, async (t) => {
    t.plan(1);
    let lock = new Lock(max);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});

    nc.flush();
    for (let i = 0; i < max; i++) {
        nc.publish('foo');
        lock.unlock();
    }
    await lock.latch;
    await nc.flush();
    t.pass();
});