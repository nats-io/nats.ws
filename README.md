# NATS - Websocket Javascript Client for the Browser


A websocket client for the [NATS messaging system](https://nats.io).

[![License](https://img.shields.io/badge/Licence-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/dm/nats.ws.svg)](https://www.npmjs.com/package/nats.ws)


## Installation

>** :warning: NATS.ws is a release candidate** you can get the current candidate by:

```bash
npm install nats.ws
```

Getting started with NATS.ws requires a little of preparation:

- You'll need a recent NATS server that supports websockets
- An HTTP server to serve HTML and the nats library

To make it easy, the nats.ws github repo aids you with this setup, however you'll need a few simple requirements installed.
If you are on windows, you'll need to look at the package.json for hints on what to do.

Here are the steps:


```bash
# clone the nats.ws repository:
git clone https://github.com/nats-io/nats.ws.git

# install [deno](https://deno.land):
npm run setup

# build the library
npm run build

# install the master of nats-server, if you have 
# [Go](https://golang.org/doc/install) installed,
# you can easily clone and build the latest from
# master:
npm run install-ns

# start the built nats-server:
npm run start-nats

# start an http server to serve the content in
# the examples directory:
npm run start-http

# point your browser to: http://localhost:4507/examples
# click on one of the HTML files

```

## Documentation

NATS.ws shares all client API and examples with 
[nats.deno repo](https://github.com/nats-io/nats.deno)


## Importing the Module
nats.ws is an async nats client. The model a standard ES Module. Copy the nats.mjs 
module from node_modules (if you didn't build it yourself), and place it where you 
can reference it from your code:

```html
<script type="module">
  // load the library
  import { connect } from './nats.mjs'
  // do something with it...
</script>
```

## Connection Options Specific to nats.ws

By default, the nats-server will serve WSS connections only.


The `nats-server` gossips cluster configuration to clients. Cluster
configuration however is disseminated as `host:port`. With websockets, 
a connection is made using an URL which means that the protocol specifies
whether the connection is encrypted or not. By default,
the nats.ws client assumes any specified `host:port` is available
via `wss://host:port`.

If your cluster security not uniform (mixes `ws://` and `wss://`), 
you'll need to disable server advertising or on the client specify 
the `ignoreServerUpdates` connection option. Of course in this case
you are responsible for providing all the URLs for the cluster if
you want fail over. 


```typescript
  
  const conn = await connect(
    { servers: ["ws://localhost:9222", "wss://localhost:2229", "localhost:9111"] },
  );

```

In the above example, the first two URLs connect as per their protocol specifications.
The third server connects using `wss://` as that is the default.

If you are accessing websocket via a proxy, likely the `ignoreServerUpdates` should
be specified to avoid learning about servers that are not accessible from
the outside.


## Web Application Examples

For various examples of using NATS in the browser, checkout [examples](examples).

## Contributing

NATS.ws uses [deno](https://deno.land) to build and package the ES Module for the library.
The library shares client functionality with [NATS.deno](https://github.com/nats-io/nats.deno).
This means that both the NATS.deno and NATS.ws use the same exact code base, only differing
on the implementation of the `Transport`. This strategy greatly reduces the amount of work 
required to develop and maintain the clients.

Currently, the base client implementation is the deno implementation. You can take
a look at it [here](https://github.com/nats-io/nats.deno/tree/main/nats-base-client).


