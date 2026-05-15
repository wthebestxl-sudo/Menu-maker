import React, { useRef, useEffect } from 'react';

interface RichTextEditProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function RichTextEdit({ value, onChange, className, placeholder }: RichTextEditProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      editorRef.current &&
      document.activeElement !== editorRef.current &&
      editorRef.current.innerHTML !== value
    ) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.innerHTML)}
      data-placeholder={placeholder}
      className={className}
    />
  );
}
