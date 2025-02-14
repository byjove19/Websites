require("dotenv").config();
const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const db = require("better-sqlite3")("app.db");
db.pragma("journal_mode = WAL");

const app = express();
const http = require('http');
const socketIo = require('socket.io');
const server = http.createServer(app);
const io = socketIo(server);

// Setup view engine and middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(
    session({
        secret: process.env.SESSION_SECRET || "defaultsecret",
        resave: false,
        saveUninitialized: true,
    })
);

// Simple chatbot responses
const botResponses = {
    "hello": "Hi there! Welcome to Sage and Silk. How can I help you?",
    "help": "I can assist you with orders, product inquiries, and more!",
    "order": "To check your order status, please provide your order ID.",
    "default": "I'm not sure about that. Can you rephrase?"
};

io.on('connection', (socket) => {
    console.log('A user connected');
    
    socket.on('user message', (msg) => {
        console.log('User:', msg);
        
        // Find response
        const response = botResponses[msg.toLowerCase()] || botResponses["default"];
        
        // Send bot response
        socket.emit('bot message', response);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});


// Database setup
const createTables = db.transaction(() => {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username STRING NOT NULL UNIQUE,
            email STRING NOT NULL,
            password STRING NOT NULL 
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS subcategories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category_id INTEGER NOT NULL,
            FOREIGN KEY (category_id) REFERENCES categories (id)
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            stock INTEGER NOT NULL,
            subcategory_id INTEGER NOT NULL,
            FOREIGN KEY (subcategory_id) REFERENCES subcategories (id)
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS product_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            image_url TEXT NOT NULL,
            FOREIGN KEY (product_id) REFERENCES products (id)
        )
    `).run();
});

createTables();

// JWT-based authentication middleware
app.use((req, res, next) => {
    const token = req.cookies.sagesilkapp;
    if (token) {
        try {
            req.user = jwt.verify(token, process.env.JWTSECRET || "defaultjwtsecret");
        } catch (error) {
            req.user = null;
        }
    } else {
        req.user = null;
    }
    res.locals.user = req.user;
    next();
});

// Routes
app.get("/", (req, res) => res.render("index", { user: req.user }));

// Signup route
app.get("/signup", (req, res) => res.render("signup", { errors: [] }));
app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;
    const errors = [];

    if (!username || !email || !password) errors.push("Please fill in all the fields.");
    const usernameRegex = /^[a-zA-Z0-9]{3,15}$/;
    const existingUser = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (existingUser) errors.push("This username is already taken. Please choose another.");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) errors.push("Enter a valid email address.");
    const existingEmail = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (existingEmail) errors.push("This email is already registered. Try logging in or use a different email.");
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) errors.push("Password should be at least 8 characters long and include a mix of upper and lowercase letters and numbers.");

    if (errors.length) return res.render("signup", { errors });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.prepare("INSERT INTO users(username, email, password) VALUES (?, ?, ?)").run(username, email, hashedPassword);
        const token = jwt.sign({ username }, process.env.JWTSECRET || "defaultjwtsecret", { expiresIn: "1d" });
        res.cookie("sagesilkapp", token, { httpOnly: true, maxAge: 86400000 });
        res.redirect("/welcome");
    } catch (error) {
        console.error(error);
        res.render("signup", { errors: ["Signup failed. Please try again."] });
    }
});

/// Login route
app.get("/login", (req, res) => res.render("login", { errors: [] }));

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const errors = [];

    // Validate input
    if (!username || !password) {
        errors.push("Username and password are required.");
        return res.render("login", { errors });
    }

    try {
        // Fetch user from the database
        const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

        // Check if user exists and password matches
        if (!user || !(await bcrypt.compare(password, user.password))) {
            errors.push("Invalid username or password.");
            return res.render("login", { errors });
        }

      
        

        // Set cookie with the token
        res.cookie("sagesilkapp", token, { httpOnly: true, maxAge: 86400000 }); // Cookie expires in 1 day
        res.redirect("/welcome");
    } catch (error) {
        console.error("Login error:", error);
        errors.push("An error occurred during login.");
        res.render("login", { errors });
    }
});

// Welcome route
app.get("/welcome", (req, res) => {
    if (!req.user) {
        return res.redirect("/login");
    }

    res.render("welcome", { username: req.user.username });
});

// Product routes for categories
app.get("/products", (req, res) => {
    try {
        res.render("products", { user: req.user });
    } catch (error) {
        console.error("Error rendering products:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Category routes
app.get("/men", (req, res) => {
    const products = db.prepare(`
        SELECT p.*, s.name AS subcategory_name, c.name AS category_name
        FROM products p
        JOIN subcategories s ON p.subcategory_id = s.id
        JOIN categories c ON s.category_id = c.id
        WHERE c.name = 'Men'
    `).all();
    res.render("men", { user: req.user, products });
});

// Women Routes

app.get("/women", (req, res) => {
    const products = db.prepare(`
        SELECT p.*, s.name AS subcategory_name, c.name AS category_name
        FROM products p
        JOIN subcategories s ON p.subcategory_id = s.id
        JOIN categories c ON s.category_id = c.id
        WHERE c.name = 'Women'
    `).all();
    res.render("women", { user: req.user, products });
});

app.get('/women/dresses-and-gowns', (req, res) => {
    res.render('women/dresses-and-gowns');
});
app.get('/women/dinner-gowns', (req, res) => {
    res.render('women/dinner-gowns');
});
app.get('/women/blouses-tops', (req, res) => {
    res.render('women/blouses-tops');
});

app.get('women/accessories', (req, res) => {
    res.render('women/accesories');
});
app.get('/women/footwears', (req, res) => {
    res.render('women/footwears'); 
});
app.get('/women/wigs', (req, res) => {
    res.render('women/wigs');
});
app.get('/women/jumpsuits', (req, res) => {
    res.render('women/jumpsuits');
});
app.get('/women/two-pieces', (req, res) => {
    res.render('women/two-pieces');
});

app.get('/women/skirts-pants', (req, res) => {
    res.render('women/skirts-pants');
});
app.get('/women/jeans', (req, res) => {
    res.render('women/jeans'); 
});
app.get('/women/african-prints', (req, res) => {
    res.render('women/african-prints');
});
app.get('/women/bags', (req, res) => {
    res.render('women/bags');
});
app.get('/women/makeup', (req, res) => {
    res.render('women/makeup');
});

app.get('/women/Jackets', (req, res) => {
    res.render('women/Jackets');
});
app.get('/women/skin-care', (req, res) => {
    res.render('women/skin-care'); 
});



app.get("/kids", (req, res) => {
    const products = db.prepare(`
        SELECT p.*, s.name AS subcategory_name, c.name AS category_name
        FROM products p
        JOIN subcategories s ON p.subcategory_id = s.id
        JOIN categories c ON s.category_id = c.id
        WHERE c.name = 'Kids'
    `).all();
    res.render("kids", { user: req.user, products });
});

app.get("/accessories", (req, res) => {
    const products = db.prepare(`
        SELECT p.*, s.name AS subcategory_name, c.name AS category_name
        FROM products p
        JOIN subcategories s ON p.subcategory_id = s.id
        JOIN categories c ON s.category_id = c.id
        WHERE c.name = 'Accessories'
    `).all();
    res.render("accessories", { user: req.user, products });
});

// Cart Route
app.get('/mycart', (req, res) => {
    const cart = req.session.cart || [];
    const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
    const tax = subtotal * 0.08;  // Example tax rate of 8%
    const total = subtotal + tax;
    res.render('mycart', { cartItems: cart, subtotal, tax, total });
});
app.post('/add-to-cart', (req, res) => {
    const { productId, quantity } = req.body;
    const product = getProductById(productId);  // Replace with your logic to fetch product details

    if (!req.session.cart) {
        req.session.cart = [];
    }

    // Add the product to the cart or update the quantity if already in the cart
    const existingItem = req.session.cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += quantity;  // Update quantity
    } else {
        req.session.cart.push({ ...product, quantity });
    }

    res.redirect('/cart');
});

app.post('/api/products', (req, res) => {
    const { name, description, price, stock, subcategory_id, images } = req.body;

    try {
        // Insert product into the products table
        const insertProduct = db.prepare(`
            INSERT INTO products (name, description, price, stock, subcategory_id)
            VALUES (?, ?, ?, ?, ?)
        `);
        const result = insertProduct.run(name, description, price, stock, subcategory_id);
        const productId = result.lastInsertRowid;

        // Insert images into the product_images table
        if (images && images.length) {
            const insertImage = db.prepare(`
                INSERT INTO product_images (product_id, image_url)
                VALUES (?, ?)
            `);
            images.forEach(image => insertImage.run(productId, image));
        }

        res.status(201).json({ message: 'Product added successfully', productId });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: 'Failed to add product' });
    }
});

app.get('/api/products', (req, res) => {
    try {
        const query = `
            SELECT 
                p.id, 
                p.name, 
                p.description, 
                p.price, 
                p.stock, 
                s.name AS subcategory_name, 
                c.name AS category_name, 
                GROUP_CONCAT(i.image_url) AS images
            FROM products p
            INNER JOIN subcategories s ON p.subcategory_id = s.id
            INNER JOIN categories c ON s.category_id = c.id
            LEFT JOIN product_images i ON p.id = i.product_id
            GROUP BY p.id
        `;
        const products = db.prepare(query).all();

        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Route for viewing the wishlist
app.get('/wishlist', (req, res) => {
    res.render('wishlist'); 
});
app.get('/wishlist/:id', (req, res) => {
    const productId = req.params.id;
    res.render('wishlist', { productId }); 
});

// Route for viewing the cart
app.get('/mycart/:id', (req, res) => {
    const productId = req.params.id;

    res.render('mycart', { productId }); 
    
});

// Checkout Route
app.get('/checkout', (req, res) => {
    const cartItems = req.session.cart || []; 

    res.render('checkout', { cartItems });
});


// Order Tracking Route (GET for tracking)
app.get('/tracking.ejs', (req, res) => {
    const { trackingId } = req.query;

    // Mock tracking info (replace with real data if needed)
    const trackingInfo = trackingId === '12345' ? {
        id: '12345',
        status: 'Shipped',
        estimatedDelivery: '2024-11-25',
        carrier: 'FedEx',
        shippingAddress: '123 Silk Rd, Fashion City, FL'
    } : null;

    res.render('tracking-id', { trackingInfo });
});

// Contact Us Route
app.get('/contact', (req, res) => {
    res.render('contact');  // Render contact page (create 'contact.ejs' file)
});

app.get('/product-accordion', (req, res) => {
    res.render('product-accordion'); 
});
app.get('/product-layout', (req, res) => {
    res.render('product-layout'); 
});
// Logout route
app.get("/logout", (req, res) => {
    res.clearCookie("sagesilkapp");
    res.redirect("/login");
});

// Start the server
app.listen(3000, () => console.log(`Server running on http://localhost:3000`));
