import dotenv from 'dotenv';
dotenv.config();

console.log('Environment variable keys:');
Object.keys(process.env).forEach(key => {
  const value = process.env[key];
  const length = value ? value.length : 0;
  const isSecret = key.includes('KEY') || key.includes('PASS') || key.includes('SECRET');
  const preview = isSecret ? '***' : (value ? value.substring(0, 30) : '');
  console.log(`- ${key}: length=${length}, val=${preview}`);
});
