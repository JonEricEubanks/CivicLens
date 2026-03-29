/**
 * Optional Cosmos DB backing store for CivicLens.
 * When COSMOS_ENDPOINT and COSMOS_KEY are set, data persists to Azure Cosmos DB
 * alongside JSON files. Falls back gracefully to JSON-only mode when unavailable.
 */

import { CosmosClient } from '@azure/cosmos';

const DB_NAME = 'civiclens';

const CONTAINERS = {
  workOrders:      { id: 'workOrders',      partitionKey: '/id' },
  potholes:        { id: 'potholes',        partitionKey: '/id' },
  sidewalkIssues:  { id: 'sidewalkIssues',  partitionKey: '/id' },
  schools:         { id: 'schools',         partitionKey: '/id' },
  serviceRequests: { id: 'serviceRequests', partitionKey: '/id' },
  auditLog:        { id: 'auditLog',        partitionKey: '/action' },
};

let db = null;
const containers = {};
let connected = false;

export function isCosmosConnected() {
  return connected;
}

/**
 * Initialize Cosmos DB connection and create database/containers if needed.
 * Returns true if connected, false if skipped (no credentials).
 */
export async function initCosmos() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;

  if (!endpoint || !key) {
    console.log('ℹ️  No COSMOS_ENDPOINT/COSMOS_KEY — using JSON-only storage');
    return false;
  }

  try {
    const client = new CosmosClient({ endpoint, key });
    const { database } = await client.databases.createIfNotExists({ id: DB_NAME });
    db = database;

    for (const [name, config] of Object.entries(CONTAINERS)) {
      const { container } = await db.containers.createIfNotExists({
        id: config.id,
        partitionKey: { paths: [config.partitionKey] },
      });
      containers[name] = container;
    }

    connected = true;
    console.log(`✅ Cosmos DB connected — database: ${DB_NAME}, containers: ${Object.keys(containers).join(', ')}`);
    return true;
  } catch (err) {
    console.error('⚠️  Cosmos DB connection failed — falling back to JSON:', err.message);
    connected = false;
    return false;
  }
}

/**
 * Seed a Cosmos container from an in-memory array (if container is empty).
 */
export async function seedContainer(containerName, records) {
  if (!connected || !containers[containerName]) return;

  try {
    const { resources } = await containers[containerName].items
      .query('SELECT VALUE COUNT(1) FROM c')
      .fetchAll();

    if (resources[0] > 0) return; // already has data

    console.log(`  Seeding ${containerName} with ${records.length} records...`);
    for (const record of records) {
      await containers[containerName].items.create({ ...record, id: record.id });
    }
  } catch (err) {
    console.error(`  ⚠️  Seeding ${containerName} failed:`, err.message);
  }
}

/**
 * Upsert a single record to Cosmos.
 */
export async function upsertRecord(containerName, record) {
  if (!connected || !containers[containerName]) return;
  try {
    await containers[containerName].items.upsert({ ...record, id: record.id });
  } catch (err) {
    console.error(`Cosmos upsert failed (${containerName}):`, err.message);
  }
}

/**
 * Write an audit log entry to Cosmos.
 */
export async function writeAuditEntry(entry) {
  if (!connected || !containers.auditLog) return;
  try {
    await containers.auditLog.items.create({
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
  } catch (err) {
    console.error('Cosmos audit write failed:', err.message);
  }
}

/**
 * Read all records from a Cosmos container.
 */
export async function readAll(containerName) {
  if (!connected || !containers[containerName]) return null;
  try {
    const { resources } = await containers[containerName].items
      .query('SELECT * FROM c')
      .fetchAll();
    return resources;
  } catch (err) {
    console.error(`Cosmos readAll failed (${containerName}):`, err.message);
    return null;
  }
}

export function getCosmosStatus() {
  return {
    connected,
    database: connected ? DB_NAME : null,
    containers: connected ? Object.keys(containers) : [],
  };
}
