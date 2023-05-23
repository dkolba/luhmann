import { assertSnapshot } from "./dev_deps.ts";
import {
  generateDocument,
  markupify,
  simpleSnippet,
  simpleTemplate,
  teaserifyDocs,
  validateDocs,
} from "./mod.ts";

const frontmatterMarkdownDocument = `---
title: A first test title
author: Boaty McBoatface
date: 2032-05-21
teaser: Best test teaser in the industry
---

## Test Headline 1

An unordered test list

- Test list item 1
- Test list item 2
- Test list item 3

An ordered test list

1. Test list item 4
2. Test list item 5
3. Test list item 6

### A test subheadling

Some test text`;

Deno.test("simpleTemplate isSnapshotMatch", async function (t): Promise<void> {
  const body = simpleTemplate("<span>TEST SPAN TAG</span>", [], "");
  await assertSnapshot(t, body);
});

Deno.test("validateDocs isSnapshotMatch", async function (t): Promise<void> {
  const docResponses = [
    new Response(frontmatterMarkdownDocument),
    new Response("## asdf"),
  ];
  const docList = ["test.md", "asdf.md"];
  const validDocs = await validateDocs(docResponses, docList);
  await assertSnapshot(t, validDocs);
});

Deno.test(
  "simpleSnippet with bare data isSnapshotMatch",
  async function (t): Promise<void> {
    const body = simpleSnippet({
      date: new Date(
        "Mon May 22 2023 21:57:18 GMT+0200 (Central European Summer Time"
      ),
    });
    await assertSnapshot(t, body);
  }
);

Deno.test(
  "simpleSnippet with full data isSnapshotMatch",
  async function (t): Promise<void> {
    const body = simpleSnippet({
      mdName: "testslug",
      title: "Test title",
      teaser: "Test teaser",
      date: new Date(
        "Mon May 22 2023 21:57:18 GMT+0200 (Central European Summer Time"
      ),
    });
    await assertSnapshot(t, body);
  }
);

Deno.test(
  "generateDocument isSnapshotMatch",
  async function (t): Promise<void> {
    const document = generateDocument({
      mdName: "testdoc.md",
      mdContent: frontmatterMarkdownDocument,
    });
    await assertSnapshot(t, document);
  }
);

Deno.test(
  "teaserifyDocs & markupify isSnapshotMatch",
  async function (t): Promise<void> {
    const validDocs = [
      {
        mdName: "test",
        mdContent: frontmatterMarkdownDocument,
      },
      { mdName: "asdf", mdContent: "## asdf" },
    ];
    const teasers = await teaserifyDocs(validDocs);
    await assertSnapshot(t, teasers);

    const markup = teasers.map((teaser) => markupify(teaser, simpleSnippet));
    await assertSnapshot(t, markup);
  }
);
