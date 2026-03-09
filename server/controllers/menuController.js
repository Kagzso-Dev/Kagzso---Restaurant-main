const MenuItem = require('../models/MenuItem');

// @desc    Get menu items
// @route   GET /api/menu
// @access  Private
// Admin receives ALL items (including unavailable) for management.
// All other roles receive only available items for ordering.
const getMenuItems = async (req, res) => {
    try {
        const items = req.role === 'admin'
            ? await MenuItem.findAll()
            : await MenuItem.findAvailable();
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create menu item
// @route   POST /api/menu
// @access  Private (Admin)
const createMenuItem = async (req, res) => {
    const { name, description, price, category, image, isVeg } = req.body;
    try {
        const item = await MenuItem.create({ name, description, price, category, image, isVeg });
        res.status(201).json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update menu item
// @route   PUT /api/menu/:id
// @access  Private (Admin)
const updateMenuItem = async (req, res) => {
    try {
        const item = await MenuItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }
        const updated = await MenuItem.updateById(req.params.id, req.body);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete menu item
// @route   DELETE /api/menu/:id
// @access  Private (Admin)
const deleteMenuItem = async (req, res) => {
    try {
        const item = await MenuItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }
        await MenuItem.deleteById(req.params.id);
        res.json({ message: 'Item removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem };
