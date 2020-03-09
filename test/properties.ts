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

import test from "ava"
import {Connect, VERSION} from "../src/protocol"
import {connect, NatsConnectionOptions, Payload} from "../src/nats"

test('VERSION is semver', (t) => {
    t.regex(VERSION, /[0-9]+\.[0-9]+\.[0-9]+/)
})

test('VERSION matches package.json', (t) => {
    // we are getting build in lib/test
    let v = require('../../package.json').version
    t.is(v, VERSION)
})

test('connect is a function', (t) => {
    t.is(typeof connect, 'function');
});

test('default connect properties', (t) => {
    let c = new Connect();
    t.is(c.lang, "javascript");
    t.truthy(c.version);
    t.is(c.verbose, false);
    t.is(c.pedantic, false);
    t.is(c.protocol, 1);
    t.is(c.user, undefined);
    t.is(c.pass, undefined);
    t.is(c.auth_token, undefined);
    t.is(c.name, undefined);
});

test('configured options', (t) => {
    let nco = {} as NatsConnectionOptions;
    nco.payload = Payload.BINARY;
    nco.name = "test";
    nco.pass = "secret";
    nco.user = "me";
    nco.token = "abc";
    nco.pedantic = true;
    nco.verbose = true;

    let c = new Connect(nco);
    t.is(c.verbose, nco.verbose);
    t.is(c.pedantic, nco.pedantic);
    //@ts-ignore
    t.is(c.payload, nco.payload);
    t.is(c.name, nco.name);
    t.is(c.user, nco.user);
    t.is(c.pass, nco.pass);
    t.is(c.auth_token, nco.token)
});