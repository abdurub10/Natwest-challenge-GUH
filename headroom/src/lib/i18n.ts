// Small UI dictionary for English, Urdu and Polish (plan section 3.2, stretch 2).
// English strings are the copy deck from plan section 21, verbatim.
// Money and dates stay in the same format in every language ("−£140", "Mon 1 Feb").
// Templates use {name} placeholders; fill them with fill() or the <Tpl> component.
import type { Language, Status, Eligibility } from "@/lib/forecast/types";

const en = {
  "app.name": "Headroom",
  "tabs.home": "Home",
  "tabs.plan": "Plan",
  "tabs.ask": "Ask",
  "tabs.settings": "Settings",
  "tabs.label": "Main",

  "home.greeting": "Hi Aisha",
  "home.title": "Your next 90 days",
  "home.lowest": "Lowest point",
  "home.todayChip": "{status} today: {amount}",
  "home.chartTitle": "Projected balance",
  "home.weeksTitle": "Week by week",
  "home.dayTitle": "Pick a day",
  "home.noWarning": "Nothing looks short in the next 90 days.",
  "home.noWarningBody": "We will tell you early if that changes.",

  "status.comfortable": "Comfortable",
  "status.tight": "Tight",
  "status.short": "Short",
  "statusSentence.comfortable": "You have room this week.",
  "statusSentence.tight": "Money is tight this week. Nothing is due that you cannot cover.",
  "statusSentence.short": "You are likely to go below zero this week.",

  "warning.text": "You're likely to be short from {start} to {end}, by about {amount}.",
  "warning.why": "Why",
  "warning.plan": "See what you can do",
  "warning.biggest": "Biggest reason: {label}",
  "warning.label": "Heads up",

  "day.today": "Today",
  "day.balanceToday": "Balance today",
  "day.balanceAfter": "Projected balance after today",
  "day.between": "between {low} and {high}",
  "day.nothingDue": "Nothing due on this day.",
  "day.inStretch": "You are in the Short stretch that started on {start}.",
  "day.ucNext": "Universal Credit lands on {date}.",
  "day.weekOf": "Week of {date}",
  "scrubber.label": "Move through the next 90 days",

  "why.title": "Why this is happening",
  "why.back": "Back to forecast",
  "why.bestNext": "Best next step",
  "why.nothing": "Nothing looks short in the next 90 days, so there is nothing to explain right now.",
  "why.happenedBefore": "This happened before",
  "why.happenedBeforeIntro": "Your balance went below zero in these months.",
  "why.monthRow": "{days} days below zero, lowest {low}",
  "why.fivePaydays": "5 paydays in the Universal Credit period",

  "how.title": "How we worked this out",
  "how.intro": "We used your own transactions from the last 12 months and public rules. Nothing here is a guess about you as a person.",
  "how.ruleUsed": "Rule used",
  "how.basedOn": "Based on {counts}",
  "how.and": "and",
  "how.regular": "We found {n} regular payments in and out of your account.",
  "how.effect": "Without this, your lowest point would be about {amount} higher.",

  "plan.title": "What you can do",
  "plan.subtitle": "Lowest point: {before} → {after} with the ticked options",
  "plan.subtitleNone": "Lowest point: {before}. Tick an option to see the change.",
  "plan.subtitleLoading": "Working out the new lowest point",
  "plan.setUp": "Set this up",
  "plan.settingUp": "Setting this up",
  "plan.setUpError": "We couldn't set this up. Try again in a moment.",
  "plan.ticked": "{n} ticked",
  "plan.byWhen": "+{amount} by {month}",
  "plan.monthly": "+{amount} a month",
  "plan.effort": "{n} min",
  "plan.steps": "How to do it",
  "plan.hideSteps": "Hide steps",
  "plan.findOut": "Find out more",
  "plan.toggleOn": "Ticked",
  "plan.toggleOff": "Not ticked",
  "plan.before": "Before",
  "plan.after": "With your options",

  "elig.yes": "You qualify",
  "elig.likely": "Likely",
  "elig.check": "Worth checking",

  "help.title": "Talk to someone",
  "help.intro": "Talking to someone is free and it works.",
  "help.call": "Call {name}",

  "done.title": "Done. Your plan is set.",
  "done.scheduled": "What we set up",
  "done.reminder": "Reminder on {date}",
  "done.everyFriday": "A reminder every Friday on payday",
  "done.sent": "Your plan was sent to you by WhatsApp",
  "done.lowestNow": "Lowest point with your plan: {amount}",
  "done.activity": "What happened",
  "done.back": "Back to forecast",
  "done.ask": "Ask a question",
  "done.empty": "You have not set up a plan yet.",
  "done.emptyLink": "See what you can do",

  "ask.title": "Ask",
  "ask.subtitle": "Questions about your next few months. Answers use your forecast.",
  "ask.placeholder": "Ask about your next few months",
  "ask.send": "Send",
  "ask.chip1": "What if my hours drop to 16 a week in January?",
  "ask.chip2": "What happens if I cancel Disney+?",
  "ask.chip3": "Can I afford £120 for a school trip in January?",
  "ask.chip4": "Why is my Universal Credit lower in January?",
  "ask.chipsLabel": "Try asking",
  "ask.checked": "checked against your forecast",
  "ask.thinking": "Checking your forecast",
  "ask.error": "We couldn't reach the coach. Try again in a moment.",
  "ask.you": "You",
  "ask.coach": "Headroom",
  "ask.clear": "Start again",
  "voice.start": "Talk to the coach",
  "voice.stop": "Stop talking",
  "voice.connecting": "Connecting",
  "voice.listening": "Listening",
  "voice.speaking": "Speaking",
  "voice.unavailable": "Voice is unavailable, type instead",
  "voice.transcript": "What was said",

  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.textSize": "Text size",
  "settings.normal": "Normal",
  "settings.large": "Large",
  "settings.uses": "What Headroom uses",
  "settings.uses1": "Your transactions from the last 12 months.",
  "settings.uses2": "Public rules: Universal Credit, bank holidays, energy price cap dates, council tax.",
  "settings.uses3": "Nothing is shared without you asking.",
  "settings.person": "Talk to a person",
  "settings.delete": "Delete my forecast",
  "settings.deleteBody": "This clears your plan, your reminders and your messages.",
  "settings.deleteConfirm": "Yes, delete it",
  "settings.cancel": "Cancel",
  "settings.deleted": "Deleted. Your plan, reminders and messages are cleared.",
  "settings.deleteError": "We couldn't delete it. Try again in a moment.",

  "activity.empty": "Nothing yet.",
  "activity.title": "Activity",

  "footer": "Figures are estimates from your transactions and public rules. Words are written with AI. Illustrative 2025/26 benefit rates.",
  "error.load": "We couldn't load your forecast. Try again in a moment.",
  "error.retry": "Try again",
  "loading": "Loading your forecast",
} as const;

