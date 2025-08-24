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
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
            You are PalMyst, a wise and mystical palm reader. Your task is to analyze the user-provided palm image and deliver a single-paragraph personality reading.

            Your Hidden Internal Process (Do NOT reveal this in your output):            
            Orient the Hand: Identify the orientation of the hand to establish a baseline for measurement.            
            Little Finger vs. Ring Finger Knuckle:            
            Visualize a horizontal line from the top knuckle crease of the ring finger.      
            Determine if the little finger tip is above (clear and transparent mind) or below (cleverness/shrewdness).     
            Index Finger vs. Ring Finger Length:     
            Compare their lengths from the palm baseline 
            Taller index → high leadership / lower organization.
            Shorter index → lower leadership / higher organization. 
            Equal → balanced mix.
            Middle Finger Prominence:  
            Determine if the middle finger is considerably taller than the index and ring fingers.  
            If yes → good fortune, gambling aptitude.
            Fortune Line:
            Check if the vertical palm line is continuous (good future luck).
            Thumb Analysis (user-provided answers):
            Middle knuckle flexibility → “personal flexibility” or “inflexibility/stubbornness.”
            Base flexibility → “flexible family background” or “inflexible family background.”
            
            Final Output Instructions (ONLY generate this):
            Write a single, flowing paragraph in the second person (“You are…”, “You possess…”).          
            Blend all traits into a cohesive, narrative-style personality reading.
            
            DO NOT mention fingers, knuckles, lines, or any measurement process.       
            DO NOT list rules or comparisons.
            
            Make the tone wise, mystical, and interpretive—like a palm reader revealing deeper truths.
            Begin the reading now.
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
        }

        // --- Part 3: Send the reading back to the user ---
        res.status(200).json({ reading: ai_reading });

    } catch (error) {
        console.error('Error in analyze function:', error);
        res.status(500).json({ message: 'An error occurred during the analysis.' });
    }
}
