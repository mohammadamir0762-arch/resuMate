import { useState } from 'react';

function UploadPanel({ fileName, status, progress, onFileSelected }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = (event) => {
    const file = event.target.files?.[0];
    // Clear the input so picking the same file again still fires a change.
    event.target.value = '';
    onFileSelected(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    onFileSelected(event.dataTransfer.files?.[0]);
  };

  return (
    <label
      className={`upload-zone${isDragging ? ' dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input type="file" accept="application/pdf,.pdf" onChange={handleChange} />
      <span className="upload-title">{fileName ? 'Choose another PDF' : 'Choose PDF resume'}</span>
      <span className="upload-copy">{uploadCopy(fileName, status, progress)}</span>
    </label>
  );
}

function uploadCopy(fileName, status, progress) {
  if (status === 'loading') {
    const pages = progress ? ` · page ${progress.page} of ${progress.total}` : '';
    return `Reading ${fileName}${pages}`;
  }
  return fileName || 'Drop a PDF here, or click to browse';
}

export default UploadPanel;
