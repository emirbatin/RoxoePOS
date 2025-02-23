const mongoose = require("mongoose");
require("dotenv").config();

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI tanımlanmamış (dotenv)!");
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB bağlantısı başarılı!");
  } catch (error) {
    console.error("MongoDB bağlantı hatası:", error);
    process.exit(1);
  }
}

module.exports = connectDB;