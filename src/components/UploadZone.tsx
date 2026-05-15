import React, { useCallback, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '../lib/utils';

interface UploadZoneProps {
  onUpload: (files: File[]) => void;
  maxFiles?: number;
  currentCount?: number;
}

export function UploadZone({ onUpload, maxFiles = 6, currentCount = 0 }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      if (currentCount >= maxFiles) return;

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      );
      
      const allowedCount = maxFiles - currentCount;
      onUpload(files.slice(0, allowedCount));
    },
    [onUpload, currentCount, maxFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (currentCount >= maxFiles) return;
      
      if (e.target.files) {
        const files = Array.from(e.target.files).filter((file) =>
          file.type.startsWith('image/')
        );
        const allowedCount = maxFiles - currentCount;
        onUpload(files.slice(0, allowedCount));
      }
      // Reset input so the same file can be selected again if needed
      e.target.value = '';
    },
    [onUpload, currentCount, maxFiles]
  );

  const isFull = currentCount >= maxFiles;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center transition-all duration-300 text-center',
        isDragging ? 'border-pink-400 bg-pink-50 scale-105 shadow-lg' : 'border-pink-200 bg-white hover:bg-pink-50/50 hover:border-pink-300',
        isFull && 'opacity-60 cursor-not-allowed border-gray-200 bg-gray-50 hover:bg-gray-50 hover:border-gray-200 hover:scale-100 shadow-none'
      )}
    >
      <UploadCloud className={cn('w-12 h-12 mb-4 transition-colors', isDragging ? 'text-pink-500' : 'text-pink-300')} />
      <p className="text-base font-semibold text-gray-700 mb-1">
        {isFull ? `ครบจำนวนสูงสุดแล้ว (${maxFiles} รูป)` : 'ลากรูปภาพมาวางที่นี่เลย! ✨'}
      </p>
      <p className="text-sm text-gray-500 mb-5">
        หรือคลิกเพื่อเลือกไฟล์ (สูงสุด {maxFiles} รูป)
      </p>
      <label className={cn(
        'px-6 py-2.5 bg-pink-100 text-pink-700 rounded-full text-sm font-bold shadow-sm cursor-pointer hover:bg-pink-200 hover:shadow transition-all active:scale-95',
        isFull && 'pointer-events-none bg-gray-100 text-gray-400'
      )}>
        เลือกไฟล์รูปภาพ 🌸
        <input
          type="file"
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={isFull}
        />
      </label>
    </div>
  );
}
