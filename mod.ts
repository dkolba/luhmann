import { render } from "./deps.ts";
import { parse } from "./deps.ts";
import { extract, test } from "./deps.ts";
import { log } from "./deps.ts";

export type SnippetType = {
  mdName?: string;
  title?: string;
  date?: Date;
  dateStamp?: string;
  teaser?: string;
};

type GenericSnippetFunc = <T extends SnippetType>(args: T) => string;

type Markdown = {
  mdName: string;
  mdContent: string;
};
type Frontmatter = {
  mdName: string;
  frontmatter: Record<string, unknown>;
};

export type StyleSheetLinksType = string[];

type TemplateType = (
  html: string,
  stylesheetlinks: StyleSheetLinksType,
  css: string,
) => string;

type ServeZettelkastenType = {
  conn: Deno.Conn;
  template?: TemplateType;
  snippet?: GenericSnippetFunc;
  stylesheetlinks?: StyleSheetLinksType;
  css?: string;
  zettelResource: string;
};

type HomeHandlerType = {
  template: TemplateType;
  snippet: GenericSnippetFunc;
  stylesheetlinks: StyleSheetLinksType;
  css: string;
  resource: string;
};

type PathHandlerType = HomeHandlerType & {
  pathname: string;
};

export const simpleTemplate = (
  body = "",
  stylesheetlinks: StyleSheetLinksType = [],
  css = "",
) => {
  const stylesheets = stylesheetlinks.length > 0
    ? stylesheetlinks.map(
      (styl) => `<link rel="stylesheet" href="${styl}" />`,
    )
    : "";

  return `<!doctype html>
  <html lang=en>
    <head>
      <meta charset=utf-8>
      <title>Zettelkasten</title>
      ${stylesheets}
      <style>
        main {
          max-width: 800px;
          margin: 0 auto;
        }
        ${css}
      </style>
    </head>
    <body>
      <main data-color-mode="light" data-light-theme="light" data-dark-theme="dark" class="markdown-body">
      ${body}
    </main>
  </body>
</html>
`;
};

export const simpleSnippet = ({
  mdName = "missing name",
  title = "missing title",
  date = new Date(),
  dateStamp = "",
  teaser = "missing teaser",
}: SnippetType) =>
  `<section>
                      <h2><a href="/${mdName}">${title}</a></h2>
                      <time datetime="${date.toUTCString()}">${dateStamp}</time>
                      <span>${teaser}</span>
		    </section>`;

export async function validateDocs(
  documentResponses: Response[],
  documentList: string[],
) {
  const validDocs = [];
  for (const [i, doc] of documentResponses.entries()) {
    const fileName = documentList[i];
    try {
      checkStatusCode(doc?.status, fileName);
    } catch (_err) {
      log.error(`HTTP status code ${doc?.status} for file ${fileName}`);
      // Error with document, skip to next in loop
      continue;
    }
    // Shave of ".md" file ending from file name
    const mdName = fileName.split(".").slice(0, -1).join(".");
    validDocs.push({ mdName, mdContent: await doc.text() });
  }
  return validDocs;
}

export function teaserifyDocs(documents: Markdown[]) {
  const teasers: Frontmatter[] = [];
  for (const doc of documents) {
    if (!(typeof doc?.mdContent === "string")) continue;
    if (!test(doc?.mdContent)) continue;
    let teaser;
    try {
      teaser = generateDocument(doc);
    } catch (err) {
      log.error(`${err.message} while generating article.`);
      continue;
    }
    teasers.push(teaser);
  }
  return teasers;
}

const checkResponse = (response: Response, resource: string) => {
  // check if status code is 200
  if (!response) {
    throw new Error(`${resource} response is undefined`);
  }
  if (response.status === 502) {
    throw new Error("Status code 502, Bad Gateway", {
      cause: `${response.url} does not exist`,
    });
  }
  if (response.status === 404) {
    throw new Error(`Status code 404 for ${resource}`, {
      cause: `${response.url} does not exist`,
    });
  }
  if (response.status !== 200) {
    throw new Error("Status code NOT 200 OK", {
      cause: `${response.url} does not exist`,
    });
  }
};

