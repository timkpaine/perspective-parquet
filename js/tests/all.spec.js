import { test, expect } from "@playwright/test";

const EXPECTED_RESULT = {"aggregates": {}, "columns": ["Row ID", "Order ID", "Order Date", "Ship Date", "Ship Mode", "Customer ID", "Segment", "Country", "City", "State", "Postal Code", "Region", "Product ID", "Category", "Sub-Category", "Sales", "Quantity", "Discount", "Profit"], "expressions": [], "filter": [], "group_by": [], "plugin": "Datagrid", "plugin_config": {"columns": {}, "editable": false, "scroll_lock": false}, "settings": false, "sort": [], "split_by": [], "theme": "Pro Light", "title": null};

async function getPsp(page, filename) {
  await page.goto(`/lab/tree/tests/test_files/${filename}.parquet`, {
    waitUntil: "networkidle",
  });

  await new Promise((resolve) => setTimeout(() => resolve(), 5000));

  const psp = await page.evaluate(async () => {
    const viewer = document.querySelector(
      "perspective-viewer"
    );

    if (viewer === undefined) {
      return {};
    } else {
      return viewer.save();
    }
  });

  return psp;
}

test.describe("Open data files and ensure they render", () => {
  test('Test File: no compression', async ({ page }) => {
    const psp = await getPsp(page, "test_none");
    expect(psp).toEqual(EXPECTED_RESULT);
  });

  test('Test File: brotli compression', async ({ page }) => {
    const psp = await getPsp(page, "test_brotli");
    expect(psp).toEqual(EXPECTED_RESULT);
  });

  test('Test File: gzip compression', async ({ page }) => {
    const psp = await getPsp(page, "test_gzip");
    expect(psp).toEqual(EXPECTED_RESULT);
  });

  test('Test File: snappy compression', async ({ page }) => {
    const psp = await getPsp(page, "test_snappy");
    expect(psp).toEqual(EXPECTED_RESULT);
  });
});
