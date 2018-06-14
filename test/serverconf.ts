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

import test from "ava";
import {jsonToNatsConf} from "./helpers/nats_conf_utils";


test('test serializing simple', (t) => {
    let x = {
        test: 'one'
    };
    let y = jsonToNatsConf(x);

    let buf = y.split('\n');
    buf.forEach(function (e, i) {
        buf[i] = e.trim();
    });

    let z = buf.join(' ');
    t.is(z, "test: one");
});

test('test serializing nested', (t) => {
    let x = {
        a: 'one',
        b: {
            a: 'two'
        }
    };
    let y = jsonToNatsConf(x);

    let buf = y.split('\n');
    buf.forEach(function (e, i) {
        buf[i] = e.trim();
    });

    let z = buf.join(' ');
    t.is(z, "a: one b { a: two }");
});

test('test serializing array', (t) => {
    let x = {
        a: 'one',
        b: ['a', 'b', 'c']
    };
    let y = jsonToNatsConf(x);

    let buf = y.split('\n');
    buf.forEach(function (e, i) {
        buf[i] = e.trim();
    });

    let z = buf.join(' ');
    t.is(z, "a: one b [ a b c ]");
});

test('test serializing array objs', (t) => {
    let x = {
        a: 'one',
        b: [{
            a: 'a'
        }, {
            b: 'b'
        }, {
            c: 'c'
        }]
    };
    let y = jsonToNatsConf(x);
    let buf = y.split('\n');
    buf.forEach(function (e, i) {
        buf[i] = e.trim();
    });

    let z = buf.join(' ');
    t.is(z, "a: one b [ { a: a } { b: b } { c: c } ]");
});

test('test serializing array arrays', (t) => {
    let x = {
        a: 'one',
        b: [{
            a: 'a',
            b: ['b', 'c']
        }, {
            b: 'b'
        }, {
            c: 'c'
        }]
    };
    let y = jsonToNatsConf(x);
    let buf = y.split('\n');
    buf.forEach(function (e, i) {
        buf[i] = e.trim();
    });

    let z = buf.join(' ');
    t.is(z, "a: one b [ { a: a b [ b c ] } { b: b } { c: c } ]");
});

test('strings that start with numbers are quoted', (t) => {
    let x = {
        a: '2hello',
        b: 2,
        c: "hello"
    };
    let y = jsonToNatsConf(x);
    let buf = y.split('\n');
    buf.forEach(function (e, i) {
        buf[i] = e.trim();
    });

    let z = buf.join(' ');
    t.is(z, 'a: "2hello" b: 2 c: hello');
});