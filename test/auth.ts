import {connect} from "../src/nats";
import test from "ava";
import {SC, startServer, stopServer} from "./helpers/nats_server_control";


test.before(async (t) => {
    t.log("TMDIR", process.env["TMPDIR"]);
    let server = await startServer("", ['--', '-p', '-1', '--user', 'derek', '--pass', 'foobar']);
    t.context = {server: server}
});

test.after.always((t) => {
    stopServer((t.context as SC).server);
});


test('no auth', async (t) => {
    t.plan(2);
    try {
        let sc = t.context as SC;
        await connect({url: sc.server.ws});
    } catch (err) {
        t.truthy(err);
        t.regex(err.message, /Authorization/);
    }
});

test('bad auth', async (t) => {
    t.plan(2);
    try {
        let sc = t.context as SC;
        await connect({url: sc.server.ws, user: 'me', pass: 'hello'});
    } catch (err) {
        t.truthy(err);
        t.regex(err.message, /Authorization/);
    }
});

test('auth', async (t) => {
    t.plan(1);
    let sc = t.context as SC;
    let nc = await connect({url: sc.server.ws, user: 'derek', pass: 'foobar'});
    nc.close();
    t.pass();
});
