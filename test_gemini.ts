import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const match = envContent.match(/GEMINI_API_KEY\s*=\s*(.*)/);
const apiKey = match ? match[1].trim() : undefined;
async function main() {
  console.log("Using API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : "UNDEFINED");

  if (!apiKey) {
    console.error("No API key found in .env.local!");
    process.exit(1);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    console.log("Calling model.generateContent...");
    const result = await model.generateContent("Hello, respond in one word.");
    console.log("Response text:", result.response.text());
    console.log("GEMINI API CALL SUCCESSFUL! 🎉");
  } catch (error: any) {
    console.error("GEMINI API CALL FAILED! ❌");
    console.error(error);
  }
}

main();
