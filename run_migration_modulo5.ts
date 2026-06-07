import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.log("DATABASE_URL is not set.");
        return;
    }
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    
    try {
        console.log("Running migracao_modulo5.sql...");
        const sqlString = fs.readFileSync(path.join(process.cwd(), 'sql', 'migracao_modulo5.sql'), 'utf-8');
        await client.query(sqlString);
        console.log("Migration modulo 5 Successful!");
    } catch (e) {
        console.error("Migration Error:", e);
    } finally {
        await client.end();
    }
}
main();
