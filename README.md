# 🤖 BoltDIY AI Agent Platform

> **منصة ذكاء اصطناعي متطورة للتطوير والبرمجة** 

تحويل شامل لمشروع BoltDIY إلى منصة ذكاء اصطناعي قوية تنافس same.new و manus.im مع دعم متعدد اللغات وإمكانيات متقدمة.

![AI Agent Platform](https://img.shields.io/badge/AI-Agent%20Platform-blue?style=for-the-badge&logo=openai)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Remix](https://img.shields.io/badge/Remix-2-black?style=for-the-badge&logo=remix)

## ✨ الميزات الأساسية

### 🧠 ذكاء اصطناعي متقدم
- **4 مزودي AI مدمجين**: OpenAI GPT-4, Anthropic Claude, Google Gemini, Mistral
- **توجيه ذكي**: اختيار المودل الأمثل بناءً على لغة البرمجة
- **15+ لغة برمجة مدعومة**: من Python إلى Rust مع تحسينات مخصصة
- **معالج أوامر متطور**: /explain, /refactor, /test, /debug, /generate

### 🔍 بحث دلالي ذكي
- **فهرسة متقدمة**: استخدام Transformers وتقنيات embeddings
- **بحث طبيعي**: ابحث عن الكود باللغة العربية أو الإنجليزية
- **تحليل السياق**: فهم الكود وترابطه في المشروع
- **3 أنماط بحث**: Semantic, Fuzzy, Hybrid

### 📸 معالجة الصور والوسائط
- **OCR متطور**: تحويل لقطات الشاشة إلى كود نظيف
- **تحليل UI**: تحويل mockups إلى React components
- **دعم متعدد اللغات**: تعرف على أكواد بلغات مختلفة من الصور
- **تحليل الأخطاء**: فهم رسائل الخطأ من الصور

### 🛡️ إدارة الملفات المتطورة
- **نظام حماية**: منع تعديل الملفات المهمة عن طريق الخطأ
- **مدير الأقفال**: واجهة مركزية لإدارة حماية الملفات
- **نطاق المحادثة**: كل محادثة لها أقفالها المستقلة
- **عمليات جماعية**: إدارة عدة ملفات مرة واحدة

## 🚀 البدء السريع

### المتطلبات
- Node.js 18+
- pnpm 8+
- Git

### التثبيت

```bash
# استنساخ المشروع
git clone https://github.com/you112ef/bolld.git
cd bolld

# تثبيت التبعيات
pnpm install

# تشغيل الخادم المحلي
pnpm run dev
```

المشروع سيعمل على: http://localhost:5173

### إعداد مفاتيح AI (اختياري)

```bash
# إنشاء ملف البيئة
cp .env.example .env.local

# إضافة مفاتيح API
VITE_OPENAI_API_KEY=your_openai_key
VITE_ANTHROPIC_API_KEY=your_anthropic_key
VITE_GOOGLE_API_KEY=your_google_key
VITE_MISTRAL_API_KEY=your_mistral_key
```

## 🎯 كيفية الاستخدام

### 1. المساعد الذكي
```typescript
// استخدم الأوامر المختصرة
/explain this function  // شرح الدالة
/refactor              // تحسين الكود
/test                  // إنشاء اختبارات
/debug error message   // إصلاح الأخطاء
```

### 2. البحث الذكي
- اكتب "ابحث عن دوال التشفير" أو "find encryption functions"
- ستحصل على نتائج دقيقة مع شرح السياق
- فلترة بحسب لغة البرمجة أو نوع الملف

### 3. معالجة الصور
- اسحب وأسقط لقطة شاشة لرسالة خطأ
- ارفع mockup لتحويله إلى كود
- احصل على كود نظيف مع شرح

### 4. إدارة المشروع
- استخدم مدير الأقفال لحماية الملفات المهمة
- تتبع التغييرات مع Git integration
- نشر سريع على Cloudflare Pages

## 🏗️ البنية التقنية

### Frontend
- **React 18** مع Hooks متطور
- **TypeScript** للأمان في الأنواع
- **Tailwind CSS** مع تصميم عربي محسن
- **Framer Motion** للحركات السلسة

### Backend
- **Remix** لـ SSR والتوجيه
- **Cloudflare Workers** للأداء العالي
- **WebContainer API** لتشغيل الكود آمن
- **Vector Database** للبحث الدلالي

### AI & ML
- **@xenova/transformers** للمعالجة المحلية
- **OpenAI GPT-4** للبرمجة المتقدمة
- **Claude 3** للتحليل النقدي
- **Tesseract.js** لمعالجة الصور

## 📊 إحصائيات المشروع

- **5,220+ modules** مدمجة
- **15+ لغات برمجة** مدعومة
- **4 مزودي AI** متكاملين
- **3 أنماط بحث** متطورة
- **Mobile-First** تصميم محسن للجوال

## 🌍 الدعم متعدد اللغات

```typescript
// دعم كامل للعربية والإنجليزية
const languages = {
  ar: "العربية", // الافتراضي
  en: "English"
};

// UI Components مصممة للـ RTL
// AI مدرب على الأوامر بالعربية
// Documentation ثنائية اللغة
```

## 🔧 التطوير

### البناء للإنتاج
```bash
pnpm run build  # بناء الملفات
pnpm run start  # تشغيل خادم الإنتاج
```

### الاختبار
```bash
pnpm run test          # تشغيل الاختبارات
pnpm run test:coverage # تقرير التغطية
pnpm run lint          # فحص الكود
```

### النشر
```bash
pnpm wrangler auth login              # تسجيل دخول Cloudflare
pnpm wrangler pages deploy build/client  # نشر المشروع
```

## 📚 التوثيق التفصيلي

- [📖 دليل المستخدم](./docs/USER_GUIDE.md)
- [⚙️ دليل التطوير](./docs/DEVELOPMENT.md)
- [🚀 دليل النشر](./DEPLOYMENT_GUIDE.md)
- [🤖 AI Features](./docs/AI_FEATURES.md)
- [🔍 Search Guide](./docs/SEARCH_GUIDE.md)

## 🤝 المساهمة

نرحب بالمساهمات! يرجى قراءة [دليل المساهمة](./CONTRIBUTING.md) أولاً.

### خطوات المساهمة
1. Fork المشروع
2. إنشاء فرع جديد (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push للفرع (`git push origin feature/amazing-feature`)
5. فتح Pull Request

## 📄 الرخصة

هذا المشروع مرخص تحت رخصة MIT - راجع ملف [LICENSE](./LICENSE) للتفاصيل.

## 🙏 شكر وتقدير

- **Remix Team** لإطار العمل الرائع
- **OpenAI & Anthropic** لنماذج الذكاء الاصطناعي
- **Cloudflare** للبنية التحتية
- **Open Source Community** للمكتبات المذهلة

## 📞 الدعم

- **GitHub Issues**: [رفع مشكلة](https://github.com/you112ef/bolld/issues)
- **Discord**: [انضم لمجتمعنا](https://discord.gg/boltdiy)
- **Twitter**: [@BoltDIY](https://twitter.com/boltdiy)
- **الموقع**: [bolt-ai.dev](https://bolt-ai.dev)

---

<div align="center">

**🚀 منصة BoltDIY AI Agent Platform - مستقبل التطوير بالذكاء الاصطناعي**

[![Deploy](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-orange?style=for-the-badge)](https://pages.cloudflare.com)
[![Star](https://img.shields.io/badge/Star-this%20repo-yellow?style=for-the-badge&logo=github)](https://github.com/you112ef/bolld)

Made with ❤️ by the BoltDIY Community

</div>
