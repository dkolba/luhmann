import { assert, assertSnapshot } from "./dev_deps.ts";
import { parse } from "./deps.ts";

const baseFileUrl = " http://localhost:4507/";
const baseTestUrl = "http://localhost:8080/";
const sitemapResource = "sitemap.yaml";

Deno.test("e2e isEtagHit", async function (): Promise<void> {
  // Get the homepage the first time
  const homePageResponse = await fetch(baseTestUrl);
  // Dispose of the response to prevent a 'leaking resources' error
  await homePageResponse.body?.cancel();
  // Extract the etag from header for reuse in the next request
  const etag = await homePageResponse.headers.get("etag");
  const headers = { headers: { "If-None-Match": etag ? etag : "NOETAG" } };
  // Get the homepage the second time, now with If-None-Match header
  const homePageIfNoneMatch = await fetch(baseTestUrl, headers);
  // Again, dispose of the response to prevent a 'leaking resources' error
  await homePageIfNoneMatch.body?.cancel();

  await assert(homePageIfNoneMatch.status === 304);
});

Deno.test("e2e isSnapshotMatch", async function (t): Promise<void> {
  const homePageResponse = await fetch(baseTestUrl);
  const homePageText = await homePageResponse.text();

  await assertSnapshot(t, homePageText);

  const sitemapResponse = await fetch(`${baseFileUrl}${sitemapResource}`);
  const sitemapbody = await sitemapResponse?.text();
  const parsedYamlDocList = parse(sitemapbody) as string[];

  for (const doc of parsedYamlDocList) {
    const mdName = doc.split(".").slice(0, -1).join(".");
    const docResponse = await fetch(`${baseTestUrl}${mdName}`);
    const docText = await docResponse.text();

    await assertSnapshot(t, docText);
  }
});
