const express = require("express");
const path = require("path");
const session = require("express-session");
const expressLayouts = require("express-ejs-layouts");
const fs = require("fs");
require("dotenv").config();

const app = express();
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
    cookie: { secure: false }
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.get("/", (req, res) => {
  res.render("pages/index", {
    title: "Bienvenue chez KazABurger"
  });
});

app.get("/about", (req, res) => {
  res.render("pages/about", {
    title: "À propos de KazABurger"
  });
});

app.get("/html/product", (req, res) => {
  const fileContent = fs.readFileSync("./data/products.json");
  let productData = JSON.parse(fileContent);
  const { family, featured, suggest, search } = req.query;

  if (family) {
    productData = productData.filter(item => item.family === family);
  }
  if (featured === "true") {
    productData = productData.filter(item => item.featured);
  }
  if (suggest === "true") {
    productData = productData.filter(item => item.suggest);
  }
  if (search) {
    productData = productData.filter(item =>
      item.title.toLowerCase().includes(search.toLowerCase())
    );
  }
  const families = [...new Set(JSON.parse(fileContent).map(prod => prod.family))];

  res.render("pages/product/index", {
    title: "La carte",
    products: productData,
    families,
    currentFamily: family || null,
    search: search || ""
  });
});

app.get("/html/product/:id", (req, res) => {
  const fileContent = fs.readFileSync("./data/products.json");
  const productData = JSON.parse(fileContent);
  const foundItem = productData.find(elem => elem.id === req.params.id);
  if (!foundItem) return res.status(404).send("Produit introuvable");

  res.render("pages/product/show", {
    title: foundItem.title,
    product: foundItem
  });
});

app.get("/html/suggest", (req, res) => {
  const suggestionsList = JSON.parse(fs.readFileSync("./data/suggestions.json"));
  const productData = JSON.parse(fs.readFileSync("./data/products.json"));

  const suggestionsCombined = suggestionsList.map(item => {
    const linked = productData.find(p => p.id === item.productId);
    return {
      ...item,
      productTitle: linked ? linked.title : "Produit introuvable",
      productImage: linked ? linked.image : "img-not-found.jpg"
    };
  });

  res.render("pages/suggest/index", {
    title: "Suggestions",
    suggestions: suggestionsCombined
  });
});

app.get("/html/suggest/:id", (req, res) => {
  const suggestionsList = JSON.parse(fs.readFileSync("./data/suggestions.json"));
  const productData = JSON.parse(fs.readFileSync("./data/products.json"));
  const requested = suggestionsList.find(s => s.id === req.params.id);
  if (!requested) return res.status(404).send("Suggestion introuvable");

  const refProduct = productData.find(p => p.id === requested.productId);

  res.render("pages/suggest/show", {
    title: "Modifier suggestion",
    suggestion: requested,
    product: refProduct
  });
});

app.patch("/suggest/:id", express.json(), (req, res) => {
  const fileData = fs.readFileSync("./data/suggestions.json");
  const suggestionsList = JSON.parse(fileData);
  const index = suggestionsList.findIndex(elem => elem.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Suggestion introuvable" });

  suggestionsList[index].comment = req.body.comment;
  fs.writeFileSync("./data/suggestions.json", JSON.stringify(suggestionsList, null, 2));
  res.json({ success: true });
});

app.delete("/suggest/:id", (req, res) => {
  const fileData = fs.readFileSync("./data/suggestions.json");
  let suggestionsList = JSON.parse(fileData);
  const index = suggestionsList.findIndex(elem => elem.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Suggestion introuvable" });

  suggestionsList.splice(index, 1);
  fs.writeFileSync("./data/suggestions.json", JSON.stringify(suggestionsList, null, 2));
  res.json({ success: true });
});

app.post("/suggest", express.json(), (req, res) => {
  const fileData = fs.readFileSync("./data/suggestions.json");
  let suggestionsList = JSON.parse(fileData);
  const newId = String(Date.now());

  suggestionsList.push({
    id: newId,
    productId: req.body.productId,
    comment: req.body.comment
  });

  fs.writeFileSync("./data/suggestions.json", JSON.stringify(suggestionsList, null, 2));
  res.status(201).json({ success: true });
});

app.get("/login", (req, res) => {
  res.render("pages/user/login", { title: "Connexion", error: null });
});

app.post("/login", express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  const userFile = fs.readFileSync("./data/users.json");
  const usersData = JSON.parse(userFile);
  const match = usersData.find(u => u.username === username && u.password === password);

  if (!match) {
    return res.render("pages/user/login", {
      title: "Connexion",
      error: "Identifiants invalides"
    });
  }
  req.session.user = { username: match.username, role: match.role };
  res.redirect("/html/product");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/html/product");
  });
});

app.use((req, res) => {
  res.status(404).send("Page introuvable");
});

const PORT = process.env.PORT || 4501;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
