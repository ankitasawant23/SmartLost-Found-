import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Camera, MapPin, Tag, Sparkles, Search, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Item } from '../types';
import ItemCard from '../components/ItemCard';


const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;

/**
 * Uploads an image directly from the browser to Cloudinary using an unsigned preset.
 * Never put the Cloudinary API Secret in frontend code.
 */
async function uploadImageToCloudinary(file: File): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary configuration is missing. Check your .env file and restart the dev server.');
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Please select a JPG, PNG, or WEBP image.');
  }

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('Image size must be 5 MB or less.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'lost-found-items');

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const response = await fetch(endpoint, { method: 'POST', body: formData });
  const result = await response.json();

  if (!response.ok) {
    console.error('Cloudinary upload error:', result);
    throw new Error(result?.error?.message || 'Cloudinary image upload failed.');
  }

  if (typeof result.secure_url !== 'string') {
    throw new Error('Cloudinary did not return an image URL.');
  }

  return result.secure_url;
}

const schema = yup.object().shape({
  title: yup.string().required('Title is required'),
  description: yup.string().required('Description is required'),
  location: yup.string().required('Location is required'),
});

const LostItemPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiLabels, setAiLabels] = useState<string[]>([]);
  const [potentialMatches, setPotentialMatches] = useState<Item[]>([]);
  const [showMatches, setShowMatches] = useState(false);
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm({
    resolver: yupResolver(schema),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Analyze image with AI
      analyzeImage(file);
    }
  };

  const analyzeImage = async (file: File) => {
    setAnalyzing(true);
    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Mock AI analysis - In production, use Google Vision API or TensorFlow.js
      const mockLabels = ['electronics', 'device', 'phone', 'technology', 'mobile'];
      setAiLabels(mockLabels);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('Image analyzed successfully!');
      
      // Find potential matches
      await findPotentialMatches(mockLabels);
    } catch (error) {
      console.error('Error analyzing image:', error);
      toast.error('Failed to analyze image');
    } finally {
      setAnalyzing(false);
    }
  };

  const findPotentialMatches = async (labels: string[]) => {
    try {
      const foundItemsQuery = query(
        collection(db, 'items'),
        where('type', '==', 'found'),
        where('status', '==', 'unclaimed')
      );
      
      const snapshot = await getDocs(foundItemsQuery);
      const foundItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as Item[];

      // Simple matching algorithm - in production, use ML similarity
      const matches = foundItems.filter(item => {
        const commonLabels = item.imageLabels.filter(label => 
          labels.some(l => l.toLowerCase().includes(label.toLowerCase()))
        );
        return commonLabels.length > 0;
      }).map(item => ({
        ...item,
        matchScore: Math.floor(Math.random() * 30) + 70, // Mock score 70-100%
      }));

      setPotentialMatches(matches);
      
      if (matches.length > 0) {
        setShowMatches(true);
        toast.success(`Found ${matches.length} potential matches!`);
      }
    } catch (error) {
      console.error('Error finding matches:', error);
    }
  };

  const onSubmit = async (data: any) => {
    if (!user) return;

    setUploading(true);
    try {
      let imageUrl = '';
      
      // Upload image if selected
      if (selectedFile) {
        imageUrl = await uploadImageToCloudinary(selectedFile);
      }

      // Save item to Firestore
      await addDoc(collection(db, 'items'), {
        userId: user.uid,
        userEmail: user.email,
        type: 'lost',
        title: data.title,
        description: data.description,
        location: data.location,
        imageUrl,
        imageLabels: aiLabels,
        status: 'unclaimed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isApproved: false,
      });

      toast.success('Lost item reported successfully!');
      reset();
      setSelectedFile(null);
      setPreviewUrl(null);
      setAiLabels([]);
      setPotentialMatches([]);
      setShowMatches(false);
    } catch (error) {
      console.error('Error submitting lost item:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to submit lost item';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Report Lost Item
        </h1>
        <p className="text-gray-600">
          Report your lost item and we'll help you find it
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Photo (Optional)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                {previewUrl ? (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="mx-auto max-h-64 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setAiLabels([]);
                        setPotentialMatches([]);
                        setShowMatches(false);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div>
                    <Camera className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <label className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          Upload a photo
                        </span>
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleFileSelect}
                        />
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      JPG, PNG, WEBP up to 5MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* AI Analysis Results */}
            {analyzing && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <Sparkles className="w-5 h-5 text-blue-600 animate-spin" />
                  <span className="ml-2 text-sm font-medium text-blue-800">
                    Analyzing image and finding matches...
                  </span>
                </div>
              </div>
            )}

            {aiLabels.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Sparkles className="w-5 h-5 text-green-600" />
                  <span className="ml-2 text-sm font-medium text-green-800">
                    AI Analysis Complete
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {aiLabels.map((label, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Item Title
              </label>
              <input
                {...register('title')}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Black iPhone 13 Pro"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe the item in detail, including color, brand, condition, etc."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                Location Lost
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  {...register('location')}
                  type="text"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Library 2nd floor, near the entrance"
                />
              </div>
              {errors.location && (
                <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={uploading}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </div>
                ) : (
                  'Report Lost Item'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setAiLabels([]);
                  setPotentialMatches([]);
                  setShowMatches(false);
                }}
                className="px-6 py-2 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Potential Matches */}
        <div>
          {showMatches && potentialMatches.length > 0 && (
            <div>
              <div className="flex items-center mb-4">
                <Search className="w-5 h-5 text-blue-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Potential Matches ({potentialMatches.length})
                </h2>
              </div>
              <div className="space-y-4">
                {potentialMatches.map((item) => (
                  <ItemCard key={item.id} item={item} showClaimButton={true} />
                ))}
              </div>
            </div>
          )}

          {showMatches && potentialMatches.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No matches found
              </h3>
              <p className="text-gray-600">
                Don't worry! We'll notify you if a matching item is found.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LostItemPage;