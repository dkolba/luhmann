import { serveZettelkasten } from "../mod.ts";
import "https://deno.land/std@0.186.0/dotenv/load.ts";

const css = "";

const zettelResource = Deno.env.get("ZETTELKASTEN") || "";
const stylesheetlinks = [`${zettelResource}paper.css`];

const server = Deno.listen({ port: Number(Deno.env.get("PORT")) || 8080 });
const keyValueStore = Deno.env.get("KV") || "DISABLE";
const ttl = 5000;
console.log(`HTTP webserver running.  Access it at:  http://localhost:8080/`);

// Connections to the server will be yielded up as an async iterable.
for await (const conn of server) {
  // In order to not be blocking, we need to handle each connection individually
  // without awaiting the function
  // serveZettelkasten(conn, template, snippet, stylesheetlinks, css);
  serveZettelkasten({
    conn,
    stylesheetlinks,
    css,
    zettelResource,
    keyValueStore,
    ttl,
  });
}
