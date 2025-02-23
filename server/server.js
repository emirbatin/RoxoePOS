require("dotenv").config();
const connectDB = require("./config/db");
const app = require("./app");

async function startServer() {
  await connectDB();

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
  });
}

startServer();