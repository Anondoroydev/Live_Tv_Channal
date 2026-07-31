import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.blink.webtv",
  appName: "Blink WebTV",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};

export default config;
