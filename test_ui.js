import puppeteer from "puppeteer";
(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.on("console", msg => console.log("CONSOLE:", msg.type(), msg.text()));
  page.on("pageerror", err => console.log("PAGE ERROR:", err.toString()));
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle0" });
  
  const html = await page.content();
  console.log("HTML ROOT CONTENT:", html.includes("BLINK") ? "FOUND BLINK WEBTV UI" : "NO BLINK UI FOUND");
  
  await browser.close();
})();
