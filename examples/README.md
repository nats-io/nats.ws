# Examples

These are the canonical examples for using nats.ws on the browser. The pages 
embed the directive `{{WSURL}}`, which should be replaced by the URL to the WS server.
If using the [`wsgnatsd`](https://github.com/aricart/wsgnatsd) example proxy server, 
the server automatically processes these directives and replaces them with the URL 
to the server automatically.

To run `wsgnatsd` cd to the root directory of the project so that examples, and lib have
the same parent directory

```bash
wsgnatsd -p 80
```

Then on your browser enter the URL http://localhost/examples/{example file}.

