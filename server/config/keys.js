require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PUBLIC_KEY = process.env.PUBLIC_KEY;

if (!PRIVATE_KEY || !PUBLIC_KEY) {
  throw new Error("Lisans anahtarları (PRIVATE_KEY/PUBLIC_KEY) .env'de tanımlı değil!");
}

module.exports = {
  PRIVATE_KEY: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
  PUBLIC_KEY: process.env.PUBLIC_KEY.replace(/\\n/g, "\n")
};