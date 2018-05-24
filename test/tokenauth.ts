import {NatsConnection} from "../src/nats";
import test from "ava";
import {startServer, stopServer} from "./helpers/nats_server_control";

let WS_HOSTPORT = "127.0.0.1:54867";

test.before(async (t) => {
    let server = await startServer(WS_HOSTPORT, ['--', '-p', '-1', '--auth', 'tokenxxxx']);
    t.context = {server: server};
});

test.after.always((t) => {
    //@ts-ignore
    stopServer(t.context.server);
});


test('token no auth', async (t) => {
    t.plan(2);
    try {
        await NatsConnection.connect({url: `ws://${WS_HOSTPORT}`});
    } catch (err) {
        t.truthy(err);
        t.regex(err.message, /Authorization/);
    }
});

test('token bad auth', async (t) => {
    t.plan(2);
    try {
        await NatsConnection.connect({url: `ws://${WS_HOSTPORT}`, token: 'bad'});
    } catch (err) {
        t.truthy(err);
        t.regex(err.message, /Authorization/);
    }
});

test('token auth', async (t) => {
    t.plan(1);
    let nc = await NatsConnection.connect({url: `ws://${WS_HOSTPORT}`, token: 'tokenxxxx'});
    nc.close();
    t.pass();
});
