const express = require("express");
const db = require('../database');
const router = express.Router();

// Product routes
router.get("/products", (req, res) => {
    try {
        res.render("products", { user: req.user });
    } catch (error) {
        console.error("Error rendering products:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Category routes
router.get("/men", (req, res) => {
    const products = db.prepare(`
        SELECT p.*, s.name AS subcategory_name, c.name AS category_name
        FROM products p
        JOIN subcategories s ON p.subcategory_id = s.id
        JOIN categories c ON s.category_id = c.id
        WHERE c.name = 'Men'
    `).all();
    res.render("men", { user: req.user, products });
});

// Add more product-related routes here...

module.exports = router;