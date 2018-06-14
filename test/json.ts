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

import {test} from "ava";
import {connect, Msg, NatsConnection, Payload} from "../src/nats";
import {Lock} from "./helpers/latch";
import {SC, startServer, stopServer} from "./helpers/nats_server_control";
import {Nuid} from 'js-nuid/src/nuid';

const nuid = new Nuid();


test.before(async (t) => {
    let server = await startServer();
    let nc = await NatsConnection.connect({url: server.ws, payload: Payload.JSON});
    t.context = {server: server, nc: nc};
});

test.after.always((t) => {
    //@ts-ignore
    stopServer(t.context.server);
});


test('connect no json propagates options', async (t) => {
    t.plan(2);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws});
    t.is(nc.options.payload, Payload.STRING, 'nc options');
    t.is(nc.protocol.options.payload, Payload.STRING, 'protocol');
    nc.close();
});

test('connect json propagates options', async (t) => {
    t.plan(2);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws, payload: Payload.JSON});
    t.is(nc.options.payload, Payload.JSON, 'nc options');
    t.is(nc.protocol.options.payload, Payload.JSON, 'protocol');
    nc.close();
});

function macro(t: any, input: any): Promise<any> {
    t.plan(1);
    let lock = new Lock();
    try {
        let subj = nuid.next();
        let nc = t.context.nc;
        nc.subscribe(subj, (msg: Msg) => {
            // in JSON undefined is translated to null
            if (input === undefined) {
                input = null;
            }
            //@ts-ignore
            t.deepEqual(msg.data, input);
            // t.log([input, '===', msg.data]);
            lock.unlock();
        });

        nc.publish(subj, input);
        nc.flush();
    } catch (err) {
        t.log(err);
    }
    return lock.latch;
}

test('string', macro, 'helloworld');
test('empty', macro, '');
test('null', macro, null);
test('undefined', macro, undefined);
test('number', macro, 10);
test('false', macro, false);
test('true', macro, true);
test('empty array', macro, []);
test('any array', macro, [1, 'a', false, 3.1416]);
test('empty object', macro, {});
test('object', macro, {a: 1, b: false, c: 'name', d: 3.1416});
