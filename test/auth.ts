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

import {connect} from "../src/nats";
import test from "ava";
import {SC, startServer, stopServer} from "./helpers/nats_server_control";
import {AUTHORIZATION_VIOLATION, NatsError, PERMISSIONS_VIOLATION} from "../src/error";
import {jsonToNatsConf, writeFile} from "./helpers/nats_conf_utils";
import {Nuid} from 'js-nuid/src/nuid'
import {Lock} from "./helpers/latch";

const nuid = new Nuid();

let CONF_DIR = (process.env.TRAVIS) ? process.env.TRAVIS_BUILD_DIR : process.env.TMPDIR;


test.before(async (t) => {
    let conf = {
        authorization: {
            PERM: {
                subscribe: "bar",
                publish: "foo"
            },
            users: [{
                user: 'derek',
                password: 'foobar',
                permission: '$PERM'
            }
            ]
        }
    };

    let fp = CONF_DIR + '/' + nuid.next() + ".conf";
    t.log(fp);
    writeFile(fp, jsonToNatsConf(conf));
    let server = await startServer("localhost:0", ['--', '-c', fp]);
    t.context = {server: server}
});

test.after.always((t) => {
    stopServer((t.context as SC).server);
});


test('no auth', async (t) => {
    t.plan(1);
    try {
        let sc = t.context as SC;
        await connect({url: sc.server.ws});
    } catch (ex) {
        let err = ex as NatsError;
        t.is(err.code, AUTHORIZATION_VIOLATION);
    }
});

test('bad auth', async (t) => {
    t.plan(1);
    try {
        let sc = t.context as SC;
        await connect({url: sc.server.ws, user: 'me', pass: 'hello'});
    } catch (ex) {
        let err = ex as NatsError;
        t.is(err.code, AUTHORIZATION_VIOLATION);
    }
});

test('auth', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws, user: 'derek', pass: 'foobar'});
    nc.close();
    t.pass();
});


test('cannot sub to foo', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws, user: 'derek', pass: 'foobar'});
    nc.addEventListener('error', (err) => {
        //@ts-ignore
        let ne = err as NatsError;
        t.is(ne.code, PERMISSIONS_VIOLATION);
        lock.unlock();

    });

    nc.subscribe("foo", () => {
        t.fail('should not have been called');
    });

    nc.publish("foo");
    nc.flush();

    return lock.latch;
});

test('cannot pub bar', async (t) => {
    t.plan(1);
    let lock = new Lock();
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws, user: 'derek', pass: 'foobar'});
    nc.addEventListener('error', (err) => {
        //@ts-ignore
        let ne = err as NatsError;
        t.is(ne.code, PERMISSIONS_VIOLATION);
        lock.unlock();

    });

    nc.subscribe("bar", () => {
        t.fail('should not have been called');
    });

    nc.publish("bar");
    nc.flush();

    return lock.latch;
});

test('no user and token', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    try {
        let nc = await connect({url: sc.server.ws, user: 'derek', token: 'foobar'});
        t.fail();
        nc.close();
    } catch (ex) {
        t.pass();
    }
});
