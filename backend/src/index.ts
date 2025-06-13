import app from "./app";

const port = Number(process.env.PORT) || 5000;

app.listen(port, () => {
  console.log(`🚀 Backend running at http://localhost:${port}`);
});

app.on("error", (err) => {
  console.error("❌ Failed to start server:", err);
});