import { Client } from "pg";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres"; // Can't easily connect from Edge maybe? Wait.
  console.log("No pg logic ready.");
}
run();
