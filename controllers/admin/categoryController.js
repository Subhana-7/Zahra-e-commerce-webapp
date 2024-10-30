const Category = require("../../models/categorySchema");
const product = require("../../models/productSchema");


const  categoryInfo = async(req,res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page-1)*limit;

    const categoryData = await Category.find({})
    .sort({createdAt:1})
    .skip(skip)
    .limit(limit);

    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories/limit);
    res.render("category-page",{
      cat:categoryData,
      currentPage:page,
      totalPages:totalPages,
      totalCategories:totalCategories
    })
  } catch (error) {
    console.error(error);
    res.redirect("/pageError");
  }
}


const addCategory = async(req,res) => {
  const {name,description} = req.body;
  try {
    const existingCategory = await Category.findOne({name});
    if(existingCategory) {
      return res.status(400).json({error:"Category Already Exists"})
    }
    const newCategory = new Category({
      name,
      description,
    })
    await newCategory.save();
    return res.json({message:"Category Added Successfully"})
  } catch (error) {
    return res.status(500).json({error:"Internal Server Error"})
  }
}


const addCategoryOffer = async (req, res) => {
  console.log("Request body:", req.body); 
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;

    if (isNaN(percentage) || percentage <= 0) {
      console.log("Invalid percentage:", percentage); // Log invalid percentage
      return res.status(400).json({ status: false, message: "Invalid offer percentage" });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      console.log("Category not found:", categoryId); // Log if category is not found
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    const products = await Product.find({ category: category._id });
    if (products.length === 0) {
      console.log("No products found for category:", category._id); // Log if no products found
    }

    const hasHigherProductOffer = products.some(product => product.productOffer > percentage);
    if (hasHigherProductOffer) {
      console.log("Product has higher offer than category:", category._id); // Log conflict
      return res.status(400).json({
        status: false,
        message: "A product in this category has a higher offer than the category offer"
      });
    }

    // Update the category offer
    await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });

    // Log category update
    console.log("Category offer updated:", { categoryId, percentage });

    // Reset product offers
    for (const product of products) {
      product.productOffer = 0;
      product.salePrice = product.regularPrice;
      await product.save();
      console.log("Product updated:", product._id); // Log each product update
    }

    res.json({ status: true, message: "Offer added successfully" });

  } catch (error) {
    console.error("Error in addCategoryOffer:", error); // Log server error
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};


const removeCategoryOffer = async(req,res) => {
  try {
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId);

    if(!category) {
      return res.status(404).json({status:false,message:"Category not found"});
    }

    const percentage = category.categoryOffer;
    const products = await Product.find({category:category._id});

    if(products.length > 0) {
      for(const product of products) {
        product.salePrice += Math.floor(product.regularPrice * (percentage/100));
        product.productOffer = 0;
        await product.save();
      }
    }
    category.categoryOffer = 0;
    await category.save();
    res.json({status:true});
  } catch (error) {
    res.status(500).json({status:false,message:"Internal Server Error"})
  }
}


const getListCategory = async (req, res) => {
  try {
    let id = req.query.id;

    // Set `isListed` to `true` to mark the category as listed
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    
    res.redirect("/admin/category");
  } catch (error) {
    console.error("Error listing category:", error); // Log the error
    res.redirect("/pageNotFound");
  }
}

const getUnlistCategory = async (req, res) => {
  try {
    let id = req.query.id;
    // Set `isListed` to `false` to mark the category as unlisted
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    
    res.redirect("/admin/category");
  } catch (error) {
    console.error("Error unlisting category:", error); // Log the error
    res.redirect("/pageNotFound");
  }
}


const getEditCategory = async(req,res) => {
  try {
  let id = req.query.id;
  const category = await Category.findOne({_id:id});
  res.render("edit-category",{category:category});

  }catch(error) {
    res.redirect("/pageNotFound");
  }
}


const editCategory = async(req,res) => {
  try {
    const id = req.params.id;
    const {categoryName,description} = req.body;
    const existingCategory = await Category.findOne({name:categoryName});

    /*if(existingCategory) {
      return res.status(400).json({error:"Category exists,Please choose another name"})
    }*/

    const updateCategory = await Category.findByIdAndUpdate(id,{
      name:categoryName,
      description:description,
   },{new:true});

   if(updateCategory) {
    res.redirect("/admin/category");
   }else {
    res.status(404).json({error:"Category not found"})
   }

  } catch (error) {
    res.status(500).json({error:"Internal Server error"});
  }
}

const deleteCategory = async(req,res) => {
  try {
    const id = req.query.id;
    const findCategory = await Category.findOne({_id:id});
    await findCategory.deleteOne({_id:id});
    res.redirect("/admin/category");
  } catch (error) {
    res.redirect("pageNotFound");
  }
}

module.exports = {
  categoryInfo,
  addCategory,
  addCategoryOffer,
  removeCategoryOffer,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory,
  deleteCategory
}