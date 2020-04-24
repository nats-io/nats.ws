# NATS - Websocket Javascript Client for the Browser


A websocket client for the [NATS messaging system](https://nats.io).

[![License](https://img.shields.io/badge/Licence-Apache%202.0-blue.svg)](./LICENSE.txt)
[![Travis branch](https://img.shields.io/travis/nats-io/nats.ws/master.svg)]()
[![Coverage Status](https://coveralls.io/repos/github/nats-io/nats.ws/badge.svg?branch=master)](https://coveralls.io/github/nats-io/nats.ws?branch=master)[![npm](https://img.shields.io/npm/v/nats.ws.svg)](https://www.npmjs.com/package/nats.ws)
[![npm](https://img.shields.io/npm/dm/nats.ws.svg)](https://www.npmjs.com/package/nats.ws)

# Installation

> :warning: If you have used a preview version of nats.ws, the API for message callbacks has changed.
> Previous versions of the API simply required a message argument. The current version of the API 
> normalizes against v2 branches for nats.js and nats.ts. The message handler signature is 
> `(err: NatsError|null, m: Msg)`, where an error will be set if there was a problem.
> This change enables the opportunity to associate errors related to the subscription such as
> JSON decoding errors, and others.

** :warning: NATS.ws is a preview** you can get the current development version by:

```bash
npm install nats.ws@next
```

Nats.ws requires a nats-server with websocket support. The nats-server implementation only supports WSS, so you'll need
 some TLS certificates.

# Basic Usage
nats.ws supports Promises, depending on the browser/runtime environment you can also use async-await constructs.

Load the library:
```html
<script src='node_modules/nats.ws/nats.js'></script>
```

In another script block, reference the 'nats' global:
```javascript
const init = async function () {
// create a connection
  const nc = await nats.connect({ url: 'ws://localhost:8080', payload: nats.Payload.STRING })

  // simple publisher
  nc.publish('hello', 'nats')

  // simple subscriber, if the message has a reply subject
  // send a reply
  const sub = await nc.subscribe('help', (err, msg) => {
    if (err) {
      // handle error
    }
    else if (msg.reply) {
      nc.publish(msg.reply, `I can help ${msg.data}`)
    }
  })

  // unsubscribe
  sub.unsubscribe()

  // request data - requests only receive one message
  // to receive multiple messages, create a subscription
  const msg = await nc.request('help', 1000, 'nats request')
  console.log(msg.data)

  // publishing a request, is similar to publishing. You must have
  // a subscription ready to handle the reply subject. Requests
  // sent this way can get multiple replies
  nc.publish('help', '', 'replysubject')


  // close the connection
  nc.close()

}

init()
```

## Wildcard Subscriptions
```javascript
// the `*` matches any string in the subject token
const sub = await nc.subscribe('help.*.system', (_, msg) => {
    if (msg.reply) {
        nc.publish(msg.reply, `I can help ${msg.data}`)
    }
})
sub.unsubscribe()

const sub2 = await nc.subscribe('help.me.*', (_, msg) => {
  if (msg.reply) {
    nc.publish(msg.reply, `I can help ${msg.data}`)
  }
})

// the `>` matches any tokens, can only be at the last token
const sub3 = await nc.subscribe('help.>', (_, msg) => {
  if (msg.reply) {
    nc.publish(msg.reply, `I can help ${msg.data}`)
  }
})
```

## Queue Groups
```javascript
// All subscriptions with the same queue name form a queue group.
// The server will select a single subscriber in each queue group
// matching the subscription to receive the message.
const qsub = await nc.subscribe('urgent.help', (_, msg) => {
  if (msg.reply) {
     nc.publish(msg.reply, `I can help ${msg.data}`)
  }
}, {queue: "urgent"})
```

## Authentication
```javascript
// if the websocket server requires authentication, 
// provide it in the URL. NATS credentials are specified
// in the `user`, `pass` or `token` options in the NatsConnectionOptions

let nc = nats.connect({url: "ws://wsuser:wsuserpass@localhost:8080", user: "me", pass: "secret"})
let nc1 = nats.connect({url: "ws://localhost:8080", user: "jenny", token: "867-5309"})
let nc3 = nats.connect({url: "ws://localhost:8080", token: "t0pS3cret!"})
```

## Advanced Usage

### Flush
```javascript
// flush does a round trip to the server. When it
// returns the the server saw it
await nc.flush()

// or with a custom callback
nc.flush(()=>{
  console.log('sent!')
});

// or publish a few things, and wait for the flush
await nc.publish('foo').publish('bar').flush()
```

### Auto unsubscribe
```javascript
// subscriptions can auto unsubscribe after a certain number of messages
const sub = await nc.subscribe('foo', ()=> {}, {max:10})

// the number can be changed or set afterwards
// if the number is less than the number of received
// messages it cancels immediately
let next = sub.getReceived() + 1
sub.unsubscribe(next)
```

### Timeout Subscriptions
```javascript
// subscriptions can specify attach a timeout
// timeout will clear with first message
const sub = await nc.subscribe('foo', ()=> {})
sub.setTimeout(300, ()=> {
  console.log('no messages received')
})

// if 10 messages are not received, timeout fires
const sub = await nc.subscribe('foo', ()=> {}, {max:10})
sub.setTimeout(300, ()=> {
    console.log(`got ${sub.getReceived()} messages. Was expecting 10`)
})

// timeout can be cancelled
sub.clearTimeout()
```

### Error Handling
```javascript
// when server returns an error, you are notified asynchronously
nc.addEventListener('error', (ex)=> {
  console.log('server sent error: ', ex)
});

// when disconnected from the server, the 'close' event is sent
nc.addEventListener('close', ()=> {
  console.log('the connection closed')
})
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
<script src="../nats.js"></script>

<script>
const Payload = nats.Payload
const me = Date.now()

// create a connection, and register listeners
const init = async function () {
  // if the connection doesn't resolve, an exception is thrown
  // a real app would allow configuring the URL
  const conn = await nats.connect({ url: '{{WSURL}}', payload: Payload.JSON })

  // handle errors sent by the gnatsd - permissions errors, etc.
  conn.addEventListener('error', (ex) => {
    addEntry(`Received error from NATS: ${ex}`)
  })

  // handle connection to the server is closed - should disable the ui
  conn.addEventListener('close', () => {
    addEntry('NATS connection closed')
  })

  // the chat application listens for messages sent under the subject 'chat'
  conn.subscribe('chat', (_, msg) => {
    addEntry(msg.data.id === me ? `(me): ${msg.data.m}` : `(${msg.data.id}): ${msg.data.m}`)
  })

  // when a new browser joins, the joining browser publishes an 'enter' message
  conn.subscribe('enter', (_, msg) => {
    if (msg.data.id !== me) {
      addEntry(`${msg.data.id} entered.`)
    }
  })

  // when a browser closes, the leaving browser publishes an 'exit' message
  conn.subscribe('exit', (_, msg) => {
    if (msg.data.id !== me) {
      addEntry(`${msg.data.id} exited.`)
    }
  })

  // we connected, and we publish our enter message
  conn.publish('enter', { id: me })
  return conn
}

init().then(conn => {
  window.nc = conn
}).catch(ex => {
  addEntry(`Error connecting to NATS: ${ex}`)
})

// this is the input field
let input = document.getElementById('data')

// add a listener to detect edits. If they hit Enter, we publish it
input.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('send').click()
  } else {
    e.preventDefault()
  }
})

// send a message if user typed one
function send () {
  input = document.getElementById('data')
  const m = input.value
  if (m !== '' && window.nc) {
    window.nc.publish('chat', { id: me, m: m })
    input.value = ''
  }
  return false
}

// send the exit message
function exiting () {
  if (window.nc) {
    window.nc.publish('exit', { id: me })
  }
}

// add an entry to the document
function addEntry (s) {
  const p = document.createElement('pre')
  p.appendChild(document.createTextNode(s))
  document.getElementById('chats').appendChild(p)
}
</script>
</body>
</html>
```

## NATS in the React components

Here is an example how to use it in React components:

```javascript
import React, { Component } from 'react';
import { NatsConnection, Payload } from 'nats.ws'


class ChatHistory extends Component {

    constructor() {
        super();

        this.state = {
            messages: []
        }
    }

    async componentDidMount() {

        let conn = await NatsConnection.connect({ url: 'wss://localhost:9222', payload: Payload.JSON })

        conn.subscribe('newMessages', (err, msg) => {
            console.log(msg.data);
            this.setState({messages: [...this.state.messages, msg.data]})
        });
    }

    render() {
        return (
            <div>
                    {
                        this.state.messages &&
                        this.state.messages.map((msg,i) => 
                            <div key={i}>{msg.text}</div>
                        )

                    }
            </div>
        )
    }

}

export default ChatHistory
```