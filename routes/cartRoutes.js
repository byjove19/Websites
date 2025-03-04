const express = require("express");
const router = express.Router();

// Cart routes
router.get("/mycart", (req, res) => {
    const cart = req.session.cart || [];
    const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
    const tax = subtotal * 0.08;  // Example tax rate of 8%
    const total = subtotal + tax;
    res.render("mycart", { cartItems: cart, subtotal, tax, total });
});

router.post("/add-to-cart", (req, res) => {
    const { productId, quantity } = req.body;
    const product = getProductById(productId);  // Replace with your logic to fetch product details

    if (!req.session.cart) {
        req.session.cart = [];
    }

    const existingItem = req.session.cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        req.session.cart.push({ ...product, quantity });
    }
// Route for viewing the cart
app.get('/mycart/:id', (req, res) => {
    const productId = req.params.id;

    res.render('mycart', { productId }); 
    
});

    res.redirect("/mycart");
});

module.exports = router;