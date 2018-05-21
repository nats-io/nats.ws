import {NatsConnection} from "../src/nats";
import {NatsWsProxy} from "./helpers/nats-wsproxy";
import test from "ava";
import {startServer, stopServer} from "./helpers/nats_server_control";

let WSPORT = 54567;
let PORT = 43598;


test.before(async (t) => {
    let server = await startServer(PORT, ['--auth', 'tokenxxxx']);
    let wse = new NatsWsProxy(WSPORT, `localhost:${PORT}`);
    t.context = {wse: wse, server: server};
});

test.after.always((t) => {
    //@ts-ignore
    t.context.wse.shutdown();
    //@ts-ignore
    stopServer(t.context.server);
});


test('token no auth', async (t) => {
    t.plan(2);
    try {
        await NatsConnection.connect({url: `ws://localhost:${WSPORT}`});
    } catch (err) {
        t.truthy(err);
        t.regex(err.message, /Authorization/);
    }
});

test('token bad auth', async (t) => {
    t.plan(2);
    try {
        await NatsConnection.connect({url: `ws://localhost:${WSPORT}`, token: 'bad'});
    } catch (err) {
        t.truthy(err);
        t.regex(err.message, /Authorization/);
    }
});

test('token auth', async (t) => {
    t.plan(1);
    let nc = await NatsConnection.connect({url: `ws://localhost:${WSPORT}`, token: 'tokenxxxx'});
    nc.close();
    t.pass();
});
