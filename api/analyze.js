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

        const image_parts = [{
            inlineData: {
                data: image_data,
                mimeType: 'image/jpeg'
            }
        }];

        // --- Step 1: Image Validation ---
        const pre_prompt = `
            Analyze this image and determine two things.
            1. Does the image clearly show a human palm? (Answer "yes" or "no").
            2. If yes, is it a left or right palm? (Answer "left", "right", or "unknown").
            
            Provide your response ONLY in a valid JSON format like this:
            {"is_palm": "yes", "hand_type": "right"}
        `;

        const validationResult = await model.generateContent([pre_prompt, ...image_parts]);
        const validationText = validationResult.response.text();
        
        // --- NEW CODE TO CLEAN THE AI's RESPONSE ---
        // Find the start and end of the JSON object within the text
        const startIndex = validationText.indexOf('{');
        const endIndex = validationText.lastIndexOf('}');
        
        if (startIndex === -1 || endIndex === -1) {
             throw new Error("AI did not return a valid JSON object.");
        }
        
        const jsonString = validationText.substring(startIndex, endIndex + 1);
        // --- END OF NEW CODE ---

        let validationData;
        try {
            // Now we parse the CLEANED string
            validationData = JSON.parse(jsonString);
        } catch (e) {
            // This is a fallback if the extracted string is still not valid JSON
            console.error("Failed to parse extracted JSON:", jsonString);
            return res.status(500).json({ message: "The AI analysis returned an invalid format. Please try again." });
        }

        if (validationData.is_palm !== "yes") {
            return res.status(400).json({ message: "The image does not appear to be a palm. Please upload the correct picture." });
        }

        const required_hand = gender === 'male' ? 'right' : 'left';
        if (validationData.hand_type !== "unknown" && validationData.hand_type !== required_hand) {
            return res.status(400).json({ message: `Incorrect hand detected. You selected ${gender}, which requires the ${required_hand} palm. Please follow the instructions.` });
        }

        // --- Step 2: Personality Reading (only if validation passes) ---
        const reading_prompt = `
            You are PalMyst, a wise and mystical palm reader. Your task is to analyze the user-provided information and deliver a final personality reading.

            Your Internal Analysis (Do NOT mention this in your output):
            - You will perform a geometric analysis of the palm image based on the predefined rules.
            - The user's provided thumb traits ARE:
                - Thumb (middle knuckle): The user is ${q4_answer === 'yes' ? 'flexible and open to change.' : 'stubborn and headstrong.'}
                - Thumb (base): The user's family background is ${q5_answer === 'yes' ? 'flexible and open to change.' : 'inflexible and stubborn.'}

            Final Output Instructions (This is the ONLY thing you will generate):
            - Synthesize all your findings into a cohesive, narrative-style personality reading written in the second person ("You are...", "You possess...").
            - DO NOT explain your reasoning or mention any comparisons of fingers, knuckles, or lines.
            - Your entire output should be a single, flowing paragraph.

            Begin the reading now.
        `;

        const readingResult = await model.generateContent([reading_prompt, ...image_parts]);
        const ai_reading = readingResult.response.text();

        // --- Step 3: Save to Supabase ---
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data, error } = await supabase.from('readings').insert([{ name, phone, reading: ai_reading }]).select('id').single();

        if (error) throw error;

        res.status(200).json({ reading: ai_reading, readingId: data.id });

    } catch (error) {
        console.error('Error in analyze function:', error);
        res.status(500).json({ message: 'An error occurred during the analysis.' });
    }
}
