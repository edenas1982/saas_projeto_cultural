import dotenv from 'dotenv';
dotenv.config();
console.log("Key length:", process.env.GOOGLE_TTS_API_KEY?.length);
console.log("Key prefix:", process.env.GOOGLE_TTS_API_KEY?.substring(0, 8));
