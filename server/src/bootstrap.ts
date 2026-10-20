import "dotenv/config";
import mongoose from "mongoose";
import { User, initialize } from "./models.js";
import { hashPassword } from "./security.js";
import { z } from "zod";
const uri = z.string().min(1).parse(process.env.MONGODB_URI);
const email = z.string().email().parse(process.env.BOOTSTRAP_EMAIL);
const password = z
  .string()
  .min(12)
  .max(128)
  .parse(process.env.BOOTSTRAP_PASSWORD);
await mongoose.connect(uri);
await initialize();
if (await User.exists({}))
  throw new Error("Bootstrap is only permitted in an empty user database");
await User.create({
  name: "Laboratory Administrator",
  email: email.toLowerCase(),
  passwordHash: await hashPassword(password),
  roles: ["admin"],
});
console.log(
  "Administrator created. Remove bootstrap credentials from the environment.",
);
await mongoose.disconnect();
