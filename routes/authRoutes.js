const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require('../database');

const router = express.Router();

// Signup Route
router.get("/signup", (req, res) => res.render("signup", { errors: [] }));

router.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;
    const errors = [];

    if (!username || !email || !password) errors.push("Please fill in all fields.");

    const existingUser = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (existingUser) errors.push("This username is already taken. Please choose another.");

    const existingEmail = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (existingEmail) errors.push("This email is already registered. Try logging in.");

    if (errors.length) return res.render("signup", { errors });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.prepare("INSERT INTO users(username, email, password) VALUES (?, ?, ?)").run(username, email, hashedPassword);

        // Create JWT Token
        const token = jwt.sign({ username }, process.env.JWTSECRET || "defaultjwtsecret", { expiresIn: "1d" });

        // Set JWT Cookie
        res.cookie("sagesilkapp", token, { httpOnly: true, maxAge: 86400000 });
        
        // Redirect to welcome page
        res.redirect("/welcome");
    } catch (error) {
        console.error(error);
        res.render("signup", { errors: ["Signup failed. Please try again."] });
    }
});

// Login Route
router.get("/login", (req, res) => res.render("login", { errors: [] }));

router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const errors = [];

    if (!username || !password) {
        errors.push("Username and password are required.");
        return res.render("login", { errors });
    }

    try {
        // Retrieve user from database
        const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
        if (!user) {
            errors.push("Invalid username or password.");
            return res.render("login", { errors });
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            errors.push("Invalid username or password.");
            return res.render("login", { errors });
        }

        // Generate JWT Token
        const token = jwt.sign({ username }, process.env.JWTSECRET || "defaultjwtsecret", { expiresIn: "1d" });

        // Set Cookie with the Token
        res.cookie("sagesilkapp", token, { httpOnly: true, maxAge: 86400000 });

        // Redirect to welcome page
        res.redirect("/welcome");
    } catch (error) {
        console.error("Login error:", error);
        errors.push("An error occurred during login.");
        res.render("login", { errors });
    }
});

// Logout Route
router.get("/logout", (req, res) => {
    res.clearCookie("sagesilkapp", { path: "/" });
    res.redirect("/login");
});

module.exports = router;router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const errors = [];

    if (!username || !password) {
        errors.push("Username and password are required.");
        return res.render("login", { errors });
    }

    try {
        // Retrieve user from database
        const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
        console.log("User from DB:", user); // Debugging

        if (!user) {
            errors.push("Invalid username or password.");
            return res.render("login", { errors });
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log("Password valid:", isPasswordValid); // Debugging

        if (!isPasswordValid) {
            errors.push("Invalid username or password.");
            return res.render("login", { errors });
        }

        // Generate JWT Token
        const token = jwt.sign({ username }, process.env.JWTSECRET || "defaultjwtsecret", { expiresIn: "1d" });

        // Set Cookie with the Token
        res.cookie("sagesilkapp", token, { httpOnly: true, maxAge: 86400000 });
        console.log("Cookie set:", token); // Debugging

        // Redirect to welcome page
        res.redirect("/welcome");
    } catch (error) {
        console.error("Login error:", error);
        errors.push("An error occurred during login.");
        res.render("login", { errors });
    }
});