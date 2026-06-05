import dotenv from "dotenv";
dotenv.config();
console.log("GOOGLE_APPLICATION_CREDENTIALS_JSON:", !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
