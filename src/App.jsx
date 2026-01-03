// To build and deploy: npm run deploy

import { Document, Packer, Paragraph, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, VerticalAlign } from "docx";
import './App.css'

function App() {
  // Load image, normalize orientation, and compress
  // - Fixes EXIF rotation issues (photos appearing rotated on some devices)
  // - Scales down large images to reduce file size
  // - Uses JPEG compression for smaller output
  const loadAndNormalizeImage = (file, targetWidth, targetHeight) => {
    return new Promise((resolve) => {
      const img = new Image();
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
      img.src = URL.createObjectURL(file);
    });
  };

  const handleGenerate = async (e) => {
    const files = Array.from(e.target.files);
    // pixels = cm ÷ 2.54 × 72
    const imageWidth = 128;  // 4.5cm ÷ 2.54 × 72 = 128 pixels
    const imageHeight = 170; // 6cm ÷ 2.54 × 72 = 170 pixels

    const imageData = await Promise.all(
      files.map((file) => loadAndNormalizeImage(file, imageWidth, imageHeight))
    );

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
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleGenerate}
        />
      </div>
    </>
  );
}

export default App
