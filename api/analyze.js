const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// This is the main function that Vercel will run
export default async function handler(req, res) {
    // Only allow POST requests, reject others
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests are allowed' });
    }

    try {
        const { name, phone, image_data, q4_answer, q5_answer } = req.body;

        // --- Part 1: AI Analysis using Gemini ---
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' }); // Using the latest efficient model

        const prompt = `
            You are PalMyst Agent, an expert in palmistry based on a specific set of rules.
            Analyze the provided image of a palm and generate a personality reading.
            Follow these rules ONLY:

            1.  **Little finger vs. ring finger:** Compare the tip of the little finger to the top knuckle line of the ring finger. State your finding and the resulting trait:
                *   If shorter: "indicates cleverness or shrewdness."
                *   If taller: "indicates a clear and transparent mind."

            2.  **Index finger vs. ring finger:** Compare the lengths of the index and ring fingers. State your finding and the resulting trait:
                *   If index is taller: "indicates high leadership and lower organization."
                *   If index is shorter: "indicates lower leadership and higher organization."
                *   If heights are equal: "indicates a balanced mix of leadership and organization."

            3.  **Middle finger prominence:** Observe if the middle finger is significantly taller than the index and ring fingers. State your finding and the resulting trait:
                *   If considerably taller: "indicates good fortune and aptitude for gambling."

            4.  **Fortune line:** Identify the main vertical line in the center of the palm. State your finding and the resulting trait:
                *   If the line is uninterrupted: "indicates good luck in future life."
                *   If the line is broken or absent: This indicates the opposite, but phrase it gently.

            Based on the user's answers to the thumb questions, add the following traits:
            - Thumb flexibility (middle knuckle): ${q4_answer === 'yes' ? 'indicates personal flexibility.' : 'indicates inflexibility or stubbornness.'}
            - Thumb flexibility (base): ${q5_answer === 'yes' ? 'indicates a flexible family.' : 'indicates an inflexible family.'}

            Combine all these observations into a cohesive, narrative-style personality reading. Start with a greeting and present the findings as a paragraph. Do not just list the rules.
        `;

        const image_parts = [{
            inlineData: {
                data: image_data,
                mimeType: 'image/jpeg'
            }
        }];

        const result = await model.generateContent([prompt, ...image_parts]);
        const ai_reading = result.response.text();

        // --- Part 2: Save to Supabase Database ---
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

        const { data, error } = await supabase
            .from('readings')
            .insert([
                { name: name, phone: phone, reading: ai_reading }
            ]);

        if (error) {
            console.error('Supabase error:', error);
            // We will still send the reading to the user even if the save fails
        }

        // --- Part 3: Send the reading back to the user ---
        res.status(200).json({ reading: ai_reading });

    } catch (error) {
        console.error('Error in analyze function:', error);
        res.status(500).json({ message: 'An error occurred during the analysis.' });
    }
}
