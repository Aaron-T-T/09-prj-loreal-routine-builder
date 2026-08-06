export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      request.method === "POST" &&
      (url.pathname === "/" || url.pathname === "/api")
    ) {
      try {
        const payload = await request.json();
        const messages = Array.isArray(payload?.messages)
          ? payload.messages
          : [];
        const lastUserMessage =
          [...messages].reverse().find((message) => message?.role === "user")
            ?.content || "";
        const lowerText = String(lastUserMessage).toLowerCase();

        let content =
          "I can help you build a simple L'Oréal routine. Share your skin goals and the products you want to use, and I will suggest a beginner-friendly plan.";

        if (lowerText.includes("routine") || lowerText.includes("generate")) {
          content =
            "Here is a simple starter routine: 1. Cleanse gently. 2. Apply any treatment or serum. 3. Moisturize. 4. Finish with sunscreen in the morning. 5. Add makeup or hair products after your skincare steps.";
        } else if (
          lowerText.includes("skincare") ||
          lowerText.includes("skin") ||
          lowerText.includes("acne") ||
          lowerText.includes("dry") ||
          lowerText.includes("oily")
        ) {
          content =
            "For skincare, start with a gentle cleanser, add a targeted treatment if needed, then moisturize and finish with sunscreen in the morning.";
        } else if (
          lowerText.includes("morning") ||
          lowerText.includes("evening")
        ) {
          content =
            "Morning: cleanse, moisturize, and protect with sunscreen. Evening: cleanse, treat, and moisturize.";
        } else if (
          lowerText.includes("makeup") ||
          lowerText.includes("hair") ||
          lowerText.includes("fragrance")
        ) {
          content =
            "I can help with skincare, haircare, makeup, and fragrance. Tell me what you want to improve, and I will tailor the advice to your routine.";
        } else if (
          lowerText.includes("sunscreen") ||
          lowerText.includes("serum")
        ) {
          content =
            "A good order is cleanse, treat, moisturize, then protect with sunscreen in the morning.";
        }

        return Response.json({
          choices: [{ message: { content } }],
        });
      } catch (error) {
        return Response.json(
          { error: "Invalid request body" },
          { status: 400 },
        );
      }
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    return new Response("L'Oréal Routine Builder Worker", { status: 200 });
  },
};
