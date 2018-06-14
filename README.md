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
    // if the connnection fails an exception is thrown
    let nc = await NatsConnection.connect({url: `ws://localhost:8080`});
    
    // if the server returns an error, lets learn about it
    nc.addEventListener('error', (ex)=> {
        console.log('server sent error: ', ex);
    });
    
    // if we disconnect from the server lets learn about it
    nc.addEventListener('close', ()=> {
        console.log('the connection closed');
    });   
    
    // publish a message
    // <subject>, <body of the message>
    nc.publish('hello', 'nats');
    
    // publish a request - need a subscription listening
    // <subject>, <body of the message>, <reply subject>
    nc.publish('hello', 'world', 'say.hi');
    
    
    // simple subscription
    let sub = await nc.subscribe('help', (msg: Msg) => {
        if (msg.reply) {
            nc.publish(msg.reply, `I can help ${msg.data}`);
        }
    });
    
    // subscriptions can be serviced by a member of a queue
    // the options argument can also specify the 'max' number
    // messages before the subscription auto-unsubscribes
    let queuesub = await nc.subscribe('urgent.help', (msg: Msg) => {
        if (msg.reply) {
            nc.publish(msg.reply, `I can help ${msg.data}`);
        }
    }, {queueGroup: "urgent"});

    // simple request
    let msg = await nc.request('help', 1000, 'nats request');
    console.log(`I got a response: ${msg.data}`);
    
    // flushing
    await nc.flush();
    
    // stop listening for 'help' messages - you optionally specify
    // the number of messages you want before the unsubscribed
    // if the count has passed, the unsubscribe happens immediately
    sub.unsubscribe();
    
    // close the connection
    nc.close();
}
```

## NATS in the Browser

Here's an example (check `examples/chat.html` for the latest version) of 
a chat application using ws-nats.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ws-nats chat</title>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css"
          crossorigin="anonymous">
</head>
<!-- when the browser exits, we publish a message -->
<body onunload="exiting()">

<!-- a form for entering messages -->
<div class="container">
    <h1>ws-nats chat</h1>
    <input type="text" class="form-control" id="data" placeholder="Message" autocomplete="off"><br/>
    <button id="send" onclick="send()" class="btn btn-primary">Send</button>
</div>
<br/>

<!-- a place to record messages -->
<div id="chats" class="container"></div>

<!-- load the nats library -->
<script src="../lib/nats.js"></script>

<script>
    let me = Date.now();

    // this will block until we initialize or fail
    init();

    // create a connection, and register listeners
    async function init() {
        try {
            // if the connection doesn't resolve, an exception is thrown
            // a real app would allow configuring the URL
            let conn = await nats.connect({url: "ws://localhost:8080", payload: "json"});

            // handle errors sent by the gnatsd - permissions errors, etc.
            conn.addEventListener('error', (ex) => {
                addEntry(`Received error from NATS: ${ex}`);
            });

            // handle connection to the server is closed - should disable the ui
            conn.addEventListener('close', () => {
                addEntry("NATS connection closed");
            });

            // the chat application listens for messages sent under the subject 'chat'
            conn.subscribe("chat", (msg) => {
                addEntry(msg.data.id === me ? `(me): ${msg.data.m}` : `(${msg.data.id}): ${msg.data.m}`);
            });

            // when a new browser joins, the joining browser publishes an 'enter' message
            conn.subscribe("enter", (msg) => {
                if (msg.data.id !== me) {
                    addEntry(`${msg.data.id} entered.`);
                }
            });

            // when a browser closes, the leaving browser publishes an 'exit' message
            conn.subscribe("exit", (msg) => {
                if (msg.data.id !== me) {
                    addEntry(`${msg.data.id} exited.`);
                }
            });

            // we connected, and we publish our enter message
            conn.publish('enter', {id: me});

            window.nc = conn;
        } catch (ex) {
            // show the user there was an error - should disable the ui
            addEntry(`Error connecting to NATS: ${ex}`);
            return null;
        }
    }

    // this is the input field
    let input = document.getElementById('data');

    // add a listener to detect edits. If they hit Enter, we publish it
    input.addEventListener("keyup", (e) => {
        if (e.key === "Enter") {
            document.getElementById("send").click();
        } else {
            e.preventDefault();
        }
    });

    // send a message if user typed one
    function send() {
        input = document.getElementById('data');
        let m = input.value;
        if (m !== "") {
            window.nc.publish('chat', {id: me, m: m});
            input.value = "";
        }
        return false;
    }

    // send the exit message
    function exiting() {
        if(nc) {
            window.nc.publish('exit', {id: me});
        }
    }

    // add an entry to the document
    function addEntry(s) {
        let p = document.createElement("pre");
        p.appendChild(document.createTextNode(s));
        document.getElementById('chats').appendChild(p);
    }
</script>
</body>
</html>
```
