// This is the content for the new file: api/send-email.js
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests are allowed' });
    }

    const { email, reading, readingId } = req.body;

    try {
        // Step 1: Update the user's record in the database with their email
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { error: dbError } = await supabase.from('readings').update({ email: email }).eq('id', readingId);

        if (dbError) {
            console.error("Supabase update error:", dbError);
            // Don't stop the email from sending, just log the error
        }

        // Step 2: Send the email using Nodemailer
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_ADDRESS,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        const mailOptions = {
            from: `"PalMyst Agent" <${process.env.GMAIL_ADDRESS}>`,
            to: email,
            subject: 'Your PalMyst Reading',
            text: `Greetings,\n\nHere is the personality reading you requested:\n\n---\n\n${reading}\n\n---\n\nFrom the PalMyst Agent.`,
            html: `<p>Greetings,</p><p>Here is the personality reading you requested:</p><hr><p><em>${reading.replace(/\n/g, '<br>')}</em></p><hr><p>From the PalMyst Agent.</p>`,
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: 'Email sent successfully!' });

    } catch (error) {
        console.error('Error in send-email function:', error);
        res.status(500).json({ message: 'Failed to send email.' });
    }
}
