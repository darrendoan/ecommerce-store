import { redis } from "../lib/redis.js";
import Product from "../models/product.model.js";
import cloudinary from "../lib/cloudinary.js";

export const getAllProducts = async (req, res) => {
    try {
        const products= await Product.find({});
        res.json({products});
    } catch (error) {
        console.log("Error in get all products controller", error.message);
        res.status(500).json({ message: "Error getting all products.", error: error.message });
    }
};

export const getFeaturedProducts = async (req, res) => {
    try {
        let featuredProducts = await redis.get("featured_products");

        if (featuredProducts) {
            return res.json({ featuredProducts: JSON.parse(featuredProducts) });
        }

        featuredProducts = await Product.find({ isFeatured: true }).lean();

        if (!featuredProducts) {
           return res.status(404).json({ message: "No featured products found." });
        }

        await redis.set("featured_products", JSON.stringify(featuredProducts), "EX", 60 * 60 * 24);
        res.json({ featuredProducts });
    } catch (error) {
        console.log("Error in get all products controller", error.message);
        res.status(500).json({ message: "Error getting all products.", error: error.message });
    }
};

export const createProduct = async (req, res) => {
    try {
        const { name, description, price, image, catergory } = req.body;

        let cloudinaryResponse = null;

        if(image) { 
            cloudinaryResponse = await cloudinary.uploader.upload(image, {folder:"products"})
        }

        const product = await Product.create({ name, description, price, image: cloudinaryResponse?.secure_url ? cloudinaryResponse?.secure_url : "", catergory });

        res.status(201).json({ product });
    } catch (error) {
        console.log("Error in create product controller", error.message);
        res.status(500).json({ message: "Error creating product.", error: error.message });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }

        if(product.image) {
            const publicId = product.image.split("/").pop().split(".")[0];
            try {
                await cloudinary.uploader.destroy(`products/${publicId}`);
                console.log("Image deleted from cloudinary");
            } catch (error) {
                console.log("Error deleting image from cloudinary", error.message);
            }
        }

        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Product deleted successfully." });
    } catch (error) {
        console.log("Error in delete product controller", error.message);
        res.status(500).json({ message: "Error deleting product.", error: error.message });
    }
};

export const getReccommendedProducts = async (req, res) => {
    try {
        const products = await Products.aggregate([
            { 
                $sample: { size: 3 } 
            }, 
            {
                $project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    price: 1,
                    image: 1,
            }
        }    
        ]);

        res.json({ products });
    } catch (error) {
        console.log("Error in get all products controller", error.message);
        res.status(500).json({ message: "Error getting all products.", error: error.message });
    }
}

export const getProductByCatergory = async (req, res) => {
    const {catergory} = req.params;
    try {
        const products = await Product.find({catergory});
        res.json({ products });
    } catch (error) {
        console.log("Error in get all products controller", error.message);
        res.status(500).json({ message: "Error getting all products.", error: error.message });
    }
}

export const toggleFeaturedProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (product) {
            product.isFeatured = !product.isFeatured;
            const updatedProduct = await product.save();
            await updateFeaturedProductsCache();
            res.json({ updatedProduct });
        } else {
            res.status(404).json({ message: "Product not found." });
        }
    } catch (error) {
        console.log("Error in toggle featured product controller", error.message);
        res.status(500).json({ message: "Error toggling featured product.", error: error.message });
    }
}

async function updateFeaturedProductsCache() {
    try {
        const featuredProducts = await Product.find({ isFeatured: true }).lean();
        await redis.set("featured_products", JSON.stringify(featuredProducts), "EX", 60 * 60 * 24);
    } catch (error) {
        console.log("Error updating featured products cache", error.message);
        res.status(500).json({ message: "Error updating featured products cache.", error: error.message });    
    }
}