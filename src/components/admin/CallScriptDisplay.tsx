import { useState, useEffect } from "react";
import { Phone, Globe, MessageCircle } from "lucide-react";
import type { Lead } from "@/types/database";

interface CallScriptDisplayProps {
  lead: Lead;
  companyName?: string;
  telecallerName?: string;
}

type ScriptLang = "hi" | "en";

const getGreeting = (lang: ScriptLang): string => {
  const hour = new Date().getHours();
  if (lang === "hi") {
    if (hour < 12) return "सुप्रभात";
    if (hour < 17) return "नमस्कार";
    return "शुभ संध्या";
  }
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

const scripts = {
  hi: {
    opening: (name: string, greeting: string, telecaller: string, company: string) =>
      `${greeting} ${name} जी, मैं ${telecaller}, ${company} की तरफ से बोल रहा हूँ। सर/मैम, एक मिनट बात हो सकती है?`,
    purpose: (loanType: string, amount: string) =>
      `सर/मैम, आपने अभी हाल ही में ${loanType} लोन के लिए ₹${amount} की इन्क्वायरी की थी। मैं आपका डेडिकेटेड लोन एडवाइज़र हूँ, आपके लिए सबसे बढ़िया डील निकालने के लिए कॉल कर रहा हूँ।`,
    valueProps: [
      "30 से ज़्यादा बैंकों का टाई-अप – सबसे सस्ती ब्याज दर मिलेगी",
      "24 घंटे के अंदर अप्रूवल का पूरा चांस",
      "सिर्फ ₹799 प्रोसेसिंग फीस – बाकी कोई हिडन चार्ज नहीं",
      "फ्री CIBIL रिपोर्ट चेक करवा देंगे",
    ],
    questions: [
      "सर/मैम, आप जॉब करते हैं या अपना बिज़नेस है?",
      "लोन कितनी जल्दी चाहिए आपको?",
      "अभी कोई EMI चल रही है क्या?",
    ],
    closing: (telecaller: string) =>
      `सर/मैम, आगे बढ़ाने के लिए मैं ${telecaller} अभी आपको ₹799 का पेमेंट लिंक WhatsApp पर भेज रहा हूँ। जैसे ही पेमेंट होगा, हमारी टीम तुरंत आपकी फाइल पर काम शुरू कर देगी।`,
    objections: [
      { q: "फीस क्यों लगा रहे हो?", a: "सर/मैम, ये फीस आपकी फाइल प्रोसेसिंग, बैंक सिलेक्शन और एक्सपर्ट कंसल्टेशन के लिए है। बिना इसके हम काम शुरू नहीं कर पाते।" },
      { q: "पहले से कहीं अप्लाई किया है", a: "सर, कोई बात नहीं, लेकिन हम 30+ बैंकों से compare करके सबसे कम रेट निकालते हैं। एक बार मौका दीजिए, फायदा आपका ही होगा।" },
      { q: "अभी ज़रूरत नहीं है", a: "बिल्कुल सर/मैम, कोई प्रॉब्लम नहीं। बताइए कब कॉल करूँ? मैं शेड्यूल कर लेता हूँ।" },
    ],
    loanTypes: {
      home: "होम", business: "बिज़नेस", personal: "पर्सनल",
      education: "एजुकेशन", vehicle: "वाहन", gold: "गोल्ड", marriage: "शादी",
    } as Record<string, string>,
  },
  en: {
    opening: (name: string, greeting: string, telecaller: string, company: string) =>
      `${greeting} ${name}, this is ${telecaller} calling from ${company}. May I have a minute of your time?`,
    purpose: (loanType: string, amount: string) =>
      `Sir/Ma'am, you recently enquired about a ${loanType} loan of ₹${amount}. I'm your dedicated loan advisor and I'm calling to get you the best deal possible.`,
    valueProps: [
      "Tie-up with 30+ banks – guaranteed lowest interest rates",
      "Approval possible within 24 hours",
      "Just ₹799 processing fee – no hidden charges",
      "Free CIBIL report check included",
    ],
    questions: [
      "Are you currently employed or running your own business?",
      "How urgently do you need the loan?",
      "Do you have any running EMIs right now?",
    ],
    closing: (telecaller: string) =>
      `Sir/Ma'am, to move forward I (${telecaller}) will send a ₹799 payment link on WhatsApp right now. As soon as payment is done, our team will immediately start working on your file.`,
    objections: [
      { q: "Why this fee?", a: "Sir/Ma'am, this fee covers your file processing, bank selection, and expert consultation. Without it we cannot start the work." },
      { q: "Already applied elsewhere", a: "No problem sir, but we compare 30+ banks to find the lowest rate. Give us one chance – the benefit is yours." },
      { q: "Not interested right now", a: "Absolutely fine sir/ma'am. When should I call back? I'll schedule it." },
    ],
    loanTypes: {
      home: "Home", business: "Business", personal: "Personal",
      education: "Education", vehicle: "Vehicle", gold: "Gold", marriage: "Marriage",
    } as Record<string, string>,
  },
};

const CallScriptDisplay = ({ lead, companyName = "Hariox", telecallerName = "" }: CallScriptDisplayProps) => {
  const [lang, setLang] = useState<ScriptLang>("hi");
  const [isExpanded, setIsExpanded] = useState(false);

  const s = scripts[lang];
  const greeting = getGreeting(lang);
  const callerName = telecallerName || (lang === "hi" ? "[आपका नाम]" : "[Your Name]");
  const loanLabel = s.loanTypes[lead.loan_type] || lead.loan_type.replace(/_/g, " ");
  const loanAmount = Number(lead.loan_amount).toLocaleString("en-IN");

  return (
    <div className="border border-green-300 dark:border-green-700 rounded-xl overflow-hidden bg-gradient-to-b from-green-50 to-white dark:from-green-950/40 dark:to-card">
      {/* Header - WhatsApp style */}
      <div className="bg-green-600 dark:bg-green-800 px-3 py-2 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Phone className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="text-white text-sm font-semibold">{lead.full_name}</p>
            <p className="text-green-100 text-[10px]">
              {lang === "hi" ? "कॉल स्क्रिप्ट" : "Call Script"} • {isExpanded ? "▲" : "▼"}
            </p>
          </div>
        </button>

        {/* Language Toggle */}
        <div className="flex items-center gap-1 bg-white/15 rounded-full p-0.5">
          <button
            onClick={() => setLang("hi")}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
              lang === "hi" ? "bg-white text-green-700" : "text-white/80 hover:text-white"
            }`}
          >
            हिंदी
          </button>
          <button
            onClick={() => setLang("en")}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
              lang === "en" ? "bg-white text-green-700" : "text-white/80 hover:text-white"
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-2.5">
          {/* Greeting bubble */}
          <div className="flex justify-end">
            <div className="bg-green-100 dark:bg-green-900/50 rounded-xl rounded-tr-sm px-3 py-2 max-w-[90%] text-sm text-green-900 dark:text-green-100">
              <p className="font-medium text-xs text-green-600 dark:text-green-400 mb-0.5">
                📞 {lang === "hi" ? "शुरुआत" : "Opening"}
              </p>
              <p className="leading-relaxed text-[12px]">
                "{s.opening(lead.full_name, greeting, callerName, companyName)}"
              </p>
            </div>
          </div>

          {/* Purpose bubble */}
          <div className="flex justify-end">
            <div className="bg-green-100 dark:bg-green-900/50 rounded-xl rounded-tr-sm px-3 py-2 max-w-[90%] text-sm text-green-900 dark:text-green-100">
              <p className="font-medium text-xs text-green-600 dark:text-green-400 mb-0.5">
                🎯 {lang === "hi" ? "उद्देश्य" : "Purpose"}
              </p>
              <p className="leading-relaxed text-[12px]">
                "{s.purpose(loanLabel, loanAmount)}"
              </p>
            </div>
          </div>

          {/* Value Props */}
          <div className="flex justify-end">
            <div className="bg-green-100 dark:bg-green-900/50 rounded-xl rounded-tr-sm px-3 py-2 max-w-[90%] text-green-900 dark:text-green-100">
              <p className="font-medium text-xs text-green-600 dark:text-green-400 mb-1">
                💡 {lang === "hi" ? "क्यों चुनें" : "Why Choose Us"}
              </p>
              <ul className="space-y-0.5 text-[12px]">
                {s.valueProps.map((v, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Questions */}
          <div className="flex justify-end">
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl rounded-tr-sm px-3 py-2 max-w-[90%] border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100">
              <p className="font-medium text-xs text-blue-600 dark:text-blue-400 mb-1">
                ❓ {lang === "hi" ? "ज़रूरी सवाल" : "Qualifying Questions"}
              </p>
              <ul className="space-y-0.5 text-[12px]">
                {s.questions.map((q, i) => (
                  <li key={i}>• {q}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Closing */}
          <div className="flex justify-end">
            <div className="bg-green-100 dark:bg-green-900/50 rounded-xl rounded-tr-sm px-3 py-2 max-w-[90%] text-green-900 dark:text-green-100">
              <p className="font-medium text-xs text-green-600 dark:text-green-400 mb-0.5">
                🔒 {lang === "hi" ? "क्लोज़िंग" : "Closing"}
              </p>
              <p className="leading-relaxed text-[12px]">
                "{s.closing(callerName)}"
              </p>
            </div>
          </div>

          {/* Objections */}
          <div className="bg-red-50 dark:bg-red-950/20 rounded-xl px-3 py-2 border border-red-200 dark:border-red-800">
            <p className="font-medium text-xs text-red-600 dark:text-red-400 mb-1.5">
              ⚠️ {lang === "hi" ? "आम आपत्तियाँ" : "Common Objections"}
            </p>
            <div className="space-y-1.5">
              {s.objections.map((obj, i) => (
                <div key={i} className="text-[11px]">
                  <span className="font-semibold text-red-700 dark:text-red-300">"{obj.q}"</span>
                  <span className="text-red-600 dark:text-red-400"> → {obj.a}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallScriptDisplay;
