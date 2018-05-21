# NATS - Websocket Javascript Client

A websocket client for the [NATS messaging system](https://nats.io).

[![license](https://img.shields.io/github/license/nats-io/ws-nats.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Travis branch](https://img.shields.io/travis/nats-io/ws-nats/master.svg)]()
[![Coveralls github branch](https://img.shields.io/coveralls/github/nats-io/ws-nats/master.svg)]()
[![npm](https://img.shields.io/npm/v/wsnats.svg)](https://www.npmjs.com/package/wsnats)
[![npm](https://img.shields.io/npm/dm/wsnats.svg)](https://www.npmjs.com/package/wsnats)

# Installation

```bash
npm install wsnats
```

Ws-nats requires a websocket proxy, if the NATS server requires LTS, the websocket must be a secure websocket.

# API

Ws-nats supports Promises, depending on the browser/runtime environment you can also use async-await constructs.

```typescript

import {NatsConnection, Msg} from 'wsnats';

async function test() {
    let nc = await NatsConnection.connect({url: `ws://localhost:8080`});
    
    // publish a message
    nc.publish('hello', 'nats');
    
    // publish a request - need a subscription listening
    nc.publish('hello', 'world', 'say.hi');
    
    
    // simple subscription
    let sub = await nc.subscribe('help', (msg: Msg) => {
        if (msg.reply) {
            nc.publish(msg.reply, `I can help ${msg.data}`);
        }
    });
    
    // simple request
    let msg = await nc.request('help', 1000, 'nats request');
    console.log(`I got a response: ${msg.data}`);
    
    // flushing
    await nc.flush();
    
    // stop listening for 'help' messages
    sub.unsubscribe();
    
    // close the connection
    nc.close();
}
```