const checkStatusCode = (statusCode: number | undefined, resource: string) => {
  // check if status code is 200
  if (statusCode !== 200) {
    throw new Error(
      `${resource} HTTP status code '${statusCode}' does not equal '200'`,
    );
  }
};

const checkContentType = (
  contentType: string | null | undefined,
  resource: string,
) => {
  // check if content-type is not 'text/html', because we expect yaml or markdown
  if (contentType === "text/html") {
    throw new Error(
      `${resource} HTTP content-type '${contentType}' is invalid`,
    );
  }
};

const handleNetworkError = () => {
  return new Response("Bad Gateway: Network error while fetching...", {
    status: 502,
  });
};

const fetchArticles = async (fileName: string, resource: string) =>
  await fetch(`${resource}${fileName}`).catch(handleNetworkError);

export const generateDocument = ({ mdName, mdContent }: Markdown) => {
  const { attrs: frontmatter, body: markdown } = extract(mdContent);
  if (!frontmatter) {
    log.error("document doesn't contain front matter");
  }
  return {
    mdName,
    frontmatter,
    markdown,
  };
};

export function markupify(
  { mdName, frontmatter }: Frontmatter,
  snippet: GenericSnippetFunc,
) {
  const { title, date, teaser } = frontmatter as SnippetType;
  const dateObj = date as Date;
  const dateStamp = dateObj.toLocaleString("de-de").split(",")[0];
  return snippet({
    title,
    date,
    teaser,
    mdName,
    dateStamp,
  });
}

async function homeHandler({
  template,
  snippet,
  stylesheetlinks,
  css,
  resource,
}: HomeHandlerType) {
  const sitemapResource = "sitemap.yaml";
  const sitemapResponse = await fetch(`${resource}${sitemapResource}`).catch(
    handleNetworkError,
  );

  checkResponse(sitemapResponse, sitemapResource);
  checkStatusCode(sitemapResponse?.status, sitemapResource);
  checkContentType(
    sitemapResponse?.headers?.get("Content-Type"),
    sitemapResource,
  );

  const sitemapbody = await sitemapResponse?.text();

  const parsedYamlDocList = parse(sitemapbody) as string[];
  const docs = await Promise.all(
    parsedYamlDocList.map((docname) => fetchArticles(docname, resource)),
  );

  const validDocs = await validateDocs(docs, parsedYamlDocList);
  const teasers = await teaserifyDocs(validDocs);
  const allSnippets = teasers.map((teaser) => markupify(teaser, snippet));
  const body = template(allSnippets?.toString(), stylesheetlinks, css);
  // back to the client.

  const headers = new Headers({
    "content-type": "text/html",
  });
  return { body, headers, status: 200 };
}

export async function pathHandler({
  pathname,
  template,
  snippet,
  stylesheetlinks,
  css,
  resource,
}: PathHandlerType) {
  log.info(`PATHNAME: ${pathname}`);
  const mdName = pathname.substring(1);
  const markdownDocResponse = await fetch(`${resource}${mdName}.md`).catch(
    handleNetworkError,
  );
  checkStatusCode(markdownDocResponse?.status, mdName);

  const mdContent = await markdownDocResponse.text();
  test(mdContent);
  const mdDoc = {
    mdName,
    mdContent,
  };
  const document = generateDocument(mdDoc);
  const markup = markupify(document, snippet) + render(document.markdown);
  const headers = new Headers({
    "content-type": "text/html",
  });
  const body = template(markup?.toString(), stylesheetlinks, css);
  return { body, headers, status: 200 };
}

function reply({
  body,
  headers,
  status,
}: {
  body: string;
  headers: Headers;
  status: number;
}) {
  return new Response(body, {
    headers: headers,
    status,
  });
}

