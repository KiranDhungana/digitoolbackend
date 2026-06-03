const { slugify } = require("../lib/slugify");

function buildTemplateFromPrompt(prompt) {
  const topic = String(prompt).trim() || "Digital gift cards in Nepal";
  const title = `${topic.charAt(0).toUpperCase()}${topic.slice(1)} — A complete guide`;
  const slug = slugify(title);
  const focusKeyword = topic.split(/\s+/).slice(0, 3).join(" ").toLowerCase();

  return {
    title,
    slug,
    meta_description: `Learn about ${topic} on Digitoolera. Practical tips, pricing in NPR, and how to buy safely in Nepal.`,
    focus_keyword: focusKeyword,
    excerpt: `Everything you need to know about ${topic} — written for shoppers in Nepal.`,
    content: `<h2>Introduction</h2><p>${topic} is increasingly popular among gamers and digital shoppers in Nepal. This guide explains what to look for, how payments work, and how Digitoolera helps you get codes quickly.</p><h2>Why choose digital products?</h2><p>Gift cards and game credits save time compared to physical retail. You can top up PUBG UC, Roblox, Apple, Xbox, and more from home with NPR pricing shown upfront.</p><h2>How to buy safely</h2><p>Use a trusted store with clear order confirmation, support chat, and a refund policy if something goes wrong. Always keep your payment reference until your order is verified.</p><h2>Conclusion</h2><p>Ready to shop? Browse the Digitoolera catalogue for gaming and software gift cards with fast delivery.</p>`,
    headings: [
      "Introduction",
      "Why choose digital products?",
      "How to buy safely",
      "Conclusion",
    ],
    faq: [
      {
        question: `What is ${topic}?`,
        answer: `It covers digital products and gift cards related to ${topic}, available online for customers in Nepal.`,
      },
      {
        question: "How fast is delivery?",
        answer:
          "Most digital codes are delivered within minutes after payment verification, depending on the product.",
      },
      {
        question: "Can I pay with Fonepay?",
        answer:
          "Yes. Digitoolera supports common Nepal payment methods including Fonepay during checkout.",
      },
    ],
    featured_image_alt: `${topic} guide — Digitoolera blog`,
  };
}

async function generateBlogFromPrompt(prompt) {
  const trimmed = String(prompt ?? "").trim();
  if (!trimmed) {
    const err = new Error("Prompt is required");
    err.statusCode = 400;
    throw err;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildTemplateFromPrompt(trimmed);
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an SEO blog writer for Digitoolera, a Nepal digital gift card store (gaming: PUBG UC, Roblox, Steam, PlayStation, Xbox; software: Apple, Google Play, Microsoft 365). Write for Google Ads landing relevance: use Nepal/NPR/Fonepay/Khalti naturally, one clear focus_keyword per post, meta_description 50-160 chars with the keyword. Return ONLY valid JSON with keys: title, slug, meta_description, focus_keyword, excerpt, content (HTML with h2/h3 and p tags), headings (string array), faq (array of {question, answer}), featured_image_alt. No markdown fences.",
        },
        {
          role: "user",
          content: `Write an SEO blog post about: ${trimmed}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn("OpenAI blog generation failed:", res.status, errText);
    return buildTemplateFromPrompt(trimmed);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  try {
    const parsed = JSON.parse(raw);
    return {
      title: parsed.title,
      slug: slugify(parsed.slug || parsed.title),
      meta_description: parsed.meta_description,
      focus_keyword: parsed.focus_keyword,
      excerpt: parsed.excerpt,
      content: parsed.content,
      headings: parsed.headings ?? [],
      faq: parsed.faq ?? [],
      featured_image_alt: parsed.featured_image_alt,
    };
  } catch {
    return buildTemplateFromPrompt(trimmed);
  }
}

module.exports = { generateBlogFromPrompt, buildTemplateFromPrompt };
