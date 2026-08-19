import app from "../server.ts";

export default function handler(req: any, res: any) {
  // Allow all CORS methods explicitly for Vercel Serverless
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Range");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  return app(req, res);
}
