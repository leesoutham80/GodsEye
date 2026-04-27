// netlify/functions/blobs-diag.js
// Diagnostic: tries every reasonable @netlify/blobs config form,
// reports which (if any) actually writes and reads back successfully.
// Visit /.netlify/functions/blobs-diag and inspect the JSON.

const blobs = require("@netlify/blobs");

exports.handler = async function (event, context) {
  const results = [];
  const testKey = "_diag_" + Date.now();
  const testValue = "ping-" + Date.now();

  // What's exposed by the SDK?
  results.push({
    test: "sdk-shape",
    keys: Object.keys(blobs).sort(),
    note: "tells us what import surface is actually available"
  });

  // What env vars exist?
  results.push({
    test: "env-presence",
    NETLIFY_SITE_ID: !!process.env.NETLIFY_SITE_ID,
    NETLIFY_API_TOKEN: !!process.env.NETLIFY_API_TOKEN,
    Godseye_Blobs: !!process.env.Godseye_Blobs,
    NETLIFY_BLOBS_CONTEXT: !!process.env.NETLIFY_BLOBS_CONTEXT,
    URL: !!process.env.URL,
    SITE_ID: !!process.env.SITE_ID,            // expected false (legacy/wrong name)
    NETLIFY: !!process.env.NETLIFY,            // present at build time
    AWS_LAMBDA_FUNCTION_NAME: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
    NETLIFY_SITE_ID_value_first8: (process.env.NETLIFY_SITE_ID || "").slice(0, 8),
    note: "true = env var is set, false = missing"
  });

  // Helper: try one config, write a value, read it back, tear down.
  async function tryForm(label, makeStore) {
    const r = { test: label, ok: false };
    try {
      const store = makeStore();
      r.constructed = true;
      await store.set(testKey, testValue);
      r.wrote = true;
      const got = await store.get(testKey);
      r.read = got;
      r.matches = got === testValue;
      try { await store.delete(testKey); r.cleaned = true; } catch (e) { r.cleanError = e.message; }
      r.ok = r.matches === true;
    } catch (e) {
      r.error = e.message;
      r.errorName = e.name;
      r.stack = (e.stack || "").split("\n").slice(0, 3);
    }
    return r;
  }

  // Form 1: bare name (auto-detect)
  results.push(await tryForm("form1_bare_getStore", () =>
    blobs.getStore("diag-test")
  ));

  // Form 2: explicit object with NETLIFY_SITE_ID + Godseye_Blobs PAT
  results.push(await tryForm("form2_explicit_PAT", () =>
    blobs.getStore({
      name: "diag-test",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.Godseye_Blobs
    })
  ));

  // Form 3: explicit with NETLIFY_API_TOKEN instead
  results.push(await tryForm("form3_explicit_API_TOKEN", () =>
    blobs.getStore({
      name: "diag-test",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_API_TOKEN
    })
  ));

  // Form 4: getDeployStore (deploy-scoped, often "just works" inside functions)
  if (typeof blobs.getDeployStore === "function") {
    results.push(await tryForm("form4_getDeployStore_bare", () =>
      blobs.getDeployStore("diag-test")
    ));
  } else {
    results.push({ test: "form4_getDeployStore_bare", error: "getDeployStore not exported by SDK" });
  }

  // Form 5: connectLambda pattern (some Netlify versions need this initialization first)
  if (typeof blobs.connectLambda === "function") {
    try {
      blobs.connectLambda(event);
      const r5 = await tryForm("form5_after_connectLambda_bare", () =>
        blobs.getStore("diag-test")
      );
      r5.note = "called connectLambda(event) first";
      results.push(r5);
    } catch (e) {
      results.push({ test: "form5_after_connectLambda_bare", error: e.message });
    }
  } else {
    results.push({ test: "form5_after_connectLambda_bare", error: "connectLambda not exported by SDK" });
  }

  // Summary
  const workingForms = results
    .filter(r => r.ok === true)
    .map(r => r.test);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      working_forms: workingForms,
      verdict: workingForms.length > 0
        ? "USE THIS FORM: " + workingForms[0]
        : "ALL FORMS FAILED — see results for individual error messages",
      results
    }, null, 2)
  };
};
