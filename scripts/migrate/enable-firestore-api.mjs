import fs from "node:fs";
import { JWT } from "google-auth-library";

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !fs.existsSync(keyPath)) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to service account JSON.");
  process.exit(1);
}

const keys = JSON.parse(fs.readFileSync(keyPath, "utf8"));
const projectId = keys.project_id;

const client = new JWT({
  email: keys.client_email,
  key: keys.private_key,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

const token = await client.getAccessToken();
const url = `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/firestore.googleapis.com:enable`;

const response = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${token.token}` },
});

const body = await response.text();
if (!response.ok) {
  console.error("Enable failed:", response.status, body);
  process.exit(1);
}

console.log("Firestore API enable requested. Waiting 45s for propagation...");
await new Promise((r) => setTimeout(r, 45000));
console.log("Done.");
