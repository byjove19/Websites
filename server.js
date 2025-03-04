require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const jwt = require("jsonwebtoken");  
const db = require("./database");
const http = require("http");
const socketIo = require("socket.io");
const { usersDb } = require("./database");
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); 
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(
    session({
        secret: process.env.SESSION_SECRET || "defaultsecret",
        resave: false,
        saveUninitialized: true,
    })
);

// ✅ JWT Authentication Middleware
app.use((req, res, next) => {
    const token = req.cookies.sagesilkapp;
    if (token) {
        try {
            req.user = jwt.verify(token, process.env.JWTSECRET || "defaultjwtsecret");
        } catch (error) {
            console.error("JWT Verification Failed:", error);
            res.clearCookie("sagesilkapp");
            req.user = null;
        }
    } else {
        req.user = null;
    }
    res.locals.user = req.user; 
    next();
});

app.use(authRoutes);




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



// Routes

app.use("/", authRoutes);
app.use("/products", productRoutes);
app.use("/cart", cartRoutes);
app.use('/products', productRoutes);
app.use('/admin', adminRoutes);
app.get("/", (req, res) => res.render("index", { user: req.user }));

// Welcome route
app.get("/welcome", (req, res) => {
    res.render("welcome", { username: req.user.username });
});

//About Us Route
app.get('/about', (req, res) => {
    res.render('about'); 
});

// Category routes
app.get("/men", (req, res) => {
    
    res.render("men");
});

// Women Routes

app.get("/women", (req, res) => {
    
    res.render("women");
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
    res.render("kids");
});

app.get("/accessories", (req, res) => {
    res.render("accessories");
});
app.get("/makeup", (req, res) => {
    res.render("makeup");
});

app.get('/product/women-footwear:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).send("Product not found");
        }
        res.render('product-details', { product });
    } catch (error) {
        res.status(500).send("Server Error");
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

// Start the server
app.listen(3000, () => console.log(`Server running on http://localhost:3000`));
