export default async function handler(req, res) {
    // فقط درخواست‌های POST را قبول می‌کنیم
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { text, imageBase64, mimeType } = req.body;
    
    // گرفتن کلید API از متغیرهای محیطی Vercel
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        return res.status(500).json({ error: 'API Key تنظیم نشده است.' });
    }

    // آدرس دقیق درخواست شده توسط شما
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // ساختار پیام برای جمنای
    const parts = [];
    
    if (text) {
        parts.push({ text: text });
    }
    
    if (imageBase64) {
        parts.push({
            inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageBase64
            }
        });
    }

    const payload = {
        contents: [{ parts: parts }]
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'خطا در ارتباط با سرور گوگل');
        }

        // استخراج متن جواب هوش مصنوعی
        const replyText = data.candidates[0].content.parts[0].text;
        res.status(200).json({ reply: replyText });

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: error.message });
    }
}
