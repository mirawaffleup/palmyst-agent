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
            You are a precise and methodical palmistry analyst. Your task is to analyze the user-provided image of a palm by following a strict, step-by-step geometric and logical process. Do not jump to conclusions. You must reason through each step before making a determination.

            **Step-by-Step Analysis Protocol:**

            1.  **Orient the Hand:** First, identify the orientation of the hand in the image. Note the position of the fingers relative to the palm and wrist to establish a baseline for your measurements.

            2.  **Rule 1 Analysis (Little Finger vs. Ring Finger Knuckle):**
                *   Identify the top knuckle crease (distal interphalangeal joint) of the ring finger.
                *   Visualize a perfectly horizontal line extending from this crease across to the little finger, adjusting for any curvature or tilt of the hand. This line must be perpendicular to the general direction of the fingers.
                *   Determine if the fleshy tip of the little finger rests above or below this visualized line.
                *   State your finding clearly in your internal thought process before moving on.

            3.  **Rule 2 Analysis (Index Finger vs. Ring Finger Length):**
                *   To accurately compare lengths and ignore the effects of hand tilt or finger curl, visualize a baseline at the bottom of the fingers where they meet the palm.
                *   Now, visualize two parallel lines running alongside the index and ring fingers, perpendicular to your baseline.
                *   Project the highest point of the fleshy tip of the index finger and the ring finger onto these parallel lines.
                *   Compare the projected lengths. Is the index finger's projection clearly taller, shorter, or approximately equal to the ring finger's projection?
                *   State this finding clearly in your internal thought process.

            4.  **Rule 3 Analysis (Middle Finger Prominence):**
                *   Compare the length of the middle finger to the index and ring fingers using the same projection method as in Step 3.
                *   The condition is met only if the middle finger is "considerably taller," meaning its tip extends significantly beyond the tips of the other two. A small difference is not enough.

            5.  **Rule 4 Analysis (Fortune Line):**
                *   Carefully trace the primary vertical line that runs up the center of the palm.
                *   Determine if this line is a single, continuous, and unbroken line from its start to its end. Ignore minor skin texture, focusing on major breaks or gaps.

            **Final Report Generation:**

            After completing your step-by-step analysis, synthesize your findings into a cohesive, narrative-style personality reading. Do not just list the rules. Explain what you saw and what it means. Use the following traits for your conclusions:

            *   **Little Finger:** Shorter -> "cleverness or shrewdness." Taller -> "a clear and transparent mind."
            *   **Index Finger:** Taller -> "high leadership and lower organization." Shorter -> "lower leadership and higher organization." Equal -> "a balanced mix of leadership and organization."
            *   **Middle Finger:** Considerably Taller -> "good fortune and aptitude for gambling."
            *   **Fortune Line:** Uninterrupted -> "good luck in your future life."
            *   **User-Provided Thumb Info (Middle Knuckle):** Incorporate the user's answer: ${q4_answer === 'yes' ? '"personal flexibility."' : '"inflexibility or stubbornness."'}
            *   **User-Provided Thumb Info (Base):** Incorporate the user's answer: ${q5_answer === 'yes' ? '"a flexible family background."' : '"an inflexible family background."'}

            Begin the report now based on the image provided.
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
