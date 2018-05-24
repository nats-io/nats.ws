import {NatsConnection} from "../src/nats";
import {NatsWsProxy} from "./helpers/nats-wsproxy";
import test from "ava";
import {startServer, stopServer} from "./helpers/nats_server_control";

let WS_HOSTPORT = "127.0.0.1:45567";


test.before(async (t) => {
    let server = await startServer(WS_HOSTPORT, ['--', '-p', '-1', '--user', 'derek', '--pass', 'foobar']);
    t.context = {server: server};
});

test.after.always((t) => {
    //@ts-ignore
    stopServer(t.context.server);
});


test('no auth', async (t) => {
    t.plan(2);
    try {
        await NatsConnection.connect({url: `ws://${WS_HOSTPORT}`});
    } catch (err) {
        t.truthy(err);
        t.regex(err.message, /Authorization/);
    }
});

test('bad auth', async (t) => {
    t.plan(2);
    try {
        await NatsConnection.connect({url: `ws://${WS_HOSTPORT}`, user: 'me', pass: 'hello'});
    } catch (err) {
        t.truthy(err);
        t.regex(err.message, /Authorization/);
    }
});

test('auth', async (t) => {
    t.plan(1);
    let nc = await NatsConnection.connect({url: `ws://${WS_HOSTPORT}`, user: 'derek', pass: 'foobar'});
    nc.close();
    t.pass();
});
