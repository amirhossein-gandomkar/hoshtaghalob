let currentReportData = null;
const introText = "به گزارش معاونت ارتباطات و رسانه دفتر امام جمعه دهستان میانکاله (زاغمرز)، حجت الاسلام والمسلمین حاج حسین انزائی در خطبه‌های این هفته از نماز جمعه، ضمن سفارش به تقوا اظهار کرد:";

document.getElementById('generateBtn').addEventListener('click', handleGeneration);
document.getElementById('wordBtn').addEventListener('click', () => exportToWord(currentReportData, introText));
document.getElementById('pdfBtn').addEventListener('click', exportToPDF);

// رویدادهای خطبه نگاشت
document.getElementById('infographic1Btn').addEventListener('click', () => {
    if(currentReportData && currentReportData.khutbah1.bestQuote) {
        generateInfographic(currentReportData.khutbah1.bestQuote);
    }
});
document.getElementById('infographic2Btn').addEventListener('click', () => {
    if(currentReportData && currentReportData.khutbah2.bestQuote) {
        generateInfographic(currentReportData.khutbah2.bestQuote);
    }
});

async function handleGeneration() {
    const k1 = document.getElementById('khutbah1').value.trim();
    const k2 = document.getElementById('khutbah2').value.trim();
    if (!k1 || !k2) return alert("لطفاً هر دو خطبه را وارد کنید.");

    const btn = document.getElementById('generateBtn');
    btn.disabled = true; btn.innerText = "در حال پردازش...";
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('resultContainer').classList.add('hidden');

    // پرامپت جدید با درخواست bestQuote (جمله طلایی برای خطبه نگاشت)
    const prompt = `
        شما دستیار متخصص خلاصه‌سازی خطبه‌های نماز جمعه هستید.
        خطبه اول: ${k1}
        خطبه دوم: ${k2}
        
        دستورالعمل خروجی JSON:
        1. impactfulTitle: تیتر کلی و جذاب.
        2. khutbah1.title و khutbah2.title
        3. khutbah1.summary و khutbah2.summary (آرایه ای از heading و explanation)
        4. khutbah1.bestQuote: یک جمله طلایی، بسیار زیبا، تاثیرگذار و نسبتا طولانی از خطبه اول (برای درج در پوستر).
        5. khutbah2.bestQuote: یک جمله طلایی، کوبنده و مهم از خطبه دوم (برای درج در پوستر).
        6. overallSummary: خلاصه کلی.
    `;

    const schema = {
        type: "OBJECT", properties: {
            "impactfulTitle": { "type": "STRING" },
            "khutbah1": { "type": "OBJECT", "properties": { "title": { "type": "STRING" }, "bestQuote": { "type": "STRING" }, "summary": { "type": "ARRAY", "items": { "type": "OBJECT", "properties": { "heading": { "type": "STRING" }, "explanation": { "type": "STRING" } } } } } },
            "khutbah2": { "type": "OBJECT", "properties": { "title": { "type": "STRING" }, "bestQuote": { "type": "STRING" }, "summary": { "type": "ARRAY", "items": { "type": "OBJECT", "properties": { "heading": { "type": "STRING" }, "explanation": { "type": "STRING" } } } } } },
            "overallSummary": { "type": "OBJECT", "properties": { "title": { "type": "STRING" }, "text": { "type": "STRING" } } }
        }
    };

    try {
        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema } })
        });

        if (!response.ok) throw new Error("خطا در ارتباط با سرور");
        const result = await response.json();
        
        const jsonText = result.candidates[0].content.parts[0].text;
        currentReportData = JSON.parse(jsonText);
        
        renderOutput(currentReportData);
    } catch (err) {
        alert("خطا: " + err.message);
    } finally {
        btn.disabled = false; btn.innerText = "آغاز پردازش مجدد";
        document.getElementById('loading').classList.add('hidden');
    }
}

function renderOutput(data) {
    let html = `
        <div class="text-center mb-8">
            <h3 class="text-2xl font-black text-sky-300 mt-4 mb-4">«${toPersianDigits(data.impactfulTitle)}»</h3>
            <p class="text-gray-300">${toPersianDigits(introText)}</p>
        </div>
        <div class="output-card output-khutbah1">
            <h4 class="text-xl font-bold text-blue-400 mb-4">خطبه اول: ${toPersianDigits(data.khutbah1.title)}</h4>
            ${data.khutbah1.summary.map((i, idx) => `<div class="mb-3"><strong class="text-blue-300">${toPersianDigits(idx+1)}. ${toPersianDigits(i.heading)}</strong><br><span class="text-gray-400 text-sm">${toPersianDigits(i.explanation)}</span></div>`).join('')}
            <div class="mt-4 p-3 bg-blue-900/30 border-r-2 border-blue-500 rounded"><span class="text-xs text-blue-200">✨ جمله منتخب خطبه اول:</span><br><em class="text-white">${toPersianDigits(data.khutbah1.bestQuote)}</em></div>
        </div>
        <div class="output-card output-khutbah2">
            <h4 class="text-xl font-bold text-emerald-400 mb-4">خطبه دوم: ${toPersianDigits(data.khutbah2.title)}</h4>
            ${data.khutbah2.summary.map((i, idx) => `<div class="mb-3"><strong class="text-emerald-300">${toPersianDigits(idx+1)}. ${toPersianDigits(i.heading)}</strong><br><span class="text-gray-400 text-sm">${toPersianDigits(i.explanation)}</span></div>`).join('')}
            <div class="mt-4 p-3 bg-emerald-900/30 border-r-2 border-emerald-500 rounded"><span class="text-xs text-emerald-200">✨ جمله منتخب خطبه دوم:</span><br><em class="text-white">${toPersianDigits(data.khutbah2.bestQuote)}</em></div>
        </div>
        <div class="output-card output-overall">
            <h4 class="text-xl font-bold text-amber-400 mb-4">${toPersianDigits(data.overallSummary.title)}</h4>
            <p class="text-gray-300">${toPersianDigits(data.overallSummary.text)}</p>
        </div>
    `;
    
    document.getElementById('output').innerHTML = html;
    const rc = document.getElementById('resultContainer');
    rc.classList.remove('hidden');
    setTimeout(() => { rc.classList.remove('opacity-0', 'translate-y-10'); }, 100);
}

// دکمه کپی
document.getElementById('copyBtn').addEventListener('click', async () => {
    const text = document.getElementById('output').innerText;
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('copyBtn');
    btn.innerText = "کپی شد!"; setTimeout(() => btn.innerText = "کپی متن", 2000);
});
