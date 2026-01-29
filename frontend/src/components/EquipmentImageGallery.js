import React, { useState, useEffect, useRef } from 'react';
import { equipmentImagesApi } from '../services/api';
import { Icons } from './Icons';

function EquipmentImageGallery({ equipmentId, editable = false }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (equipmentId) {
      fetchImages();
    }
  }, [equipmentId]);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await equipmentImagesApi.getByEquipment(equipmentId);
      setImages(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }

      await equipmentImagesApi.uploadMultiple(equipmentId, formData);
      fetchImages();
    } catch (err) {
      setError(err.message || 'Error uploading images');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSetPrimary = async (imageId) => {
    try {
      await equipmentImagesApi.setPrimary(equipmentId, imageId);
      fetchImages();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (imageId) => {
    if (!window.confirm('Delete this image?')) return;
    
    try {
      await equipmentImagesApi.delete(imageId);
      fetchImages();
      if (selectedImage?.id === imageId) {
        setSelectedImage(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateCaption = async (imageId, caption) => {
    try {
      await equipmentImagesApi.update(imageId, { caption });
      fetchImages();
    } catch (err) {
      setError(err.message);
    }
  };

  const primaryImage = images.find(img => img.is_primary) || images[0];

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <div className="spinner" style={{ width: '24px', height: '24px' }}></div>
      </div>
    );
  }

  return (
    <div className="equipment-gallery">
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Main Image Display */}
      <div 
        className="gallery-main"
        style={{
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          overflow: 'hidden',
          aspectRatio: '4/3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem',
          position: 'relative',
          cursor: primaryImage ? 'pointer' : 'default',
        }}
        onClick={() => primaryImage && setSelectedImage(primaryImage)}
      >
        {primaryImage ? (
          <img
            src={`/api${primaryImage.image_path}`}
            alt={primaryImage.caption || 'Equipment'}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
            <div style={{ marginBottom: '0.5rem' }}><Icons.Camera size={48} /></div>
            <div>No images</div>
          </div>
        )}
        
        {primaryImage?.is_primary && (
          <span 
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              background: 'var(--success)',
              color: 'white',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
            }}
          >
            Primary
          </span>
        )}
      </div>

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div 
          className="gallery-thumbnails"
          style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            padding: '0.5rem 0',
            marginBottom: '1rem',
          }}
        >
          {images.map(img => (
            <div
              key={img.id}
              onClick={() => setSelectedImage(img)}
              style={{
                flexShrink: 0,
                width: '60px',
                height: '60px',
                borderRadius: '4px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: img.is_primary ? '2px solid var(--success)' : '2px solid transparent',
              }}
            >
              <img
                src={`/api${img.image_path}`}
                alt={img.caption || 'Thumbnail'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {editable && (
        <div>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ width: '100%' }}
          >
            {uploading ? (
              <>
                <span className="spinner" style={{ width: '16px', height: '16px', marginRight: '0.5rem' }}></span>
                Uploading...
              </>
            ) : (
              '+ Upload Images'
            )}
          </button>
        </div>
      )}

      {/* Image Count */}
      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        {images.length} image{images.length !== 1 ? 's' : ''}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div 
          className="modal-overlay"
          style={{ zIndex: 1000 }}
          onClick={() => setSelectedImage(null)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Lightbox Header */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                {selectedImage.caption && (
                  <div style={{ fontWeight: 500 }}>{selectedImage.caption}</div>
                )}
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Uploaded {new Date(selectedImage.created_at).toLocaleDateString()}
                </div>
              </div>
              <button 
                className="modal-close"
                onClick={() => setSelectedImage(null)}
              >
                ×
              </button>
            </div>

            {/* Lightbox Image */}
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              maxHeight: '70vh',
            }}>
              <img
                src={`/api${selectedImage.image_path}`}
                alt={selectedImage.caption || 'Equipment'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>

            {/* Lightbox Footer - Actions */}
            {editable && (
              <div style={{
                padding: '1rem',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'flex-end',
              }}>
                {!selectedImage.is_primary && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleSetPrimary(selectedImage.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Icons.Star size={14} /> Set as Primary
                  </button>
                )}
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(selectedImage.id)}
                >
                  Delete
                </button>
              </div>
            )}

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => {
                    const currentIndex = images.findIndex(i => i.id === selectedImage.id);
                    const prevIndex = (currentIndex - 1 + images.length) % images.length;
                    setSelectedImage(images[prevIndex]);
                  }}
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    fontSize: '1.5rem',
                  }}
                >
                  ‹
                </button>
                <button
                  onClick={() => {
                    const currentIndex = images.findIndex(i => i.id === selectedImage.id);
                    const nextIndex = (currentIndex + 1) % images.length;
                    setSelectedImage(images[nextIndex]);
                  }}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    fontSize: '1.5rem',
                  }}
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EquipmentImageGallery;
