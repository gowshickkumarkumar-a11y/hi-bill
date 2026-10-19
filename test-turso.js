const { createClient } = require('@libsql/client');

const url = 'libsql://bill-gowshick.aws-ap-south-1.turso.io';
const authToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTIzOTE0MDUsImlkIjoiMDFhMTUyY2YtMmEwMS03NTdmLWIxNDEtNGE5YzM4MmY0ZmExIiwia2lkIjoiUlFzTlFMU0VrSzBVci1OZ0N0Vnd2SHJXZ2pibUFWOVZFeVFWZUh5cm0wUSIsInJpZCI6IjY1NWNlZmRjLWNhY2YtNDBkOC1iNzVkLTNjNzU2ZjQyNzYzNiJ9.N7PiGU83ZzNDwNw1k6leD5h_l7Ky9iR6tNui_7Kuvn7Etso2NxbEbX0uVR5vxyoQQpRf_IJk7AW8mlh2dUkGBw';

async function main() {
  console.log('Connecting to Turso database at:', url);
  const client = createClient({ url, authToken });
  
  try {
    const res = await client.execute('SELECT 1 as connected;');
    console.log('SUCCESS! Database response:', res.rows);

    // Create table for storing tracker data
    await client.execute(`
      CREATE TABLE IF NOT EXISTS tracker_store (
        key TEXT PRIMARY KEY,
        data TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('SUCCESS: Table tracker_store is ready!');
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

main();

