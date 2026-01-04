// To build and deploy: npm run deploy

import { useState } from "react";
import { Document, Packer, Paragraph, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, VerticalAlign } from "docx";
import libheif from "libheif-js";
import './App.css'

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  // Convert HEIC files to a Blob using libheif-js (better codec support than heic2any)
  const convertHeicToBlob = async (file) => {
    console.log('Converting HEIC to JPEG using libheif-js...');
    const buffer = await file.arrayBuffer();
    const decoder = new libheif.HeifDecoder();
    const images = decoder.decode(new Uint8Array(buffer));
    
    if (!images || images.length === 0) {
      throw new Error('Failed to decode HEIC image');
    }
    
    const image = images[0];
    const width = image.get_width();
    const height = image.get_height();
    
    // Create canvas and get image data
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    
    // Decode image data (returns a Promise-like object)
    await new Promise((resolve, reject) => {
      image.display(imageData, (displayData) => {
        if (!displayData) {
          reject(new Error('Failed to decode HEIC image data'));
          return;
        }
        resolve(displayData);
      });
    });
    
    // Put the decoded data onto canvas
    ctx.putImageData(imageData, 0, 0);
    
    // Convert to blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        console.log('HEIC conversion successful');
        resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  };

  // Check if file is HEIC and convert if needed
  const convertHeicIfNeeded = async (file) => {
    const isHeic = file.type === 'image/heic' || 
                   file.type === 'image/heif' || 
                   file.name.toLowerCase().endsWith('.heic') ||
                   file.name.toLowerCase().endsWith('.heif');
    if (isHeic) {
      try {
        return await convertHeicToBlob(file);
      } catch (error) {
        console.warn('HEIC conversion failed:', error.message);
        // Fall through to return original file - might work on Safari/macOS
        return file;
      }
    }
    return file;
  };

  // Load image, normalize orientation, and compress
  // - Fixes EXIF rotation issues (photos appearing rotated on some devices)
  // - Scales down large images to reduce file size
  // - Uses JPEG compression for smaller output
  const loadAndNormalizeImage = async (file, targetWidth, targetHeight) => {
    // Convert HEIC to JPEG first if needed
    const processedFile = await convertHeicIfNeeded(file);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error(`Failed to load image: ${file.name}. HEIC files may not be supported in this browser.`));
      };
      img.onload = () => {
        // Scale down to max 800px on longest side (reduces file size significantly)
        const maxDimension = 800;
        const quality = 0.7; // JPEG quality (0.7 = good balance of size vs quality)
        
        let width = img.width;
        let height = img.height;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height / width) * maxDimension);
            width = maxDimension;
          } else {
            width = Math.round((width / height) * maxDimension);
            height = maxDimension;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          blob.arrayBuffer().then((buffer) => {
            resolve({
              data: new Uint8Array(buffer),
              type: 'jpg',
              width: targetWidth,
              height: targetHeight,
            });
          });
        }, 'image/jpeg', quality);
        
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(processedFile);
    });
  };

  const handleGenerate = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setIsLoading(true);
    setProgress({ current: 0, total: files.length });
    
    try {
      console.log('Files selected:', files.length, files.map(f => f.name));
      
      // pixels = cm ÷ 2.54 × 72
      const imageWidth = 128;  // 4.5cm ÷ 2.54 × 72 = 128 pixels
      const imageHeight = 170; // 6cm ÷ 2.54 × 72 = 170 pixels

      // Process files one at a time to track progress
      const imageData = [];
      for (let i = 0; i < files.length; i++) {
        const result = await loadAndNormalizeImage(files[i], imageWidth, imageHeight);
        imageData.push(result);
        setProgress({ current: i + 1, total: files.length });
      }

    // Group images into rows of 3
    const rows = [];
    for (let i = 0; i < imageData.length; i += 3) {
      const rowImages = imageData.slice(i, i + 3);
      
      const cells = rowImages.map((img) => 
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: img.data,
                  type: img.type,
                  transformation: { width: img.width, height: img.height },
                }),
              ],
            }),
          ],
        })
      );

      // Add empty cells if row has fewer than 3 images
      while (cells.length < 3) {
        cells.push(new TableCell({ children: [new Paragraph({})] }));
      }

      rows.push(new TableRow({ children: cells }));
    }

    const table = new Table({
      rows: rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    });

    const doc = new Document({
      sections: [{ children: [table] }],
    });

    const blob = await Packer.toBlob(doc);
    download(blob, "images.docx");
    } catch (error) {
      console.error('Error generating document:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  };
  
  const download = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <h1>Images to Docx</h1>
      <div className="card">
        {isLoading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Processing {progress.current} of {progress.total} images...</p>
          </div>
        ) : (
          <input
            type="file"
            multiple
            accept="image/*,.heic,.heif"
            onChange={handleGenerate}
          />
        )}
      </div>
    </>
  );
}

export default App
