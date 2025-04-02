const express = require("express");
const app = express();
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const path = require("path");
require("dotenv").config();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");

app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secretkey",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});


const fs = require("fs");

app.get("/html/product", (req, res) => {
  const rawData = fs.readFileSync("./data/products.json");
  let products = JSON.parse(rawData);

  const { family, featured, suggest, search } = req.query;

  // 🔎 Filtrage par famille
  if (family) {
    products = products.filter((p) => p.family === family);
  }

  // 🌟 Filtrage vedettes
  if (featured === "true") {
    products = products.filter((p) => p.featured === true);
  }

  // 💡 Filtrage suggestions
  if (suggest === "true") {
    products = products.filter((p) => p.suggest === true);
  }

  // 🔠 Recherche titre
  if (search) {
    products = products.filter((p) =>
      p.title.toLowerCase().includes(search.toLowerCase())
    );
  }

  // 🔁 Extraire familles pour les boutons dynamiques
  const families = [...new Set(JSON.parse(rawData).map((p) => p.family))];

  res.render("pages/product/index", {
    title: "La carte",
    products,
    families,
    currentFamily: family,
    search
  });
});

app.get("/html/suggest", (req, res) => {
  const suggestions = JSON.parse(fs.readFileSync("./data/suggestions.json"));
  const products = JSON.parse(fs.readFileSync("./data/products.json"));

  // On enrichit chaque suggestion avec les infos du produit lié
  const enriched = suggestions.map(s => {
    const product = products.find(p => p.id === s.productId);
    return {
      ...s,
      productTitle: product?.title || "Produit introuvable",
      productImage: product?.image || "img-not-found.jpg"
    };
  });

  res.render("pages/suggest/index", {
    title: "Suggestions",
    suggestions: enriched
  });
});


app.get("/html/product/:id", (req, res) => {
  const id = req.params.id;
  const rawData = fs.readFileSync("./data/products.json");
  const products = JSON.parse(rawData);

  const product = products.find((p) => p.id === id);

  if (!product) {
    return res.status(404).send("Produit introuvable");
  }

  res.render("pages/product/show", {
    title: product.title,
    product
  });
});

app.get("/html/suggest/:id", (req, res) => {
  const { id } = req.params;
  const suggestions = JSON.parse(fs.readFileSync("./data/suggestions.json"));
  const products = JSON.parse(fs.readFileSync("./data/products.json"));

  const suggestion = suggestions.find(s => s.id === id);
  if (!suggestion) return res.status(404).send("Suggestion introuvable");

  const product = products.find(p => p.id === suggestion.productId);

  res.render("pages/suggest/show", {
    title: "Modifier suggestion",
    suggestion,
    product
  });
});

app.patch("/suggest/:id", express.json(), (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  const filePath = "./data/suggestions.json";
  const suggestions = JSON.parse(fs.readFileSync(filePath));

  const index = suggestions.findIndex(s => s.id === id);
  if (index === -1) return res.status(404).json({ error: "Suggestion introuvable" });

  suggestions[index].comment = comment;

  fs.writeFileSync(filePath, JSON.stringify(suggestions, null, 2));
  res.json({ success: true });
});

app.delete("/suggest/:id", (req, res) => {
  const { id } = req.params;
  const filePath = "./data/suggestions.json";

  let suggestions = JSON.parse(fs.readFileSync(filePath));
  const index = suggestions.findIndex(s => s.id === id);

  if (index === -1) return res.status(404).json({ error: "Suggestion introuvable" });

  suggestions.splice(index, 1); // on retire l'entrée

  fs.writeFileSync(filePath, JSON.stringify(suggestions, null, 2));
  res.json({ success: true });
});

app.post("/suggest", express.json(), (req, res) => {
  const { productId, comment } = req.body;
  const filePath = "./data/suggestions.json";

  let suggestions = JSON.parse(fs.readFileSync(filePath));

  // Générer un nouvel ID unique (auto-incrémenté ici)
  const newId = String(Date.now());

  suggestions.push({
    id: newId,
    productId,
    comment
  });

  fs.writeFileSync(filePath, JSON.stringify(suggestions, null, 2));
  res.status(201).json({ success: true });
});

app.get("/login", (req, res) => {
  res.render("pages/user/login", { title: "Connexion", error: null });
});

app.post("/login", express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  const users = JSON.parse(fs.readFileSync("./data/users.json"));

  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.render("pages/user/login", {
      title: "Connexion",
      error: "Identifiants invalides"
    });
  }

  req.session.user = {
    username: user.username,
    role: user.role
  };

  res.redirect("/html/product");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/html/product");
  });
});

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});


app.get("/", (req, res) => {
  res.render("pages/index", {
    title: "Bienvenue chez <a href='/' class='underline'>KazABurger</a>",
  });
});

app.get("/about", (req, res) => {
  res.render("pages/about", {
    title: "À propos de <a href='/' class='underline'>KazABurger</a>",
  });
});


const PORT = process.env.PORT || 4501;
app.listen(PORT, () => {
  console.log(`Serveur en ligne sur http://localhost:${PORT}`);
});
