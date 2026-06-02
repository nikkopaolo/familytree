/**
 * Import famtree-export.json into Firestore.
 *
 * Usage:
 *   set GOOGLE_APPLICATION_CREDENTIALS=D:\path\to\service-account.json
 *   node scripts/migrate/import-to-firestore.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const exportPath = path.resolve(
  process.env.EXPORT_PATH ?? "scripts/migrate/output/famtree-export.json"
);

if (!fs.existsSync(exportPath)) {
  console.error(`Missing export file: ${exportPath}`);
  console.error("Run export-from-postgres.mjs first, or set EXPORT_PATH.");
  process.exit(1);
}

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service account JSON.");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const data = JSON.parse(fs.readFileSync(exportPath, "utf8"));
const tables = data.tables ?? {};

const batchSet = async (label, items, writer) => {
  if (!items?.length) {
    console.log(`  ${label}: 0 (skip)`);
    return;
  }
  const chunkSize = 400;
  for (let i = 0; i < items.length; i += chunkSize) {
    const batch = db.batch();
    const slice = items.slice(i, i + chunkSize);
    slice.forEach((row) => writer(batch, row));
    await batch.commit();
    console.log(`  ${label}: committed ${Math.min(i + chunkSize, items.length)} / ${items.length}`);
  }
};

const mapClan = (row) => ({
  name: row.name,
  slug: row.slug,
  description: row.description ?? null,
  isPublic: row.is_public ?? true,
  createdBy: row.created_by ?? null,
  createdAt: row.created_at ?? FieldValue.serverTimestamp(),
});

const mapPerson = (row) => ({
  clanId: row.clan_id,
  branchRootId: row.branch_root_id ?? row.id,
  fullName: row.full_name,
  birthDate: row.birth_date ?? null,
  deathDate: row.death_date ?? null,
  isAlive: row.is_alive ?? true,
  gender: row.gender ?? null,
  photoUrl: row.photo_url ?? null,
  notes: row.notes ?? null,
  stats: row.stats ?? {},
  createdBy: row.created_by ?? null,
  updatedBy: row.updated_by ?? null,
  createdAt: row.created_at ?? FieldValue.serverTimestamp(),
  updatedAt: row.updated_at ?? FieldValue.serverTimestamp(),
});

const mapRelationship = (row) => ({
  clanId: row.clan_id,
  parentId: row.parent_id,
  childId: row.child_id,
  relationshipType: row.relationship_type ?? "parent",
  marriageDate: row.marriage_date ?? null,
  createdAt: row.created_at ?? FieldValue.serverTimestamp(),
});

const mapPosition = (row) => ({
  clanId: row.clan_id,
  personId: row.person_id,
  x: Number(row.x ?? 0),
  y: Number(row.y ?? 0),
  updatedAt: row.updated_at ?? FieldValue.serverTimestamp(),
});

const main = async () => {
  console.log("Importing clans...");
  await batchSet("clans", tables.clans, (batch, row) => {
    batch.set(db.collection("clans").doc(row.id), mapClan(row));
  });

  console.log("Importing memberships...");
  await batchSet("memberships", tables.clan_memberships, (batch, row) => {
    const docId = `${row.user_id}_${row.clan_id}`;
    batch.set(db.collection("memberships").doc(docId), {
      userId: row.user_id,
      clanId: row.clan_id,
      role: row.role,
      createdAt: row.created_at ?? FieldValue.serverTimestamp(),
    });
  });

  console.log("Importing persons...");
  await batchSet("persons", tables.persons, (batch, row) => {
    batch.set(db.collection("clans").doc(row.clan_id).collection("persons").doc(row.id), mapPerson(row));
  });

  console.log("Importing relationships...");
  await batchSet("relationships", tables.relationships, (batch, row) => {
    batch.set(
      db.collection("clans").doc(row.clan_id).collection("relationships").doc(row.id),
      mapRelationship(row)
    );
  });

  console.log("Importing positions...");
  await batchSet("positions", tables.person_positions, (batch, row) => {
    batch.set(
      db.collection("clans").doc(row.clan_id).collection("positions").doc(row.person_id),
      mapPosition(row)
    );
  });

  console.log("Importing branch owners...");
  await batchSet("branchOwners", tables.branch_owners, (batch, row) => {
    batch.set(db.collection("branchOwners").doc(row.id), {
      clanId: row.clan_id,
      userId: row.user_id,
      branchRootId: row.branch_root_id,
      createdAt: row.created_at ?? FieldValue.serverTimestamp(),
    });
  });

  console.log("Importing change events...");
  await batchSet("changeEvents", tables.change_events, (batch, row) => {
    batch.set(db.collection("clans").doc(row.clan_id).collection("changeEvents").doc(row.id), {
      actorId: row.actor_id ?? null,
      actorName: row.actor_name ?? null,
      targetType: row.target_type,
      targetId: row.target_id ?? null,
      action: row.action,
      diff: row.diff ?? [],
      createdAt: row.created_at ?? FieldValue.serverTimestamp(),
    });
  });

  console.log("Importing suggestions...");
  await batchSet("suggestions", tables.suggestions, (batch, row) => {
    batch.set(db.collection("clans").doc(row.clan_id).collection("suggestions").doc(row.id), {
      createdBy: row.created_by ?? null,
      creatorEmail: row.creator_email ?? null,
      targetType: row.target_type,
      targetId: row.target_id ?? null,
      action: row.action,
      payload: row.payload ?? {},
      status: row.status ?? "pending",
      reviewedBy: row.reviewed_by ?? null,
      reviewedAt: row.reviewed_at ?? null,
      createdAt: row.created_at ?? FieldValue.serverTimestamp(),
    });
  });

  console.log("\nDone. Enable Firebase Auth (Email link) and deploy Firestore rules.");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
