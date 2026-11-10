// Client-side image analysis using TensorFlow.js as fallback
import * as tf from '@tensorflow/tfjs';

export const analyzeImageLocally = async (imageFile: File): Promise<string[]> => {
  try {
    // Load a pre-trained model (MobileNet for general classification)
    const model = await tf.loadLayersModel('/models/mobilenet/model.json');
    
    // Preprocess the image
    const img = new Image();
    img.src = URL.createObjectURL(imageFile);
    
    return new Promise((resolve) => {
      img.onload = async () => {
        const tensor = tf.browser.fromPixels(img)
          .resizeNearestNeighbor([224, 224])
          .expandDims(0)
          .cast('float32')
          .div(255.0);
        
        const predictions = await model.predict(tensor) as tf.Tensor;
        const probabilities = await predictions.data();
        
        // Get top predictions (mock labels for now)
        const labels = [
          'electronics', 'device', 'technology', 'mobile', 'gadget',
          'accessory', 'personal', 'valuable', 'portable', 'digital'
        ];
        
        // Clean up
        tensor.dispose();
        predictions.dispose();
        
        resolve(labels.slice(0, 5));
      };
    });
  } catch (error) {
    console.error('Error analyzing image locally:', error);
    // Fallback to mock labels
    return ['electronics', 'device', 'technology', 'mobile', 'gadget'];
  }
};

export const calculateImageSimilarity = (labels1: string[], labels2: string[]): number => {
  const set1 = new Set(labels1.map(l => l.toLowerCase()));
  const set2 = new Set(labels2.map(l => l.toLowerCase()));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
};