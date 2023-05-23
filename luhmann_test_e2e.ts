import { assertSnapshot } from "./dev_deps.ts";
import { parse } from "./deps.ts";

const baseFileUrl = " http://localhost:4507/";
const baseTestUrl = "http://localhost:8080/";
const sitemapResource = "sitemap.yaml";

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
