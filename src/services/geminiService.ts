import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const analyzeArticle = async (article: { title: string; abstract: string }) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Tu es un analyste médical senior spécialisé dans la veille stratégique. 
    Analyse cet article (qui peut être une étude PubMed, un essai clinique ClinicalTrials.gov, une recommandation institutionnelle, une étude sur les phytomédicaments, ou une fiche de maladie rare).
    
    Titre: ${article.title}
    Abstract/Description: ${article.abstract}
    
    Objectifs de l'analyse :
    1. Identifier s'il s'agit d'un nouveau médicament, d'un changement de protocole, d'une recommandation majeure, d'un phytomédicament (plante médicinale), ou d'une maladie rare.
    2. Évaluer le niveau de preuve (RCT, méta-analyse, phase I/II/III, étude in vitro/in vivo).
    3. Détecter les "médicaments miracles" ou les allégations sans preuve solide pour alerter l'utilisateur.
    4. Calculer un score de fiabilité (0-100) basé sur la source et la méthodologie.
    
    Réponds au format JSON strict.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "medication, protocol, guideline, case_study, phytomedicine, ou rare_disease" },
          pathology: { type: Type.STRING },
          population: { type: Type.STRING },
          evidence_level: { type: Type.STRING },
          key_findings: { type: Type.ARRAY, items: { type: Type.STRING } },
          limitations: { type: Type.ARRAY, items: { type: Type.STRING } },
          clinical_impact: { type: Type.STRING, description: "minor, major, ou breakthrough" },
          reliability_score: { type: Type.INTEGER, description: "Score de fiabilité 0-100" },
          molecule_name: { type: Type.STRING },
          study_phase: { type: Type.STRING },
          summary_web: { type: Type.STRING, description: "Résumé professionnel (15-20 lignes)" },
          summary_facebook: { type: Type.STRING, description: "Post Facebook (100-150 mots) avec emojis" }
        },
        required: ["type", "pathology", "summary_web", "summary_facebook", "reliability_score"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const generatePostImage = async (article: { title: string; type: string }) => {
  const model = "gemini-2.5-flash-image";
  const prompt = `
    Crée une image professionnelle et moderne pour un post Facebook médical.
    Thème: ${article.type}
    Titre de l'article: ${article.title}
    Style: Minimaliste, médical, haute résolution, couleurs sobres (bleu, blanc, vert).
    Format: Paysage 16:9.
    Pas de texte sur l'image, juste un visuel symbolique fort.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};
