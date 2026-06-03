const express = require("express");
const { generateBlogFromPrompt } = require("../../services/blogAiService");

const router = express.Router();

router.post("/generate", async (req, res, next) => {
  try {
    const { prompt } = req.body;
    const result = await generateBlogFromPrompt(prompt);
    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
