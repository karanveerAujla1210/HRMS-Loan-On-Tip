// Creates admin@loanontip.com via Supabase signUp (no service role needed)
const https = require("https");
const fs = require("fs");
const path = require("path");

const env = {};
fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split("\n")
  .forEach((line) => {
    const idx = line.indexOf("=");
    if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  });

const SUPABASE_URL  = env["NEXT_PUBLIC_SUPABASE_URL"];
const ANON_KEY      = env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

const payload = JSON.stringify({
  email: "admin@loanontip.com",
  password: "Admin@123",
  data: { full_name: "Super Admin", role: "SUPER_ADMIN" },
});

const url = new URL(SUPABASE_URL + "/auth/v1/signup");
const req = https.request(
  {
    hostname: url.hostname,
    path: url.pathname,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      apikey: ANON_KEY,
      Authorization: "Bearer " + ANON_KEY,
    },
  },
  (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => {
      const json = JSON.parse(data);
      if (json.id) {
        console.log("\n✅ User created successfully!");
        console.log("   ID    :", json.id);
        console.log("   Email :", json.email);
        console.log("   Status:", json.email_confirmed_at ? "Confirmed" : "Needs email confirmation");
        if (!json.email_confirmed_at) {
          console.log("\n⚠️  Email not auto-confirmed.");
          console.log("   Run 19_super_admin.sql in Supabase SQL Editor to confirm + assign role.\n");
        } else {
          console.log("\n   Now run 19_super_admin.sql steps 2-5 in Supabase SQL Editor.\n");
        }
      } else if (JSON.stringify(json).toLowerCase().includes("already registered")) {
        console.log("\n✅ admin@loanontip.com already exists.\n");
        console.log("   Run 19_super_admin.sql in Supabase SQL Editor to assign SUPER_ADMIN role.\n");
      } else {
        console.error("\n❌ Response:", JSON.stringify(json, null, 2), "\n");
      }
    });
  }
);
req.on("error", (e) => console.error(e.message));
req.write(payload);
req.end();
