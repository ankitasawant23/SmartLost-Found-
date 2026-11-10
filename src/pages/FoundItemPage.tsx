import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Camera, MapPin, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const CLOUDINARY_CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const CLOUDINARY_UPLOAD_PRESET =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

type FoundItemFormData = {
  title: string;
  description: string;
  location: string;
};

const schema: yup.ObjectSchema<FoundItemFormData> = yup.object({
  title: yup.string().trim().required('Item title is required'),
  description: yup.string().trim().required('Description is required'),
  location: yup.string().trim().required('Found location is required'),
});

async function uploadImageToCloudinary(file: File): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error(
      'Cloudinary settings are missing. Check your .env file and restart npm run dev.'
    );
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Choose a JPG, PNG, or WEBP image.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be 5 MB or smaller.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'lost-found-items');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );
  const result = await response.json();

  if (!response.ok) {
    console.error('Cloudinary upload error:', result);
    throw new Error(result?.error?.message || 'Image upload failed.');
  }

  if (typeof result.secure_url !== 'string') {
    throw new Error('Cloudinary did not return an image URL.');
  }

  return result.secure_url;
}

const FoundItemPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FoundItemFormData>({
    resolver: yupResolver(schema),
    defaultValues: { title: '', description: '', location: '' },
  });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const onSubmit = async (data: FoundItemFormData) => {
    if (!user) {
      toast.error('Please log in before reporting a found item.');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = '';
      if (selectedFile) {
        imageUrl = await uploadImageToCloudinary(selectedFile);
      }

      await addDoc(collection(db, 'items'), {
        userId: user.uid,
        userEmail: user.email ?? '',
        type: 'found',
        title: data.title.trim(),
        description: data.description.trim(),
        location: data.location.trim(),
        imageUrl,
        imageLabels: [],
        status: 'unclaimed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isApproved: false,
      });

      toast.success('Found item reported successfully!');
      reset();
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error submitting found item:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to report found item.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const clearSelectedImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-full bg-green-100 p-3">
            <CheckCircle2 className="h-7 w-7 text-green-700" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Report Found Item</h1>
        </div>
        <p className="text-gray-600">
          Help return a lost item to its owner by sharing its details.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Item Photo (Optional)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors">
            {previewUrl ? (
              <div className="relative inline-block">
                <img
                  src={previewUrl}
                  alt="Found item preview"
                  className="mx-auto max-h-64 rounded-lg"
                />
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  aria-label="Remove selected image"
                  className="absolute -right-3 -top-3 bg-red-600 text-white rounded-full w-8 h-8"
                >
                  ×
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center">
                <Camera className="h-12 w-12 text-gray-400" />
                <span className="mt-3 text-sm font-medium text-gray-900">
                  Choose a photo
                </span>
                <span className="mt-1 text-xs text-gray-500">
                  JPG, PNG, or WEBP · Maximum 5 MB
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handleFileSelect}
                />
              </label>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Item Title
          </label>
          <input
            id="title"
            {...register('title')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="e.g., Black wallet"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            {...register('description')}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Describe the item, its colour, brand, and any identifying details."
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
            Where Did You Find It?
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              id="location"
              {...register('location')}
              className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., College library, near the entrance"
            />
          </div>
          {errors.location && (
            <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Report Found Item'}
        </button>
      </form>
    </div>
  );
};

export default FoundItemPage;
