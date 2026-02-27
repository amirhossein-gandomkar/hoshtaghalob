import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function detectTextRegions(base64Image: string, mimeType: string) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: "Analyze this manga/manhwa image and find all text, speech bubbles, and sound effects. Return their bounding boxes as percentages (0-100) of the image's width and height. Do not include the whole image, only the specific text regions.",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            ymin: { type: Type.NUMBER, description: "Top edge percentage (0-100)" },
            xmin: { type: Type.NUMBER, description: "Left edge percentage (0-100)" },
            ymax: { type: Type.NUMBER, description: "Bottom edge percentage (0-100)" },
            xmax: { type: Type.NUMBER, description: "Right edge percentage (0-100)" },
          },
          required: ["ymin", "xmin", "ymax", "xmax"],
        },
      },
    },
  });

  const jsonStr = response.text?.trim() || "[]";
  try {
    return JSON.parse(jsonStr) as { ymin: number; xmin: number; ymax: number; xmax: number }[];
  } catch (e) {
    console.error("Failed to parse JSON", e);
    return [];
  }
}

export async function cleanTextRegion(base64Image: string, mimeType: string) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: "Remove all text from this image. Keep the background, textures, and speech bubble borders intact. Do not add any new elements or characters. Output only the cleaned image.",
        },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image returned from Gemini");
}
