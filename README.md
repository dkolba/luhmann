# LUHMANN

A lightweight Deno library to dynamically generate a full website from a markdown Zettelkasten.

## WHAT?

Luhmann fetches markdown files from somewhere on the internet and converts them to a website.

## GETTING STARTED

```
import { serveZettelkasten } from "../luhmann.ts";
const zettelResource = "http://example.com/";

const server = Deno.listen({ port: 8080 });
console.log(`HTTP webserver running.  Access it at:  http://localhost:8080/`);

// Serve the Zettelkasten
for await (const conn of server) {
  serveZettelkastenn, zettelResource });
}

```

### TESTS

Enter the examples folder. Then run either of the following:

_Unit tests_

    deno task test

_E2E tests_

    deno task file_server &
    deno task dev &
    deno task test_e2e

### PRIOR ART

This app was heavily inspired by [MD-Party](https://github.com/memowe/md-party)