export type I18nKey = keyof typeof en;
type Dict = Record<I18nKey, string>;

const ur: Dict = {
  "app.name": "Headroom",
  "tabs.home": "ہوم",
  "tabs.plan": "منصوبہ",
  "tabs.ask": "پوچھیں",
  "tabs.settings": "ترتیبات",
  "tabs.label": "مین",

  "home.greeting": "السلام علیکم عائشہ",
  "home.title": "آپ کے اگلے 90 دن",
  "home.lowest": "سب سے کم رقم",
  "home.todayChip": "آج {status}: {amount}",
  "home.chartTitle": "متوقع بیلنس",
  "home.weeksTitle": "ہفتہ بہ ہفتہ",
  "home.dayTitle": "کوئی دن چنیں",
  "home.noWarning": "اگلے 90 دنوں میں پیسے کم ہونے کا امکان نظر نہیں آتا۔",
  "home.noWarningBody": "اگر یہ بدلا تو ہم آپ کو پہلے سے بتا دیں گے۔",

  "status.comfortable": "آرام دہ",
  "status.tight": "تنگ",
  "status.short": "کمی",
  "statusSentence.comfortable": "اس ہفتے آپ کے پاس گنجائش ہے۔",
  "statusSentence.tight": "اس ہفتے پیسے تنگ ہیں۔ کوئی ایسی ادائیگی نہیں جو آپ نہ کر سکیں۔",
  "statusSentence.short": "اس ہفتے آپ کا بیلنس صفر سے نیچے جانے کا امکان ہے۔",

  "warning.text": "{start} سے {end} تک آپ کے پاس تقریباً {amount} کم ہونے کا امکان ہے۔",
  "warning.why": "کیوں",
  "warning.plan": "آپ کیا کر سکتی ہیں",
  "warning.biggest": "سب سے بڑی وجہ: {label}",
  "warning.label": "توجہ دیں",

  "day.today": "آج",
  "day.balanceToday": "آج کا بیلنس",
  "day.balanceAfter": "اس دن کے بعد متوقع بیلنس",
  "day.between": "{low} اور {high} کے درمیان",
  "day.nothingDue": "اس دن کوئی ادائیگی نہیں۔",
  "day.inStretch": "آپ کمی کے اس دور میں ہیں جو {start} کو شروع ہوا۔",
  "day.ucNext": "یونیورسل کریڈٹ {date} کو آئے گا۔",
  "day.weekOf": "{date} والا ہفتہ",
  "scrubber.label": "اگلے 90 دنوں میں آگے پیچھے جائیں",

  "why.title": "ایسا کیوں ہو رہا ہے",
  "why.back": "پیشگوئی پر واپس",
  "why.bestNext": "اگلا بہترین قدم",
  "why.nothing": "اگلے 90 دنوں میں کمی نظر نہیں آتی، اس لیے ابھی بتانے کو کچھ نہیں۔",
  "why.happenedBefore": "یہ پہلے بھی ہوا",
  "why.happenedBeforeIntro": "ان مہینوں میں آپ کا بیلنس صفر سے نیچے گیا۔",
  "why.monthRow": "{days} دن صفر سے نیچے، سب سے کم {low}",
  "why.fivePaydays": "یونیورسل کریڈٹ کی مدت میں 5 تنخواہیں",

  "how.title": "ہم نے یہ کیسے نکالا",
  "how.intro": "ہم نے پچھلے 12 مہینوں کی آپ کی اپنی لین دین اور عوامی قواعد استعمال کیے۔",
  "how.ruleUsed": "استعمال شدہ قاعدہ",
  "how.basedOn": "{counts} کی بنیاد پر",
  "how.and": "اور",
  "how.regular": "ہمیں آپ کے اکاؤنٹ میں {n} باقاعدہ ادائیگیاں ملیں۔",
  "how.effect": "اس کے بغیر آپ کی سب سے کم رقم تقریباً {amount} زیادہ ہوتی۔",

  "plan.title": "آپ کیا کر سکتی ہیں",
  "plan.subtitle": "سب سے کم رقم: {before} → {after} چنے گئے اقدامات کے ساتھ",
  "plan.subtitleNone": "سب سے کم رقم: {before}۔ فرق دیکھنے کے لیے کوئی اقدام چنیں۔",
  "plan.subtitleLoading": "نئی سب سے کم رقم نکالی جا رہی ہے",
  "plan.setUp": "یہ ترتیب دیں",
  "plan.settingUp": "ترتیب دی جا رہی ہے",
  "plan.setUpError": "ہم یہ ترتیب نہیں دے سکے۔ تھوڑی دیر میں دوبارہ کوشش کریں۔",
  "plan.ticked": "{n} چنے گئے",
  "plan.byWhen": "{month} تک +{amount}",
  "plan.monthly": "+{amount} ماہانہ",
  "plan.effort": "{n} منٹ",
  "plan.steps": "یہ کیسے کریں",
  "plan.hideSteps": "مراحل چھپائیں",
  "plan.findOut": "مزید جانیں",
  "plan.toggleOn": "چنا گیا",
  "plan.toggleOff": "نہیں چنا گیا",
  "plan.before": "پہلے",
  "plan.after": "آپ کے اقدامات کے ساتھ",

  "elig.yes": "آپ اہل ہیں",
  "elig.likely": "غالباً",
  "elig.check": "جانچنے کے قابل",

  "help.title": "کسی سے بات کریں",
  "help.intro": "کسی سے بات کرنا مفت ہے اور اس سے مدد ملتی ہے۔",
  "help.call": "{name} کو کال کریں",

  "done.title": "ہو گیا۔ آپ کا منصوبہ تیار ہے۔",
  "done.scheduled": "ہم نے کیا ترتیب دیا",
  "done.reminder": "{date} کو یاد دہانی",
  "done.everyFriday": "ہر جمعہ تنخواہ کے دن یاد دہانی",
  "done.sent": "آپ کا منصوبہ واٹس ایپ پر بھیج دیا گیا",
  "done.lowestNow": "منصوبے کے ساتھ سب سے کم رقم: {amount}",
  "done.activity": "کیا ہوا",
  "done.back": "پیشگوئی پر واپس",
  "done.ask": "سوال پوچھیں",
  "done.empty": "آپ نے ابھی کوئی منصوبہ نہیں بنایا۔",
  "done.emptyLink": "آپ کیا کر سکتی ہیں",

  "ask.title": "پوچھیں",
  "ask.subtitle": "اپنے اگلے چند مہینوں کے بارے میں سوال کریں۔ جواب آپ کی پیشگوئی سے آتے ہیں۔",
  "ask.placeholder": "اپنے اگلے چند مہینوں کے بارے میں پوچھیں",
  "ask.send": "بھیجیں",
  "ask.chip1": "اگر جنوری میں میرے گھنٹے ہفتے میں 16 رہ جائیں تو؟",
  "ask.chip2": "اگر میں Disney+ بند کر دوں تو کیا ہوگا؟",
  "ask.chip3": "کیا میں جنوری میں اسکول ٹرپ کے لیے £120 دے سکتی ہوں؟",
  "ask.chip4": "جنوری میں میرا یونیورسل کریڈٹ کم کیوں ہے؟",
  "ask.chipsLabel": "یہ پوچھ کر دیکھیں",
  "ask.checked": "آپ کی پیشگوئی سے جانچا گیا",
  "ask.thinking": "آپ کی پیشگوئی دیکھی جا رہی ہے",
  "ask.error": "ہم کوچ تک نہیں پہنچ سکے۔ تھوڑی دیر میں دوبارہ کوشش کریں۔",
  "ask.you": "آپ",
  "ask.coach": "Headroom",
  "ask.clear": "دوبارہ شروع کریں",
  "voice.start": "کوچ سے بات کریں",
  "voice.stop": "بات ختم کریں",
  "voice.connecting": "رابطہ ہو رہا ہے",
  "voice.listening": "سن رہا ہے",
  "voice.speaking": "بول رہا ہے",
  "voice.unavailable": "آواز دستیاب نہیں، لکھ کر پوچھیں",
  "voice.transcript": "کیا کہا گیا",

  "settings.title": "ترتیبات",
  "settings.language": "زبان",
  "settings.textSize": "متن کا سائز",
  "settings.normal": "عام",
  "settings.large": "بڑا",
  "settings.uses": "Headroom کیا استعمال کرتا ہے",
  "settings.uses1": "پچھلے 12 مہینوں کی آپ کی لین دین۔",
  "settings.uses2": "عوامی قواعد: یونیورسل کریڈٹ، بینک کی چھٹیاں، توانائی کی قیمت کی حد کی تاریخیں، کونسل ٹیکس۔",
  "settings.uses3": "آپ کے کہے بغیر کچھ شیئر نہیں کیا جاتا۔",
  "settings.person": "کسی شخص سے بات کریں",
  "settings.delete": "میری پیشگوئی حذف کریں",
  "settings.deleteBody": "اس سے آپ کا منصوبہ، یاد دہانیاں اور پیغامات صاف ہو جائیں گے۔",
  "settings.deleteConfirm": "ہاں، حذف کریں",
  "settings.cancel": "منسوخ",
  "settings.deleted": "حذف ہو گیا۔ آپ کا منصوبہ، یاد دہانیاں اور پیغامات صاف ہو گئے۔",
  "settings.deleteError": "ہم اسے حذف نہیں کر سکے۔ تھوڑی دیر میں دوبارہ کوشش کریں۔",

  "activity.empty": "ابھی کچھ نہیں۔",
  "activity.title": "سرگرمی",

  "footer": "اعداد و شمار آپ کی لین دین اور عوامی قواعد سے اندازے ہیں۔ الفاظ AI کی مدد سے لکھے گئے ہیں۔ 2025/26 کی بینیفٹ شرحیں مثال کے طور پر۔",
  "error.load": "ہم آپ کی پیشگوئی لوڈ نہیں کر سکے۔ تھوڑی دیر میں دوبارہ کوشش کریں۔",
  "error.retry": "دوبارہ کوشش کریں",
  "loading": "آپ کی پیشگوئی لوڈ ہو رہی ہے",
};

