const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();


const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    const address = await Address.find({ userId: user._id });
    //console.log(address);
    return res.render("profile", { user, address });
  } catch (error) {
    return res.render("PageNotFound");
  }
};


const loadEditProfile = async(req, res) => {
  try {
    const user = await User.findById(req.session.user);
    return res.render("edit-profile", { user: user });
  } catch (error) {
    return res.redirect("/pageNotFound");
  }
}


const editProfile = async(req, res) => {
  try {
    const { name, email, phone } = req.body;
    const updateDetails = await User.findByIdAndUpdate(req.session.user,
      {
        name: name,
        email: email,
        phone: phone,
      },{ new: true }
    );

    if (updateDetails) {
      return res.redirect("/profile");
    } else {
      res.status(404).json({ error: "Profile details not found" });
    }
  } catch (error) {
    return res.redirect("/pageNotFound");
  }
}

const loadAddAddress = async(req,res) => {
  try {
    const user = await User.findById(req.session.user);
    return res.render("add-address",{user});
  } catch (error) {
    return res.redirect("/pageNotFound");
  }
}

const addAddress = async (req, res) => {
  const { name, addressType, streetName, landmark, locality, city, state, pin, contactNo } = req.body;
  const user = req.session.user;

  console.log("User ID:", user);
  if (!user) {
    console.error("User not found in session.");
    return res.status(400).send("User session not found.");
  }

  try {
    const newAddress = new Address({
      userId: user,
      name,
      addressType,
      streetName,
      landmark,
      locality,
      city,
      state,
      pin,
      contactNo
    });
    await newAddress.save();
    res.redirect('/profile');
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).send('Server Error');
  }
};







const loadEditAddress = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    const addressId = req.params.id;
    const address = await Address.findById(addressId); 

    if (!address) {
      return res.redirect("/pageNotFound");
    }

    return res.render("edit-address", { user, address });
  } catch (error) {
    console.error("Error loading address for edit:", error);
    return res.redirect("/pageNotFound");
  }
};


const editAddress = async (req, res) => {
  const addressId = req.params.id;  // Address ID to update
  const { name, addressType, streetName, landmark, locality, city, state, pin, contactNo } = req.body;
  const user = req.session.user;

  try {
    if (!user) {
      return res.redirect('/login');
    }

    const address = await Address.findById(addressId);

    if (!address) {
      req.flash('error', 'No address found');
      return res.redirect('/profile');
    }

    // Update address details
    address.name = name;
    address.addressType = addressType;
    address.streetName = streetName;
    address.landmark = landmark;
    address.locality = locality;
    address.city = city;
    address.state = state;
    address.pin = pin;
    address.contactNo = contactNo;

    await address.save();  // Save updated address to DB

    // Redirect to profile after updating
    res.redirect('/profile');
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).send('Server Error');
  }
};



const deleteAddress = async(req,res) => {
  try {
    const addressId = req.params.id;
    const result = await Address.updateOne(
      { "address._id": addressId },
      { $pull: { address: { _id: addressId } } }
  );
  if (result.modifiedCount > 0) {
    return res.status(200).json({ message: "Address deleted successfully." });
} else {
    return res.status(404).json({ error: "Address not found." });
}
  } catch (error) {
    return res.redirect("pageNotFound");
  }
}

const cart = async (req, res) => {
  //console.log("cart");
  try {
    const user = await User.findById(req.session.user);
    const cartItems = await Cart.findOne({ userId: user._id }).populate('items.productId');
    //console.log(cartItems);

    if (!cartItems || !cartItems.items.length) {
      return res.render("cart", { cart: [], message: "Your cart is empty." });
    }

    return res.render("cart", { cart: cartItems.items, message: null });
  } catch (error) {
    console.error("Error fetching cart items:", error);
    return res.redirect("pageNotFound");
  }
};




const addItemToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity } = req.body;
    const parsedQuantity = parseInt(quantity, 10);

    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity provided" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (typeof product.salePrice !== "number") {
      return res.status(500).json({ message: "Product price is invalid" });
    }
  
    if (parsedQuantity > product.stock) {
      return res.status(400).json({ message: `Cannot add more than ${product.stock} of the same product. Only ${product.stock} left in stock.` });
    }

    const totalPrice = product.salePrice * parsedQuantity;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (existingItemIndex > -1) {
      // Check if adding the quantity would exceed 12
      const newQuantity = cart.items[existingItemIndex].quantity + parsedQuantity;
      if (newQuantity > 12) {
        return res.status(400).json({ message: "Cannot add more than 12 of the same product." });
      }
      // Check if the new quantity exceeds available stock
      if (newQuantity > product.stock) {
        return res.status(400).json({ message: `Cannot add more than ${product.stock} of the same product. Only ${product.stock} left in stock.` });
      }

      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].totalPrice = newQuantity * product.salePrice;
    } else {
      if (parsedQuantity > 12) {
        return res.status(400).json({ message: "Cannot add more than 12 of the same product." });
      }
      // Check stock availability for new item
      if (parsedQuantity > product.stock) {
        return res.status(400).json({ message: `Cannot add more than ${product.stock} of the same product. Only ${product.stock} left in stock.` });
      }

      cart.items.push({
        productId,
        quantity: parsedQuantity,
        price: product.salePrice,
        totalPrice,
      });
    }

    await cart.save();
    return res.redirect("/cart");
  } catch (error) {
    console.error("Error adding to cart:", error);
    return res.redirect("/pageNotFound");
  }
};


const updateCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity } = req.body;

    const parsedQuantity = parseInt(quantity, 10);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity provided" });
    }

    let cart = await Cart.findOne({ userId }).populate('items.productId');

    const itemIndex = cart.items.findIndex(item => item.productId._id.toString() === productId);
    if (itemIndex > -1) {
      // Check if updating the quantity exceeds 12
      if (parsedQuantity > 12) {
        return res.status(400).json({ message: "Cannot update to more than 12 of the same product." });
      }

      // Fetch the product again to check stock
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (parsedQuantity > product.quantity) {
        return res.status(400).json({ 
            message: `Cannot update to more than ${product.quantity} of the same product. Only ${product.quantity} left in stock.`,
            availableStock: product.stock 
        });
    }
    

      cart.items[itemIndex].quantity = parsedQuantity;
      cart.items[itemIndex].totalPrice = parsedQuantity * product.salePrice; // Update total price

      await cart.save();

      const cartTotal = cart.items.reduce((total, item) => total + (item.productId.salePrice * item.quantity), 0);
      return res.status(200).json({ message: "Cart updated successfully", cartTotal });
    } else {
      return res.status(404).json({ message: "Item not found in cart" });
    }
  } catch (error) {
    console.error("Error updating cart:", error);
    return res.status(500).json({ message: "An error occurred while updating the cart" });
  }
};



const removeItemFromCart = async (req, res) => {
  try {
    //console.log("removing product")
    const userId = req.session.user;
    const { productId } = req.body;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex > -1) {
      cart.items.splice(itemIndex, 1);
      await cart.save();
      return res.status(200).json({ message: "Item removed from cart" });
    } else {
      return res.status(404).json({ message: "Item not found in cart" });
    }
  } catch (error) {
    console.error("Error removing item from cart:", error);
    return res.status(500).json({ message: "An error occurred while removing the item from the cart" });
  }
};







module.exports = {
  getProfile,
  loadEditProfile,
  editProfile,
  loadAddAddress,
  addAddress,
  loadEditAddress,
  editAddress,
  deleteAddress,
  cart,
  addItemToCart,
  removeItemFromCart,
  updateCart
}