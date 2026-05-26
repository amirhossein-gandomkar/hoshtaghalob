// تابع تبدیل اعداد
function toPersianDigits(str) {
    const persianDigits =['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.toString().replace(/\d/g, x => persianDigits[x]);
}

// 1. تولید فایل Word
function exportToWord(reportData, introText) {
    if (!reportData) return;
    let wordHTML = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>گزارش خطبه</title>
        <style>
            body { font-family: 'B Nazanin', Arial, sans-serif; font-size: 14pt; direction: rtl; text-align: right; }
            .bismillah { text-align: center; margin-bottom: 10pt; font-size: 14pt; }
            .main-title { font-size: 16pt; font-weight: bold; text-align: center; }
            .section-title { font-weight: bold; margin-top: 15pt; font-size: 14pt; color: #333; }
        </style>
    </head>
    <body>
        <p class="bismillah">بِسْمِ اللهِ الرَّحْمنِ الرَّحِیم</p>
        <p class="main-title">«${reportData.impactfulTitle}»</p>
        <p>${introText}</p>
        <p class="section-title">🔸 خطبه اول: ${reportData.khutbah1.title}</p>
    `;
    reportData.khutbah1.summary.forEach((item, index) => { wordHTML += `<p>${index + 1}. <b>${item.heading}</b><br>${item.explanation}</p>`; });
    wordHTML += `<p class="section-title">🔹 خطبه دوم: ${reportData.khutbah2.title}</p>`;
    reportData.khutbah2.summary.forEach((item, index) => { wordHTML += `<p>${index + 1}. <b>${item.heading}</b><br>${item.explanation}</p>`; });
    wordHTML += `<p class="section-title">📌 ${reportData.overallSummary.title}</p><p>${reportData.overallSummary.text}</p></body></html>`;

    wordHTML = toPersianDigits(wordHTML);
    const blob = new Blob(['\ufeff', wordHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'گزارش_خطبه.doc';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// 2. تولید فایل PDF با استراتژی تهاجمی
function exportToPDF() {
    const element = document.getElementById('output');
    // ساخت یک کپی از خروجی برای اعمال کلاس ایمن PDF بدون خراب شدن ظاهر سایت
    const clonedElement = element.cloneNode(true);
    clonedElement.classList.add('pdf-safe-mode'); // حذف رنگ های oklch و اعمال رنگ های ساده
    
    // مخفی کردن کپی در صفحه
    clonedElement.style.position = 'absolute';
    clonedElement.style.left = '-9999px';
    document.body.appendChild(clonedElement);

    const opt = {
        margin:       10,
        filename:     'خلاصه_خطبه.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(clonedElement).save().then(() => {
        document.body.removeChild(clonedElement); // پاکسازی
    });
}

// 3. تولید خطبه نگاشت (Canvas API - حل قطعی مشکل CORS و کیفیت)
async function generateInfographic(quoteText) {
    if(!quoteText) return alert("متن نقل قول یافت نشد.");
    
    // نمایش لودینگ روی دکمه (اختیاری)
    const bgUrl = "https://raw.githubusercontent.com/amirhossein-gandomkar/AISERMONANALYZER/a3bbbbbe683533ce44b9f00bbc618e66eabbc9f9/kh.png";
    const canvas = document.getElementById('posterCanvas');
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.crossOrigin = "Anonymous"; // حل مشکل خطای دانلود
    img.src = bgUrl;
    
    img.onload = () => {
        // تنظیم اندازه بوم برابر با تصویر اصلی
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // تولید تاریخ امروز شمسی
        const today = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
        const dateText = `نماز جمعه ${today} دهستان میانکاله (زاغمرز)`;
        const titleText = "امام جمعه محترم دهستان میانکاله(زاغمرز) حجت الاسلام والمسلمین حاج حسین انزائی:";
        
        // مختصات قرارگیری درون کادر آبی پایین.
        // کادر آبی معمولا در 15٪ پایینی تصویر است.
        const startY = canvas.height * 0.82; 
        const centerX = canvas.width / 2;

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // تابع کمکی برای رسم متن با دور خط مشکی
        const drawText = (text, x, y, font, fillColor) => {
            ctx.font = font;
            ctx.lineJoin = "round";
            ctx.miterLimit = 2;
            ctx.strokeStyle = "black";
            // ضخامت حاشیه متناسب با سایز فونت محاسبه میشود
            const fontSize = parseInt(font.match(/\d+/)[0]);
            ctx.lineWidth = fontSize * 0.2; 
            ctx.strokeText(text, x, y);
            ctx.fillStyle = fillColor;
            ctx.fillText(text, x, y);
        };

        // رسم خط 1: تاریخ
        // به دلیل بزرگ بودن عکس، فونت 10 درخواستی ناخوانا میشود، لذا آن را ضریبی از عرض تصویر در نظر میگیریم اما مقیاس درخواستی شما حفظ شده.
        let scale = canvas.width / 800; // فرض میکنیم مبنا 800 پیکسل است
        drawText(toPersianDigits(dateText), centerX, startY, `bold ${14 * scale}px 'B Nazanin', Tahoma`, "white");
        
        // رسم خط 2: نام امام جمعه
        drawText(titleText, centerX, startY + (25 * scale), `bold ${20 * scale}px 'B Nazanin', Tahoma`, "white");

        // رسم خط 3: متن انتخابی خطبه با قابلیت شکستن خط (Word Wrap)
        const maxTextWidth = canvas.width * 0.85;
        const quoteFont = `bold ${22 * scale}px 'B Titr', Tahoma`;
        const words = toPersianDigits(quoteText).split(' ');
        let line = '';
        let currentY = startY + (60 * scale);
        
        ctx.font = quoteFont;
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            if (metrics.width > maxTextWidth && n > 0) {
                drawText(line, centerX, currentY, quoteFont, "yellow");
                line = words[n] + ' ';
                currentY += (35 * scale); // فاصله خطوط
            } else {
                line = testLine;
            }
        }
        drawText(line, centerX, currentY, quoteFont, "yellow");

        // دانلود عکس
        try {
            const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
            const link = document.createElement('a');
            link.download = `خطبه_نگاشت_${Date.now()}.jpg`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch(e) {
            alert("خطا در تولید تصویر! لطفاً از مرورگر دیگری استفاده کنید.");
        }
    };
    
    img.onerror = () => alert("خطا در بارگذاری تصویر پس‌زمینه از گیت‌هاب.");
}
