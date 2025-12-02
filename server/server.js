const express = require("express");
const multer = require("multer");
const pdfParseLib = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
require("dotenv").config();
const cors = require("cors");

const app = express();

app.use(cors());

const upload = multer({ dest: "uploads/" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

app.post("/extract-pdf", upload.any(), async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("FILES:", req.files);

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No file uploaded" });
    const pdfPath = req.files[0].path;
    const dataBuffer = fs.readFileSync(pdfPath);

    // Handle ESM default export compatibility
    const pdfParse = pdfParseLib.default || pdfParseLib;

    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text;

    const prompt = `
Parse the following CV text and return ONLY valid JSON.

CV TEXT:
${extractedText}

Return JSON with fields:
{
  "fullName": "",
  "email": "",
  "phone": "",
  "address": "",
  "summary": "",
  "skills": [],
  "experience": [
    {
      "title": "",
      "company": "",
      "duration": "",
      "description": ""
    }
  ],
  "education": [
    {
      "institute": "",
      "degree": "",
      "year": ""
    }
  ],
  "certifications": []
}
    `;

    const result = await model.generateContent(prompt);
    const structuredData = result.response.text();

    const cleaned = structuredData
      .replace(/```json\s*/, "")
      .replace(/```/, "")
      .trim();

    const structuredJson = JSON.parse(cleaned);

    fs.unlinkSync(pdfPath);

    console.log(structuredJson);

    res.json({
      success: true,
      rawText: extractedText,
      structuredJson,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(4000, () => console.log("Server running on port 4000"));
