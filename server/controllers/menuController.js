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
    const { name, description, price, category, image, isVeg, availability } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Item name is required' });
    }
    if (!price || isNaN(Number(price)) || Number(price) < 0) {
        return res.status(400).json({ message: 'Valid price is required' });
    }
    if (!category) {
        return res.status(400).json({ message: 'Category is required' });
    }
    try {
        const item = await MenuItem.create({
            name: name.trim(), description, price, category, image,
            isVeg, availability: availability !== false,
        });
        req.app.get('socketio').to('restaurant_main').emit('menu-updated', { action: 'create', item });
        res.status(201).json(item);
    } catch (error) {
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ message: 'Selected category does not exist' });
        }
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
        req.app.get('socketio').to('restaurant_main').emit('menu-updated', { action: 'update', item: updated });
        res.json(updated);
    } catch (error) {
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ message: 'Selected category does not exist' });
        }
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
        req.app.get('socketio').to('restaurant_main').emit('menu-updated', { action: 'delete', id: req.params.id });
        res.json({ message: 'Item removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem };
