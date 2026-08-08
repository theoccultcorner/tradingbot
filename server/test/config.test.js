import assert from "node:assert/strict";
import test from "node:test";

test(
  "required environment variables are present",
  () => {
    const required = [
      "FIREBASE_PROJECT_ID",
      "GOOGLE_APPLICATION_CREDENTIALS",
    ];

    const missing =
      required.filter(
        (name) =>
          !process.env[
            name
          ],
      );

    assert.deepEqual(
      missing,
      [],
      `Missing environment variables: ${missing.join(", ")}`,
    );
  },
);