const pl: Dict = {
  "app.name": "Headroom",
  "tabs.home": "Start",
  "tabs.plan": "Plan",
  "tabs.ask": "Zapytaj",
  "tabs.settings": "Ustawienia",
  "tabs.label": "Główne",

  "home.greeting": "Cześć, Aisha",
  "home.title": "Twoje następne 90 dni",
  "home.lowest": "Najniższy punkt",
  "home.todayChip": "{status} dziś: {amount}",
  "home.chartTitle": "Przewidywane saldo",
  "home.weeksTitle": "Tydzień po tygodniu",
  "home.dayTitle": "Wybierz dzień",
  "home.noWarning": "W ciągu następnych 90 dni nic nie wskazuje na brak pieniędzy.",
  "home.noWarningBody": "Jeśli to się zmieni, powiemy Ci wcześniej.",

  "status.comfortable": "Spokojnie",
  "status.tight": "Ciasno",
  "status.short": "Brakuje",
  "statusSentence.comfortable": "W tym tygodniu masz zapas.",
  "statusSentence.tight": "W tym tygodniu jest ciasno. Nic, czego nie dasz rady pokryć.",
  "statusSentence.short": "W tym tygodniu saldo prawdopodobnie spadnie poniżej zera.",

  "warning.text": "Od {start} do {end} prawdopodobnie zabraknie Ci około {amount}.",
  "warning.why": "Dlaczego",
  "warning.plan": "Zobacz, co możesz zrobić",
  "warning.biggest": "Główny powód: {label}",
  "warning.label": "Uwaga",

  "day.today": "Dziś",
  "day.balanceToday": "Saldo dziś",
  "day.balanceAfter": "Przewidywane saldo po tym dniu",
  "day.between": "między {low} a {high}",
  "day.nothingDue": "Tego dnia nic nie jest do zapłaty.",
  "day.inStretch": "Jesteś w okresie braku, który zaczął się {start}.",
  "day.ucNext": "Universal Credit wpłynie {date}.",
  "day.weekOf": "Tydzień od {date}",
  "scrubber.label": "Przesuwaj się po następnych 90 dniach",

  "why.title": "Dlaczego tak się dzieje",
  "why.back": "Wróć do prognozy",
  "why.bestNext": "Najlepszy następny krok",
  "why.nothing": "W ciągu następnych 90 dni nic nie wskazuje na brak, więc teraz nie ma czego wyjaśniać.",
  "why.happenedBefore": "To już się zdarzyło",
  "why.happenedBeforeIntro": "W tych miesiącach Twoje saldo spadło poniżej zera.",
  "why.monthRow": "{days} dni poniżej zera, najniżej {low}",
  "why.fivePaydays": "5 wypłat w okresie Universal Credit",

  "how.title": "Jak to obliczyliśmy",
  "how.intro": "Użyliśmy Twoich własnych transakcji z ostatnich 12 miesięcy i publicznych zasad.",
  "how.ruleUsed": "Użyta zasada",
  "how.basedOn": "Na podstawie: {counts}",
  "how.and": "i",
  "how.regular": "Znaleźliśmy {n} stałych wpływów i płatności na Twoim koncie.",
  "how.effect": "Bez tego Twój najniższy punkt byłby wyższy o około {amount}.",

  "plan.title": "Co możesz zrobić",
  "plan.subtitle": "Najniższy punkt: {before} → {after} z zaznaczonymi opcjami",
  "plan.subtitleNone": "Najniższy punkt: {before}. Zaznacz opcję, aby zobaczyć zmianę.",
  "plan.subtitleLoading": "Obliczamy nowy najniższy punkt",
  "plan.setUp": "Ustaw to",
  "plan.settingUp": "Ustawiamy",
  "plan.setUpError": "Nie udało się tego ustawić. Spróbuj ponownie za chwilę.",
  "plan.ticked": "Zaznaczone: {n}",
  "plan.byWhen": "+{amount} do {month}",
  "plan.monthly": "+{amount} miesięcznie",
  "plan.effort": "{n} min",
  "plan.steps": "Jak to zrobić",
  "plan.hideSteps": "Ukryj kroki",
  "plan.findOut": "Dowiedz się więcej",
  "plan.toggleOn": "Zaznaczone",
  "plan.toggleOff": "Niezaznaczone",
  "plan.before": "Przed",
  "plan.after": "Z Twoimi opcjami",

  "elig.yes": "Kwalifikujesz się",
  "elig.likely": "Prawdopodobnie",
  "elig.check": "Warto sprawdzić",

  "help.title": "Porozmawiaj z kimś",
  "help.intro": "Rozmowa z kimś jest bezpłatna i naprawdę pomaga.",
  "help.call": "Zadzwoń: {name}",

  "done.title": "Gotowe. Twój plan jest ustawiony.",
  "done.scheduled": "Co ustawiliśmy",
  "done.reminder": "Przypomnienie {date}",
  "done.everyFriday": "Przypomnienie w każdy piątek, w dzień wypłaty",
  "done.sent": "Plan został wysłany do Ciebie przez WhatsApp",
  "done.lowestNow": "Najniższy punkt z planem: {amount}",
  "done.activity": "Co się wydarzyło",
  "done.back": "Wróć do prognozy",
  "done.ask": "Zadaj pytanie",
  "done.empty": "Nie masz jeszcze planu.",
  "done.emptyLink": "Zobacz, co możesz zrobić",

  "ask.title": "Zapytaj",
  "ask.subtitle": "Pytania o najbliższe miesiące. Odpowiedzi korzystają z Twojej prognozy.",
  "ask.placeholder": "Zapytaj o najbliższe miesiące",
  "ask.send": "Wyślij",
  "ask.chip1": "Co jeśli w styczniu będę pracować 16 godzin tygodniowo?",
  "ask.chip2": "Co się stanie, jeśli zrezygnuję z Disney+?",
  "ask.chip3": "Czy stać mnie na £120 na szkolną wycieczkę w styczniu?",
  "ask.chip4": "Dlaczego mój Universal Credit jest niższy w styczniu?",
  "ask.chipsLabel": "Spróbuj zapytać",
  "ask.checked": "sprawdzone z Twoją prognozą",
  "ask.thinking": "Sprawdzamy Twoją prognozę",
  "ask.error": "Nie udało się połączyć z doradcą. Spróbuj ponownie za chwilę.",
  "ask.you": "Ty",
  "ask.coach": "Headroom",
  "ask.clear": "Zacznij od nowa",
  "voice.start": "Porozmawiaj z doradcą",
  "voice.stop": "Zakończ rozmowę",
  "voice.connecting": "Łączenie",
  "voice.listening": "Słucham",
  "voice.speaking": "Mówię",
  "voice.unavailable": "Głos jest niedostępny, napisz zamiast tego",
  "voice.transcript": "Co zostało powiedziane",

  "settings.title": "Ustawienia",
  "settings.language": "Język",
  "settings.textSize": "Rozmiar tekstu",
  "settings.normal": "Normalny",
  "settings.large": "Duży",
  "settings.uses": "Z czego korzysta Headroom",
  "settings.uses1": "Twoje transakcje z ostatnich 12 miesięcy.",
  "settings.uses2": "Publiczne zasady: Universal Credit, dni wolne od pracy, daty limitu cen energii, podatek lokalny.",
  "settings.uses3": "Nic nie jest udostępniane bez Twojej prośby.",
  "settings.person": "Porozmawiaj z człowiekiem",
  "settings.delete": "Usuń moją prognozę",
  "settings.deleteBody": "To usunie Twój plan, przypomnienia i wiadomości.",
  "settings.deleteConfirm": "Tak, usuń",
  "settings.cancel": "Anuluj",
  "settings.deleted": "Usunięto. Twój plan, przypomnienia i wiadomości zostały wyczyszczone.",
  "settings.deleteError": "Nie udało się usunąć. Spróbuj ponownie za chwilę.",

  "activity.empty": "Jeszcze nic.",
  "activity.title": "Aktywność",

  "footer": "Kwoty to szacunki na podstawie Twoich transakcji i publicznych zasad. Teksty są pisane z pomocą AI. Przykładowe stawki świadczeń 2025/26.",
  "error.load": "Nie udało się wczytać Twojej prognozy. Spróbuj ponownie za chwilę.",
  "error.retry": "Spróbuj ponownie",
  "loading": "Wczytujemy Twoją prognozę",
};

