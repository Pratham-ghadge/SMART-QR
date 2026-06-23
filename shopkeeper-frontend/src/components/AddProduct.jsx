import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { LuPackagePlus } from 'react-icons/lu';

const AddProduct = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const uploadToCloudinary = async () => {
    if (!imageFile) return null;

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'smartqr';

    if (!cloudName || cloudName === 'YOUR_CLOUD_NAME_HERE') {
      alert("Please add your Cloudinary Cloud Name to the frontend .env file!");
      return null;
    }

    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('upload_preset', uploadPreset);

    try {
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        formData
      );
      return response.data.secure_url;
    } catch (error) {
      console.error('Image upload failed:', error);
      alert('Failed to upload image to Cloudinary');
      throw error;
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    setIsUploading(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadToCloudinary();
      }

      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/products`,
        { 
          name, 
          description, 
          price: parseFloat(price), 
          category, 
          stock: parseInt(stock),
          imageUrl
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate('/dashboard');
    } catch (err) {
      alert('Failed to add product');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="form-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <LuPackagePlus /> Add New Product
          </h1>
          <p className="page-desc">Add a product to your store inventory</p>
        </div>
      </div>

      <div className="card form-card">
        <form onSubmit={handleAdd}>
          <div className="form-group">
            <label className="form-label">Product Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="form-input"
              style={{ paddingTop: '10px' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Product Name</label>
            <input
              type="text"
              placeholder="e.g., Organic Coffee"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <input
              type="text"
              placeholder="Brief description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Price (₹)</label>
              <input
                type="number"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Stock Quantity</label>
              <input
                type="number"
                placeholder="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="form-input"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <input
              type="text"
              placeholder="e.g., Beverages"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => navigate('/dashboard')} className="btn btn-ghost" disabled={isUploading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isUploading}>
               {isUploading ? 'Uploading...' : <><LuPackagePlus /> Add Product</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProduct;