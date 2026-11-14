// Changes the application id (Android applicationId / iOS bundle id / HarmonyOS bundle name / Capacitor appId) everywhere in one go.
// Usage: node scripts/set-app-id.mjs com.yourname.learningcenter
// Do it ONCE, before the first store upload: a published id can never be changed. Rules: lower-case letters, digits, underscore, at least two dot-separated parts.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const id = process.argv[2];
if (!id || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(id)) { console.error("Usage: node scripts/set-app-id.mjs com.yourname.learningcenter   (lower case, digits, _ and dots)"); process.exit(1); }

const rd = (p) => readFileSync(join(root, p), "utf8");
const wr = (p, s) => writeFileSync(join(root, p), s);
const cfg = rd("capacitor.config.ts");
const old = cfg.match(/appId: "([^"]+)"/)[1];
if (old === id) { console.log("already " + id); process.exit(0); }

const sub = (p, re, to) => { if (!existsSync(join(root, p))) return; const s = rd(p); if (re.test(s)) { wr(p, s.replace(re, to)); console.log("changed " + p); } };
sub("capacitor.config.ts", /appId: "[^"]+"/, `appId: "${id}"`);
sub("android/app/build.gradle", /namespace = "[^"]+"/, `namespace = "${id}"`);
sub("android/app/build.gradle", /applicationId "[^"]+"/, `applicationId "${id}"`);
sub("ios/App/App.xcodeproj/project.pbxproj", new RegExp(`PRODUCT_BUNDLE_IDENTIFIER = ${old.replace(/\./g, "\\.")};`, "g"), `PRODUCT_BUNDLE_IDENTIFIER = ${id};`);
sub("harmony/AppScope/app.json5", /"bundleName": "[^"]+"/, `"bundleName": "${id}"`);
sub("android/app/src/main/res/values/strings.xml", new RegExp(old.replace(/\./g, "\\."), "g"), id);

// the Java package of MainActivity follows the id
const oldDir = join(root, "android/app/src/main/java", ...old.split("."));
const newDir = join(root, "android/app/src/main/java", ...id.split("."));
if (existsSync(join(oldDir, "MainActivity.java"))) {
  mkdirSync(newDir, { recursive: true });
  const s = readFileSync(join(oldDir, "MainActivity.java"), "utf8").replace(/^package [^;]+;/m, `package ${id};`);
  writeFileSync(join(newDir, "MainActivity.java"), s);
  rmSync(join(oldDir, "MainActivity.java"));
  // remove the emptied folders of the old package
  for (let d = oldDir; d.length > join(root, "android/app/src/main/java").length; d = dirname(d)) { if (readdirSync(d).length) break; rmSync(d, { recursive: true }); }
  console.log(`moved MainActivity: ${old} -> ${id}`);
}
console.log(`application id is now ${id}. Run: npm run cap:sync   (and see packaging/README.md)`);
