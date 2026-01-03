// To build and deploy: npm run deploy

import { Document, Packer, Paragraph, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, VerticalAlign } from "docx";
import './App.css'

function App() {
  const getImageType = (mimeType) => {
    const types = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/bmp': 'bmp',
    };
    return types[mimeType] || 'png';
  };

  const handleGenerate = async (e) => {
    const files = Array.from(e.target.files);
    const imageWidth = 120;
    const imageHeight = 120;

    const imageData = await Promise.all(
      files.map(async (file) => {
        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        const type = getImageType(file.type);
        
        return { data: uint8Array, type, width: imageWidth, height: imageHeight };
      })
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