const smash = {
  badImplementation(err: Error) {
    log.error(`SMASH("Bad Implementation"): ${err}`);
    return {
      body: "HIDE ME: Bad Implementation",
      headers: new Headers({
        "content-type": "text/html",
      }),
      status: 500,
    };
  },
  notImplemented(err: Error) {
    log.error(`SMASH("Not Implemented"): ${err}`);
    return {
      body: "HIDE ME: Not Implemented",
      headers: new Headers({
        "content-type": "text/html",
      }),
      status: 501,
    };
  },
  badGateway(err: Error) {
    log.error(`SMASH("Bad Gateway"): ${err}`);
    return {
      body: "Bad Gateway",
      headers: new Headers({
        "content-type": "text/html",
      }),
      status: 502,
    };
  },
  serverUnavailable(err: Error) {
    log.error(`SMASH("Server Unavailable"): ${err}`);
    return {
      body: "Server Unavailable",
      headers: new Headers({
        "content-type": "text/html",
      }),
      status: 503,
    };
  },
  gatewayTimeout(err: Error) {
    log.error(`SMASH("Gateway Timeout"): ${err}`);
    return {
      body: "Gateway Timeout",
      headers: new Headers({
        "content-type": "text/html",
      }),
      status: 504,
    };
  },
};

const handleErrorResponse = (err: Error) => {
  const { name, message, cause } = err;
  // TODO: remove
  log.error(`MSTR - caught this error: ${err}`);
  log.error(`MSTR - error name: ${name}`);
  log.error(`MSTR - error msg: ${message}`);
  log.error(`MSTR - error cause: ${cause}`);
  log.error(`MSTR - error all: ${err}`);
  switch (true) {
    // TODO: remove
    case err.cause === "Felt sick":
      return smash.badGateway(err);
    case err.message === "Status code 404":
      return smash.gatewayTimeout(err);
    case err.message === "Status code 404 for sitemap.yaml":
      return smash.gatewayTimeout(err);
    case err.message === "parsedYaml.map is not a function":
      return smash.badImplementation(err);
    case err.name === "YAMLError":
      return smash.badGateway(err);
    case err.message === "parsedYamlDocList.map is not a function":
      return smash.badGateway(err);
    case err.message === "Unexpected end of input":
      return smash.badImplementation(err);
    case err.message === "Unsupported front matter format":
      return smash.badImplementation(err);
    case err.message === "Unable to test for unknown front matter format":
      return smash.badImplementation(err);
    default:
      return smash.badImplementation(err);
  }
};

export async function serveZettelkasten({
  conn,
  template = simpleTemplate,
  snippet = simpleSnippet,
  stylesheetlinks = [],
  css = "",
  zettelResource,
}: ServeZettelkastenType) {
  // TODO: Throw error if zettelResource is undefined
  // This "upgrades" a network connection into an HTTP connection.
  const httpConn = Deno.serveHttp(conn);
  // Each request sent over the HTTP connection will be yielded as an async
  // iterator from the HTTP connection.
  for await (const { request, respondWith } of httpConn) {
    const { pathname } = new URL(request.url);
    if (pathname === "/") {
      log.info("Home route '/' was called");
      respondWith(
        reply(
          await homeHandler({
            template,
            snippet,
            stylesheetlinks,
            css,
            resource: zettelResource,
          }).catch(handleErrorResponse),
        ),
      ).catch((err) => {
        // TODO: How to handle this error?
        log.critical(`Refreshed too fast...🏎️ : ${err}`);
      });
    }
    if (pathname === "/favicon.ico") {
      log.info("Favicon route '/favicon.ico' was called");
      // TODO: Deliver favicon
      respondWith(
        reply({
          body: "404",
          headers: new Headers({
            "content-type": "text/html",
          }),
          status: 404,
        }),
      ).catch((err) => {
        log.critical(`Refreshed favicon too fast...🏎️ : ${err}`);
      });
    }
    if (pathname !== "/" && pathname !== "/favicon.ico") {
      console.info("PATH was: ", pathname);
      log.info(`Path route '${pathname}' was called`);
      respondWith(
        reply(
          await pathHandler({
            pathname,
            template,
            snippet,
            stylesheetlinks,
            css,
            resource: zettelResource,
          }).catch(handleErrorResponse),
        ),
      ).catch((err) => {
        // TODO: How to handle this error?
        log.critical(`Refreshed too fast, too furious...🏎️ 🚙 : ${err}`);
      });
    }
  }
}
