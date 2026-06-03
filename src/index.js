require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { authAdmin } = require("./middleware/auth");
const { assertChatReady } = require("./services/chatService");
const { disconnectPrisma } = require("./lib/prisma");
const { setupChatSocket } = require("./socket/chat");
const { startBlogPublisher } = require("./services/blogPublisher");

const publicProducts = require("./routes/public/products");
const publicSearch = require("./routes/public/search");
const publicCategories = require("./routes/public/categories");
const publicBrands = require("./routes/public/brands");
const publicAuth = require("./routes/public/auth");
const publicOrders = require("./routes/public/orders");
const publicChat = require("./routes/public/chat");
const publicContact = require("./routes/public/contact");
const publicReferrals = require("./routes/public/referrals");
const adminAuth = require("./routes/admin/auth");
const adminDashboard = require("./routes/admin/dashboard");
const adminCategories = require("./routes/admin/categories");
const adminBrands = require("./routes/admin/brands");
const adminProducts = require("./routes/admin/products");
const adminMedia = require("./routes/admin/media");
const adminOrders = require("./routes/admin/orders");
const adminChat = require("./routes/admin/chat");
const adminContact = require("./routes/admin/contact");
const adminReferrals = require("./routes/admin/referrals");
const adminBlogs = require("./routes/admin/blogs");
const adminBlogCategories = require("./routes/admin/blogCategories");
const adminBlogTags = require("./routes/admin/blogTags");
const adminBlogAi = require("./routes/admin/blogAi");
const publicBlogs = require("./routes/public/blogs");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://82.25.95.230:3001",
  "https://digitoolera.com",
];

if (!process.env.JWT_SECRET) {
  console.warn("Warning: JWT_SECRET is not set in .env");
}

console.log("CORS allowed origins:", ALLOWED_ORIGINS.join(", "));

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
});

setupChatSocket(io);
app.set("io", io);

app.get("/api/health", (req, res) => {
  let chatReady = false;
  try {
    assertChatReady();
    chatReady = true;
  } catch {
    chatReady = false;
  }
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    chatReady,
  });
});

app.use("/api/products", publicProducts);
app.use("/api/search", publicSearch);
app.use("/api/categories", publicCategories);
app.use("/api/brands", publicBrands);
app.use("/api/auth", publicAuth);
app.use("/api/orders", publicOrders);
app.use("/api/chat", publicChat);
app.use("/api/contact", publicContact);
app.use("/api/referrals", publicReferrals);
app.use("/api/blogs", publicBlogs);

app.use("/api/admin/auth", adminAuth);
app.use("/api/admin/dashboard", authAdmin, adminDashboard);
app.use("/api/admin/categories", authAdmin, adminCategories);
app.use("/api/admin/brands", authAdmin, adminBrands);
app.use("/api/admin/products", authAdmin, adminProducts);
app.use("/api/admin/media", authAdmin, adminMedia);
app.use("/api/admin/orders", authAdmin, adminOrders);
app.use("/api/admin/chat", authAdmin, adminChat);
app.use("/api/admin/contact", authAdmin, adminContact);
app.use("/api/admin/referrals", authAdmin, adminReferrals);
app.use("/api/admin/blogs", authAdmin, adminBlogs);
app.use("/api/admin/blog-categories", authAdmin, adminBlogCategories);
app.use("/api/admin/blog-tags", authAdmin, adminBlogTags);
app.use("/api/admin/blog-ai", authAdmin, adminBlogAi);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

let blogPublisherTimer;

server.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  blogPublisherTimer = startBlogPublisher();
  try {
    assertChatReady();
    console.log("Chat (Socket.IO + REST) is ready");
  } catch (err) {
    console.warn(`Chat not ready: ${err.message}`);
  }
});

function shutdown() {
  if (blogPublisherTimer) clearInterval(blogPublisherTimer);
  server.close(() => {
    disconnectPrisma().finally(() => process.exit(0));
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
