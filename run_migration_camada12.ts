import { Client } from 'pg';
import path from 'path';

async function main() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.log("DATABASE_URL is not set.");
        return;
    }
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    
    try {
        console.log("Running migration...");
        await client.query(`
            ALTER TABLE memoriais
                ADD COLUMN IF NOT EXISTS total_invites_criados integer DEFAULT 0,
                ADD COLUMN IF NOT EXISTS total_invites_concluidos integer DEFAULT 0,
                ADD COLUMN IF NOT EXISTS origem_sistema text DEFAULT 'saas';
                
            CREATE INDEX IF NOT EXISTS idx_memoriais_origem ON memoriais(origem_sistema);
            
            UPDATE memoriais SET origem_sistema = 'projeto_cultural' WHERE organization_id IS NULL AND family_account_id IS NULL AND origem_sistema IS NULL;
            UPDATE memoriais SET origem_sistema = 'saas' WHERE organization_id IS NOT NULL AND origem_sistema IS NULL;
        `);
        console.log("Migration successful");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}
main();
