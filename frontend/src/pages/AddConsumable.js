import React, { useState, useEffect } from 'react';
import { categoriesApi, consumablesApi } from '../services/api';

function AddConsumable() {
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    unit: '',
    description: '',
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    async function fetchCategories() {
      const res = await categoriesApi.getAll();
      setCategories(res.data);
    }
    fetchCategories();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const res = await consumablesApi.add(formData);
      if (res.data && res.data.success) {
        setSuccess('Consumable added successfully!');
        setFormData({ name: '', category_id: '', unit: '', description: '' });
      } else {
        setError(res.data.error || 'Failed to add consumable.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="card">
      <h2>Add Consumable</h2>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name *</label>
          <input name="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Category *</label>
          <select name="category_id" value={formData.category_id} onChange={handleChange} required>
            <option value="">Select category...</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Unit *</label>
          <input name="unit" value={formData.unit} onChange={handleChange} required placeholder="e.g. box, litre, each" />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea name="description" value={formData.description} onChange={handleChange} />
        </div>
        <button type="submit" className="btn btn-primary">Add Consumable</button>
      </form>
    </div>
  );
}

export default AddConsumable;
