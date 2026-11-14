import type { CapacitorConfig } from "@capacitor/cli";

// Native shell (iOS / Android) around the SAME web code, built with MOBILE=1 (relative base, output folder dist-app).
// CHANGE appId BEFORE THE FIRST STORE UPLOAD (it can never be changed afterwards): see packaging/README.md, section 0.
const config: CapacitorConfig = {
  appId: "com.example.learningcenter",
  appName: "学习乐园",
  webDir: "dist-app",
  ios: { contentInset: "always", limitsNavigationsToAppBoundDomains: false },
  android: { allowMixedContent: false },
  plugins: {
    StatusBar: { style: "LIGHT", backgroundColor: "#ffffff", overlaysWebView: false },
  },
};
export default config;
