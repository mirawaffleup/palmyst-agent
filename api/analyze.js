// This is the content for api/analyze.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests are allowed' });
    }

    try {
        const { name, phone, image_data, q4_answer, q5_answer, gender } = req.body;
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const image_parts = [{ inlineData: { data: image_data, mimeType: 'image/jpeg' } }];

        // Step 1: Image Validation
        const validation_prompt = `Analyze this image with two checks.
        1. Is it a clear photo of a human palm? (Answer "yes" or "no").
        2. If yes, is it a left or right palm? (Answer "left", "right", or "unknown").
        Respond ONLY in this JSON format: {"is_palm": "answer", "hand_type": "answer"}`;

        const validationResult = await model.generateContent([validation_prompt, ...image_parts]);
        let validationData = JSON.parse(validationResult.response.text());

        if (validationData.is_palm !== "yes") {
            return res.status(400).json({ message: "The image is not a palm. Please upload the correct picture." });
        }

        const required_hand = gender === 'male' ? 'right' : 'left';
        if (validationData.hand_type !== "unknown" && validationData.hand_type !== required_hand) {
            return res.status(400).json({ message: `Wrong palm detected. A ${gender} requires the ${required_hand} hand. Please try again.` });
        }

        // Step 2: Personality Reading
        const reading_prompt = `You are PalMyst, a wise palm reader. Analyze the user's information and deliver a final personality reading.
        Internal Analysis (Do NOT reveal):
        - Analyze the palm image based on standard palmistry rules.
        - The user is ${q4_answer === 'yes' ? 'flexible and open to change.' : 'stubborn and headstrong.'}
        - Their family background is ${q5_answer === 'yes' ? 'flexible.' : 'inflexible.'}
        Final Output Instructions:
        - Synthesize all findings into a single, cohesive paragraph written in the second person ("You possess...").
        - DO NOT mention your reasoning, fingers, or lines.
        Begin the reading now.`;
        
        const readingResult = await model.generateContent([reading_prompt, ...image_parts]);
        const ai_reading = readingResult.response.text();

        // Step 3: Save to Database and return the new reading's ID
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data, error } = await supabase.from('readings').insert([{ name, phone, reading: ai_reading }]).select('id').single();

        if (error) throw error;

        res.status(200).json({ reading: ai_reading, readingId: data.id });

    } catch (error) {
        console.error('Error in analyze function:', error);
        res.status(500).json({ message: 'An error occurred during analysis.' });
    }
}
