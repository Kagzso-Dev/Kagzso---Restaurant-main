const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User   = require('../models/User');

const generateToken = ({ userId, role }) =>
    jwt.sign({ userId, role }, process.env.JWT_SECRET, {
        expiresIn: '30d',
        issuer:    'KOT_AUTH',
    });

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Private (Admin)
const registerUser = async (req, res) => {
    try {
        const { username, password, role } = req.body;

        if (await User.usernameExists(username)) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({ username, password, role });

        res.status(201).json({
            _id:      user._id,
            username: user.username,
            role:     user.role,
            token:    generateToken({ userId: user._id, role: user.role }),
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        res.json({
            _id:      user._id,
            username: user.username,
            role:     user.role,
            token:    generateToken({ userId: user._id, role: user.role }),
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.userId, true); // excludePassword = true
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { registerUser, loginUser, getMe };
