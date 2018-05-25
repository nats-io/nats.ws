import {connect} from "../src/nats";
import test from "ava";
import {SC, startServer, stopServer} from "./helpers/nats_server_control";


test.before(async (t) => {
    let server = await startServer("", ['--', '-p', '-1', '--auth', 'tokenxxxx']);
    t.context = {server: server};
});

test.after.always((t) => {
    stopServer((t.context as SC).server);
});


test('token no auth', async (t) => {
    t.plan(2);
    try {
        let sc = t.context as SC;
        await connect({url: sc.server.ws});
    } catch (err) {
        t.truthy(err);
        t.regex(err.message, /Authorization/);
    }
});

test('token bad auth', async (t) => {
    t.plan(2);
    try {
        let sc = t.context as SC;
        await connect({url: sc.server.ws, token: 'bad'});
    } catch (err) {
        t.truthy(err);
        t.regex(err.message, /Authorization/);
    }
});

test('token auth', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws, token: 'tokenxxxx'});
    nc.close();
    t.pass();
});
