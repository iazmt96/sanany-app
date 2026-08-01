const fs = require("fs");
const path = require("path");

function loadMobileEnv() {
  const envPath = path.join(__dirname, "apps", "mobile", ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadMobileEnv();

const mobileAppConfig = require("./apps/mobile/app.json");
const expoConfig = mobileAppConfig.expo ?? mobileAppConfig;

module.exports = {
  expo: {
    ...expoConfig,
    entryPoint: "./apps/mobile/index.ts",
  },
};
