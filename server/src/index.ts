import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { initialize, seedCatalogue } from "./models.js";
const { MONGODB_URI, APP_ORIGIN } = process.env;
if (!MONGODB_URI || !APP_ORIGIN)
  throw new Error("MONGODB_URI and APP_ORIGIN are required");
await mongoose.connect(MONGODB_URI);
await initialize();
await seedCatalogue();
const server = createApp(
  APP_ORIGIN,
  process.env.NODE_ENV === "production",
).listen(Number(process.env.PORT ?? 4000), () => console.log("LIMS API ready"));
async function stop() {
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