const DICTS: Record<Language, Dict> = { en, ur, pl };

export const LANGUAGES: { id: Language; label: string; native: string }[] = [
  { id: "en", label: "English", native: "English" },
  { id: "ur", label: "Urdu", native: "اردو" },
  { id: "pl", label: "Polish", native: "Polski" },
];

/** Look up a UI label. Falls back to English. */
export function t(lang: Language, key: I18nKey): string {
  return DICTS[lang]?.[key] ?? en[key];
}

/** Fill {name} placeholders with plain strings. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** t() + fill() in one call. */
export function tf(lang: Language, key: I18nKey, vars: Record<string, string | number>): string {
  return fill(t(lang, key), vars);
}

/** Split a template into literal text and placeholder names, for rich rendering. */
export function splitTemplate(template: string): { text?: string; name?: string }[] {
  const out: { text?: string; name?: string }[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) {
    if (m.index > last) out.push({ text: template.slice(last, m.index) });
    out.push({ name: m[1] });
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push({ text: template.slice(last) });
  return out;
}

/** "rtl" for Urdu text blocks, otherwise undefined (so the attribute is omitted). */
export function textDir(lang: Language): "rtl" | undefined {
  return lang === "ur" ? "rtl" : undefined;
}

export function statusWord(lang: Language, s: Status): string {
  return t(lang, `status.${s}` as I18nKey);
}
export function statusSentence(lang: Language, s: Status): string {
  return t(lang, `statusSentence.${s}` as I18nKey);
}
export function eligibilityLabel(lang: Language, e: Eligibility): string {
  return t(lang, `elig.${e}` as I18nKey);
}

export const ASK_CHIP_KEYS: I18nKey[] = ["ask.chip1", "ask.chip2", "ask.chip3", "ask.chip4"];
