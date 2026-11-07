delete process.env.ANTHROPIC_API_KEY;
import { runCoach, expenseLabel } from "@/lib/coach/chat";
(async () => {
  for (const q of ["What if my hours drop to 16 a week in January?", "What happens if I cancel Disney+?", "Can I afford £120 for a school trip in January?", "Why is my Universal Credit lower in January?", "car repair £300 in December", "what if my hours go up to 28 a week from December", "I need to spend £60 on a coat in December", "cancel my O2 mobile"]) {
    const r = await runCoach({ personaId: "aisha", language: "en", messages: [{ role: "user", content: q }] });
    console.log(`\nQ: ${q}\nA: ${r.reply}\n   tools=${r.toolCalls} checked=${r.checked}`);
  }
  console.log(expenseLabel("Can I afford £120 for a school trip in January?"), expenseLabel("car repair £300 in December"), expenseLabel("I need to spend £60 on a coat in December"));
})();
